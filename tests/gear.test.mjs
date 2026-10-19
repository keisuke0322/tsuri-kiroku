import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const source = ts.transpileModule(await readFile('app/gear.ts', 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { combinationSignature, reconcileSpecies, emptyCombination } =
  await import(
    'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
  );
const rod = {
  id: 1,
  kind: 'ロッド',
  name: '竿',
  manufacturer: '',
  model: '',
  spec: 'PE 0.8号',
};
const lure = {
  id: 2,
  kind: 'ルアー',
  name: 'ルアー',
  manufacturer: '',
  model: '',
  spec: '20g',
};
const combo = {
  ...emptyCombination(['タチウオ']),
  method: 'テンヤ',
  gear: [rod, lure],
  setId: 1,
};
assert.equal(
  combinationSignature(combo),
  combinationSignature({
    ...combo,
    gear: [lure, { ...rod, name: '変更後', spec: 'PE 2号' }],
    species: ['アジ'],
    setId: 2,
  }),
);
assert.notEqual(
  combinationSignature(combo),
  combinationSignature({ ...combo, method: '浮き釣り' }),
);
assert.notEqual(
  combinationSignature(combo),
  combinationSignature({ ...combo, gear: [rod] }),
);
const temporary = { ...combo, gear: [{ ...lure, id: null }] };
assert.notEqual(
  combinationSignature(temporary),
  combinationSignature({
    ...temporary,
    gear: [{ ...lure, id: null, spec: '30g' }],
  }),
);
assert.deepEqual(
  reconcileSpecies([emptyCombination()], [''], ['アジ'])[0].species,
  ['アジ'],
);
assert.deepEqual(
  reconcileSpecies([{ ...combo, species: [] }], ['タチウオ'], ['タチウオ'])[0]
    .species,
  [],
  'explicit clearing stays cleared',
);
assert.deepEqual(
  reconcileSpecies([combo], ['タチウオ'], ['アジ'], ['タチウオ', 'アジ'])[0]
    .species,
  ['アジ'],
);
assert.deepEqual(
  reconcileSpecies([combo], ['タチウオ', 'サバ'], ['サバ'])[0].species,
  [],
  'deleted fish is removed',
);
assert.deepEqual(
  reconcileSpecies([combo], ['タチウオ'], ['タチウオ', 'サバ'])[0].species,
  ['タチウオ'],
);

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for (const file of (await readdir('drizzle'))
  .filter((f) => f.endsWith('.sql') && f < '0010')
  .sort())
  db.exec(await readFile('drizzle/' + file, 'utf8'));
db.exec(
  "INSERT INTO profiles(user_id,display_name) VALUES ('owner','釣り人'); INSERT INTO catches(date,location,species,count,owner_id) VALUES ('2026-10-19','港','アジ',2,'owner')",
);
const before = db.prepare('SELECT * FROM catches').get();
db.exec(await readFile('drizzle/0010_gear.sql', 'utf8'));
assert.deepEqual(db.prepare('SELECT * FROM catches').get(), before);
assert.equal(
  db.prepare('SELECT COUNT(*) n FROM catch_combinations').get().n,
  0,
);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
db.close();
console.log(
  'Gear identity, fish association and additive migration checks passed.',
);
