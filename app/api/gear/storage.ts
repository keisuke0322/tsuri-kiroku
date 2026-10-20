import { getDb } from '../catches/db';
import { ApiError } from '../access';
import {
  gearKinds,
  gearLimits,
  snapshot,
  combinationSignature,
  type Gear,
  type GearSet,
  type GearSnapshot,
  type Combination,
} from '../../gear';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(400, '道具の入力内容を確認してください。');
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number, required = false): string {
  if (value !== undefined && typeof value !== 'string')
    throw new ApiError(400, '文字列で入力してください。');
  const result = (value as string | undefined)?.trim() || '';
  if (result.length > max || (required && !result))
    throw new ApiError(
      400,
      `必須項目と文字数（最大${max}文字）を確認してください。`,
    );
  return result;
}

function flag(value: unknown): boolean {
  if (value !== undefined && typeof value !== 'boolean')
    throw new ApiError(400, '状態の指定を確認してください。');
  return value === true;
}

function id(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    throw new ApiError(400, 'IDを確認してください。');
  return value;
}

export function gearInput(value: unknown) {
  const v = object(value);
  if (!gearKinds.includes(v.kind as Gear['kind']))
    throw new ApiError(400, '道具の種類を選んでください。');
  return {
    kind: v.kind as Gear['kind'],
    name: text(v.name, 120, true),
    manufacturer: text(v.manufacturer, 120),
    model: text(v.model, 120),
    spec: text(v.spec, 300),
    memo: text(v.memo, 2000),
    favorite: flag(v.favorite),
    retired: flag(v.retired),
  };
}

export async function ownGear(owner: string): Promise<Gear[]> {
  const rows = await getDb()
    .prepare(
      'SELECT id,kind,name,manufacturer,model,spec,memo,favorite,retired FROM gear WHERE owner_id=? ORDER BY favorite DESC,name,id',
    )
    .bind(owner)
    .all<Gear>();
  return rows.results.map((g) => ({
    ...g,
    favorite: !!g.favorite,
    retired: !!g.retired,
  }));
}

export async function ownSets(owner: string): Promise<GearSet[]> {
  const rows = await getDb()
    .prepare(
      'SELECT id,name,target_species AS targetSpecies,method,gear_json,favorite,retired FROM gear_sets WHERE owner_id=? ORDER BY favorite DESC,name,id',
    )
    .bind(owner)
    .all<Omit<GearSet, 'gear'> & { gear_json: string }>();
  return rows.results.map(({ gear_json, ...s }) => ({
    ...s,
    gear: JSON.parse(gear_json),
    favorite: !!s.favorite,
    retired: !!s.retired,
  }));
}

async function gearSnapshots(
  value: unknown,
  owner: string,
  owned?: Set<number>,
): Promise<GearSnapshot[]> {
  if (!Array.isArray(value) || value.length > gearLimits.perCombination)
    throw new ApiError(400, '道具は1組30点までです。');
  const result = value.map((raw) => {
    const v = object(raw),
      parsed = gearInput(v);
    return snapshot({ ...parsed, id: v.id == null ? null : id(v.id) });
  });
  const ids = result.flatMap((g) => (g.id === null ? [] : [g.id]));
  if (new Set(ids).size !== ids.length)
    throw new ApiError(400, '同じ道具が重複しています。');
  if (owned) {
    if (ids.some((id) => !owned.has(id)))
      throw new ApiError(403, '自分の道具だけ選択できます。');
  } else if (ids.length) {
    const found = await getDb()
      .prepare(
        `SELECT id FROM gear WHERE owner_id=? AND id IN (${ids.map(() => '?').join(',')})`,
      )
      .bind(owner, ...ids)
      .all<{ id: number }>();
    if (found.results.length !== ids.length)
      throw new ApiError(403, '自分の道具だけ選択できます。');
  }
  return result;
}

export async function setInput(value: unknown, owner: string) {
  const v = object(value);
  return {
    name: text(v.name, 120, true),
    targetSpecies: text(v.targetSpecies, 80),
    method: text(v.method, 200),
    gear: await gearSnapshots(v.gear, owner),
    favorite: flag(v.favorite),
    retired: flag(v.retired),
  };
}

export async function combinationsInput(
  value: unknown,
  owner: string,
  species: string[],
): Promise<Combination[] | undefined> {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > gearLimits.combinations)
    throw new ApiError(400, '組み合わせは20組までです。');
  if (value.length === 0) return [];
  const db = getDb();
  const setRows = await db
    .prepare('SELECT id FROM gear_sets WHERE owner_id=?')
    .bind(owner)
    .all<{ id: number }>();
  const gearRows = await db
    .prepare('SELECT id FROM gear WHERE owner_id=?')
    .bind(owner)
    .all<{ id: number }>();
  const sets = new Set(setRows.results.map((s) => s.id));
  const owned = new Set(gearRows.results.map((g) => g.id));
  const result: Combination[] = [];
  for (const raw of value) {
    const v = object(raw),
      setId = v.setId == null ? null : id(v.setId);
    if (setId !== null && !sets.has(setId))
      throw new ApiError(403, '自分のセットだけ選択できます。');
    if (
      !Array.isArray(v.species) ||
      v.species.length > 20 ||
      v.species.some((s) => typeof s !== 'string' || !species.includes(s)) ||
      new Set(v.species).size !== v.species.length
    )
      throw new ApiError(400, '組み合わせの魚種を確認してください。');
    result.push({
      setId,
      setName: text(v.setName, 120),
      method: text(v.method, 200),
      gear: await gearSnapshots(v.gear, owner, owned),
      species: v.species as string[],
    });
  }
  return result;
}

export function combinationStatements(
  catchId: number,
  combinations: Combination[] | undefined,
) {
  if (combinations === undefined) return [];
  const db = getDb();
  const statements = [
    db.prepare('DELETE FROM catch_combinations WHERE catch_id=?').bind(catchId),
  ];
  // Eight bindings per row: batches of ten stay under D1's 100-parameter limit
  // and leave room for fish/photo queries within the free invocation budget.
  for (let start = 0; start < combinations.length; start += 10) {
    const group = combinations.slice(start, start + 10);
    statements.push(
      db
        .prepare(
          `INSERT INTO catch_combinations (catch_id,set_id,set_name,method,gear_json,species_json,signature,sort_order) VALUES ${group.map(() => '(?,?,?,?,?,?,?,?)').join(',')}`,
        )
        .bind(
          ...group.flatMap((c, index) => [
            catchId,
            c.setId,
            c.setName,
            c.method,
            JSON.stringify(c.gear),
            JSON.stringify(c.species),
            combinationSignature(c),
            start + index,
          ]),
        ),
    );
  }
  return statements;
}

export type CombinationRow = {
  id: number;
  catch_id: number;
  set_id: number | null;
  set_name: string;
  method: string;
  gear_json: string;
  species_json: string;
  signature: string;
  date?: string;
};

export function readCombination(row: CombinationRow): Combination {
  return {
    setId: row.set_id,
    setName: row.set_name,
    method: row.method,
    gear: (JSON.parse(row.gear_json) as GearSnapshot[]).map(snapshot),
    species: JSON.parse(row.species_json),
  };
}
