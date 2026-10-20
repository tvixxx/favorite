#!/usr/bin/env node
/**
 * Периодический слепок базы: дамп → (шифрование) → (выгрузка в S3) → ротация.
 *
 *   node scripts/backup/db-backup.cjs
 *
 * Настройки через переменные окружения (все со значениями по умолчанию):
 *   PG_CONTAINER   имя docker-контейнера с Postgres (пусто = локальный pg_dump)
 *   PG_USER        пользователь (по умолчанию берётся из DATABASE_URL)
 *   PG_DB          база (по умолчанию из DATABASE_URL)
 *   BACKUP_DIR     куда складывать (по умолчанию backend/backups)
 *   GPG_RECIPIENT  если задан — дамп шифруется на этот ключ
 *   S3_URI         если задан (s3://bucket/prefix) — файл уходит туда через aws cli
 *   HEALTHCHECK_URL если задан — пингуется после успеха (dead-man switch)
 *   KEEP_HOURLY/KEEP_DAILY/KEEP_WEEKLY/KEEP_MONTHLY — глубина ротации
 *
 * Почему Node, а не bash: ротация — это арифметика с датами, а у `date` в macOS
 * и Linux разный синтаксис. На проде и на ноутбуке скрипт должен вести себя одинаково.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { randomBytes } = require('node:crypto');
const { parseStamp, pickKeepers } = require('./retention.cjs');

const BACKEND_DIR = path.resolve(__dirname, '..', '..');

function readEnvFile() {
  const file = path.join(BACKEND_DIR, '.env');

  if (!fs.existsSync(file)) {
    return {};
  }

  const url = fs
    .readFileSync(file, 'utf8')
    .match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];

  if (!url) {
    return {};
  }

  const parsed = new URL(url);

  return {
    user: decodeURIComponent(parsed.username),
    db: parsed.pathname.replace(/^\//, ''),
  };
}

const fromEnvFile =
  process.env.PG_USER && process.env.PG_DB ? {} : readEnvFile();

const CONFIG = {
  container: process.env.PG_CONTAINER ?? 'postgres',
  user: process.env.PG_USER ?? fromEnvFile.user ?? 'postgres',
  db: process.env.PG_DB ?? fromEnvFile.db ?? 'postgres',
  dir: process.env.BACKUP_DIR ?? path.join(BACKEND_DIR, 'backups'),
  gpgRecipient: process.env.GPG_RECIPIENT ?? '',
  s3Uri: process.env.S3_URI ?? '',
  s3Endpoint: process.env.S3_ENDPOINT_URL ?? '',
  healthcheckUrl: process.env.HEALTHCHECK_URL ?? '',
  keep: {
    hourly: Number(process.env.KEEP_HOURLY ?? 24),
    daily: Number(process.env.KEEP_DAILY ?? 7),
    weekly: Number(process.env.KEEP_WEEKLY ?? 4),
    monthly: Number(process.env.KEEP_MONTHLY ?? 3),
  },
};

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', ...opts });

/** Имя файла несёт метку времени в UTC — по ней же работает ротация */
function stamp(date) {
  const iso = date.toISOString();

  return `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
}

function dump(target) {
  // pg_dump запускаем ВНУТРИ контейнера: так версия клиента всегда совпадает
  // с версией сервера (иначе более новый сервер отказывается отдавать дамп)
  const args = CONFIG.container
    ? [
        'exec',
        CONFIG.container,
        'pg_dump',
        '-U',
        CONFIG.user,
        '-d',
        CONFIG.db,
        '-Fc',
      ]
    : ['-U', CONFIG.user, '-d', CONFIG.db, '-Fc'];

  const out = fs.openSync(target, 'wx', 0o600);

  try {
    run(CONFIG.container ? 'docker' : 'pg_dump', args, {
      stdio: ['ignore', out, 'inherit'],
      maxBuffer: 1024 * 1024 * 1024,
    });
  } finally {
    fs.closeSync(out);
  }
}

function encrypt(file) {
  const target = `${file}.gpg`;

  run('gpg', [
    '--batch',
    '--yes',
    '--encrypt',
    '--recipient',
    CONFIG.gpgRecipient,
    '--output',
    target,
    file,
  ]);
  fs.unlinkSync(file);

  return target;
}

function upload(file) {
  const uri = `${CONFIG.s3Uri.replace(/\/$/, '')}/${path.basename(file)}`;

  const endpoint = CONFIG.s3Endpoint
    ? ['--endpoint-url', CONFIG.s3Endpoint]
    : [];

  run('aws', [...endpoint, 's3', 'cp', file, uri], { stdio: 'inherit' });

  return uri;
}

function rotate() {
  const files = fs
    .readdirSync(CONFIG.dir)
    .filter((name) => name.startsWith(`${CONFIG.db}-`) && parseStamp(name));

  const keep = pickKeepers(files, CONFIG.keep);
  const removed = [];

  for (const name of files) {
    if (!keep.has(name)) {
      fs.unlinkSync(path.join(CONFIG.dir, name));
      removed.push(name);
    }
  }

  return { kept: keep.size, removed };
}

async function ping(url) {
  try {
    await fetch(url, { method: 'POST' });
  } catch {
    console.warn('Не удалось пингнуть healthcheck — проверьте URL');
  }
}

(async () => {
  fs.mkdirSync(CONFIG.dir, { recursive: true });

  let file = path.join(
    CONFIG.dir,
    `${CONFIG.db}-${stamp(new Date())}-${randomBytes(8).toString('hex')}.dump`,
  );
  const partial = `${file}.partial`;
  let size;

  try {
    dump(partial);
    size = fs.statSync(partial).size;
    if (size < 1024) {
      throw new Error(
        `Дамп подозрительно мал (${size} байт) — считаю неудачей`,
      );
    }
    fs.renameSync(partial, file);
  } finally {
    if (fs.existsSync(partial)) fs.unlinkSync(partial);
  }

  if (CONFIG.gpgRecipient) {
    file = encrypt(file);
  }

  if (CONFIG.s3Uri) {
    console.log(`Выгружено: ${upload(file)}`);
  }

  const { kept, removed } = rotate();

  console.log(
    `Дамп готов: ${path.basename(file)} (${(size / 1048576).toFixed(2)} МБ)`,
  );
  console.log(`Хранится копий: ${kept}, удалено по ротации: ${removed.length}`);

  if (CONFIG.healthcheckUrl) {
    await ping(CONFIG.healthcheckUrl);
  }
})().catch((error) => {
  console.error('Бэкап НЕ выполнен:', error.message);
  process.exit(1);
});
