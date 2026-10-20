#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { parseStamp, pickKeepers } = require('./retention.cjs');

const IMAGE =
  'public.ecr.aws/aws-cli/aws-cli@sha256:733d5be1015825e4038c6016f3fa9954868ddee1f611b73be795a9cc2e706bfd';
const RECIPIENT = '071B3507C032D951A28CED18ED66422BEFCBD333';
const KEEP = { hourly: 24, daily: 7, weekly: 4, monthly: 3 };
const DUMP = /^favorite-\d{4}-\d{2}-\d{2}T\d{4}Z-[a-f0-9]{16}\.dump$/;
const OBJECT =
  /^db\/favorite-\d{4}-\d{2}-\d{2}T\d{4}Z-[a-f0-9]{16}-[a-f0-9]{16}\.dump\.gpg$/;

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function privatePath(file, directory) {
  const stat = fs.lstatSync(file);
  if ((directory ? !stat.isDirectory() : !stat.isFile()) || stat.mode & 0o077) {
    throw new Error('Unsafe permissions or file type: ' + file);
  }
  return stat;
}

// Запускать после локального дампа под общей блокировкой deploy/backup с flock --close.
async function backupOffsite(
  {
    directory = '/srv/favorite/backups',
    credentials = '/etc/favkino-backup/s3-credentials',
    keyring = '/etc/favkino-backup/gnupg',
  } = {},
  execute = execFileSync,
) {
  privatePath(directory, true);
  privatePath(credentials, false);
  privatePath(keyring, true);
  const name = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && DUMP.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  if (!name) throw new Error('No completed local dump');
  const source = path.join(directory, name);
  const stat = privatePath(source, false);
  const at = parseStamp(name);
  if (stat.size < 1024 || !Number.isFinite(at?.getTime())) {
    throw new Error('Invalid local dump');
  }
  const disk = fs.statfsSync(directory, { bigint: true });
  // Место для шифротекста и проверочного скачивания, сверх резерва 3 ГиБ.
  if (disk.bavail * disk.bsize < 3221225472n + BigInt(stat.size) * 3n) {
    throw new Error('BACKUP_LOW_DISK_SPACE');
  }

  const work = fs.mkdtempSync(path.join(directory, 'offsite-'));
  const cipher = path.join(work, 'archive.dump.gpg');
  const downloaded = path.join(work, 'downloaded.gpg');
  const key =
    'db/' +
    name.slice(0, -5) +
    '-' +
    randomBytes(8).toString('hex') +
    '.dump.gpg';
  const run = (command, args) =>
    execute(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
  const aws = (operation, args, mount = '') => {
    const mounts = mount
      ? [
          '--mount',
          'type=bind,src=' +
            work +
            ',dst=/work' +
            (mount === 'read' ? ',readonly' : ''),
        ]
      : [];
    return run('docker', [
      'run',
      '--rm',
      '--pull',
      'never',
      '--mount',
      'type=bind,src=' + credentials + ',dst=/run/s3-credentials,readonly',
      ...mounts,
      '-e',
      'AWS_SHARED_CREDENTIALS_FILE=/run/s3-credentials',
      '-e',
      'AWS_EC2_METADATA_DISABLED=true',
      '-e',
      'AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED',
      IMAGE,
      '--endpoint-url',
      'https://s3.twcstorage.ru',
      '--region',
      'ru-1',
      '--cli-connect-timeout',
      '10',
      '--cli-read-timeout',
      '30',
      '--no-cli-pager',
      '--output',
      'json',
      's3api',
      operation,
      '--bucket',
      'favkino-backups',
      ...args,
    ]);
  };

  try {
    const plainHash = await sha256(source);
    run('gpg', [
      '--homedir',
      keyring,
      '--batch',
      '--no-tty',
      '--trust-model',
      'always',
      '--encrypt',
      '--recipient',
      RECIPIENT,
      '--output',
      cipher,
      source,
    ]);
    fs.chmodSync(cipher, 0o600);
    if (!fs.statSync(cipher).size) throw new Error('Empty encrypted backup');
    const cipherHash = await sha256(cipher);
    aws(
      'put-object',
      [
        '--key',
        key,
        '--body',
        '/work/archive.dump.gpg',
        '--metadata',
        'plain-sha256=' + plainHash + ',cipher-sha256=' + cipherHash,
      ],
      'read',
    );
    const received = JSON.parse(
      aws('get-object', ['--key', key, '/work/downloaded.gpg'], 'write'),
    );
    if ((await sha256(downloaded)) !== cipherHash) {
      throw new Error('OFFSITE_DOWNLOAD_HASH_MISMATCH');
    }
    if (
      received.Metadata?.['plain-sha256'] !== plainHash ||
      received.Metadata?.['cipher-sha256'] !== cipherHash
    ) {
      throw new Error('OFFSITE_METADATA_MISMATCH');
    }
    console.log('OFFSITE_ROUNDTRIP_OK ' + key);
    console.log('PLAIN_SHA256=' + plainHash + ' CIPHER_SHA256=' + cipherHash);

    const entries = [];
    const tokens = new Set();
    let token;
    do {
      const listing = JSON.parse(
        aws('list-objects-v2', [
          '--prefix',
          'db/',
          '--no-paginate',
          ...(token ? ['--continuation-token', token] : []),
        ]),
      );
      if (
        typeof listing.IsTruncated !== 'boolean' ||
        !Array.isArray(listing.Contents ?? []) ||
        (listing.Contents ?? []).some(
          (entry) => !entry || typeof entry.Key !== 'string',
        )
      ) {
        throw new Error('Invalid S3 listing');
      }
      entries.push(...(listing.Contents ?? []));
      token = listing.IsTruncated ? listing.NextContinuationToken : undefined;
      if (
        listing.IsTruncated &&
        (typeof token !== 'string' || !token || tokens.has(token))
      ) {
        throw new Error('Incomplete S3 listing');
      }
      tokens.add(token);
    } while (token);
    const files = entries.filter(
      (entry) =>
        OBJECT.test(entry.Key) &&
        Number.isFinite(parseStamp(entry.Key)?.getTime()),
    );
    if (
      !files.some(
        (entry) => entry.Key === key && entry.Size === fs.statSync(cipher).size,
      )
    ) {
      throw new Error('Verified object missing from S3 listing');
    }
    const keep = pickKeepers(
      files.map((entry) => entry.Key),
      KEEP,
    );
    keep.add(key);
    let removed = 0;
    for (const entry of files) {
      if (!keep.has(entry.Key)) {
        aws('delete-object', ['--key', entry.Key]);
        removed++;
      }
    }
    console.log(
      'OFFSITE_ROTATION_OK kept=' + keep.size + ' removed=' + removed,
    );
    console.log('OFFSITE_BACKUP_OK');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

module.exports = { backupOffsite };

if (require.main === module) {
  if (process.getuid() !== 0) {
    console.error('Run as root under the backup lock');
    process.exitCode = 1;
  } else {
    backupOffsite().catch((error) => {
      console.error('OFFSITE_BACKUP_FAILED: ' + error.message);
      process.exitCode = 1;
    });
  }
}
