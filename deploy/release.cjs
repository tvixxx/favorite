const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { execFileSync } = require("node:child_process");

const deploy = __dirname;
const root = path.join(
  process.env.BACKUP_DIR || "/srv/favorite/backups",
  "releases",
);
const pattern = /^\d{8}T\d{6}Z-[a-f0-9]{8}$/;
const [action = "list", id, ...flags] = process.argv.slice(2);
const confirmed = flags.includes("--yes");
const run = (command, args, options = {}) =>
  String(
    execFileSync(command, args, {
      cwd: deploy,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      ...options,
    }) ?? "",
  ).trim();
const docker = (...args) => run("docker", args);
const write = (file, value) => {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  });
  fs.renameSync(`${file}.tmp`, file);
};
const container = (service) => {
  const value = docker("compose", "ps", "-aq", service);
  if (!value || value.includes("\n"))
    throw new Error(
      `Нужен один существующий контейнер ${service}. Для первого запуска используйте bootstrap.sh`,
    );
  return value;
};
const migrations = () =>
  docker(
    "exec",
    process.env.PG_CONTAINER || "favorite-postgres",
    "psql",
    "-U",
    process.env.POSTGRES_USER,
    "-d",
    process.env.POSTGRES_DB,
    "-tAc",
    "SELECT migration_name || CASE WHEN finished_at IS NULL THEN ':unfinished' ELSE '' END FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY migration_name",
  )
    .split("\n")
    .filter(Boolean);

function loadPoint() {
  if (!pattern.test(id || ""))
    throw new Error("Укажите идентификатор из rollback.sh list");
  const dir = path.join(root, id);
  const point = JSON.parse(
    fs.readFileSync(path.join(dir, "point.json"), "utf8"),
  );
  if (point.id !== id) throw new Error("Идентификатор точки повреждён");
  return { dir, point };
}

function snapshot() {
  const images = {};
  for (const service of ["backend", "web"]) {
    images[service] = docker(
      "inspect",
      "--format",
      "{{.Image}}",
      container(service),
    );
    if (!/^sha256:[a-f0-9]{64}$/.test(images[service]))
      throw new Error(`Не удалось определить образ ${service}`);
  }
  const pointId = `${new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")}-${randomBytes(4).toString("hex")}`;
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const dir = path.join(root, pointId);
  fs.mkdirSync(dir, { mode: 0o700 });
  fs.copyFileSync(
    path.join(deploy, "docker-compose.yml"),
    path.join(dir, "compose.yml"),
  );
  fs.copyFileSync(process.env.NGINX_CONFIG, path.join(dir, "nginx.conf"));
  fs.copyFileSync(
    path.join(deploy, "../backend/scripts/backup/db-restore.cjs"),
    path.join(dir, "db-restore.cjs"),
  );
  const references = {};
  for (const service of ["backend", "web"]) {
    references[service] = `favorite-rollback-${service}:${pointId}`;
    docker("image", "tag", images[service], references[service]);
  }
  docker(
    "image",
    "save",
    "--output",
    path.join(dir, "images.tar"),
    ...Object.values(references),
  );
  write(path.join(dir, "images.json"), {
    services: {
      backend: { image: references.backend },
      web: { image: references.web },
    },
  });
  write(path.join(dir, "point.json"), {
    id: pointId,
    createdAt: new Date().toISOString(),
    origin: /^\s*ssl_certificate\s/m.test(
      fs.readFileSync(path.join(dir, "nginx.conf"), "utf8"),
    )
      ? `https://${process.env.DOMAIN}`
      : "http://127.0.0.1",
    checkoutBefore: run("git", ["rev-parse", "HEAD"]),
    images,
    ready: false,
  });
  console.log(pointId);
}

function complete() {
  const { dir, point } = loadPoint();
  if (point.ready) throw new Error("Точка уже завершена");
  const files = fs
    .readdirSync(path.join(dir, "database"))
    .filter((file) => /\.dump(?:\.gpg)?$/.test(file));
  if (
    files.length !== 1 ||
    fs.statSync(path.join(dir, "database", files[0])).size < 1024
  ) {
    throw new Error("В точке должен быть один успешно созданный дамп");
  }
  point.dump = files[0];
  point.migrations = migrations();
  if (point.migrations.some((name) => name.endsWith(":unfinished"))) {
    throw new Error(
      "В базе есть незавершённая миграция. Новое обновление запрещено",
    );
  }
  point.checkoutTarget = run("git", ["rev-parse", "HEAD"]);
  point.ready = true;
  write(path.join(dir, "point.json"), point);
  console.log(`RESTORE_POINT_READY ${id}`);
}

