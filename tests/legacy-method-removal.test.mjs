import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { cleanupMigrations } from '../scripts/cloudflare-migrations.mjs';

test('removing record-level method preserves catches and every related table', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  try {
    for (const file of (await readdir('drizzle'))
      .filter((f) => f.endsWith('.sql') && f < '0011')
      .sort())
      db.exec(await readFile(`drizzle/${file}`, 'utf8'));
    db.exec(`INSERT INTO profiles(user_id,display_name) VALUES ('owner','釣り人');
      INSERT INTO catches(id,date,location,species,count,method,memo,owner_id) VALUES (1,'2026-11-08','港','アジ',2,'削除対象','残すメモ','owner');
      INSERT INTO catch_fish(catch_id,species,count,sort_order) VALUES (1,'アジ',2,0);
      INSERT INTO catch_likes(catch_id,user_id) VALUES (1,'owner');
      UPDATE photo_storage_settings SET initialized=1 WHERE id=1;
      INSERT INTO photo_storage_objects(object_key,owner_id,catch_id,byte_size,state,created_at) VALUES ('photo','owner',1,42,'reserved','2026-11-08');
      INSERT INTO catch_photos(catch_id,object_key,content_type,created_at,species) VALUES (1,'photo','image/jpeg','2026-11-08','アジ');
      UPDATE photo_storage_objects SET state='stored' WHERE object_key='photo';
      INSERT INTO gear_sets(id,owner_id,name,method,gear_json) VALUES (1,'owner','基本セット','残すセットの釣り方','[]');
      INSERT INTO catch_combinations(catch_id,set_id,set_name,method,gear_json,species_json,signature,sort_order) VALUES (1,1,'基本セット','残す組み合わせの釣り方','[]','["アジ"]','sig',0);`);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((r) => r.name);
    const snapshot = () =>
      Object.fromEntries(
        tables.map((table) => [
          table,
          db
            .prepare(`SELECT * FROM ${table} ORDER BY rowid`)
            .all()
            .map((row) => {
              const value = { ...row };
              if (table === 'catches') delete value.method;
              return value;
            }),
        ]),
      );
    const before = snapshot();
    db.exec(await readFile('drizzle/0011_remove_legacy_method.sql', 'utf8'));
    assert.deepEqual(snapshot(), before);
    assert.equal(
      db
        .prepare('PRAGMA table_info(catches)')
        .all()
        .some((r) => r.name === 'method'),
      false,
    );
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(
      db.prepare('PRAGMA integrity_check').get().integrity_check,
      'ok',
    );
    assert.throws(() => db.prepare('SELECT method FROM catches'));
    // New writes work once the column is physically gone, without a rebuild.
    db.exec(
      "INSERT INTO catches(date,location,species,count,owner_id) VALUES ('2026-11-09','海','サバ',1,'owner')",
    );
  } finally {
    db.close();
  }
});

test('both destructive removals are deferred until after Worker verification', () => {
  assert.ok(cleanupMigrations.includes('0009_remove_guest_public.sql'));
  assert.ok(cleanupMigrations.includes('0011_remove_legacy_method.sql'));
});
