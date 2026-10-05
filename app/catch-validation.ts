import * as v from 'valibot';

const text = () => v.pipe(v.optional(v.unknown(), ''), v.transform(value => String(value || '').trim()));
const requiredText = (name: string, max: number) => v.pipe(text(), v.nonEmpty(`${name}を入力してください。`), v.maxLength(max, `${name}は${max}文字以内で入力してください。`));
const numeric = v.pipe(v.optional(v.unknown(), null), v.transform(value => value == null || typeof value === 'string' && !value.trim() ? NaN : Number(value)));
const countSchema = v.pipe(numeric, v.number('匹数を入力してください。'), v.integer('匹数は整数で入力してください。'), v.minValue(1, '匹数は1〜9999で入力してください。'), v.maxValue(9999, '匹数は1〜9999で入力してください。'));
const lengthSchema = v.pipe(v.optional(v.unknown(), null), v.transform(value => value === '' || value == null ? null : Number(value)), v.nullable(v.pipe(v.number('サイズは数値で入力してください。'), v.finite('サイズは有限の数値で入力してください。'), v.minValue(0, 'サイズは0〜999cmで入力してください。'), v.maxValue(999, 'サイズは0〜999cmで入力してください。'))));
const fishSchema = v.object({species: requiredText('魚種', 80), count: countSchema, length: lengthSchema});
const uniqueFishSchema = v.pipe(v.array(v.object({species: requiredText('魚種', 80)})), v.rawCheck(({dataset, addIssue}) => {
 if (!dataset.typed) return;
 const fish = dataset.value;
 fish.forEach((row, index) => {
  if (row.species && fish.some((other, i) => i !== index && other.species === row.species)) addIssue({message: '魚種が重複しています。別の魚種を入力してください。', path: [
   {type: 'array', origin: 'value', input: fish, key: index, value: row},
   {type: 'object', origin: 'value', input: row, key: 'species', value: row.species},
  ]});
 });
}));
const fishListSchema = v.intersect([v.pipe(v.array(fishSchema, '魚種を入力してください。'), v.minLength(1, '魚種を1つ以上登録してください。'), v.maxLength(20, '魚種は20種類まで登録できます。')), uniqueFishSchema]);
function validDate(value: string) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const date = new Date(value + 'T00:00:00Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const catchSchema = v.object({
 date: v.pipe(v.optional(v.unknown(), ''), v.transform(value => String(value || '')), v.nonEmpty('釣行日を選択してください。'), v.check(validDate, '釣行日には有効な日付を指定してください。')),
 location: requiredText('場所', 120), fish: fishListSchema,
 method: v.pipe(text(), v.maxLength(200, '釣り方・仕掛けは200文字以内で入力してください。')),
 memo: v.pipe(text(), v.maxLength(2000, 'メモは2000文字以内で入力してください。')),
});
export type CatchFieldErrors = Record<string, string>;
export function validateCatch(input: unknown) {
 const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
 const legacy = !Array.isArray(value.fish);
 const normalized = {...value, fish: legacy ? [{species: value.species, count: value.count, length: value.length}] : value.fish};
 const result = v.safeParse(catchSchema, normalized);
 const errors: CatchFieldErrors = {};
 if (!result.success) for (const issue of result.issues) {
  const key = issue.path?.map(part => String(part.key)).join('.') || 'form';
  errors[key] ??= issue.message;
 }
 return result.success ? {success: true as const, data: {...result.output, legacy}, errors} : {success: false as const, errors};
}
export function parseCatch(input: unknown) {
 const result = validateCatch(input);
 return result.success ? result.data : null;
}
export type FishInput = v.InferOutput<typeof fishSchema>;
