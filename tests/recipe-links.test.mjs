import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const code = ts.transpileModule(await readFile('app/recipe-links.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { recipeLinks } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);

for (const [input, expected] of [
  ['アジ', '釣り アジ'],
  ['太刀魚', '釣り 太刀魚'],
  ['　 アジ \n', '釣り アジ'],
  ['魚 / ? # & %', '釣り 魚 / ? # & %'],
  [
    'とても長い名前の魚（地方名・別名を含む）',
    '釣り とても長い名前の魚（地方名・別名を含む）',
  ],
]) {
  const links = recipeLinks(input);
  assert.deepEqual(
    links.map((link) => link.label),
    ['楽天レシピで探す', 'クックパッドで探す'],
  );
  for (const [index, link] of links.entries()) {
    const url = new URL(link.href);
    assert.equal(url.protocol, 'https:');
    assert.equal(
      url.hostname,
      index === 0 ? 'recipe.rakuten.co.jp' : 'cookpad.com',
    );
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    const path =
      index === 0
        ? url.pathname.slice('/search/'.length, -1)
        : url.pathname.slice('/jp/search/'.length);
    assert.equal(decodeURIComponent(path), expected);
  }
}
console.log(
  'Recipe links passed: Japanese names, trimming, long names and URL-reserved characters.',
);
