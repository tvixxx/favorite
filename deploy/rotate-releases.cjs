#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const POINT = /^\d{8}T\d{6}Z-[a-f0-9]{8}$/;
const SHA = /^[a-f0-9]{40}$/;
const IMAGE = /^sha256:[a-f0-9]{64}$/;
const ROLES = ["backend", "migrate", "web"];
const REGISTRY = "ghcr.io/tvixxx/favkino-private-";
const CONTAINER_FORMAT =
  '{"name":{{json .Name}},"image":{{json .Image}},"running":{{json .State.Running}},"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}}}';
const IMAGE_FORMAT =
  '{"id":{{json .Id}},"tags":{{json .RepoTags}},"digests":{{json .RepoDigests}},"source":{{with index .Config "Labels"}}{{json (index . "org.opencontainers.image.source")}}{{else}}null{{end}},"revision":{{with index .Config "Labels"}}{{json (index . "org.opencontainers.image.revision")}}{{else}}null{{end}}}';

function entry(file, directory = false) {
  const stat = fs.lstatSync(file);
  if (
    stat.isSymbolicLink() ||
    !(directory ? stat.isDirectory() : stat.isFile())
  )
    throw new Error("Unexpected file type: " + file);
  return stat;
}

function json(file) {
  const stat = entry(file);
  if (stat.uid !== process.getuid() || stat.mode & 0o077)
    throw new Error("Metadata must be private and owned by the operator");
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error("Invalid metadata JSON: " + file);
  }
}

function ownedReference(ref) {
  return (
    typeof ref === "string" &&
    (/^ghcr\.io\/tvixxx\/favkino-private-(backend|migrate|web)(:[a-f0-9]{40}|@sha256:[a-f0-9]{64})$/.test(
      ref
    ) ||
      /^favorite-rollback-(backend|web):\d{8}T\d{6}Z-[a-f0-9]{8}$/.test(ref) ||
      /^favorite-(backend|migrate|web):latest$/.test(ref))
  );
}

