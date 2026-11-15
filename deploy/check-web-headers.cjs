const assert = require("node:assert/strict");
const http = require("node:http");
const https = require("node:https");

async function checkWebHeaders(base, asset) {
  const secure = new URL(base).protocol === "https:";
  const client = secure ? https : http;
  const missing = "/assets/__qa_missing__.js";
  const htmlPaths = new Set(["/", "/login", "/index.html"]);
  const documentNonces = new Set();
  for (const path of [
    "/",
    "/login",
    "/index.html",
    "/manifest.webmanifest",
    "/sw.js",
    asset,
    missing,
  ]) {
    const { status, headers, body } = await new Promise((resolve, reject) => {
      // Только одноразовый QA-сертификат из verify-local.sh, реальные сервисы этим кодом не проверяются.
      const request = client.get(
        new URL(path, base),
        { rejectUnauthorized: !secure },
        (response) => {
          let body = "";
          if (htmlPaths.has(path)) {
            response.setEncoding("utf8");
            response.on("data", (chunk) => { body += chunk; });
          }
          response.on("error", reject);
          response.on("end", () =>
            resolve({ status: response.statusCode, headers: response.headers, body }),
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
    const reportOnly = headers["content-security-policy-report-only"];
    assert.ok(reportOnly, `${path}: content-security-policy-report-only`);
    assert.equal(
      headers["content-security-policy"],
      undefined,
      `${path}: CSP must be report-only during rollout`,
    );
    const directives = reportOnly.split(";").map((value) => value.trim());
    const style = directives.filter((value) => value.split(/\s+/)[0] === "style-src");
    assert.equal(style.length, 1, `${path}: one CSP style-src`);
    const nonce = /^style-src 'self' 'nonce-([a-f0-9]{32})'$/.exec(style[0])?.[1];
    assert.ok(nonce, `${path}: CSP style-src with nonce`);
    if (htmlPaths.has(path)) {
      assert.ok(body.includes(`<meta name="fv-style-nonce" nonce="${nonce}">`), `${path}: HTML style nonce`);
      assert.ok(!documentNonces.has(nonce), `${path}: unique HTML nonce`);
      documentNonces.add(nonce);
    }
    for (const expected of [
      "default-src 'self'",
      "script-src 'self'",
      "script-src-attr 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "report-uri /_csp-report",
    ]) {
      const name = expected.split(" ")[0];
      assert.deepEqual(
        directives.filter((value) => value.split(/\s+/)[0] === name),
        [expected],
        `${path}: CSP ${name}`,
      );
    }
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
