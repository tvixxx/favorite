const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { join } = require("node:path");
const { checkWebHeaders } = require("./check-web-headers.cjs");

async function fixture(
  t,
  { missingHeader, missingStatus = 404, badCache = false } = {},
) {
  const paths = [];
  const server = http.createServer((request, response) => {
    const path = request.url;
    paths.push(path);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "SAMEORIGIN");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (path === "/assets/__qa_missing__.js") {
      response.statusCode = missingStatus;
      if (missingHeader) response.removeHeader(missingHeader);
    } else {
      response.setHeader(
        "Cache-Control",
        path === "/assets/app.js"
          ? badCache
            ? "no-cache"
            : ["max-age=31536000", "public, immutable"]
          : "no-cache",
      );
    }
    response.end("QA response");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  return { base: `http://127.0.0.1:${server.address().port}`, paths };
}

test("читает защитные заголовки настоящего ответа 404 и сохраняет обе политики кеширования", async (t) => {
  const { base, paths } = await fixture(t);
  await checkWebHeaders(base, "/assets/app.js");
  assert.deepEqual(paths, [
    "/",
    "/login",
    "/index.html",
    "/manifest.webmanifest",
    "/sw.js",
    "/assets/app.js",
    "/assets/__qa_missing__.js",
  ]);
});

test("командный запуск действительно проверяет все ответы, включая 404", async (t) => {
  const { base } = await fixture(t);
  const child = spawn(
    process.execPath,
    [join(__dirname, "check-web-headers.cjs"), base, "/assets/app.js"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  assert.equal(code, 0, output);
  assert.match(
    output,
    /HTTP 404 \/assets\/__qa_missing__\.js: security\/cache OK/,
  );
});

for (const header of [
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
]) {
  test(`отсутствие ${header} у ответа 404 не выдаёт успешную проверку`, async (t) => {
    const { base } = await fixture(t, { missingHeader: header });
    await assert.rejects(
      checkWebHeaders(base, "/assets/app.js"),
      new RegExp(header.toLowerCase()),
    );
  });
}

test("ответ 200 вместо ожидаемого 404 считается ошибкой", async (t) => {
  const { base } = await fixture(t, { missingStatus: 200 });
  await assert.rejects(checkWebHeaders(base, "/assets/app.js"), /status/);
});

test("не принимает кеширование HTML вместо immutable у JS", async (t) => {
  const { base } = await fixture(t, { badCache: true });
  await assert.rejects(
    checkWebHeaders(base, "/assets/app.js"),
    /cache-control/,
  );
});
