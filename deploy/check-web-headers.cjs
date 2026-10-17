const assert = require("node:assert/strict");
const http = require("node:http");
const https = require("node:https");

async function checkWebHeaders(base, asset) {
  const secure = new URL(base).protocol === "https:";
  const client = secure ? https : http;
  const missing = "/assets/__qa_missing__.js";
  for (const path of [
    "/",
    "/login",
    "/index.html",
    "/manifest.webmanifest",
    "/sw.js",
    asset,
    missing,
  ]) {
    const { status, headers } = await new Promise((resolve, reject) => {
      // Только одноразовый QA-сертификат из verify-local.sh, реальные сервисы этим кодом не проверяются.
      const request = client.get(
        new URL(path, base),
        { rejectUnauthorized: !secure },
        (response) => {
          response.on("error", reject);
          response.on("end", () =>
            resolve({ status: response.statusCode, headers: response.headers }),
          );
          response.resume();
        },
      );
      request.setTimeout(5000, () =>
        request.destroy(new Error(`${path}: timeout`)),
      );
      request.on("error", reject);
    });
    assert.equal(status, path === missing ? 404 : 200, `${path}: status`);
    for (const [header, expected] of [
      ["x-content-type-options", "nosniff"],
      ["x-frame-options", "SAMEORIGIN"],
      ["referrer-policy", "strict-origin-when-cross-origin"],
      ...(secure ? [["strict-transport-security", "max-age=31536000"]] : []),
    ]) {
      assert.equal(headers[header], expected, `${path}: ${header}`);
    }
    if (path !== missing) {
      const cache = headers["cache-control"] ?? "";
      if (path === asset) {
        assert.match(
          cache,
          /(?:^|,\s*)public(?:,|$)/,
          `${path}: cache-control public`,
        );
        assert.match(
          cache,
          /(?:^|,\s*)immutable(?:,|$)/,
          `${path}: cache-control immutable`,
        );
        assert.match(
          cache,
          /(?:^|,\s*)max-age=31536000(?:,|$)/,
          `${path}: cache-control max-age`,
        );
      } else {
        assert.equal(cache, "no-cache", `${path}: cache-control`);
      }
    }
    console.log(
      `${secure ? "HTTPS" : "HTTP"} ${status} ${path}: security/cache OK`,
    );
  }
}

module.exports = { checkWebHeaders };

if (require.main === module) {
  checkWebHeaders(process.argv[2], process.argv[3]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
