const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

async function run(
  script,
  {
    databases = new Map(),
    target,
    restoreError = false,
    restoredCount = 1,
    dumpError = false,
    executions = 1,
  } = {},
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'favourite-backup-test-'));
  const dump = path.join(dir, 'qa-2026-10-14T1200Z.dump');
  fs.writeFileSync(dump, Buffer.alloc(2048));
  const output = [];
  let exitCode = 0;
  const stopped = new Error('process.exit');
  const source = fs.readFileSync(path.join(__dirname, script), 'utf8');
  const execute = (command, argv, options) => {
    assert.notEqual(
      command,
      'docker',
      'При PG_CONTAINER="" нужны локальные утилиты',
    );
    if (command === 'createdb') {
      const name = argv.at(-1);
      if (databases.has(name)) throw new Error('database already exists');
      databases.set(name, 0);
    } else if (command === 'dropdb') {
      databases.delete(argv.at(-1));
    } else if (command === 'pg_restore') {
      const name = argv[argv.indexOf('-d') + 1];
      if (restoreError) {
        if (!argv.includes('--single-transaction')) databases.set(name, -1);
        throw new Error('invalid archive');
      }
      databases.set(name, restoredCount);
    } else if (command === 'psql') {
      const sql = argv.at(-1);
      return sql.includes('to_regclass')
        ? 't'
        : String(databases.get(argv[argv.indexOf('-d') + 1]) ?? 1);
    } else if (command === 'pg_dump') {
      fs.writeSync(options.stdio[1], Buffer.alloc(dumpError ? 128 : 2048));
      if (dumpError) throw new Error('dump interrupted');
    } else {
      throw new Error(`Unexpected command ${command}`);
    }
    return '';
  };
  const context = {
    __dirname,
    URL,
    console: {
      log: (...values) => output.push(values.join(' ')),
      error: (...values) => output.push(values.join(' ')),
    },
    process: {
      argv: [
        'node',
        script,
        dump,
        ...(target ? ['--into', target, '--yes'] : []),
      ],
      env: { PG_CONTAINER: '', PG_USER: 'qa', PG_DB: 'qa', BACKUP_DIR: dir },
      exit: (code) => {
        exitCode = code;
        throw stopped;
      },
    },
    require: (name) => {
      if (name === 'fs')
        return {
          ...fs,
          readFileSync: (file, ...args) => {
            assert.notEqual(
              path.basename(file),
              '.env',
              'Явные PG_* не должны читать приватный env',
            );
            return fs.readFileSync(file, ...args);
          },
        };
      if (name === 'child_process') return { execFileSync: execute };
      return require(name);
    },
  };
  let files;
  try {
    for (let index = 0; index < executions; index++) {
      await vm.runInNewContext(source, { ...context }, { filename: script });
    }
  } catch (error) {
    if (error !== stopped) throw error;
  } finally {
    files = fs.readdirSync(dir).map((name) => ({
      name,
      mode: fs.statSync(path.join(dir, name)).mode & 0o777,
    }));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { exitCode, output: output.join('\n'), databases, files };
}

test('проверка дампа использует явные настройки и не удаляет существующую базу', async () => {
  const databases = new Map([
    ['qa', 1],
    ['qa_verify', 42],
  ]);
  const result = await run('db-verify.cjs', { databases });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(
    [...databases],
    [
      ['qa', 1],
      ['qa_verify', 42],
    ],
  );
});

test('несовпадение данных не выдаёт успешную проверку дампа', async () => {
  const result = await run('db-verify.cjs', {
    databases: new Map([['qa', 1]]),
    restoredCount: 2,
  });
  assert.equal(result.exitCode, 1);
  assert.deepEqual([...result.databases], [['qa', 1]]);
});

test('восстановление в занятую новую базу отказывает и сохраняет её данные', async () => {
  const databases = new Map([
    ['qa', 1],
    ['qa_restored', 42],
  ]);
  const result = await run('db-restore.cjs', {
    databases,
    target: 'qa_restored',
  });
  assert.equal(result.exitCode, 1);
  assert.equal(databases.get('qa_restored'), 42);
});

test('ошибка восстановления не оставляет рабочую базу частично изменённой', async () => {
  const databases = new Map([['qa', 42]]);
  const result = await run('db-restore.cjs', {
    databases,
    target: 'qa',
    restoreError: true,
  });
  assert.equal(result.exitCode, 1);
  assert.equal(databases.get('qa'), 42);
  assert.doesNotMatch(result.output, /Готово/);
});

test('предпросмотр восстановления не меняет ни одну базу', async () => {
  const databases = new Map([['qa', 42]]);
  const result = await run('db-restore.cjs', { databases });
  assert.equal(result.exitCode, 0);
  assert.deepEqual([...databases], [['qa', 42]]);
});

test('оборванный бэкап не оставляет файл, похожий на готовый дамп', async () => {
  const result = await run('db-backup.cjs', { dumpError: true });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(
    result.files.map((file) => file.name),
    ['qa-2026-10-14T1200Z.dump'],
  );
});

test('два бэкапа подряд сохраняют отдельные закрытые копии', async () => {
  const result = await run('db-backup.cjs', { executions: 2 });
  assert.equal(result.exitCode, 0);
  const copies = result.files.filter(
    (file) => file.name !== 'qa-2026-10-14T1200Z.dump',
  );
  assert.equal(copies.length, 2);
  assert.ok(copies.every((file) => file.mode === 0o600));
});

test('ошибка страховочного дампа отменяет восстановление и не оставляет готовую копию', async () => {
  const databases = new Map([['qa', 42]]);
  const result = await run('db-restore.cjs', {
    databases,
    target: 'qa',
    dumpError: true,
  });
  assert.equal(result.exitCode, 1);
  assert.equal(databases.get('qa'), 42);
  assert.deepEqual(
    result.files.map((file) => file.name),
    ['qa-2026-10-14T1200Z.dump'],
  );
});