function restore() {
  const { dir, point } = loadPoint();
  if (
    !point.ready ||
    !Array.isArray(point.migrations) ||
    path.basename(point.dump || "") !== point.dump
  ) {
    throw new Error("Точка не завершена или повреждена. Откат запрещён");
  }
  for (const file of [
    "images.tar",
    "compose.yml",
    "images.json",
    "nginx.conf",
    "db-restore.cjs",
  ]) {
    if (!fs.statSync(path.join(dir, file)).isFile())
      throw new Error(`Нет файла ${file}`);
  }
  console.log(
    `Точка: ${id}, создана: ${point.createdAt}, checkout до обновления: ${point.checkoutBefore}`,
  );
  console.log(
    action === "database"
      ? "Будут остановлены backend/web, создан страховочный дамп, восстановлены БД и прежние образы. Все изменения БД после точки будут потеряны."
      : "Будут возвращены прежние образы backend/web. Текущие данные БД сохраняются.",
  );
  if (!confirmed) {
    console.log("Только план. Для выполнения добавьте --yes");
    return;
  }
  if (action === "app") {
    const currentMigrations = migrations();
    if (currentMigrations.some((name) => name.endsWith(":unfinished"))) {
      throw new Error(
        "Есть незавершённая миграция. Сначала разберите её ошибку или выберите database",
      );
    }
    if (
      !flags.includes("--schema-compatible") &&
      JSON.stringify(currentMigrations) !== JSON.stringify(point.migrations)
    ) {
      throw new Error(
        "История миграций отличается. Сначала проверьте совместимость и добавьте --schema-compatible либо выберите восстановление database",
      );
    }
  }
  let dump = path.join(dir, "database", point.dump);
  const dumpIndex = flags.indexOf("--dump");
  if (dumpIndex !== -1) dump = path.resolve(flags[dumpIndex + 1]);
  if (
    action === "database" &&
    (dump.endsWith(".gpg") || !fs.statSync(dump).isFile())
  ) {
    throw new Error(
      "Нужен расшифрованный дамп. Расшифруйте его на доверенном компьютере и передайте --dump /путь/к/файлу.dump",
    );
  }
  docker("image", "load", "--input", path.join(dir, "images.tar"));
  for (const service of ["backend", "web"]) {
    const restored = docker(
      "image",
      "inspect",
      "--format",
      "{{.Id}}",
      `favorite-rollback-${service}:${id}`,
    );
    if (restored !== point.images[service])
      throw new Error(`Архив не содержит ожидаемый образ ${service}`);
  }
  if (action === "database") {
    const current = ["backend", "web"].map(container);
    try {
      docker("stop", ...current);
      run(
        "node",
        [
          path.join(dir, "db-restore.cjs"),
          dump,
          "--into",
          process.env.POSTGRES_DB,
          "--yes",
        ],
        {
          stdio: "inherit",
          env: {
            ...process.env,
            PG_CONTAINER: process.env.PG_CONTAINER || "favorite-postgres",
            PG_USER: process.env.POSTGRES_USER,
            PG_DB: process.env.POSTGRES_DB,
            BACKUP_DIR: path.join(root, "safety"),
          },
        },
      );
    } catch (error) {
      docker("start", ...current);
      throw error;
    }
  }
  const compose = (...args) =>
    run(
      "docker",
      [
        "compose",
        "--project-directory",
        deploy,
        "-f",
        path.join(dir, "compose.yml"),
        "-f",
        path.join(dir, "images.json"),
        ...args,
      ],
      {
        env: { ...process.env, NGINX_CONFIG: path.join(dir, "nginx.conf") },
        stdio: "inherit",
      },
    );
  compose(
    "up",
    "-d",
    "--no-build",
    "--no-deps",
    "--pull",
    "never",
    "--wait",
    "--wait-timeout",
    "120",
    "backend",
  );
  compose(
    "up",
    "-d",
    "--no-build",
    "--no-deps",
    "--pull",
    "never",
    "--force-recreate",
    "--wait",
    "--wait-timeout",
    "120",
    "web",
  );
  compose("exec", "-T", "web", "nginx", "-t");
  const health = run("curl", [
    "--fail",
    "--silent",
    "--show-error",
    "--max-time",
    "15",
    "--retry",
    "10",
    "--retry-delay",
    "1",
    "--retry-connrefused",
    `${point.origin}/api/health`,
  ]);
  if (JSON.parse(health).status !== "ok")
    throw new Error("После отката API не готов");
  run("curl", [
    "--fail",
    "--silent",
    "--show-error",
    "--max-time",
    "15",
    `${point.origin}/`,
    "-o",
    "/dev/null",
  ]);
  console.log(`FAVOURITE_ROLLBACK_OK ${id}`);
}

try {
  const allowed =
    action === "database"
      ? ["--yes", "--dump"]
      : ["--yes", "--schema-compatible"];
  for (let index = 0; index < flags.length; index++) {
    if (!allowed.includes(flags[index]))
      throw new Error(`Неизвестный параметр: ${flags[index]}`);
    if (
      flags[index] === "--dump" &&
      (!flags[++index] || flags[index].startsWith("--"))
    )
      throw new Error("После --dump нужен путь");
  }
  if (action === "snapshot") snapshot();
  else if (action === "complete") complete();
  else if (action === "app" || action === "database") restore();
  else if (action === "list") {
    for (const entry of fs.existsSync(root)
      ? fs
          .readdirSync(root)
          .filter((name) => pattern.test(name))
          .sort()
          .reverse()
      : []) {
      try {
        const point = JSON.parse(
          fs.readFileSync(path.join(root, entry, "point.json"), "utf8"),
        );
        console.log(
          `${entry} ${point.ready ? "READY" : "INCOMPLETE"} ${point.checkoutBefore}`,
        );
      } catch {
        console.log(`${entry} INCOMPLETE (нет корректного point.json)`);
      }
    }
  } else
    throw new Error(
      "Использование: rollback.sh list | app ID [--yes] | database ID [--yes]",
    );
} catch (error) {
  console.error("RESTORE_POINT_FAILED:", error.message);
  process.exitCode = 1;
}
