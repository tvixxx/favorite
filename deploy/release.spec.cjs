const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

function setup(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "favourite-release-test-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const deploy = path.join(root, "deploy");
  fs.mkdirSync(deploy);
  fs.mkdirSync(path.join(root, "backend/scripts/backup"), { recursive: true });
  fs.writeFileSync(
    path.join(deploy, "docker-compose.yml"),
    "name: favorite\nservices: {}",
  );
  fs.writeFileSync(path.join(deploy, "nginx.conf"), "server {}");
  fs.writeFileSync(
    path.join(root, "backend/scripts/backup/db-restore.cjs"),
    "// saved restore tool",
  );
  const calls = [];
  const images = {
    backend: `sha256:${"a".repeat(64)}`,
    web: `sha256:${"b".repeat(64)}`,
  };
  const state = {
    migrations: ["initial"],
    database: 1,
    restoreFails: false,
    running: true,
  };
  const execute = (...args) => {
    let exitCode = 0;
    const output = [];
    const context = {
      __dirname: deploy,
      Buffer,
      console: {
        log: (...values) => output.push(values.join(" ")),
        error: (...values) => output.push(values.join(" ")),
      },
      process: {
        argv: ["node", "release.cjs", ...args],
        env: {
          BACKUP_DIR: path.join(root, "backups"),
          PG_CONTAINER: "postgres",
          POSTGRES_USER: "qa",
          POSTGRES_DB: "qa",
          NGINX_CONFIG: path.join(deploy, "nginx.conf"),
        },
        get exitCode() {
          return exitCode;
        },
        set exitCode(value) {
          exitCode = value;
        },
      },
      require: (name) => {
        if (name !== "node:child_process") return require(name);
        return {
          execFileSync: (command, argv) => {
            calls.push([command, ...argv]);
            if (command === "git") return "c".repeat(40);
            if (command === "curl") return '{"status":"ok"}';
            if (command === "node") {
              if (state.restoreFails) throw new Error("restore failed");
              state.database = 1;
              state.migrations = ["initial"];
            }
            if (command === "docker") {
              if (argv.includes("ps")) return `container-${argv.at(-1)}`;
              if (argv[0] === "inspect")
                return images[argv.at(-1).replace("container-", "")];
              if (argv[0] === "image" && argv[1] === "inspect")
                return images[
                  argv.at(-1).includes("-backend:") ? "backend" : "web"
                ];
              if (argv[0] === "exec") return state.migrations.join("\n");
              if (argv.includes("save"))
                fs.writeFileSync(argv[argv.indexOf("--output") + 1], "archive");
              if (argv[0] === "stop") state.running = false;
              if (argv[0] === "start" || argv.includes("up"))
                state.running = true;
            }
            return "";
          },
        };
      },
    };
    vm.runInNewContext(
      fs.readFileSync(path.join(__dirname, "release.cjs"), "utf8"),
      context,
    );
    return { code: exitCode, output: output.join("\n") };
  };
  const snapshot = () => {
    const result = execute("snapshot");
    assert.equal(result.code, 0, result.output);
    return result.output.trim();
  };
  const complete = (id) => {
    const dir = path.join(root, "backups/releases", id, "database");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "qa.dump"), Buffer.alloc(2048));
    const result = execute("complete", id);
    assert.equal(result.code, 0, result.output);
  };
  return { root, execute, snapshot, complete, calls, state };
}

test("точка содержит архив прежних образов и конфигурацию, без приватного env", (t) => {
  const { root, snapshot } = setup(t);
  const id = snapshot();
  const dir = path.join(root, "backups/releases", id);
  assert.ok(fs.existsSync(path.join(dir, "images.tar")));
  assert.ok(fs.existsSync(path.join(dir, "compose.yml")));
  assert.ok(fs.existsSync(path.join(dir, "nginx.conf")));
  assert.equal(fs.existsSync(path.join(dir, ".env")), false);
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
});

