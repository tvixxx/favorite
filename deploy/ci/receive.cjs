#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ROOT = "/srv/favorite";
const DEPLOY = ROOT + "/deploy";
const REQUEST = "/run/favkino-deploy-request.json";
const SERVICES = ["backend", "migrate", "web"];
const PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

function validate(request) {
  if (
    !request ||
    typeof request.sha !== "string" ||
    !/^[a-f0-9]{40}$/.test(request.sha) ||
    typeof request.actor !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}(\[bot\])?$/.test(request.actor) ||
    typeof request.token !== "string" ||
    request.token.length < 20 ||
    request.token.length > 8192 ||
    !/^[a-zA-Z0-9._-]+$/.test(request.token) ||
    !request.images ||
    Object.keys(request.images).sort().join(",") !== "backend,migrate,web" ||
    SERVICES.some(
      (service) =>
        typeof request.images[service] !== "string" ||
        !/^sha256:[a-f0-9]{64}$/.test(request.images[service]),
    )
  ) {
    throw new Error("Invalid deploy request");
  }
}

function receive(request, execute = execFileSync, files = fs) {
  validate(request);
  const env = {
    PATH,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "safe.directory",
    GIT_CONFIG_VALUE_0: ROOT,
  };
  const run = (command, args, options = {}) =>
    String(
      execute(command, args, {
        cwd: DEPLOY,
        env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 4 * 1024 * 1024,
        ...options,
      }) ?? "",
    ).trim();
  const git = (...args) =>
    run("runuser", [
      "-u",
      "deploy",
      "--",
      "git",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "credential.helper=",
      "-C",
      ROOT,
      ...args,
    ]);
  const freeBytes = () => {
    const disk = files.statfsSync(ROOT, { bigint: true });
    return disk.bavail * disk.bsize;
  };
  if (freeBytes() < 8n * 1024n ** 3n)
    throw new Error("DEPLOY_NEEDS_8_GIB_FREE");
  if (
    git("remote", "get-url", "origin") !==
      "https://github.com/tvixxx/favorite.git" ||
    git("symbolic-ref", "--short", "HEAD") !== "main" ||
    git("status", "--porcelain")
  ) {
    throw new Error("DEPLOY_CHECKOUT_NOT_CLEAN_MAIN");
  }
  const currentMain = () => {
    git(
      "fetch",
      "--no-tags",
      "origin",
      "refs/heads/main:refs/remotes/origin/main",
    );
    return git("rev-parse", "refs/remotes/origin/main");
  };
  if (currentMain() !== request.sha) {
    console.log("DEPLOY_SUPERSEDED");
    return;
  }
  git("merge-base", "--is-ancestor", "HEAD", request.sha);
  const config = files.mkdtempSync("/run/favkino-deploy-job/docker.");
  files.chmodSync(config, 0o700);
  const docker = (...args) => run("docker", ["--config", config, ...args]);
  const images = Object.fromEntries(
    SERVICES.map((service) => [
      service,
      "ghcr.io/tvixxx/favorite-" + service + "@" + request.images[service],
    ]),
  );
  try {
    run(
      "docker",
      [
        "--config",
        config,
        "login",
        "ghcr.io",
        "--username",
        request.actor,
        "--password-stdin",
      ],
      { input: request.token + "\n", stdio: ["pipe", "pipe", "pipe"] },
    );
    for (const image of Object.values(images)) {
      docker("pull", image);
      if (
        docker(
          "image",
          "inspect",
          "--format",
          '{{.Os}}/{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}',
          image,
        ) !==
        "linux/amd64 " + request.sha
      ) {
        throw new Error("DEPLOY_IMAGE_REVISION_OR_PLATFORM_MISMATCH");
      }
    }
    if (currentMain() !== request.sha) {
      console.log("DEPLOY_SUPERSEDED");
      return;
    }
    // shortcut: точки релизов очищает оператор, добавить ротацию после выбора глубины истории.
    let archiveBytes = 0n;
    for (const container of ["favorite-backend", "favorite-web"]) {
      const image = run("docker", [
        "inspect",
        "--format",
        "{{.Image}}",
        container,
      ]);
      archiveBytes += BigInt(
        docker("image", "inspect", "--format", "{{.Size}}", image),
      );
    }
    if (freeBytes() < 3n * 1024n ** 3n + archiveBytes * 2n) {
      throw new Error("DEPLOY_NOT_ENOUGH_SPACE_FOR_RESTORE_POINT");
    }
    const point = run("/bin/bash", [
      "-c",
      "source ./common.sh; node ./release.cjs snapshot",
    ]);
    if (!/^\d{8}T\d{6}Z-[a-f0-9]{8}$/.test(point))
      throw new Error("DEPLOY_INVALID_RESTORE_POINT");
    console.log("DEPLOY_RESTORE_POINT=" + point);
    git("merge", "--ff-only", "refs/remotes/origin/main");
    if (git("rev-parse", "HEAD") !== request.sha)
      throw new Error("DEPLOY_CHECKOUT_SHA_MISMATCH");
    files.mkdirSync(path.join(DEPLOY, ".state"), {
      recursive: true,
      mode: 0o700,
    });
    const writeState = (name, value) => {
      const file = path.join(DEPLOY, ".state", name);
      files.writeFileSync(file + ".tmp", JSON.stringify(value) + "\n", {
        mode: 0o600,
        flag: "wx",
      });
      files.renameSync(file + ".tmp", file);
    };
    writeState("ci-images.json", {
      services: Object.fromEntries(
        SERVICES.map((service) => [service, { image: images[service] }]),
      ),
    });
    run("/bin/bash", [path.join(DEPLOY, "ci-release.sh"), point, request.sha], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    writeState("ci-last-success.json", {
      sha: request.sha,
      images,
      point,
      at: new Date().toISOString(),
    });
    console.log("FAVKINO_DEPLOY_OK " + request.sha);
  } catch (error) {
    const message = error.message.split(request.token).join("[REDACTED]");
    console.error("DEPLOY_STEP_FAILED: " + message);
    throw new Error(message);
  } finally {
    files.rmSync(config, { recursive: true, force: true });
  }
}

function submit(request, execute = execFileSync, files = fs) {
  validate(request);
  const run = (args, options = {}) =>
    execute("/usr/bin/systemctl", args, {
      encoding: "utf8",
      env: { PATH },
      ...options,
    });
  const state = String(
    run(["show", "favkino-deploy.service", "-p", "ActiveState", "--value"]),
  ).trim();
  if (!["inactive", "failed"].includes(state))
    throw new Error("DEPLOY_ALREADY_RUNNING");
  files.writeFileSync(REQUEST, JSON.stringify(request), {
    mode: 0o600,
    flag: "wx",
  });
  // systemd продолжает деплой, даже если SSH-соединение оборвалось.
  try {
    run(["start", "favkino-deploy.service"], { stdio: "inherit" });
  } finally {
    execute(
      "/usr/bin/journalctl",
      [
        "-u",
        "favkino-deploy.service",
        "-n",
        "60",
        "--no-pager",
        "--output=cat",
      ],
      { env: { PATH }, stdio: "inherit" },
    );
  }
}

async function readRequest(stream) {
  let text = "";
  const deadline = setTimeout(
    () => stream.destroy(new Error("Invalid deploy request timeout")),
    30000,
  );
  try {
    for await (const chunk of stream) {
      text += chunk;
      if (Buffer.byteLength(text) > 16384)
        throw new Error("Invalid deploy request size");
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(deadline);
  }
}

module.exports = { receive, submit, readRequest };

if (require.main === module) {
  (async () => {
    if (process.getuid() !== 0) throw new Error("Root required");
    if (process.argv[2] === "submit" && process.argv.length === 3) {
      submit(await readRequest(process.stdin));
    } else if (process.argv[2] === "apply" && process.argv.length === 3) {
      try {
        receive(JSON.parse(fs.readFileSync(REQUEST, "utf8")));
      } finally {
        fs.unlinkSync(REQUEST);
      }
    } else {
      throw new Error("Invalid invocation");
    }
  })().catch(() => {
    console.error(
      "FAVKINO_DEPLOY_FAILED: inspect favkino-deploy.service journal",
    );
    process.exitCode = 1;
  });
}