function rotateReleases({
  root = "/srv/favorite",
  apply = false,
  execute = execFileSync,
} = {}) {
  entry(root, true);
  entry(path.join(root, "deploy"), true);
  entry(path.join(root, "deploy/.state"), true);
  const releases = path.join(root, "backups/releases");
  for (const dir of [path.join(root, "backups"), releases]) {
    const stat = entry(dir, true);
    if (stat.uid !== process.getuid() || stat.mode & 0o077)
      throw new Error(
        "Backup directory must be private and owned by the operator"
      );
  }
  const state = json(path.join(root, "deploy/.state/ci-last-success.json"));
  if (
    !SHA.test(state.sha) ||
    !POINT.test(state.point) ||
    !state.images ||
    Object.keys(state.images).sort().join(",") !== "backend,migrate,web"
  )
    throw new Error("Invalid last successful deployment");
  for (const role of ROLES) {
    const ref = state.images[role];
    if (
      typeof ref !== "string" ||
      !ref.startsWith(REGISTRY + role + "@") ||
      !IMAGE.test(ref.slice((REGISTRY + role + "@").length))
    )
      throw new Error("Invalid current image reference");
  }

  const points = fs
    .readdirSync(releases)
    .filter((name) => POINT.test(name))
    .sort()
    .map((id) => {
      const dir = path.join(releases, id);
      const stat = entry(dir, true);
      const point = json(path.join(dir, "point.json"));
      if (
        point.id !== id ||
        typeof point.ready !== "boolean" ||
        !point.images ||
        !IMAGE.test(point.images.backend) ||
        !IMAGE.test(point.images.web)
      )
        throw new Error("Invalid release metadata: " + id);
      if (point.ready) {
        const expected = [
          "point.json",
          "images.tar",
          "images.json",
          "compose.yml",
          "nginx.conf",
          "db-restore.cjs",
          "database",
        ].sort();
        if (
          JSON.stringify(fs.readdirSync(dir).sort()) !==
          JSON.stringify(expected)
        )
          throw new Error("Unknown release files: " + id);
        for (const name of expected.filter((name) => name !== "database"))
          if (entry(path.join(dir, name)).size === 0)
            throw new Error("Empty release file");
        entry(path.join(dir, "database"), true);
        if (
          typeof point.dump !== "string" ||
          path.basename(point.dump) !== point.dump ||
          !/\.dump(?:\.gpg)?$/.test(point.dump)
        )
          throw new Error("Invalid release dump");
        if (entry(path.join(dir, "database", point.dump)).size < 1024)
          throw new Error("Invalid release dump size");
        if (
          fs
            .readdirSync(path.join(dir, "database"))
            .some(
              (name) => name !== point.dump && name !== point.dump + ".sha256"
            )
        )
          throw new Error("Unknown files in release database");
        const images = json(path.join(dir, "images.json"));
        for (const role of ["backend", "web"])
          if (
            images.services?.[role]?.image !== `favorite-rollback-${role}:${id}`
          )
            throw new Error("Invalid rollback reference");
      }
      return { ...point, dir, inode: stat.ino, device: stat.dev };
    });
  const currentPoint = points.find((point) => point.id === state.point);
  if (!currentPoint?.ready || currentPoint.checkoutTarget !== state.sha)
    throw new Error("Last successful restore point is missing or inconsistent");
  const keep = new Set(
    points
      .filter((point) => point.ready)
      .slice(-3)
      .map((point) => point.id)
  );
  keep.add(state.point);
  for (const point of points) if (!point.ready) keep.add(point.id);

  const docker = (...args) =>
    String(
      execute("docker", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 16 * 1024 * 1024,
        timeout: 120000,
        env: {
          PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        },
      })
    ).trim();
  const lines = (text) => (text ? text.split("\n") : []);
  const inspectContainers = () => {
    const ids = lines(
      docker("container", "ls", "--all", "--quiet", "--no-trunc")
    );
    if (!ids.length || ids.some((id) => !/^[a-f0-9]{64}$/.test(id)))
      throw new Error("Invalid container inventory");
    const data = lines(
      docker("container", "inspect", "--format", CONTAINER_FORMAT, ...ids)
    ).map((line) => JSON.parse(line));
    if (data.length !== ids.length || data.some((x) => !IMAGE.test(x.image)))
      throw new Error("Incomplete container inventory");
    return data;
  };
  const containers = inspectContainers();
  const protectedImages = new Set(
    containers.map((container) => container.image)
  );
  const currentImages = {};
  for (const role of ROLES) {
    const id = docker(
      "image",
      "inspect",
      "--format",
      "{{.Id}}",
      state.images[role]
    );
    if (!IMAGE.test(id)) throw new Error("Current image is missing");
    protectedImages.add(id);
    currentImages[role] = id;
  }
  for (const role of ["backend", "web"]) {
    const container = containers.find((x) => x.name === "/favorite-" + role);
    if (
      !container?.running ||
      container.image !== currentImages[role] ||
      (role === "backend" && container.health !== "healthy")
    )
      throw new Error(
        "Application is not healthy or differs from last success"
      );
  }
  const pointImages = new Set();
  for (const point of points)
    for (const id of Object.values(point.images)) {
      if (typeof id !== "string" || !IMAGE.test(id))
        throw new Error("Invalid restore image ID");
      pointImages.add(id);
      if (keep.has(point.id)) protectedImages.add(id);
    }
  const ids = [
    ...new Set(lines(docker("image", "ls", "--quiet", "--no-trunc"))),
  ];
  if (!ids.length || ids.some((id) => !IMAGE.test(id)))
    throw new Error("Invalid image inventory");
  const images = lines(
    docker("image", "inspect", "--format", IMAGE_FORMAT, ...ids)
  ).map((line) => JSON.parse(line));
  if (
    images.length !== ids.length ||
    new Set(images.map((x) => x.id)).size !== ids.length ||
    images.some((x) => !ids.includes(x.id))
  )
    throw new Error("Incomplete image inventory");
  for (const id of Object.values(currentImages)) {
    const image = images.find((x) => x.id === id);
    if (
      image?.source !== "https://github.com/tvixxx/favorite" ||
      image.revision !== state.sha
    )
      throw new Error("Current image provenance differs from last success");
  }
  const retainedReferences = new Map();
  for (const point of points.filter((point) => keep.has(point.id)))
    for (const role of ["backend", "web"])
      retainedReferences.set(
        `favorite-rollback-${role}:${point.id}`,
        point.images[role]
      );
  for (const image of images)
    for (const tag of image.tags ?? [])
      if (
        retainedReferences.has(tag) &&
        retainedReferences.get(tag) !== image.id
      )
        throw new Error("Rollback reference differs from retained point");

  const removeImages = [];
  for (const image of images) {
    if (protectedImages.has(image.id)) continue;
    const tags = image.tags ?? [];
    const digests = image.digests ?? [];
    if (!Array.isArray(tags) || !Array.isArray(digests))
      throw new Error("Invalid image references");
    const refs = [...tags, ...digests];
    const owned =
      pointImages.has(image.id) ||
      (image.source === "https://github.com/tvixxx/favorite" &&
        SHA.test(image.revision));
    if (
      !owned ||
      (!refs.length && !pointImages.has(image.id)) ||
      !refs.every(ownedReference)
    )
      continue;
    removeImages.push({
      id: image.id,
      references: tags.length ? tags : digests.length ? digests : [image.id],
    });
  }
  const removePoints = points.filter((point) => !keep.has(point.id));
  // Проверяем дерево перед любыми удалениями, не переходим через ссылки или mount.
  const checkTree = (dir, device) => {
    const stat = fs.lstatSync(dir);
    if (
      stat.isSymbolicLink() ||
      stat.dev !== device ||
      (!stat.isFile() && !stat.isDirectory())
    )
      throw new Error("Unsafe release tree: " + dir);
    if (stat.isDirectory())
      for (const name of fs.readdirSync(dir))
        checkTree(path.join(dir, name), device);
  };
  for (const point of removePoints)
    checkTree(point.dir, entry(releases, true).dev);
  const plan = {
    mode: apply ? "apply" : "preview",
    keepPoints: points
      .filter((point) => keep.has(point.id))
      .map((point) => point.id)
      .reverse(),
    removePoints: removePoints.map((point) => point.id),
    removeImages,
  };
  if (!apply) return plan;

  const inUse = new Set(inspectContainers().map((x) => x.image));
  if (removeImages.some((image) => inUse.has(image.id)))
    throw new Error("Container inventory changed, run preview again");
  for (const image of removeImages)
    for (const ref of image.references)
      if (docker("image", "inspect", "--format", "{{.Id}}", ref) !== image.id)
        throw new Error("Image reference changed, run preview again");
  for (const image of removeImages)
    docker("image", "rm", "--no-prune", ...image.references);
  for (const point of removePoints) {
    const stat = entry(point.dir, true);
    if (stat.ino !== point.inode || stat.dev !== point.device)
      throw new Error("Release directory changed");
    fs.rmSync(point.dir, { recursive: true });
  }
  return plan;
}

module.exports = { rotateReleases };
if (require.main === module) {
  try {
    if (process.getuid() !== 0) throw new Error("Root required");
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== "--apply"))
      throw new Error("Usage: rotate-releases.cjs [--apply]");
    const plan = rotateReleases({ apply: args[0] === "--apply" });
    console.log(JSON.stringify(plan, null, 2));
    console.log(
      plan.mode === "apply"
        ? "RELEASE_ROTATION_OK"
        : "RELEASE_ROTATION_PREVIEW_OK"
    );
  } catch (error) {
    console.error("RELEASE_ROTATION_FAILED: " + error.message);
    process.exitCode = 1;
  }
}
