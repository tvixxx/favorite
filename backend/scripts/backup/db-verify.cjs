#!/usr/bin/env node
/**
 * Проверка, что слепок реально восстанавливается. Бэкап, который никогда не
 * восстанавливали, — это не бэкап, а надежда.
 *
 *   node scripts/backup/db-verify.cjs            # взять самый свежий дамп
 *   node scripts/backup/db-verify.cjs путь.dump  # конкретный файл
 *
 * Что делает: разворачивает дамп в ОТДЕЛЬНУЮ временную базу, сравнивает
 * количество строк в ключевых таблицах с рабочей базой и удаляет временную.
 * Рабочую базу не трогает.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BACKEND_DIR = path.resolve(__dirname, "..", "..");

const envUrl = fs
  .readFileSync(path.join(BACKEND_DIR, ".env"), "utf8")
  .match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
const parsed = new URL(envUrl);

const CONFIG = {
  container: process.env.PG_CONTAINER ?? "postgres",
  user: process.env.PG_USER ?? decodeURIComponent(parsed.username),
  db: process.env.PG_DB ?? parsed.pathname.replace(/^\//, ""),
  dir: process.env.BACKUP_DIR ?? path.join(BACKEND_DIR, "backups"),
};

const SCRATCH_DB = `${CONFIG.db}_verify`;
const TABLES = ["users", "movies", "user_movies", "reviews", "messages", "feedback"];

const inContainer = (bin, args, opts = {}) =>
  execFileSync(
    CONFIG.container ? "docker" : bin,
    CONFIG.container ? ["exec", "-i", CONFIG.container, bin, ...args] : args,
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 512, ...opts },
  );

const psql = (db, sql) =>
  inContainer("psql", ["-U", CONFIG.user, "-d", db, "-tAc", sql]).trim();

function latestDump() {
  const files = fs
    .readdirSync(CONFIG.dir)
    .filter((n) => n.startsWith(`${CONFIG.db}-`) && n.endsWith(".dump"))
    .sort();

  if (!files.length) {
    throw new Error(`В ${CONFIG.dir} нет дампов (.dump). Зашифрованные сначала расшифруйте.`);
  }

  return path.join(CONFIG.dir, files[files.length - 1]);
}

function counts(db) {
  const result = {};

  for (const table of TABLES) {
    const exists = psql(
      db,
      `SELECT to_regclass('public.${table}') IS NOT NULL`,
    );

    result[table] = exists === "t" ? Number(psql(db, `SELECT count(*) FROM ${table}`)) : null;
  }

  return result;
}

const dumpFile = process.argv[2] ? path.resolve(process.argv[2]) : latestDump();

(async () => {
  console.log(`Проверяю: ${path.basename(dumpFile)}`);

  // На случай, если предыдущий прогон упал на середине
  inContainer("dropdb", ["-U", CONFIG.user, "--if-exists", SCRATCH_DB]);
  inContainer("createdb", ["-U", CONFIG.user, SCRATCH_DB]);

  try {
    const input = fs.openSync(dumpFile, "r");

    try {
      execFileSync(
        "docker",
        ["exec", "-i", CONFIG.container, "pg_restore", "-U", CONFIG.user, "-d", SCRATCH_DB],
        { stdio: [input, "pipe", "pipe"], maxBuffer: 1024 * 1024 * 512 },
      );
    } finally {
      fs.closeSync(input);
    }

    const live = counts(CONFIG.db);
    const restored = counts(SCRATCH_DB);

    console.log("\nтаблица            рабочая   из дампа");

    let mismatches = 0;

    for (const table of TABLES) {
      const a = live[table];
      const b = restored[table];

      if (a === null && b === null) {
        continue;
      }

      const same = a === b;

      if (!same) {
        mismatches += 1;
      }

      console.log(
        `${table.padEnd(18)} ${String(a ?? "—").padStart(7)} ${String(b ?? "—").padStart(10)}  ${same ? "ok" : "РАСХОЖДЕНИЕ"}`,
      );
    }

    console.log(
      mismatches
        ? `\n⚠️  Расхождений: ${mismatches}. Это нормально, если после дампа данные менялись — сверьте по времени дампа.`
        : "\n✅ Дамп восстановился, количество строк совпадает.",
    );
  } finally {
    inContainer("dropdb", ["-U", CONFIG.user, "--if-exists", SCRATCH_DB]);
    console.log(`Временная база ${SCRATCH_DB} удалена.`);
  }
})().catch((error) => {
  console.error("Проверка не прошла:", error.message);
  process.exit(1);
});
