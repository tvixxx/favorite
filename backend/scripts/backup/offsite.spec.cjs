const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pickKeepers } = require('./retention.cjs');
const { backupOffsite } = require('./db-offsite.cjs');

test('GFS сохраняет все часовые копии и последние доступные периоды после перерыва', () => {
  const now = Date.UTC(2026, 9, 20, 12);
  const name = (time) =>
    'favorite-' +
    new Date(time).toISOString().slice(0, 16).replace(':', '') +
    'Z' +
    '-a.dump.gpg';
  const hourly = Array.from({ length: 25 }, (_, i) => name(now - i * 3600000));
  const old = Array.from({ length: 120 }, (_, i) =>
    name(now - (i + 10) * 86400000),
  );
  const files = [...hourly, ...old];
  const keep = pickKeepers(
    files,
    { hourly: 24, daily: 7, weekly: 4, monthly: 3 },
    now,
  );
  assert.ok(hourly.every((file) => keep.has(file)));
  assert.ok(keep.size < files.length);
  const afterOutage = pickKeepers(
    old,
    { hourly: 24, daily: 7, weekly: 4, monthly: 3 },
    now + 365 * 86400000,
  );
  assert.ok(afterOutage.has(old[0]));
  assert.ok(afterOutage.size > 3);
});

function fixture(t, failure) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'favkino-offsite-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'backups');
  const credentials = path.join(root, 'credentials');
  const keyring = path.join(root, 'gnupg');
  fs.mkdirSync(directory, { mode: 0o700 });
  fs.mkdirSync(keyring, { mode: 0o700 });
  fs.writeFileSync(credentials, 'fake credentials', { mode: 0o600 });
  const stamp = new Date().toISOString().slice(0, 16).replace(':', '') + 'Z';
  const dump = path.join(
    directory,
    'favorite-' + stamp + '-0123456789abcdef.dump',
  );
  const plaintext = Buffer.alloc(2048, 42);
  fs.writeFileSync(dump, plaintext, { mode: 0o600 });
  const objects = new Map();
  for (let i = 1; i <= 120; i++) {
    const time =
      new Date(Date.now() - i * 86400000)
        .toISOString()
        .slice(0, 16)
        .replace(':', '') + 'Z';
    objects.set(
      'db/favorite-' + time + '-0123456789abcdef-fedcba9876543210.dump.gpg',
      Buffer.from('old'),
    );
  }
  objects.set(
    'verification/original/archive.dump.gpg',
    Buffer.from('manual check'),
  );
  objects.set('db/unrelated.txt', Buffer.from('foreign object'));
  const before = new Map(objects);
  const operations = [];
  let uploaded;
  let metadata;
  let mounts;
  const execute = (command, args) => {
    if (command === 'gpg') {
      if (failure === 'encryption') throw new Error('encryption failed');
      assert.equal(args[args.indexOf('--homedir') + 1], keyring);
      assert.equal(
        args[args.indexOf('--recipient') + 1],
        '071B3507C032D951A28CED18ED66422BEFCBD333',
      );
      fs.writeFileSync(
        args[args.indexOf('--output') + 1],
        'encrypted fixture',
        { mode: 0o600 },
      );
      return '';
    }
    assert.equal(command, 'docker');
    assert.ok(args.includes('--pull'));
    assert.equal(args[args.indexOf('--pull') + 1], 'never');
    assert.ok(args.includes('AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED'));
    mounts = args.filter((arg) => arg.startsWith('type=bind,'));
    assert.ok(
      mounts.some(
        (mount) =>
          mount.includes('src=' + credentials + ',') &&
          mount.endsWith('readonly'),
      ),
    );
    assert.ok(
      !mounts.some((mount) => mount.includes('src=' + directory + ',')),
    );
    const workMount = mounts.find((mount) => mount.includes('dst=/work'));
    const work = workMount?.match(/src=([^,]+)/)?.[1];
    const op = args[args.indexOf('s3api') + 1];
    const value = (flag) => args[args.indexOf(flag) + 1];
    operations.push(op);
    assert.equal(value('--bucket'), 'favkino-backups');
    if (op === 'put-object') {
      if (failure === 'upload') throw new Error('upload failed');
      uploaded = value('--key');
      metadata = value('--metadata');
      objects.set(
        uploaded,
        fs.readFileSync(path.join(work, 'archive.dump.gpg')),
      );
    } else if (op === 'get-object') {
      fs.writeFileSync(
        path.join(work, 'downloaded.gpg'),
        failure === 'mismatch' ? 'corrupt' : objects.get(value('--key')),
      );
      return JSON.stringify({
        Metadata:
          failure === 'metadata'
            ? {}
            : Object.fromEntries(
                metadata.split(',').map((item) => item.split('=')),
              ),
      });
    } else if (op === 'list-objects-v2') {
      if (failure === 'listing') throw new Error('listing failed');
      if (failure === 'truncated')
        return JSON.stringify({ IsTruncated: true, Contents: [] });
      assert.equal(value('--prefix'), 'db/');
      if (failure === 'invalid-listing') return 'null';
      const contents = [...objects]
        .filter(([key]) => key.startsWith('db/'))
        .map(([Key, body]) => ({ Key, Size: body.length }));
      if (failure === 'missing-upload')
        return JSON.stringify({
          IsTruncated: false,
          Contents: contents.filter((entry) => entry.Key !== uploaded),
        });
      if (failure === 'paged' && !args.includes('--continuation-token')) {
        return JSON.stringify({
          IsTruncated: true,
          NextContinuationToken: 'page2',
          Contents: contents.slice(0, 60),
        });
      }
      if (failure === 'paged') {
        assert.equal(value('--continuation-token'), 'page2');
        return JSON.stringify({
          IsTruncated: false,
          Contents: contents.slice(60),
        });
      }
      return JSON.stringify({ IsTruncated: false, Contents: contents });
    } else if (op === 'delete-object') {
      assert.ok(operations.includes('get-object'));
      assert.notEqual(value('--key'), uploaded);
      objects.delete(value('--key'));
    } else {
      throw new Error('Unexpected S3 operation ' + op);
    }
    return '{}';
  };
  return {
    config: { directory, credentials, keyring },
    execute,
    objects,
    before,
    operations,
    dump,
    plaintext,
    get uploaded() {
      return uploaded;
    },
    get metadata() {
      return metadata;
    },
  };
}

