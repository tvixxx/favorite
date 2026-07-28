#!/usr/bin/env node
/**
 * Восстановление базы из слепка. Операция разрушительная, поэтому:
 *   1) без --yes ничего не делает, только показывает план;
 *   2) перед восстановлением сам снимает «страховочный» дамп текущего состояния;
 *   3) по умолчанию разворачивает в НОВУЮ базу, а не в рабочую.
 *
 *   node scripts/backup/db-restore.cjs backups/favorites-...dump                  # план
 *   node scripts/backup/db-restore.cjs backups/favorites-...dump --into favorites_new --yes
 *   node scripts/backup/db-restore.cjs backups/favorites-...dump --into favorites --yes
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BACKEND_DIR = path.resolve(__dirname, "..", "..");

const parsed = new URL(
  fs
    .readFileSync(path.join(BACKEND_DIR, ".env"), "utf8")
    .match(/^DATABASE_URL="?([^"\n]+)"?/m)[1],
);

const CONFIG = {
  container: process.env.PG_CONTAINER ?? "postgres",
  user: process.env.PG_USER ?? decodeURIComponent(parsed.username),
  liveDb: process.env.PG_DB ?? parsed.pathname.replace(/^\//, ""),
  dir: process.env.BACKUP_DIR ?? path.join(BACKEND_DIR, "backups"),
};

const args = process.argv.slice(2);
const dumpArg = args.find((a) => !a.startsWith("--"));
const intoIndex = args.indexOf("--into");
const target = intoIndex !== -1 ? args[intoIndex + 1] : `${CONFIG.liveDb}_restored`;
const confirmed = args.includes("--yes");

if (!dumpArg) {
  console.error("Укажите файл дампа. Пример: node scripts/backup/db-restore.cjs backups/favorites-....dump --into favorites_new --yes");
  process.exit(1);
}

const dumpFile = path.resolve(dumpArg);

if (!fs.existsSync(dumpFile)) {
  console.error(`Файл не найден: ${dumpFile}`);
  process.exit(1);
}

const docker = (bin, extra, opts = {}) =>
  execFileSync(
    CONFIG.container ? "docker" : bin,
    CONFIG.container ? ["exec", "-i", CONFIG.container, bin, ...extra] : extra,
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 512, ...opts },
  );

const isLive = target === CONFIG.liveDb;

console.log(`Дамп:        ${path.basename(dumpFile)}`);
console.log(`Куда:        ${target}${isLive ? "  ← РАБОЧАЯ БАЗА" : ""}`);
console.log(`Контейнер:   ${CONFIG.container || "(локальный postgres)"}`);

if (!confirmed) {
  console.log(
    "\nЭто был предпросмотр. Добавьте --yes, чтобы выполнить." +
      (isLive
        ? "\nВНИМАНИЕ: цель — рабочая база. Текущие данные будут заменены содержимым дампа."
        : ""),
  );
  process.exit(0);
}

(async () => {
  // Страховка: что бы ни случилось дальше, текущее состояние сохранено
  if (isLive) {
    const safety = path.join(CONFIG.dir, `${CONFIG.liveDb}-before-restore.dump`);

    fs.mkdirSync(CONFIG.dir, { recursive: true });

    const out = fs.openSync(safety, "w");

    try {
      docker("pg_dump", ["-U", CONFIG.user, "-d", CONFIG.liveDb, "-Fc"], {
        stdio: ["ignore", out, "inherit"],
      });
    } finally {
      fs.closeSync(out);
    }

    console.log(`Страховочный дамп: ${path.basename(safety)}`);
  }

  if (!isLive) {
    docker("dropdb", ["-U", CONFIG.user, "--if-exists", target]);
    docker("createdb", ["-U", CONFIG.user, target]);
  }

  const input = fs.openSync(dumpFile, "r");

  try {
    // --clean --if-exists нужен, когда разворачиваем поверх существующей базы
    const restoreArgs = ["-U", CONFIG.user, "-d", target, "--no-owner"];

    if (isLive) {
      restoreArgs.push("--clean", "--if-exists");
    }

    execFileSync(
      CONFIG.container ? "docker" : "pg_restore",
      CONFIG.container
        ? ["exec", "-i", CONFIG.container, "pg_restore", ...restoreArgs]
        : restoreArgs,
      { stdio: [input, "inherit", "inherit"], maxBuffer: 1024 * 1024 * 512 },
    );
  } finally {
    fs.closeSync(input);
  }

  console.log(`\nГотово. База ${target} восстановлена из ${path.basename(dumpFile)}.`);
  console.log(
    isLive
      ? "Перезапустите backend — соединения в пуле смотрят на прежние объекты."
      : `Чтобы переключить приложение: поменяйте базу в DATABASE_URL на ${target}.`,
  );
})().catch((error) => {
  console.error("Восстановление не выполнено:", error.message);
  process.exit(1);
});
