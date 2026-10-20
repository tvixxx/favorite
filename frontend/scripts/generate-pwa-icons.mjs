/**
 * Иконки Favorite: белая F на фирменном красном фоне.
 * Запуск: yarn pwa:icons
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const brand = [255, 0, 50];
// Геометрия в координатах 64×64, буква внутри безопасной области maskable.
const mark = [
  [20, 16, 25, 8],
  [20, 24, 9, 24],
  [29, 29, 12, 8],
];

function iconPng(size) {
  const png = new PNG({ width: size, height: size });

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = ((x + 0.5) * 64) / size;
      const py = ((y + 0.5) * 64) / size;
      const white = mark.some(
        ([left, top, width, height]) =>
          px >= left && px < left + width && py >= top && py < top + height
      );
      const idx = (size * y + x) * 4;

      png.data[idx] = white ? 255 : brand[0];
      png.data[idx + 1] = white ? 255 : brand[1];
      png.data[idx + 2] = white ? 255 : brand[2];
      png.data[idx + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

mkdirSync(publicDir, { recursive: true });

const rectangles = mark
  .map(
    ([x, y, width, height]) =>
      `  <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff"/>`
  )
  .join("\n");

writeFileSync(
  join(publicDir, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#ff0032"/>
${rectangles}
</svg>
`
);

for (const size of [192, 512]) {
  writeFileSync(join(publicDir, `pwa-${size}.png`), iconPng(size));
}

writeFileSync(join(publicDir, "apple-touch-icon.png"), iconPng(180));

// ICO с PNG-кадром для браузеров, которые не выбирают SVG.
const png = iconPng(32);
const header = Buffer.alloc(22);

header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(header.length, 18);
writeFileSync(join(publicDir, "favicon.ico"), Buffer.concat([header, png]));

console.log("Written Favorite favicon, Apple touch icon and PWA icons");
