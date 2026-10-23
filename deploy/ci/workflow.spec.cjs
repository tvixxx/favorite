const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const yaml = require("../../backend/node_modules/js-yaml");
const w = yaml.load(
  fs.readFileSync(
    path.join(__dirname, "../../.github/workflows/ci-deploy.yml"),
    "utf8",
  ),
);

test("workflow допускает production только из main после проверок и явного включения", () => {
  assert.deepEqual(w.on.push.branches, ["main"]);
  assert.deepEqual(w.on.pull_request.branches, ["main"]);
  assert.equal(w.jobs.images.needs, "checks");
  assert.equal(w.jobs.deploy.needs, "images");
  assert.match(w.jobs.deploy.if, /DEPLOY_ENABLED == 'true'/);
  assert.match(w.jobs.deploy.if, /github.ref == 'refs\/heads\/main'/);
  assert.match(w.jobs.deploy.if, /github.event_name != 'pull_request'/);
  assert.equal(w.jobs.deploy.concurrency["cancel-in-progress"], false);
  assert.equal(w.jobs.deploy.concurrency.queue, "max");
});

test("публикация использует новые пакеты вместо прежних публичных", () => {
  const images = w.jobs.images.steps.filter((step) => step.with?.push);
  assert.deepEqual(
    Object.fromEntries(images.map((step) => [step.id, step.with.tags])),
    {
      migrate: "ghcr.io/tvixxx/favkino-private-migrate:${{ github.sha }}",
      backend: "ghcr.io/tvixxx/favkino-private-backend:${{ github.sha }}",
      web: "ghcr.io/tvixxx/favkino-private-web:${{ github.sha }}",
    },
  );
});

test("frontend-зависимости PostgreSQL-тестов доступны до backend lint", () => {
  const steps = w.jobs.checks.steps;
  const installFrontend = steps.findIndex((step) =>
    step.run?.includes("yarn --cwd frontend install"),
  );
  const lintBackend = steps.findIndex((step) =>
    step.run?.includes("yarn --cwd backend lint:check"),
  );
  assert.ok(
    installFrontend >= 0,
    "В CI должна быть установка frontend-зависимостей",
  );
  assert.ok(
    lintBackend > installFrontend,
    "backend/test импортирует socket.io-client из frontend/node_modules до запуска линтера",
  );
});

test("права токена ограничены заданиями, actions закреплены за commit SHA", () => {
  assert.equal(w.permissions.contents, "read");
  assert.equal(w.jobs.deploy.permissions.packages, "read");
  assert.equal(w.jobs.images.permissions.packages, "write");
  for (const job of Object.values(w.jobs)) {
    for (const step of job.steps)
      if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
  }
});

test("новость релиза публикуется после проверки приложения, файл включён в runtime-образ", () => {
  for (const file of ["ci-release.sh", "deploy.sh"]) {
    const script = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    const health = script.indexOf("check_application\n");
    const publish = script.indexOf("node dist/src/notification/publish-release.js");
    assert.ok(health >= 0 && publish > health);
  }
  const dockerfile = fs.readFileSync(path.join(__dirname, "../../backend/Dockerfile"), "utf8");
  assert.match(dockerfile, /COPY --from=build \/app\/release-notes \.\/release-notes/);
});

test("SSH сохраняет проверку ключа сервера, пароль реестра передаётся через stdin", () => {
  const step = w.jobs.deploy.steps[0];
  assert.ok(step.env.CI_SSH_KEY.includes("secrets."));
  assert.match(step.run, /StrictHostKeyChecking=yes/);
  assert.match(step.run, /UserKnownHostsFile=/);
  assert.match(step.run, /\| ssh -T/);
  assert.ok(!step.run.includes("set -x"));
  assert.match(
    step.run,
    /\/usr\/bin\/sudo -n \/usr\/local\/sbin\/favkino-deploy/,
  );
});
