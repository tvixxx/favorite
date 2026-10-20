const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { rotateReleases } = require("./rotate-releases.cjs");

const imageId = (n) => "sha256:" + n.toString(16).padStart(64, "0");
const revision = (n) => n.toString(16).padStart(40, "0");
const registry = "ghcr.io/tvixxx/favkino-private-";

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "favkino-rotation-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const releases = path.join(root, "backups/releases");
  const stateDir = path.join(root, "deploy/.state");
  fs.mkdirSync(releases, { recursive: true, mode: 0o700 });
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const write = (file, value) =>
    fs.writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
  const points = [];
  const images = [];
  for (let n = 1; n <= 5; n++) {
    const id = `2026100${n}T120000Z-${n.toString(16).padStart(8, "0")}`;
    points.push(id);
    const dir = path.join(releases, id);
    fs.mkdirSync(path.join(dir, "database"), { recursive: true, mode: 0o700 });
    for (const name of [
      "images.tar",
      "compose.yml",
      "nginx.conf",
      "db-restore.cjs",
    ])
      fs.writeFileSync(path.join(dir, name), "archive", { mode: 0o600 });
    fs.writeFileSync(
      path.join(dir, "database/favorite.dump"),
      Buffer.alloc(2048),
      { mode: 0o600 }
    );
    write(path.join(dir, "point.json"), {
      id,
      ready: true,
      dump: "favorite.dump",
      checkoutTarget: revision(100),
      images: { backend: imageId(n * 2), web: imageId(n * 2 + 1) },
    });
    const services = {};
    for (const [role, number] of [
      ["backend", n * 2],
      ["web", n * 2 + 1],
    ]) {
      services[role] = { image: `favorite-rollback-${role}:${id}` };
      images.push({
        id: imageId(number),
        tags: [registry + role + ":" + revision(n), services[role].image],
        digests: [],
        source: "https://github.com/tvixxx/favorite",
        revision: revision(n),
      });
    }
    write(path.join(dir, "images.json"), { services });
  }
  const state = { sha: revision(100), point: points[4], images: {} };
  const references = new Map();
  for (const [role, n] of [
    ["backend", 100],
    ["migrate", 101],
    ["web", 102],
  ]) {
    const ref = registry + role + "@" + imageId(n);
    state.images[role] = ref;
    references.set(ref, imageId(n));
    images.push({
      id: imageId(n),
      tags: [],
      digests: [ref],
      source: "https://github.com/tvixxx/favorite",
      revision: state.sha,
    });
  }
  images.push(
    {
      id: imageId(200),
      tags: [],
      digests: [registry + "migrate@" + imageId(200)],
      source: "https://github.com/tvixxx/favorite",
      revision: revision(1),
    },
    {
      id: imageId(201),
      tags: ["postgres:18-alpine"],
      digests: [],
      source: null,
      revision: null,
    }
  );
  for (const image of images)
    for (const ref of [...image.tags, ...image.digests])
      references.set(ref, image.id);
  const containers = [
    {
      name: "/favorite-backend",
      image: imageId(100),
      running: true,
      health: "healthy",
    },
    { name: "/favorite-web", image: imageId(102), running: true, health: null },
    {
      name: "/favorite-postgres",
      image: imageId(201),
      running: true,
      health: "healthy",
    },
  ];
  const calls = [];
  let failRemove = false;
  let inspections = 0;
  let addContainer = false;
  const execute = (command, args) => {
    assert.equal(command, "docker");
    calls.push(args);
    if (args[0] === "container" && args[1] === "ls") {
      inspections++;
      if (addContainer && inspections === 2)
        containers.push({
          name: "/new-job",
          image: imageId(2),
          running: false,
          health: null,
        });
      return containers
        .map((_, i) => (i + 1).toString(16).padStart(64, "0"))
        .join("\n");
    }
    if (args[0] === "container" && args[1] === "inspect")
      return containers.map((x) => JSON.stringify(x)).join("\n");
    if (args[0] === "image" && args[1] === "ls")
      return images.map((x) => x.id).join("\n");
    if (args[0] === "image" && args[1] === "inspect") {
      if (args[3] === "{{.Id}}") return references.get(args[4]) || "";
      if (args[3].includes(".Config.Labels"))
        throw new Error('map has no entry for key "Labels"');
      return images.map((x) => JSON.stringify(x)).join("\n");
    }
    if (args[0] === "image" && args[1] === "rm") {
      if (failRemove) throw new Error("image is in use");
      return "";
    }
    throw new Error("Unexpected Docker operation");
  };
  const stateFile = path.join(stateDir, "ci-last-success.json");
  write(stateFile, state);
  fs.writeFileSync(path.join(root, "backups/hourly.dump"), "private data");
  const point = (id) => path.join(releases, id);
  return {
    root,
    releases,
    points,
    images,
    containers,
    calls,
    state,
    stateFile,
    write,
    point,
    references,
    changeInventory: () => {
      addContainer = true;
    },
    failRemove: () => {
      failRemove = true;
    },
    run: (apply = false) => rotateReleases({ root, execute, apply }),
  };
}

