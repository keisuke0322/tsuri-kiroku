import * as v from 'valibot';
import {
  vNormalizedCatch,
  vNormalizedFish,
} from '../lib/api/generated/valibot.gen';
import type { NormalizedFish } from '../lib/api/generated/types.gen';

function validDate(value: string) {
  const date = new Date(value + 'T00:00:00Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

// OpenAPI owns field constraints. These checks cover calendar and cross-row rules.
export const catchSchema = v.intersect([
  v.object({
    ...vNormalizedCatch.entries,
    date: v.pipe(vNormalizedCatch.entries.date, v.check(validDate)),
  }),
  v.object({
    fish: v.pipe(
      v.array(v.object({ species: v.string() })),
      v.rawCheck(({ dataset, addIssue }) => {
        if (!dataset.typed) return;
        dataset.value.forEach((row, index, fish) => {
          if (
            row.species &&
            fish.some(
              (other, i) => i !== index && other.species === row.species,
            )
          )
            addIssue({
              message: '魚種が重複しています。別の魚種を入力してください。',
              path: [
                {
                  type: 'array',
                  origin: 'value',
                  input: fish,
                  key: index,
                  value: row,
                },
                {
                  type: 'object',
                  origin: 'value',
                  input: row,
                  key: 'species',
                  value: row.species,
                },
              ],
            });
        });
      }),
    ),
  }),
]);

export type CatchFieldErrors = Record<string, string>;

const text = (value: unknown) => String(value || '').trim();
const numeric = (value: unknown) =>
  value == null || (typeof value === 'string' && !value.trim())
    ? NaN
    : Number(value);

export function validateCatch(input: unknown) {
  const value =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : {};
  const legacy = !Array.isArray(value.fish);
  const rows = legacy
    ? [{ species: value.species, count: value.count, length: value.length }]
    : (value.fish as unknown[]);
  const normalized = {
    date: String(value.date || ''),
    location: text(value.location),
    memo: text(value.memo),
    fish: rows.map((raw) => {
      const row =
        raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      return {
        species: text(row.species),
        count: numeric(row.count),
        length:
          row.length === '' || row.length == null ? null : Number(row.length),
      };
    }),
  };
  const result = v.safeParse(catchSchema, normalized);
  const errors: CatchFieldErrors = {};
  const countRules = vNormalizedFish.entries.count.pipe;
  const lengthRules = vNormalizedFish.entries.length.wrapped.pipe;
  const countRange = `${countRules.find((rule) => rule.type === 'min_value')!.requirement}〜${countRules.find((rule) => rule.type === 'max_value')!.requirement}`;
  const lengthRange = `${lengthRules.find((rule) => rule.type === 'min_value')!.requirement}〜${lengthRules.find((rule) => rule.type === 'max_value')!.requirement}`;
  if (!result.success)
    for (const issue of result.issues) {
      const key =
        issue.path?.map((part) => String(part.key)).join('.') || 'form';
      const field = key.split('.').at(-1)!;
      const requirement = 'requirement' in issue ? issue.requirement : '';
      const labels: Record<string, string> = {
        location: '場所',
        species: '魚種',
        memo: 'メモ',
      };
      let message = '入力内容を確認してください。';
      if (labels[field])
        message =
          issue.type === 'max_length'
            ? `${labels[field]}は${requirement}文字以内で入力してください。`
            : `${labels[field]}を入力してください。`;
      if (field === 'date')
        message = normalized.date
          ? '釣行日には有効な日付を指定してください。'
          : '釣行日を選択してください。';
      if (field === 'count')
        message =
          issue.type === 'number'
            ? '匹数を入力してください。'
            : issue.type === 'integer'
              ? '匹数は整数で入力してください。'
              : `匹数は${countRange}で入力してください。`;
      if (field === 'length')
        message =
          issue.type === 'number'
            ? 'サイズは数値で入力してください。'
            : !Number.isFinite(issue.input)
              ? 'サイズは有限の数値で入力してください。'
              : `サイズは${lengthRange}cmで入力してください。`;
      if (field === 'fish')
        message =
          issue.type === 'max_length'
            ? `魚種は${requirement}種類まで登録できます。`
            : '魚種を1つ以上登録してください。';
      errors[key] ??= issue.message.startsWith('魚種が重複')
        ? issue.message
        : message;
    }
  return result.success
    ? { success: true as const, data: { ...result.output, legacy }, errors }
    : { success: false as const, errors };
}

export function parseCatch(input: unknown) {
  const result = validateCatch(input);
  return result.success ? result.data : null;
}

export type FishInput = NormalizedFish;
