'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  gearKinds,
  snapshot,
  type Gear,
  type GearSnapshot,
  type GearSet,
  type Combination,
  type GearHistory,
} from './gear';

export async function gearRequest<T>(
  path: string,
  value?: unknown,
  method = 'POST',
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    cache: 'no-store',
    signal,
    ...(value === undefined
      ? {}
      : {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value),
        }),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw Error(result.error || '読み込み・保存に失敗しました。');
  return result as T;
}

export function GearPicker({
  gear,
  value,
  onChange,
  onCreated,
  allowCreate = false,
}: {
  gear: Gear[];
  value: GearSnapshot[];
  onChange: (v: GearSnapshot[]) => void;
  onCreated: (v: Gear) => void;
  allowCreate?: boolean;
}) {
  const [query, setQuery] = useState(''),
    [adding, setAdding] = useState(false),
    [kind, setKind] = useState<Gear['kind']>('その他'),
    [name, setName] = useState(''),
    [temporary, setTemporary] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function add() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      if (value.length >= 30) throw Error('道具は1組30点までです。');
      const input = {
        kind,
        name: name.trim(),
        manufacturer: '',
        model: '',
        spec: '',
      };
      const item = temporary
        ? { ...input, id: null }
        : await gearRequest<Gear>('/api/gear', input);
      if (item.id !== null) onCreated(item as Gear);
      onChange([...value, snapshot(item)]);
      setName('');
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const candidates = gear
    .filter(
      (g) =>
        !g.retired &&
        `${g.kind} ${g.name} ${g.spec}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        a.name.localeCompare(b.name, 'ja'),
    );
  return (
    <div className="gear-picker">
      <div className="gear-chips">
        {value.map((g, i) => (
          <div key={i} className="gear-chip" data-cy="selected-gear">
            <span>
              {g.kind}：{g.name} {g.spec}
              {g.id === null && '（今回だけ）'}
              {gear.find((item) => item.id === g.id)?.retired && (
                <strong className="retired-note">
                  {' '}
                  使用終了・差し替え／取り外しを確認してください
                </strong>
              )}
            </span>
            <button
              type="button"
              aria-label={`${g.name}を取り外す`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <Input
        data-cy="gear-picker-search"
        aria-label="登録済みの道具を検索"
        placeholder="道具を検索（複数選択できます）"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="gear-options">
        {candidates.map((g) => (
          <label key={g.id}>
            <input
              type="checkbox"
              data-cy="gear-option"
              checked={value.some((v) => v.id === g.id)}
              disabled={value.length >= 30 && !value.some((v) => v.id === g.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, snapshot(g)]
                    : value.filter((v) => v.id !== g.id),
                )
              }
            />
            <span>
              {g.favorite && '★ '}
              {g.kind}：{g.name} {g.spec}
            </span>
          </label>
        ))}
      </div>
      {!candidates.length && (
        <p className="gear-help">選択できる道具がありません。</p>
      )}
      {allowCreate && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setAdding(!adding)}
        >
          見つからない道具を追加
        </Button>
      )}
      {adding && (
        <div className="gear-inline-add">
          <label>
            種類
            <select
              aria-label="追加する道具の種類"
              value={kind}
              onChange={(e) => setKind(e.target.value as Gear['kind'])}
            >
              {gearKinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            名前
            <Input
              data-cy="inline-gear-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="gear-check">
            <input
              type="checkbox"
              checked={temporary}
              onChange={(e) => setTemporary(e.target.checked)}
            />
            今回の記録だけ（所有道具へ保存しない）
          </label>
          <Button type="button" disabled={busy || !name.trim()} onClick={add}>
            この道具を追加
          </Button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function CombinationDisplay({ value }: { value: Combination }) {
  return (
    <div className="combination-summary">
      <strong>
        {value.setName || '個別の組み合わせ'}
        {value.method && ` ／ ${value.method}`}
      </strong>
      <p>
        {value.gear
          .map(
            (g) =>
              `${g.kind}：${g.name}${g.spec ? `（${g.spec}）` : ''}${g.manufacturer ? ` / ${g.manufacturer}` : ''}${g.model ? ` / ${g.model}` : ''}`,
          )
          .join('、') || '道具未選択'}
      </p>
      {value.species.length > 0 && (
        <small>紐づけた魚種：{value.species.join('・')}</small>
      )}
    </div>
  );
}

export function GearHistoryPanel({
  active = true,
  gearId = '',
  setId = '',
  onCopy,
  onSaveSet,
  onViewCatch,
}: {
  active?: boolean;
  gearId?: string;
  setId?: string;
  onCopy: (c: Combination) => void;
  onSaveSet: (c: Combination) => void;
  onViewCatch?: (id: number) => void;
}) {
  const [species, setSpecies] = useState(''),
    [signature, setSignature] = useState(''),
    [items, setItems] = useState<GearHistory[]>([]),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [loadedKey, setLoadedKey] = useState(''),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([
    active,
    gearId,
    setId,
    species,
    signature,
    offset,
    revision,
  ]);
  const loading = active && loadedKey !== requestKey;
  const apply = useEffectEvent(
    (data: { items: GearHistory[]; more: boolean }, key: string) => {
      setItems(data.items);
      setMore(data.more);
      setError('');
      setLoadedKey(key);
    },
  );
  const report = useEffectEvent((e: Error, key: string) => {
    setError(e.message);
    setItems([]);
    setMore(false);
    setLoadedKey(key);
  });
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const q = new URLSearchParams({ offset: String(offset) });
    if (species.trim()) q.set('species', species.trim());
    if (gearId) q.set('gearId', gearId);
    if (setId) q.set('setId', setId);
    if (signature) q.set('combinationId', signature);
    void gearRequest<{ items: GearHistory[]; more: boolean }>(
      '/api/gear-history?' + q,
      undefined,
      'POST',
      controller.signal,
    )
      .then((v) => {
        if (!controller.signal.aborted) apply(v, requestKey);
      })
      .catch((e) => {
        if (!controller.signal.aborted) report(e, requestKey);
      });
    return () => controller.abort();
  }, [active, gearId, setId, species, signature, offset, revision, requestKey]);
  return (
    <section className="gear-history" aria-label="使用履歴">
      <h3>その組み合わせを使用した記録</h3>
      <p className="gear-help">
        匹数・サイズは記録全体の魚種別合計です。組み合わせだけの釣果としては集計しません。
      </p>
      <label>
        紐づけた魚種で検索
        <Input
          data-cy="history-species"
          value={species}
          maxLength={80}
          placeholder="例：タチウオ"
          onChange={(e) => {
            setSpecies(e.target.value);
            setOffset(0);
          }}
        />
      </label>
      {signature && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSignature('');
            setOffset(0);
          }}
        >
          同じ組み合わせの絞り込みを解除
        </Button>
      )}
      {loading ? (
        <p role="status">履歴を読み込み中…</p>
      ) : error ? (
        <p role="alert">
          {error}
          <Button type="button" onClick={() => setRevision(revision + 1)}>
            再試行
          </Button>
        </p>
      ) : !items.length ? (
        <p>該当する使用履歴はありません。</p>
      ) : (
        items.map((c) => (
          <article
            className="gear-history-card"
            key={c.id}
            data-cy="gear-history-card"
          >
            <p>{c.date}</p>
            <CombinationDisplay value={c} />
            <div className="gear-actions">
              <Button type="button" variant="outline" onClick={() => onCopy(c)}>
                今回の記録へコピー
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onSaveSet(c)}
              >
                基本セットとして保存
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSignature(String(c.id));
                  setOffset(0);
                }}
              >
                当日の道具が同じ記録
              </Button>
              {onViewCatch && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onViewCatch(c.catchId)}
                >
                  釣果記録を見る
                </Button>
              )}
            </div>
          </article>
        ))
      )}
      <div className="gear-actions">
        <Button
          type="button"
          variant="outline"
          disabled={loading || offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          前の50件
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading || !more}
          onClick={() => setOffset(offset + 50)}
        >
          次の50件
        </Button>
      </div>
    </section>
  );
}

export function CombinationEditor({
  value,
  onChange,
  fish,
  gear,
  sets,
  onCreated,
  onSaveSet,
}: {
  value: Combination[];
  onChange: (v: Combination[]) => void;
  fish: string[];
  gear: Gear[];
  sets: GearSet[];
  onCreated: (g: Gear) => void;
  onSaveSet: (c: Combination) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  function update(index: number, patch: Partial<Combination>) {
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function copy(c: Combination) {
    const next = {
      ...structuredClone(c),
      species:
        fish.length === 1
          ? [...fish]
          : c.species.filter((s) => fish.includes(s)),
    };
    const blank = value.findIndex(
      (v) => !v.gear.length && !v.setId && !v.method,
    );
    if (blank >= 0) onChange(value.map((v, i) => (i === blank ? next : v)));
    else if (value.length < 20) onChange([...value, next]);
    setHistoryOpen(false);
  }
  return (
    <fieldset className="combination-editor">
      <legend>当日の組み合わせ（任意）</legend>
      <p className="gear-help">
        基本セットは変更せず、この記録だけ道具を差し替えられます。最大20組・各30点。
      </p>
      {value.map((c, index) => (
        <div
          className="combination-card"
          key={index}
          data-cy="combination-editor"
        >
          <div className="gear-actions">
            <strong>組み合わせ {index + 1}</strong>
            <Button
              type="button"
              variant="outline"
              disabled={value.length >= 20}
              onClick={() => onChange([...value, structuredClone(c)])}
            >
              この組み合わせを複製
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              削除
            </Button>
          </div>
          <label>
            基本セット
            <select
              data-cy="combination-set"
              value={c.setId ?? ''}
              onChange={(e) => {
                const s = sets.find((s) => String(s.id) === e.target.value);
                if (!s) return update(index, { setId: null, setName: '' });
                update(index, {
                  setId: s.id,
                  setName: s.name,
                  method: s.method,
                  gear: s.gear.map((g) =>
                    snapshot(gear.find((v) => v.id === g.id) || g),
                  ),
                });
              }}
            >
              <option value="">基本セットを使わず選択</option>
              {sets
                .filter((s) => !s.retired || s.id === c.setId)
                .sort((a, b) => Number(b.favorite) - Number(a.favorite))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.favorite && '★ '}
                    {s.name}
                    {s.retired && '（登録解除）'}
                  </option>
                ))}
            </select>
          </label>
          {c.setId && sets.find((s) => s.id === c.setId)?.retired && (
            <p className="retired-note">
              登録解除したセットです。使用内容は保持しています。
            </p>
          )}
          <GearPicker
            gear={gear}
            value={c.gear}
            onChange={(gear) => update(index, { gear })}
            onCreated={onCreated}
            allowCreate
          />
          <label>
            釣り方の候補
            <select
              data-cy="combination-method-choice"
              value=""
              onChange={(e) => {
                if (e.target.value) update(index, { method: e.target.value });
              }}
            >
              <option value="">候補から選ぶ（自由入力もできます）</option>
              {[
                ...new Set([
                  'テンヤ',
                  '浮き釣り',
                  'サビキ',
                  'ルアー',
                  '投げ釣り',
                  ...sets.map((s) => s.method),
                ]),
              ]
                .filter(Boolean)
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          </label>
          <label>
            この組み合わせの釣り方
            <Input
              data-cy="combination-method"
              value={c.method}
              maxLength={200}
              placeholder="候補を選択、または自由入力"
              onChange={(e) => update(index, { method: e.target.value })}
            />
          </label>
          <div className="gear-species">
            <span>魚種との紐づけ（任意）</span>
            {fish.map((name) => (
              <label key={name}>
                <input
                  data-cy="combination-species"
                  type="checkbox"
                  checked={c.species.includes(name)}
                  onChange={(e) =>
                    update(index, {
                      species: e.target.checked
                        ? [...c.species, name]
                        : c.species.filter((s) => s !== name),
                    })
                  }
                />
                {name}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="gear-actions">
        <Button
          type="button"
          variant="outline"
          disabled={value.length >= 20}
          onClick={() =>
            onChange([
              ...value,
              {
                setId: null,
                setName: '',
                method: '',
                gear: [],
                species: fish.length === 1 ? [...fish] : [],
              },
            ])
          }
        >
          ＋組み合わせを追加
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={value.length >= 20}
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          過去の組み合わせを再利用
        </Button>
      </div>
      {historyOpen && <GearHistoryPanel onCopy={copy} onSaveSet={onSaveSet} />}
    </fieldset>
  );
}
