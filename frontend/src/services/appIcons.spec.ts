import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const { PNG } = createRequire(import.meta.url)("pngjs");

describe("Иконки приложения", () => {
  it("подключает существующие иконки вкладки и домашнего экрана", async () => {
    const html = await readFile(resolve("index.html"), "utf8");

    for (const name of ["favicon.ico", "favicon.svg", "apple-touch-icon.png"]) {
      expect(html).toContain(`href="/${name}"`);
      expect((await readFile(resolve("public", name))).length).toBeGreaterThan(
        0
      );
    }
  });

  it("содержит белую букву на фирменном красном фоне во всех размерах", async () => {
    for (const [name, size] of [
      ["pwa-192.png", 192],
      ["pwa-512.png", 512],
      ["apple-touch-icon.png", 180],
    ] as const) {
      const png = PNG.sync.read(await readFile(resolve("public", name)));

      expect([png.width, png.height]).toEqual([size, size]);

      const pixel = (x: number, y: number) => {
        const offset =
          (Math.floor((y * size) / 64) * size + Math.floor((x * size) / 64)) *
          4;

        return [...png.data.subarray(offset, offset + 4)];
      };

      expect(pixel(8, 8)).toEqual([255, 0, 50, 255]);
      expect(pixel(23, 44)).toEqual([255, 255, 255, 255]);
      expect(pixel(38, 20)).toEqual([255, 255, 255, 255]);
      expect(pixel(35, 33)).toEqual([255, 255, 255, 255]);
      expect(pixel(38, 44)).toEqual([255, 0, 50, 255]);
    }
  });

  it("предоставляет читаемый ICO с иконкой 32 на 32 для совместимости", async () => {
    const ico = await readFile(resolve("public/favicon.ico"));

    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(1);
    expect([ico[6], ico[7]]).toEqual([32, 32]);

    const size = ico.readUInt32LE(14);
    const offset = ico.readUInt32LE(18);

    expect(offset + size).toBe(ico.length);

    const png = PNG.sync.read(ico.subarray(offset, offset + size));

    expect([png.width, png.height]).toEqual([32, 32]);
  });
});