test("предпросмотр оставляет три точки, текущие образы и все файлы без изменений", (t) => {
  const f = setup(t);
  const plan = f.run();
  assert.deepEqual(plan.removePoints, f.points.slice(0, 2));
  assert.deepEqual(plan.keepPoints, f.points.slice(2).reverse());
  assert.ok(plan.removeImages.some((x) => x.id === imageId(200)));
  for (const n of [100, 101, 102, 201])
    assert.ok(!plan.removeImages.some((x) => x.id === imageId(n)));
  assert.ok(f.points.every((id) => fs.existsSync(f.point(id))));
  assert.ok(!f.calls.some((args) => args.includes("rm")));
});

test("образ без меток читается и сохраняется без подтверждённого владельца", (t) => {
  const f = setup(t);
  f.images.push({
    id: imageId(202),
    tags: ["favorite-migrate:latest"],
    digests: [],
    source: null,
    revision: null,
  });
  const plan = f.run();
  assert.ok(!plan.removeImages.some((x) => x.id === imageId(202)));
  assert.ok(!f.calls.some((args) => args[1] === "rm"));
});

test("применение удаляет только устаревшие точки и разрешённые образы", (t) => {
  const f = setup(t);
  fs.mkdirSync(path.join(f.releases, "safety"), { mode: 0o700 });
  const plan = f.run(true);
  assert.ok(fs.existsSync(path.join(f.releases, "safety")));
  for (const id of f.points.slice(0, 2))
    assert.equal(fs.existsSync(f.point(id)), false);
  for (const id of f.points.slice(2))
    assert.equal(fs.existsSync(f.point(id)), true);
  assert.equal(
    fs.readFileSync(path.join(f.root, "backups/hourly.dump"), "utf8"),
    "private data"
  );
  const removals = f.calls.filter((args) => args[1] === "rm");
  assert.equal(removals.length, plan.removeImages.length);
  assert.ok(
    removals.every((args) => args[0] === "image" && args.includes("--no-prune"))
  );
  assert.ok(
    !f.calls
      .flat()
      .some((arg) => ["--force", "-f", "prune", "volume", "stop"].includes(arg))
  );
});

test("точка последнего успеха сохраняется дополнительно к трём новейшим", (t) => {
  const f = setup(t);
  f.state.point = f.points[0];
  f.write(f.stateFile, f.state);
  const plan = f.run(true);
  assert.ok(plan.keepPoints.includes(f.points[0]));
  assert.deepEqual(plan.removePoints, [f.points[1]]);
});

test("образ остановленного контейнера и чужая метка исключаются из удаления", (t) => {
  const f = setup(t);
  f.containers.push({
    name: "/other-stopped",
    image: imageId(2),
    running: false,
    health: null,
  });
  f.images.find((x) => x.id === imageId(3)).tags.push("other-project:latest");
  const plan = f.run();
  for (const n of [2, 3])
    assert.ok(!plan.removeImages.some((x) => x.id === imageId(n)));
});

