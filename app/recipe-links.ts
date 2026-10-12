export function recipeLinks(fishName: string) {
  const query = encodeURIComponent(`釣り ${fishName.trim()}`);
  return [
    {label: '楽天レシピで探す', href: `https://recipe.rakuten.co.jp/search/${query}/`},
    {label: 'クックパッドで探す', href: `https://cookpad.com/jp/search/${query}`},
  ];
}
