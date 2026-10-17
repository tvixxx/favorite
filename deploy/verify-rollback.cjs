// Запускает пользователь. Только одноразовый Compose-проект, без рабочей БД и env.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { createServer } = require("node:net");
const { execFileSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "favourite-rollback-"));
const deploy = path.join(root, "deploy");
const token = randomBytes(6).toString("hex");
const project = `favourite-rollback-${token}`;
const images = ["backend-old", "backend-new", "web-old", "web-new"].map(
  (name) => `favourite-rollback-qa-${name}:${token}`,
);
const env = {
  ...process.env,
  POSTGRES_USER: "qa",
  POSTGRES_DB: "qa",
  BACKUP_DIR: path.join(root, "backups"),
  NGINX_CONFIG: path.join(deploy, "nginx.conf"),
  PG_USER: "qa",
  PG_DB: "qa",
  S3_URI: "",
  GPG_RECIPIENT: "",
  HEALTHCHECK_URL: "",
  COMPOSE_FILE: path.join(deploy, "docker-compose.yml"),
  COMPOSE_PROJECT_NAME: project,
  COMPOSE_PROFILES: "",
  COMPOSE_ENV_FILES: "/dev/null",
  GIT_DIR: execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
    cwd: __dirname,
    encoding: "utf8",
  }).trim(),
  GIT_WORK_TREE: path.dirname(__dirname),
};
const run = (command, args, options = {}) =>
  String(
    execFileSync(command, args, {
      cwd: deploy,
      env,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      ...options,
    }) ?? "",
  ).trim();
const compose = (...args) => run("docker", ["compose", ...args]);
const release = (...args) =>
  run("node", [path.join(deploy, "release.cjs"), ...args]);
const sql = (query) =>
  run("docker", [
    "exec",
    env.PG_CONTAINER,
    "psql",
    "-U",
    "qa",
    "-d",
    "qa",
    "-v",
    "ON_ERROR_STOP=1",
    "-tAc",
    query,
  ]);
let pointId;
let started = false;