test("незавершённая точка и её образы сохраняются для разбора", (t) => {
  const f = setup(t);
  const file = path.join(f.point(f.points[0]), "point.json");
  const point = JSON.parse(fs.readFileSync(file));
  point.ready = false;
  f.write(file, point);
  const plan = f.run(true);
  assert.ok(!plan.removePoints.includes(point.id));
  assert.ok(fs.existsSync(f.point(point.id)));
  assert.ok(
    !plan.removeImages.some((x) => [imageId(2), imageId(3)].includes(x.id))
  );
});

for (const condition of [
  "corrupt",
  "symlink",
  "unhealthy",
  "wrong-image",
  "missing-state",
  "unknown-file",
  "public-metadata",
]) {
  test("неясное состояние отменяет очистку до удаления: " + condition, (t) => {
    const f = setup(t);
    if (condition === "corrupt")
      fs.writeFileSync(path.join(f.point(f.points[0]), "point.json"), "{}");
    if (condition === "symlink") {
      fs.unlinkSync(path.join(f.point(f.points[0]), "images.tar"));
      fs.symlinkSync(
        path.join(f.root, "backups/hourly.dump"),
        path.join(f.point(f.points[0]), "images.tar")
      );
    }
    if (condition === "unhealthy") f.containers[0].health = "unhealthy";
    if (condition === "wrong-image") f.containers[0].image = imageId(999);
    if (condition === "missing-state") fs.unlinkSync(f.stateFile);
    if (condition === "public-metadata") fs.chmodSync(f.stateFile, 0o644);
    if (condition === "unknown-file")
      fs.writeFileSync(path.join(f.point(f.points[0]), "notes.txt"), "keep");
    assert.throws(() => f.run(true));
    assert.ok(f.points.every((id) => fs.existsSync(f.point(id))));
    assert.ok(!f.calls.some((args) => args[1] === "rm"));
  });
}

for (const change of ["container", "tag"]) {
  test(
    "изменение состояния перед удалением отменяет очистку: " + change,
    (t) => {
      const f = setup(t);
      if (change === "container") f.changeInventory();
      else f.references.set(f.images[0].tags[0], imageId(999));
      assert.throws(() => f.run(true), /changed/);
      assert.ok(f.points.every((id) => fs.existsSync(f.point(id))));
      assert.ok(!f.calls.some((args) => args[1] === "rm"));
    }
  );
}

test("чужой образ под меткой сохраняемой точки блокирует очистку", (t) => {
  const f = setup(t);
  f.images[0].tags.push("favorite-rollback-backend:" + f.points[4]);
  assert.throws(() => f.run(true), /Rollback reference/);
  assert.ok(!f.calls.some((args) => args[1] === "rm"));
});

test("вложенная ссылка в архиве не затрагивает внешний файл", (t) => {
  const f = setup(t);
  fs.symlinkSync(
    path.join(f.root, "backups/hourly.dump"),
    path.join(f.point(f.points[0]), "database/favorite.dump.sha256")
  );
  assert.throws(() => f.run(true), /Unsafe release tree/);
  assert.equal(
    fs.readFileSync(path.join(f.root, "backups/hourly.dump"), "utf8"),
    "private data"
  );
  assert.ok(!f.calls.some((args) => args[1] === "rm"));
});

test("служба очистки использует блокировку деплоя и не останавливает его", () => {
  const deploy = fs.readFileSync(
    path.join(__dirname, "ci/favkino-deploy.service"),
    "utf8"
  );
  const cleanup = fs.readFileSync(
    path.join(__dirname, "systemd/favkino-release-cleanup.service"),
    "utf8"
  );
  const lock = deploy.match(/\/run\/lock\/[a-zA-Z0-9.-]+/)[0];
  assert.ok(cleanup.includes(lock));
  assert.match(cleanup, /flock --close -w 900/);
  assert.match(cleanup, /Type=oneshot/);
  assert.doesNotMatch(cleanup, /^Conflicts=/m);
});

test("ошибка удаления Docker сохраняет архивы и не пытается принудительно удалить образ", (t) => {
  const f = setup(t);
  f.failRemove();
  assert.throws(() => f.run(true), /image is in use/);
  assert.ok(f.points.every((id) => fs.existsSync(f.point(id))));
  assert.ok(!f.calls.flat().includes("--force"));
});
