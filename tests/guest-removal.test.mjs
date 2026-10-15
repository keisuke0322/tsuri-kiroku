import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  beforeDeployment,
  afterDeployment,
  cleanupMigration,
} from '../scripts/cloudflare-migrations.mjs';

test('removing both opt-in values restores the original schema and preserves every existing row', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  try {
    for (const file of (await readdir('drizzle'))
      .filter((f) => f.endsWith('.sql') && f < '0008')
      .sort())
      db.exec(await readFile(`drizzle/${file}`, 'utf8'));
    db.exec(`INSERT INTO profiles(user_id,display_name) VALUES ('owner','釣り人');
   INSERT INTO catches(date,location,species,count,owner_id,memo) VALUES ('2026-10-08','海岸','アジ',2,'owner','残す釣果'),('2026-10-09','港','シロギス',3,'owner','もう一つの釣果');
   INSERT INTO catch_fish(catch_id,species,count,sort_order) VALUES (1,'アジ',2,0),(2,'シロギス',3,0);
   INSERT INTO catch_likes(catch_id,user_id) VALUES (1,'owner');
   INSERT INTO fishing_spots(owner_id,name,latitude,longitude) VALUES ('owner','堤防',35,139);
   INSERT INTO catch_positions(catch_id,spot_id,latitude,longitude,source) VALUES (1,1,35,139,'saved');
   UPDATE photo_storage_settings SET initialized=1 WHERE id=1;
   INSERT INTO photo_storage_objects(object_key,owner_id,catch_id,byte_size,state,created_at) VALUES ('real-photo','owner',1,42,'reserved','2026-10-08');
   INSERT INTO catch_photos(catch_id,object_key,content_type,created_at,species) VALUES (1,'real-photo','image/jpeg','2026-10-08','アジ');
   UPDATE photo_storage_objects SET state='stored' WHERE object_key='real-photo';
   UPDATE catches SET featured_photo_id=1 WHERE id=1;
   INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES ('session-hash','owner',9999999999);
   INSERT INTO oauth_transactions(state_hash,verifier,nonce,expires_at) VALUES ('state','verifier','nonce',9999999999);`);
    const objects = () =>
      db
        .prepare(
          "SELECT type,name,tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name",
        )
        .all();
    const originalObjects = objects();
    const tables = originalObjects
      .filter((row) => row.type === 'table')
      .map((row) => row.name);
    const snapshot = () =>
      Object.fromEntries(
        tables.map((table) => [
          table,
          db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
        ]),
      );
    const originalRows = snapshot(),
      columns = db.prepare('PRAGMA table_info(catches)').all();
    db.exec(await readFile('drizzle/0008_guest_public.sql', 'utf8'));
    db.exec('UPDATE catches SET guest_public=1 WHERE id=1');
    assert.deepEqual(
      db
        .prepare('SELECT guest_public FROM catches ORDER BY id')
        .all()
        .map((row) => row.guest_public),
      [1, 0],
    );
    db.exec(await readFile(`drizzle/${cleanupMigration}`, 'utf8'));
    assert.deepEqual(objects(), originalObjects);
    assert.deepEqual(db.prepare('PRAGMA table_info(catches)').all(), columns);
    assert.deepEqual(snapshot(), originalRows);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(
      db.prepare('PRAGMA integrity_check').get().integrity_check,
      'ok',
    );
    assert.ok(
      !db
        .prepare("SELECT sql FROM sqlite_master WHERE name='catches'")
        .get()
        .sql.includes('guest_public'),
    );
  } finally {
    db.close();
  }
});

test('pre-deployment migration set excludes the destructive migration and removes temporary files', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'tsuri-cleanup-test-'));
  let temporary;
  try {
    const configPath = join(folder, 'wrangler.json');
    await writeFile(
      configPath,
      JSON.stringify({
        name: 'test',
        d1_databases: [
          { binding: 'DB', migrations_dir: join(process.cwd(), 'drizzle') },
        ],
      }),
    );
    await beforeDeployment(configPath, async (args) => {
      temporary = args.at(-1);
      const config = JSON.parse(await readFile(temporary, 'utf8'));
      const files = await readdir(config.d1_databases[0].migrations_dir);
      assert.ok(files.includes('0008_guest_public.sql'));
      assert.ok(!files.includes(cleanupMigration));
    });
    await assert.rejects(readFile(temporary), { code: 'ENOENT' });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('cleanup requires a recorded recovery point before applying SQL and verifies schema/foreign keys', async () => {
  const events = [];
  let query = 0;
  await afterDeployment(
    'environment.json',
    async (args) => {
      if (args.includes('execute')) {
        events.push('query');
        return JSON.stringify([
          {
            success: true,
            results: query++ === 0 ? [{ name: 'guest_public' }] : [],
          },
        ]);
      }
      if (args.includes('time-travel')) {
        events.push('backup');
        return JSON.stringify({ bookmark: '00000001-00000002-00000003' });
      }
      events.push('apply');
      return '';
    },
    async (bookmark) => {
      assert.ok(bookmark);
      events.push('record');
    },
  );
  assert.deepEqual(events, [
    'query',
    'backup',
    'record',
    'apply',
    'query',
    'query',
  ]);
  for (const fail of ['bookmark', 'record']) {
    const calls = [];
    await assert.rejects(
      afterDeployment(
        'environment.json',
        async (args) => {
          calls.push(args);
          return args.includes('execute')
            ? JSON.stringify([
                { success: true, results: [{ name: 'guest_public' }] },
              ])
            : JSON.stringify({
                bookmark: fail === 'bookmark' ? '' : 'safe-bookmark',
              });
        },
        async () => {
          throw Error('Recovery point could not be recorded');
        },
      ),
    );
    assert.ok(!calls.some((args) => args.includes('apply')));
  }
});

test('deployment verifies the login-required Worker before dropping the old guest column', async () => {
  const workflow = await readFile('.github/workflows/cloudflare.yml', 'utf8');
  const before = workflow.indexOf(
    'node scripts/cloudflare-migrations.mjs before',
  );
  const deploy = workflow.indexOf('wrangler deploy --config');
  const firstSmoke = workflow.indexOf('node scripts/cloudflare-smoke.mjs');
  const after = workflow.indexOf(
    'node scripts/cloudflare-migrations.mjs after',
  );
  const secondSmoke = workflow.indexOf(
    'node scripts/cloudflare-smoke.mjs',
    firstSmoke + 1,
  );
  const e2e = workflow.indexOf('pnpm run e2e:staging');
  assert.ok(
    before > 0 &&
      before < deploy &&
      deploy < firstSmoke &&
      firstSmoke < after &&
      after < secondSmoke &&
      secondSmoke < e2e,
  );
});
