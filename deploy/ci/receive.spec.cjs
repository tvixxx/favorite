const { test } = require("node:test");
const assert = require("node:assert/strict");
const { receive, submit, readRequest } = require("./receive.cjs");
const { Readable, PassThrough } = require("node:stream");

function setup(overrides = {}) {
  const sha = "a".repeat(40);
  const request = {
    sha,
    actor: "tvixxx",
    token: "test-token-never-a-real-secret",
    images: {
      backend: "sha256:" + "b".repeat(64),
      migrate: "sha256:" + "c".repeat(64),
      web: "sha256:" + "d".repeat(64),
    },
  };
  const calls = [];
  const writes = [];
  const state = {
    free: 20n * 1024n ** 3n,
    remote: sha,
    dirty: "",
    arch: "linux/amd64",
    fail: "",
    fetches: 0,
    ...overrides,
  };
  const files = {
    statfsSync: () => ({ bavail: state.free, bsize: 1n }),
    mkdtempSync: () => "/run/favkino-deploy.test",
    chmodSync() {},
    mkdirSync() {},
    writeFileSync: (file, value, options) =>
      writes.push({ file, value, options }),
    renameSync() {},
    rmSync: (file) => calls.push(["cleanup", file]),
  };
  const execute = (command, args, options) => {
    calls.push([command, ...args]);
    assert.ok(
      !args.some((arg) => String(arg).includes(request.token)),
      "Токен не передаётся в аргументах",
    );
    if (command === "runuser") {
      if (args.includes("get-url"))
        return "https://github.com/tvixxx/favorite.git";
      if (args.includes("symbolic-ref")) return "main";
      if (args.includes("status")) return state.dirty;
      if (args.includes("fetch")) {
        state.fetches++;
        if (state.fetches === 2 && state.newerDuringPull)
          state.remote = "e".repeat(40);
      }
      if (args.includes("rev-parse")) return state.remote;
    }
    if (command === "docker") {
      if (args.includes("login")) {
        assert.equal(options.input, request.token + "\n");
        if (state.fail === "login")
          throw new Error("registry denied " + request.token);
      }
      if (args.includes("pull") && state.fail === "pull")
        throw new Error("pull failed");
      if (args.includes("image") && args.includes("inspect")) {
        if (args.includes("{{.Size}}")) return "1000000000";
        return state.arch + " " + sha;
      }
      if (args[0] === "inspect") return "sha256:" + "f".repeat(64);
    }
    if (command === "/bin/bash" && args.includes("-c"))
      return "20261020T100000Z-01234567";
    if (
      command === "/bin/bash" &&
      !args.includes("-c") &&
      state.fail === "apply"
    )
      throw new Error("migration failed");
    return "";
  };
  return { request, calls, writes, state, execute, files };
}

test("успех скачивает только digest, проверяет образы и готовит точку до изменения checkout", () => {
  const f = setup();
  receive(f.request, f.execute, f.files);
  const pulls = f.calls.filter((call) => call.includes("pull"));
  assert.equal(pulls.length, 3);
  assert.ok(
    pulls.every(
      (call) =>
        call.at(-1).startsWith("ghcr.io/tvixxx/favorite-") &&
        call.at(-1).includes("@sha256:"),
    ),
  );
  const snapshot = f.calls.findIndex(
    (call) => call[0] === "/bin/bash" && call.includes("-c"),
  );
  const merge = f.calls.findIndex((call) => call.includes("merge"));
  const apply = f.calls.findIndex(
    (call) => call[0] === "/bin/bash" && !call.includes("-c"),
  );
  assert.ok(
    snapshot > f.calls.map((call) => call.includes("pull")).lastIndexOf(true),
  );
  assert.ok(snapshot < merge && merge < apply);
  assert.ok(
    f.writes.some(
      (write) =>
        write.file.endsWith("ci-images.json.tmp") &&
        write.options.mode === 0o600,
    ),
  );
  assert.ok(
    f.writes.every((write) => !String(write.value).includes(f.request.token)),
  );
  assert.ok(f.calls.some((call) => call[0] === "cleanup"));
});

for (const mutate of [
  (r) => {
    r.sha = "../main";
  },
  (r) => {
    r.images.backend = "ghcr.io/attacker/image:latest";
  },
  (r) => {
    r.actor = "--config";
  },
  (r) => {
    r.token = "line1\nline2";
  },
  (r) => {
    r.images.extra = "sha256:" + "a".repeat(64);
  },
]) {
  test("неверный запрос отклоняется до команд и записи файлов", () => {
    const f = setup();
    mutate(f.request);
    assert.throws(() => receive(f.request, f.execute, f.files), /Invalid/);
    assert.equal(f.calls.length, 0);
    assert.equal(f.writes.length, 0);
  });
}

