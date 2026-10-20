'use client';

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import MethodField from './method-field';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  gearKinds,
  emptyCombination,
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

function CombinationCard({
  value: c,
  index,
  gear,
  sets,
  fish,
  onChange,
  onCreated,
  onDuplicate,
  onDelete,
  canDuplicate,
  initiallyOpen,
  methods,
}: {
  value: Combination;
  index: number;
  gear: Gear[];
  sets: GearSet[];
  fish: string[];
  onChange: (patch: Partial<Combination>) => void;
  onCreated: (g: Gear) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canDuplicate: boolean;
  initiallyOpen: boolean;
  methods: string[];
}) {
  const [expanded, setExpanded] = useState(initiallyOpen);
  const [pending, setPending] = useState<Partial<Combination> | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const setSelect = useRef<HTMLSelectElement>(null);
  const menuAction = useRef(false);
  useEffect(() => {
    if (initiallyOpen) {
      card.current?.scrollIntoView({ block: 'nearest' });
      toggle.current?.focus({ preventScroll: true });
    }
  }, [initiallyOpen]);

  function selectSet(id: string) {
    const s = sets.find((s) => String(s.id) === id);
    if (!s) return onChange({ setId: null, setName: '' });
    const next = {
      setId: s.id,
      setName: s.name,
      method: s.method,
      gear: s.gear.map((g) => snapshot(gear.find((v) => v.id === g.id) || g)),
    };
    // Compare the full snapshots so changed specs are also protected.
    const equipmentKey = (items: GearSnapshot[]) =>
      JSON.stringify(items.map((g) => JSON.stringify(snapshot(g))).sort());
    const changes =
      c.method !== next.method ||
      equipmentKey(c.gear) !== equipmentKey(next.gear);
    if ((c.gear.length || c.method) && changes) setPending(next);
    else onChange(next);
  }

  const retired = c.gear.filter(
    (g) => gear.find((v) => v.id === g.id)?.retired,
  );
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
      <div className="combination-card" ref={card} data-cy="combination-editor">
        <div className="combination-heading">
          <strong>組み合わせ {index + 1}</strong>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                data-cy="combination-actions"
                aria-label={`組み合わせ ${index + 1}のその他の操作`}
              >
                その他の操作
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(e) => {
                if (menuAction.current) e.preventDefault();
                menuAction.current = false;
              }}
            >
              <DropdownMenuItem
                disabled={!canDuplicate}
                onSelect={() => {
                  menuAction.current = true;
                  onDuplicate();
                }}
                data-cy="duplicate-combination"
              >
                この組み合わせを複製
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  menuAction.current = true;
                  onDelete();
                }}
                data-cy="delete-combination"
              >
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <label>
          基本セット
          <select
            ref={setSelect}
            data-cy="combination-set"
            value={c.setId ?? ''}
            onChange={(e) => selectSet(e.target.value)}
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
        <div className="combination-overview" data-cy="combination-overview">
          <p>
            道具：
            {c.gear
              .slice(0, 3)
              .map((g) => `${g.name}${g.id === null ? '（今回だけ）' : ''}`)
              .join('・') || '未選択'}
            {c.gear.length > 3 && ` ほか${c.gear.length - 3}点`}
          </p>
          <p>釣り方・仕掛け：{c.method || '未入力'}</p>
          <p>対象魚種：{c.species.join('・') || '指定なし'}</p>
        </div>
        {!!retired.length && (
          <p className="retired-note">
            使用終了：{retired.map((g) => g.name).join('・')}
            。差し替え・取り外しを確認してください。
          </p>
        )}
        {c.setId && sets.find((s) => s.id === c.setId)?.retired && (
          <p className="retired-note">
            登録解除したセットです。使用内容は保持しています。
          </p>
        )}
        <CollapsibleTrigger asChild>
          <Button
            ref={toggle}
            type="button"
            variant="outline"
            data-cy="combination-details-toggle"
          >
            {expanded ? '詳細を閉じる' : '道具・詳細を変更'}
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={
                expanded
                  ? 'combination-chevron expanded'
                  : 'combination-chevron'
              }
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent
          forceMount
          hidden={!expanded}
          className="combination-details"
          data-cy="combination-details"
        >
          <GearPicker
            gear={gear}
            value={c.gear}
            onChange={(gear) => onChange({ gear })}
            onCreated={onCreated}
            allowCreate
          />
          <MethodField
            value={c.method}
            onChange={(method) => onChange({ method })}
            suggestions={[...sets.map((s) => s.method), ...methods]}
          />
          <div className="gear-species">
            <span>魚種との紐づけ（任意）</span>
            {fish.map((name) => (
              <label key={name}>
                <input
                  data-cy="combination-species"
                  type="checkbox"
                  checked={c.species.includes(name)}
                  onChange={(e) =>
                    onChange({
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
        </CollapsibleContent>
        <AlertDialog
          open={!!pending}
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
        >
          <AlertDialogContent
            data-cy="replace-set-dialog"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              setSelect.current?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>基本セットを変更しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                道具と釣り方を「{pending?.setName}
                」の内容に置き換えます。魚種の紐づけは維持します。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-cy="cancel-replace-set">
                キャンセル
              </AlertDialogCancel>
              <AlertDialogAction
                data-cy="confirm-replace-set"
                onClick={() => {
                  if (pending) onChange(pending);
                  setPending(null);
                }}
              >
                置き換える
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Collapsible>
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
  methods = [],
  legacyMethod,
}: {
  value: Combination[];
  onChange: (v: Combination[]) => void;
  fish: string[];
  gear: Gear[];
  sets: GearSet[];
  onCreated: (g: Gear) => void;
  onSaveSet: (c: Combination) => void;
  methods?: string[];
  legacyMethod?: ReactNode;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  // UI-only identities keep each card's draft and expansion attached on removal.
  const [keys, setKeys] = useState(() => value.map(() => crypto.randomUUID()));
  const [newKey, setNewKey] = useState('');
  const editor = useRef<HTMLFieldSetElement>(null);

  function insert(c: Combination, replace = -1) {
    if (replace < 0 && value.length >= 20) return;
    const key = crypto.randomUUID();
    setNewKey(key);
    setKeys(
      replace < 0
        ? [...keys, key]
        : keys.map((v, i) => (i === replace ? key : v)),
    );
    onChange(
      replace < 0
        ? [...value, c]
        : value.map((v, i) => (i === replace ? c : v)),
    );
  }

  function copy(c: Combination) {
    insert(
      {
        ...structuredClone(c),
        species:
          fish.length === 1
            ? [...fish]
            : c.species.filter((s) => fish.includes(s)),
      },
      value.findIndex((v) => !v.gear.length && !v.setId && !v.method),
    );
    setHistoryOpen(false);
  }

  return (
    <fieldset ref={editor} className="combination-editor">
      <legend>当日の組み合わせ（任意）</legend>
      <p className="gear-help">
        基本セットは変更せず、この記録だけ道具を差し替えられます。最大20組・各30点。
      </p>
      {legacyMethod}
      {value.map((c, index) => (
        <CombinationCard
          key={keys[index]}
          value={c}
          index={index}
          gear={gear}
          sets={sets}
          fish={fish}
          methods={methods}
          onCreated={onCreated}
          initiallyOpen={keys[index] === newKey}
          canDuplicate={value.length < 20}
          onChange={(patch) =>
            onChange(
              value.map((v, i) => (i === index ? { ...v, ...patch } : v)),
            )
          }
          onDuplicate={() => insert(structuredClone(c))}
          onDelete={() => {
            setKeys(keys.filter((_, i) => i !== index));
            onChange(value.filter((_, i) => i !== index));
            requestAnimationFrame(() => {
              const toggles =
                editor.current?.querySelectorAll<HTMLButtonElement>(
                  '[data-cy="combination-details-toggle"]',
                );
              (
                toggles?.[Math.min(index, (toggles?.length || 1) - 1)] ||
                editor.current?.querySelector<HTMLButtonElement>(
                  '[data-cy="add-combination"]',
                )
              )?.focus();
            });
          }}
        />
      ))}
      <div className="gear-actions">
        <Button
          type="button"
          variant="outline"
          data-cy="add-combination"
          disabled={value.length >= 20}
          onClick={() => insert(emptyCombination(fish))}
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
