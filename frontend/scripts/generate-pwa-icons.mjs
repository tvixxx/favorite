/**
 * Генерирует PNG иконки для PWA (primary Ant Design blue).
 * Запуск: node scripts/generate-pwa-icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

function fillPng(size, rgb) {
  const png = new PNG({ width: size, height: size });

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      png.data[idx] = rgb[0];
      png.data[idx + 1] = rgb[1];
      png.data[idx + 2] = rgb[2];
      png.data[idx + 3] = 255;
    }
  }

  return png;
}

const primary = [22, 119, 255];

mkdirSync(publicDir, { recursive: true });

for (const size of [192, 512]) {
  const png = fillPng(size, primary);
  const path = join(publicDir, `pwa-${size}.png`);
  const buffer = PNG.sync.write(png);

  writeFileSync(path, buffer);
}

console.log("Written public/pwa-192.png, public/pwa-512.png");