for (const condition of [
  { remote: "e".repeat(40) },
  { newerDuringPull: true },
]) {
  test("устаревший коммит не меняет checkout и не запускает миграции", () => {
    const f = setup(condition);
    receive(f.request, f.execute, f.files);
    assert.ok(
      !f.calls.some(
        (call) => call.includes("merge") || call[0] === "/bin/bash",
      ),
    );
    assert.equal(f.writes.length, 0);
  });
}

for (const condition of [
  { free: 1n },
  { dirty: " M deploy/docker-compose.yml" },
  { arch: "linux/arm64" },
  { fail: "pull" },
]) {
  test("небезопасное состояние останавливает деплой до снимка и миграций", () => {
    const f = setup(condition);
    assert.throws(() => receive(f.request, f.execute, f.files));
    assert.ok(
      !f.calls.some(
        (call) => call.includes("merge") || call[0] === "/bin/bash",
      ),
    );
    assert.ok(
      !f.writes.some((write) => write.file.includes("ci-last-success")),
    );
  });
}

test("ошибка миграции не отмечает релиз успешным и не запускает восстановление БД", () => {
  const f = setup({ fail: "apply" });
  assert.throws(
    () => receive(f.request, f.execute, f.files),
    /migration failed/,
  );
  assert.ok(!f.writes.some((write) => write.file.includes("ci-last-success")));
  assert.ok(
    !f.calls.some(
      (call) => call.includes("database") || call.includes("prune"),
    ),
  );
  assert.ok(f.calls.some((call) => call[0] === "cleanup"));
});

test("ошибка входа скрывает токен и удаляет временную конфигурацию", () => {
  const f = setup({ fail: "login" });
  assert.throws(
    () => receive(f.request, f.execute, f.files),
    (error) => !error.message.includes(f.request.token),
  );
  assert.ok(f.calls.some((call) => call[0] === "cleanup"));
  assert.ok(!f.calls.some((call) => call[0] === "/bin/bash"));
});

for (const active of ["active", "activating", "deactivating"]) {
  test(
    "повторный запрос не перезаписывает задание при состоянии " + active,
    () => {
      const f = setup();
      assert.throws(
        () => submit(f.request, () => active, f.files),
        /DEPLOY_ALREADY_RUNNING/,
      );
      assert.equal(f.writes.length, 0);
    },
  );
}

test("закрытое эксклюзивное задание создаётся до запуска systemd, токен отсутствует в командах", () => {
  const f = setup();
  const calls = [];
  submit(
    f.request,
    (command, args) => {
      calls.push([command, ...args]);
      assert.ok(args.every((arg) => !arg.includes(f.request.token)));
      if (args.includes("show")) return "inactive";
      if (args.includes("start")) {
        assert.equal(f.writes.length, 1);
        assert.equal(f.writes[0].options.mode, 0o600);
        assert.equal(f.writes[0].options.flag, "wx");
        assert.deepEqual(JSON.parse(f.writes[0].value), f.request);
      }
    },
    f.files,
  );
  assert.ok(calls.some((call) => call[0] === "/usr/bin/journalctl"));
});

test("оставшееся задание не перезаписывается и не запускает новый деплой", () => {
  const f = setup();
  let started = false;
  f.files.writeFileSync = () => {
    throw new Error("EEXIST");
  };
  assert.throws(
    () =>
      submit(
        f.request,
        (command, args) => {
          if (args.includes("start")) started = true;
          return "inactive";
        },
        f.files,
      ),
    /EEXIST/,
  );
  assert.equal(started, false);
});

test("поток принимает целый JSON и отклоняет запрос больше лимита", async () => {
  const f = setup();
  assert.deepEqual(
    await readRequest(Readable.from([JSON.stringify(f.request)])),
    f.request,
  );
  await assert.rejects(
    readRequest(Readable.from(["x".repeat(16385)])),
    /Invalid deploy request size/,
  );
});

test("незавершённый поток освобождает обработчик по таймауту", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stream = new PassThrough();
  const pending = readRequest(stream);
  t.mock.timers.tick(30000);
  await assert.rejects(pending, /Invalid deploy request timeout/);
});
