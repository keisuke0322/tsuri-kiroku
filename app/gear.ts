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

export type GearSnapshot = {
  id: number | null;
  kind: GearKind;
  name: string;
  manufacturer: string;
  model: string;
  spec: string;
};

export type Gear = GearSnapshot & {
  id: number;
  memo: string;
  favorite: boolean;
  retired: boolean;
};

export type GearSet = {
  id: number;
  name: string;
  targetSpecies: string;
  method: string;
  gear: GearSnapshot[];
  favorite: boolean;
  retired: boolean;
};

export type Combination = {
  setId: number | null;
  setName: string;
  method: string;
  gear: GearSnapshot[];
  species: string[];
};

export type GearHistory = Combination & {
  id: number;
  catchId: number;
  date: string;
};

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