test("незавершённая точка не разрешает откат", (t) => {
  const { execute, snapshot, calls } = setup(t);
  const id = snapshot();
  calls.length = 0;
  assert.equal(execute("app", id, "--yes").code, 1);
  assert.equal(calls.length, 0);
});

test("без подтверждения откат только показывает план", (t) => {
  const { execute, snapshot, complete, calls, state } = setup(t);
  const id = snapshot();
  complete(id);
  calls.length = 0;
  assert.equal(execute("database", id).code, 0);
  assert.equal(calls.length, 0);
  assert.equal(state.database, 1);
});

test("откат приложения сохраняет новые пользовательские данные", (t) => {
  const { execute, snapshot, complete, calls, state } = setup(t);
  const id = snapshot();
  complete(id);
  state.database = 42;
  calls.length = 0;
  assert.equal(execute("app", id, "--yes").code, 0);
  assert.equal(state.database, 42);
  assert.ok(calls.some((call) => call.includes("load")));
  assert.ok(
    calls.some(
      (call) => call.includes("--no-build") && call.includes("--no-deps"),
    ),
  );
  assert.ok(
    !calls.some((call) => call[0] === "node" || call.includes("migrate")),
  );
});

test("новые миграции запрещают обычный откат до проверки совместимости", (t) => {
  const { execute, snapshot, complete, calls, state } = setup(t);
  const id = snapshot();
  complete(id);
  state.migrations.push("new-schema");
  calls.length = 0;
  assert.equal(execute("app", id, "--yes").code, 1);
  assert.ok(
    !calls.some((call) => call.includes("up") || call.includes("load")),
  );
  assert.equal(execute("app", id, "--schema-compatible", "--yes").code, 0);
});

test("полное восстановление возвращает данные и приложение к выбранной точке", (t) => {
  const { execute, snapshot, complete, calls, state } = setup(t);
  const id = snapshot();
  complete(id);
  state.database = 42;
  state.migrations.push("new-schema");
  calls.length = 0;
  assert.equal(execute("database", id, "--yes").code, 0);
  assert.equal(state.database, 1);
  assert.equal(state.running, true);
  assert.ok(
    calls.findIndex((call) => call.includes("stop")) <
      calls.findIndex((call) => call[0] === "node"),
  );
});

test("при ошибке восстановления возвращает прежние контейнеры и сохраняет текущие данные", (t) => {
  const { execute, snapshot, complete, state } = setup(t);
  const id = snapshot();
  complete(id);
  state.database = 42;
  state.restoreFails = true;
  assert.equal(execute("database", id, "--yes").code, 1);
  assert.equal(state.database, 42);
  assert.equal(state.running, true);
});

test("путь вместо идентификатора точки отклоняется до любых действий", (t) => {
  const { execute, calls } = setup(t);
  assert.equal(execute("database", "../other", "--yes").code, 1);
  assert.equal(calls.length, 0);
});

test("оборванная запись не мешает показать остальные точки возврата", (t) => {
  const { root, execute, snapshot, complete } = setup(t);
  const id = snapshot();
  complete(id);
  const incomplete = "20260101T000000Z-00000000";
  fs.mkdirSync(path.join(root, "backups/releases", incomplete));
  const result = execute("list");
  assert.equal(result.code, 0);
  assert.ok(result.output.includes(`${id} READY`));
  assert.ok(result.output.includes(`${incomplete} INCOMPLETE`));
});

test("незавершённую миграцию нельзя обойти подтверждением совместимости", (t) => {
  const { execute, snapshot, complete, calls, state } = setup(t);
  const id = snapshot();
  complete(id);
  state.migrations.push("failed:unfinished");
  calls.length = 0;
  assert.equal(execute("app", id, "--schema-compatible", "--yes").code, 1);
  assert.ok(
    !calls.some((call) => call.includes("up") || call.includes("load")),
  );
});