async function main() {
  fs.mkdirSync(deploy);
  for (const script of ["deploy.sh", "rollback.sh"]) {
    run("bash", ["-n", path.join(__dirname, script)]);
  }
  fs.mkdirSync(path.join(root, "backend/scripts/backup"), { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, "release.cjs"),
    path.join(deploy, "release.cjs"),
  );
  fs.copyFileSync(
    path.join(__dirname, "../backend/scripts/backup/db-restore.cjs"),
    path.join(root, "backend/scripts/backup/db-restore.cjs"),
  );
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  async function version(expected) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${origin}/`, {
          signal: AbortSignal.timeout(1000),
        });
        if ((await response.text()).trim() === expected) return;
      } catch {
        /* nginx ещё запускается */
      }
      await delay(100);
    }
    throw new Error(`Веб не вернулся к версии ${expected}`);
  }
  const context = path.join(root, "images");
  fs.mkdirSync(context);
  fs.writeFileSync(
    path.join(context, "server.cjs"),
    `require('node:http').createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'ok',version:process.env.VERSION}));}).listen(3005,'0.0.0.0');`,
  );
  fs.writeFileSync(
    path.join(context, "backend.Dockerfile"),
    'FROM node:22-alpine\nWORKDIR /app\nCOPY server.cjs .\nARG VERSION\nENV VERSION=$VERSION\nCMD ["node","server.cjs"]\n',
  );
  fs.writeFileSync(
    path.join(context, "web.Dockerfile"),
    'FROM nginx:1.27-alpine\nARG VERSION\nRUN printf "%s" "$VERSION" > /usr/share/nginx/html/index.html\n',
  );
  fs.writeFileSync(
    env.NGINX_CONFIG,
    "server { listen 80; location /api/ { proxy_pass http://backend:3005/; } location / { root /usr/share/nginx/html; } }",
  );
  const config = {
    name: project,
    services: {
      postgres: {
        image: "postgres:18-alpine",
        platform: "linux/amd64",
        environment: {
          POSTGRES_USER: "qa",
          POSTGRES_DB: "qa",
          POSTGRES_PASSWORD: "qa-local-only",
        },
        healthcheck: {
          test: ["CMD", "pg_isready", "-U", "qa", "-d", "qa"],
          interval: "1s",
          timeout: "3s",
          retries: 30,
        },
      },
      backend: {
        image: images[0],
        platform: "linux/amd64",
        depends_on: { postgres: { condition: "service_healthy" } },
        healthcheck: {
          test: [
            "CMD",
            "node",
            "-e",
            "fetch('http://127.0.0.1:3005/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
          ],
          interval: "1s",
          timeout: "3s",
          retries: 30,
        },
      },
      web: {
        image: images[2],
        platform: "linux/amd64",
        depends_on: { backend: { condition: "service_healthy" } },
        ports: [`127.0.0.1:${port}:80`],
        volumes: ["${NGINX_CONFIG}:/etc/nginx/conf.d/default.conf:ro"],
      },
    },
  };
  fs.writeFileSync(
    path.join(deploy, "docker-compose.yml"),
    JSON.stringify(config),
  );
  fs.writeFileSync(
    path.join(deploy, "new.json"),
    JSON.stringify({
      services: { backend: { image: images[1] }, web: { image: images[3] } },
    }),
  );
  console.log(
    "1/4: небольшие образы двух версий, зависимости приложения не устанавливаются",
  );
  for (let index = 0; index < images.length; index++) {
    run(
      "docker",
      [
        "build",
        "--platform",
        "linux/amd64",
        "-f",
        path.join(context, index < 2 ? "backend.Dockerfile" : "web.Dockerfile"),
        "--build-arg",
        `VERSION=${index % 2 ? "new" : "old"}`,
        "-t",
        images[index],
        context,
      ],
      { stdio: "inherit" },
    );
  }
  started = true;
  compose("up", "-d", "--wait", "--wait-timeout", "90");
  env.PG_CONTAINER = compose("ps", "-q", "postgres");
  await version("old");
  sql(
    "CREATE TABLE _prisma_migrations (migration_name TEXT, finished_at TIMESTAMP, rolled_back_at TIMESTAMP); INSERT INTO _prisma_migrations VALUES ('initial', NOW(), NULL); CREATE TABLE counter (value INT PRIMARY KEY); INSERT INTO counter VALUES (1)",
  );
  pointId = release("snapshot");
  const pointDir = path.join(env.BACKUP_DIR, "releases", pointId);
  run(
    "node",
    [path.join(__dirname, "../backend/scripts/backup/db-backup.cjs")],
    {
      env: { ...env, BACKUP_DIR: path.join(pointDir, "database") },
      stdio: "inherit",
    },
  );
  release("complete", pointId);
  // Только QA-точка использует свободный локальный порт вместо production 80/443.
  const pointFile = path.join(pointDir, "point.json");
  const point = JSON.parse(fs.readFileSync(pointFile, "utf8"));
  point.origin = origin;
  fs.writeFileSync(pointFile, JSON.stringify(point));
  const newVersion = () =>
    compose(
      "-f",
      "docker-compose.yml",
      "-f",
      "new.json",
      "up",
      "-d",
      "--no-build",
      "--no-deps",
      "--wait",
      "--wait-timeout",
      "90",
      "backend",
      "web",
    );
  console.log("2/4: откат образов сохраняет новые данные");
  newVersion();
  await version("new");
  sql("UPDATE counter SET value = 2");
  release("app", pointId);
  await version("new");
  release("app", pointId, "--yes");
  await version("old");
  assert.equal(sql("SELECT value FROM counter"), "2");
  console.log(
    "3/4: новые миграции блокируют обычный откат, полное восстановление возвращает БД",
  );
  newVersion();
  await version("new");
  sql(
    "UPDATE counter SET value = 3; INSERT INTO _prisma_migrations VALUES ('next', NOW(), NULL)",
  );
  assert.throws(
    () => release("app", pointId, "--yes"),
    /История миграций отличается/,
  );
  await version("new");
  assert.equal(sql("SELECT value FROM counter"), "3");
  release("database", pointId, "--yes");
  await version("old");
  assert.equal(sql("SELECT value FROM counter"), "1");
  assert.equal(sql("SELECT count(*) FROM _prisma_migrations"), "1");
  console.log(
    "4/4: ожидаемая ошибка restore сохраняет текущую БД и запускает прежние контейнеры",
  );
  newVersion();
  await version("new");
  sql(
    "UPDATE counter SET value = 4; CREATE TABLE counter_guard (value INT REFERENCES counter(value))",
  );
  assert.throws(() => release("database", pointId, "--yes"), /Command failed/);
  await version("new");
  assert.equal(sql("SELECT value FROM counter"), "4");
}

main()
  .then(() => {
    console.log("Проверки отката прошли, удаляю только созданный QA-проект");
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      if (started) compose("down", "--volumes", "--remove-orphans");
      if (pointId)
        run("docker", [
          "image",
          "rm",
          `favorite-rollback-backend:${pointId}`,
          `favorite-rollback-web:${pointId}`,
        ]);
      for (const image of images) {
        try {
          run("docker", ["image", "rm", image]);
        } catch {
          /* образ мог не успеть собраться */
        }
      }
      fs.rmSync(root, { recursive: true, force: true });
      if (!process.exitCode) console.log("FAVOURITE_ROLLBACK_CHECK_OK");
    } catch (error) {
      console.error(`QA cleanup не завершён: ${error.message}. Файлы: ${root}`);
      process.exitCode = 1;
    }
  });
