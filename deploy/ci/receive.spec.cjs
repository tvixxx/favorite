const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  receive,
  submit,
  readRequest,
  deploymentFailureReason,
} = require("./receive.cjs");
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
      if (args[0] === "builder" && args[1] === "prune") {
        if (state.fail === "prune")
          throw new Error("daemon failed " + request.token);
        if (state.freeAfterPrune !== undefined)
          state.free = state.freeAfterPrune;
      }
      if (args.includes("pull") && state.freeAfterPull !== undefined)
        state.free = state.freeAfterPull;
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
  const expectedImages = {
    backend:
      "ghcr.io/tvixxx/favkino-private-backend@" + f.request.images.backend,
    migrate:
      "ghcr.io/tvixxx/favkino-private-migrate@" + f.request.images.migrate,
    web: "ghcr.io/tvixxx/favkino-private-web@" + f.request.images.web,
  };
  assert.deepEqual(
    pulls.map((call) => call.at(-1)),
    Object.values(expectedImages),
  );
  const imageConfig = f.writes.find((write) =>
    write.file.endsWith("ci-images.json.tmp"),
  );
  assert.deepEqual(
    JSON.parse(imageConfig.value).services,
    Object.fromEntries(
      Object.entries(expectedImages).map(([service, image]) => [
        service,
        { image },
      ]),
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

test("недостаток места устраняется одной очисткой неиспользуемого кэша до скачивания образов", () => {
  const f = setup({
    free: 8n * 1024n ** 3n - 1n,
    freeAfterPrune: 20n * 1024n ** 3n,
  });
  receive(f.request, f.execute, f.files);
  const cleanup = f.calls.filter((call) => call.includes("prune"));
  assert.deepEqual(cleanup, [
    ["docker", "builder", "prune", "--all", "--force"],
  ]);
  assert.ok(
    f.calls.findIndex((call) => call.includes("prune")) <
      f.calls.findIndex((call) => call.includes("pull")),
  );
  assert.ok(f.writes.some((write) => write.file.includes("ci-last-success")));
});

test("нехватка места после очистки сохраняет порог и останавливает деплой до скачивания и миграций", () => {
  const f = setup({ free: 8553811968n });
  assert.throws(
    () => receive(f.request, f.execute, f.files),
    /DEPLOY_NEEDS_8_GIB_FREE available_bytes=8553811968 required_bytes=8589934592/,
  );
  assert.equal(f.calls.filter((call) => call.includes("prune")).length, 1);
  assert.ok(
    !f.calls.some(
      (call) =>
        call.includes("pull") ||
        call.includes("merge") ||
        call[0] === "/bin/bash",
    ),
  );
  assert.equal(f.writes.length, 0);
});

test("грязный checkout и устаревший выпуск не запускают очистку даже при нехватке места", () => {
  const dirty = setup({ free: 1n, dirty: "?? deploy/.env.before-update" });
  assert.throws(
    () => receive(dirty.request, dirty.execute, dirty.files),
    /DEPLOY_CHECKOUT_NOT_CLEAN_MAIN/,
  );
  const superseded = setup({ free: 1n, remote: "e".repeat(40) });
  receive(superseded.request, superseded.execute, superseded.files);
  for (const f of [dirty, superseded]) {
    assert.ok(!f.calls.some((call) => call[0] === "docker"));
    assert.equal(f.writes.length, 0);
  }
});

test("после скачивания тоже проверяется запас для точки восстановления", () => {
  const f = setup({ freeAfterPull: 1n, freeAfterPrune: 20n * 1024n ** 3n });
  receive(f.request, f.execute, f.files);
  assert.equal(f.calls.filter((call) => call.includes("prune")).length, 1);
  assert.ok(
    f.calls.findIndex((call) => call.includes("prune")) <
      f.calls.findIndex((call) => call[0] === "/bin/bash"),
  );
});

test("очистка не повторяется при новой нехватке места после скачивания", () => {
  const f = setup({
    free: 1n,
    freeAfterPrune: 8n * 1024n ** 3n,
    freeAfterPull: 1n,
  });
  assert.throws(
    () => receive(f.request, f.execute, f.files),
    /DEPLOY_NOT_ENOUGH_SPACE_FOR_RESTORE_POINT available_bytes=1 required_bytes=/,
  );
  assert.equal(f.calls.filter((call) => call.includes("prune")).length, 1);
  assert.ok(
    !f.calls.some((call) => call[0] === "/bin/bash" || call.includes("merge")),
  );
});

test("ошибка очистки останавливает деплой и не раскрывает вывод Docker с токеном", () => {
  const f = setup({ free: 1n, fail: "prune" });
  assert.throws(
    () => receive(f.request, f.execute, f.files),
    (error) => error.message === "DEPLOY_BUILD_CACHE_CLEANUP_FAILED",
  );
  assert.ok(
    !f.calls.some((call) => call.includes("pull") || call[0] === "/bin/bash"),
  );
});

test("в диагностике доступны только известные причины и числовые значения", () => {
  for (const message of [
    "DEPLOY_CHECKOUT_NOT_CLEAN_MAIN",
    "DEPLOY_BUILD_CACHE_CLEANUP_FAILED",
    "DEPLOY_NEEDS_8_GIB_FREE available_bytes=1 required_bytes=8589934592",
    "DEPLOY_NOT_ENOUGH_SPACE_FOR_RESTORE_POINT available_bytes=1 required_bytes=9",
  ])
    assert.equal(deploymentFailureReason(new Error(message)), message);
  for (const error of [
    new Error("registry denied test-token-never-a-real-secret"),
    new Error("DEPLOY_CHECKOUT_NOT_CLEAN_MAIN\nsecret"),
    new Error("DEPLOY_UNKNOWN_SECRET"),
    null,
  ])
    assert.equal(
      deploymentFailureReason(error),
      "inspect favkino-deploy.service journal",
    );
});

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
  const journal = calls.find((call) => call[0] === "/usr/bin/journalctl");
  assert.ok(journal);
  assert.match(
    journal[journal.indexOf("--since") + 1],
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/,
  );
  assert.ok(!journal.includes("-n"));
  assert.ok(journal.includes("--output=short-iso"));
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
