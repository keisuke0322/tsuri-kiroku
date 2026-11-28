import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
import * as valibot from 'valibot';

const context = vm.createContext({ Date, Number, String, Object });
const validator = new vm.SyntheticModule(
  Object.keys(valibot),
  function () {
    for (const [key, value] of Object.entries(valibot))
      this.setExport(key, value);
  },
  { context },
);
const generated = new vm.SourceTextModule(
  ts.transpileModule(
    await readFile('lib/api/generated/valibot.gen.ts', 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { context },
);
await generated.link(() => validator);
await generated.evaluate();
const source = new vm.SourceTextModule(
  ts.transpileModule(await readFile('app/catch-validation.ts', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { context },
);
await source.link((name) => (name === 'valibot' ? validator : generated));
await source.evaluate();
const { validateCatch, parseCatch: rawParseCatch } = source.namespace;
const parseCatch = (value) => {
  const result = rawParseCatch(value);
  return result ? JSON.parse(JSON.stringify(result)) : result;
};

const valid = {
  date: '2024-02-29',
  location: ' 海 ',
  fish: [{ species: ' アジ ', count: '2', length: '' }],
  method: ' 竿 ',
  memo: ' 記録 ',
};
assert.deepEqual(parseCatch(valid), {
  date: '2024-02-29',
  location: '海',
  fish: [{ species: 'アジ', count: 2, length: null }],
  memo: '記録',
  legacy: false,
});
for (const length of ['', null, undefined, 0, 999, '12.5'])
  assert.ok(
    parseCatch({ ...valid, fish: [{ species: '魚', count: 1, length }] }),
  );
for (const date of [
  '2023-02-29',
  '2024-02-30',
  '2026-04-31',
  '2026-13-01',
  '2026-00-01',
  '2026-01-00',
  '2026-1-01',
  '',
])
  assert.ok(validateCatch({ ...valid, date }).errors.date);
for (const count of [
  '',
  null,
  undefined,
  ' ',
  0,
  -1,
  1.1,
  10000,
  Infinity,
  'NaN',
])
  assert.ok(
    validateCatch({ ...valid, fish: [{ species: '魚', count }] }).errors[
      'fish.0.count'
    ],
  );
for (const count of [1, 9999, '1', '9999'])
  assert.ok(parseCatch({ ...valid, fish: [{ species: '魚', count }] }));
for (const length of [-1, 1000, Infinity, NaN, 'abc'])
  assert.ok(
    validateCatch({ ...valid, fish: [{ species: '魚', count: 1, length }] })
      .errors['fish.0.length'],
  );
for (const [field, max] of [
  ['location', 120],
  ['memo', 2000],
]) {
  assert.ok(parseCatch({ ...valid, [field]: 'あ'.repeat(max) }));
  assert.ok(
    validateCatch({ ...valid, [field]: 'あ'.repeat(max + 1) }).errors[field],
  );
}
assert.ok(
  parseCatch({ ...valid, fish: [{ species: '魚'.repeat(80), count: 1 }] }),
);
assert.ok(
  validateCatch({ ...valid, fish: [{ species: '魚'.repeat(81), count: 1 }] })
    .errors['fish.0.species'],
);
assert.ok(
  parseCatch({
    ...valid,
    fish: Array.from({ length: 20 }, (_, i) => ({
      species: String(i),
      count: 1,
    })),
  }),
);
for (const fish of [
  [],
  Array.from({ length: 21 }, (_, i) => ({ species: String(i), count: 1 })),
])
  assert.ok(validateCatch({ ...valid, fish }).errors.fish);
const invalid = {
  ...valid,
  date: '',
  location: ' ',
  fish: [
    { species: 'アジ', count: '' },
    { species: ' アジ ', count: 0 },
    { species: ' ', count: 10000 },
  ],
  memo: '海'.repeat(2001),
};
const original = structuredClone(invalid),
  errors = validateCatch(invalid).errors;
for (const key of [
  'date',
  'location',
  'fish.0.species',
  'fish.1.species',
  'fish.2.species',
  'fish.0.count',
  'fish.1.count',
  'fish.2.count',
  'memo',
])
  assert.ok(errors[key], key);
assert.deepEqual(
  invalid,
  original,
  'Validation must retain the entered values',
);
assert.equal(Object.keys(validateCatch(valid).errors).length, 0);
assert.deepEqual(
  parseCatch({ date: '2026-10-05', location: '海', species: '魚', count: '1' }),
  {
    date: '2026-10-05',
    location: '海',
    fish: [{ species: '魚', count: 1, length: null }],
    memo: '',
    legacy: true,
  },
);
for (const input of [null, undefined, [], 1, 'bad'])
  assert.equal(parseCatch(input), null);
console.log(
  'Catch validation passed: required fields, dates, boundaries, coercion, duplicates by row, legacy payload and preserved input.',
);

assert.equal(
  Object.hasOwn(parseCatch(valid), 'method'),
  false,
  'Retired input must not be persisted',
);

// Retain the existing field messages when switching to generated schemas.
const missing = validateCatch({
  date: '',
  location: '',
  fish: [{ species: '', count: '' }],
  memo: '',
}).errors;
assert.equal(missing.location, '場所を入力してください。');
assert.equal(missing['fish.0.species'], '魚種を入力してください。');
assert.equal(missing.date, '釣行日を選択してください。');
assert.equal(missing['fish.0.count'], '匹数を入力してください。');
assert.equal(
  validateCatch({ ...valid, location: '海'.repeat(121) }).errors.location,
  '場所は120文字以内で入力してください。',
);
assert.equal(
  validateCatch({ ...valid, fish: [{ species: '魚', count: 0 }] }).errors[
    'fish.0.count'
  ],
  '匹数は1〜9999で入力してください。',
);
