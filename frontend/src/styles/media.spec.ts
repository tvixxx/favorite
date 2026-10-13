/// <reference types="node" />
// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileString } from "sass";
import { describe, expect, it } from "vitest";

const styles = dirname(fileURLToPath(import.meta.url));

describe("Общие медиамиксины", () => {
  it("сохраняет точные границы мобильного и десктопного макетов", () => {
    const { css } = compileString(
      `
      @use "media" as *;
      .below { @include mediaMax($tablet - 0.02px) { color: red; } }
      .inclusive { @include mediaMax($tablet) { color: blue; } }
      .desktop { @include mediaDesktopXS { color: green; } }
      .custom { @include mediaMin(520px) { color: black; } }
    `,
      { loadPaths: [styles] }
    );

    expect(css).toContain("(max-width: 767.98px)");
    expect(css).toContain("(max-width: 768px)");
    expect(css).toContain("(min-width: 960px)");
    expect(css).toContain("(min-width: 520px)");
  });

  it("сохраняет условия наведения и уменьшения движения", () => {
    const { css } = compileString(
      `
      @use "media" as *;
      .hover { @include mediaHover { color: red; } }
      .touch { @include mediaNoHover { color: blue; } }
      .motion { @include mediaReducedMotion { animation: none; } }
    `,
      { loadPaths: [styles] }
    );

    expect(css).toContain("(hover: hover)");
    expect(css).toContain("(hover: none)");
    expect(css).toContain("(prefers-reduced-motion: reduce)");
  });

  it("объявляет медиазапросы только в общем файле миксинов", () => {
    const source = join(styles, "..");
    const directMediaFiles = readdirSync(source, { recursive: true })
      .filter((file) => /\.(vue|scss)$/.test(String(file)))
      .map((file) => join(source, String(file)))
      .filter((file) => file !== join(styles, "media.scss"))
      .filter((file) => /^\s*@media\b/m.test(readFileSync(file, "utf8")));

    expect(directMediaFiles).toEqual([]);
  });
});