test('успех сохраняет локальный дамп, проверяет S3 и удаляет только старые управляемые объекты', async (t) => {
  const f = fixture(t);
  await backupOffsite(f.config, f.execute);
  assert.deepEqual(fs.readFileSync(f.dump), f.plaintext);
  assert.ok(f.objects.has(f.uploaded));
  assert.equal(
    f.objects.get('verification/original/archive.dump.gpg').toString(),
    'manual check',
  );
  assert.equal(f.objects.get('db/unrelated.txt').toString(), 'foreign object');
  assert.ok(f.operations.includes('delete-object'));
  const hash = createHash('sha256').update(f.plaintext).digest('hex');
  assert.ok(f.metadata.includes('plain-sha256=' + hash));
  assert.deepEqual(fs.readdirSync(f.config.directory), [path.basename(f.dump)]);
});

for (const failure of [
  'encryption',
  'upload',
  'mismatch',
  'metadata',
  'listing',
  'truncated',
  'invalid-listing',
  'missing-upload',
]) {
  test(
    'ошибка ' +
      failure +
      ' сохраняет предыдущие внешние копии и локальный дамп',
    async (t) => {
      const f = fixture(t, failure);
      await assert.rejects(backupOffsite(f.config, f.execute));
      assert.ok(!f.operations.includes('delete-object'));
      for (const [key, bytes] of f.before)
        assert.deepEqual(f.objects.get(key), bytes);
      assert.deepEqual(fs.readFileSync(f.dump), f.plaintext);
      assert.deepEqual(fs.readdirSync(f.config.directory), [
        path.basename(f.dump),
      ]);
    },
  );
}

test('ротация учитывает все страницы S3 до удаления первого объекта', async (t) => {
  const f = fixture(t, 'paged');
  await backupOffsite(f.config, f.execute);
  assert.equal(f.operations.filter((op) => op === 'list-objects-v2').length, 2);
  assert.ok(
    f.operations.indexOf('delete-object') >
      f.operations.lastIndexOf('list-objects-v2'),
  );
  assert.ok(f.objects.has(f.uploaded));
});

test('нехватка места сохраняет все копии и останавливает работу до шифрования', async (t) => {
  const f = fixture(t);
  t.mock.method(fs, 'statfsSync', () => ({ bavail: 1n, bsize: 1n }));
  await assert.rejects(
    backupOffsite(f.config, f.execute),
    /BACKUP_LOW_DISK_SPACE/,
  );
  assert.equal(f.operations.length, 0);
  assert.deepEqual(fs.readFileSync(f.dump), f.plaintext);
});

test('публичные права файла учётных данных останавливают работу до вызова Docker', async (t) => {
  const f = fixture(t);
  fs.chmodSync(f.config.credentials, 0o644);
  await assert.rejects(backupOffsite(f.config, f.execute), /permissions/);
  assert.equal(f.operations.length, 0);
});
