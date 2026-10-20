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

test("права токена ограничены заданиями, actions закреплены за commit SHA", () => {
  assert.equal(w.permissions.contents, "read");
  assert.equal(w.jobs.deploy.permissions.packages, "read");
  assert.equal(w.jobs.images.permissions.packages, "write");
  for (const job of Object.values(w.jobs)) {
    for (const step of job.steps)
      if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
  }
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
