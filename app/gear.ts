export const gearKinds = [
  'ロッド',
  'リール',
  'ライン',
  'リーダー',
  'ルアー',
  '仕掛け',
  'その他',
] as const;
export type GearKind = (typeof gearKinds)[number];
export const gearLimits = {
  items: 1000,
  sets: 100,
  combinations: 20,
  perCombination: 30,
};

export type {
  GearSnapshot,
  Gear,
  GearSet,
  Combination,
  GearHistory,
} from '../lib/api/generated/types.gen';
import type { GearSnapshot, Combination } from '../lib/api/generated/types.gen';

export function snapshot(item: GearSnapshot): GearSnapshot {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    manufacturer: item.manufacturer,
    model: item.model,
    spec: item.spec,
  };
}

export function emptyCombination(species: string[] = []): Combination {
  return {
    setId: null,
    setName: '',
    method: '',
    gear: [],
    species: species.length === 1 ? [...species] : [],
  };
}

// Stable owned IDs ignore later name/spec changes. Temporary gear uses its public
// description. Order, species and base-set identity do not affect equipment equality.
export function combinationSignature(value: Combination): string {
  return JSON.stringify([
    value.method.trim(),
    value.gear
      .map((g) =>
        g.id !== null
          ? ['id', g.id]
          : ['temporary', g.kind, g.name, g.manufacturer, g.model, g.spec],
      )
      .map((g) => JSON.stringify(g))
      .sort(),
  ]);
}

export function reconcileSpecies(
  combinations: Combination[],
  before: string[],
  after: string[],
  rename?: [string, string],
): Combination[] {
  const valid = [...new Set(after.map((s) => s.trim()).filter(Boolean))];
  return combinations.map((c) => ({
    ...c,
    species: [
      ...new Set(
        c.species
          .map((s) => (rename && s === rename[0].trim() ? rename[1].trim() : s))
          .filter((s) => valid.includes(s)),
      ),
    ],
    ...(before.every((s) => !s.trim()) && valid.length === 1
      ? { species: [...valid] }
      : {}),
  }));
}
