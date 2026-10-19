'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GearPicker, GearHistoryPanel, gearRequest } from './gear-controls';
import {
  gearKinds,
  type Gear,
  type GearSet,
  type GearSnapshot,
  type Combination,
} from './gear';
import { toast } from 'sonner';

const emptyGear = () => ({
  id: 0,
  kind: 'ロッド' as Gear['kind'],
  name: '',
  manufacturer: '',
  model: '',
  spec: '',
  memo: '',
  favorite: false,
  retired: false,
});

export const emptySet = () => ({
  id: 0,
  name: '',
  targetSpecies: '',
  method: '',
  gear: [] as GearSnapshot[],
  favorite: false,
  retired: false,
});

export default function GearManager({
  active,
  gear,
  sets,
  onCreated,
  onUpdated,
  onSetUpdated,
  onCopy,
  setDraft,
  onSetDraft,
  onViewCatch,
  error,
  onReload,
}: {
  active: boolean;
  gear: Gear[];
  sets: GearSet[];
  onCreated: (g: Gear) => void;
  onUpdated: (g: Gear) => void;
  onSetUpdated: (s: GearSet) => void;
  onCopy: (c: Combination) => void;
  setDraft: GearSet | null;
  onSetDraft: (s: GearSet | null) => void;
  onViewCatch: (id: number) => void;
  error: string;
  onReload: () => void;
}) {
  const [tab, setTab] = useState('gear'),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState(''),
    [status, setStatus] = useState('active'),
    [favorite, setFavorite] = useState(false),
    [draft, setGearDraft] = useState<Gear | null>(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(''),
    [history, setHistory] = useState({ gearId: '', setId: '' });

  async function saveGear(value: Gear) {
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      const g = await gearRequest<Gear>(
        '/api/gear' + (value.id ? `/${value.id}` : ''),
        value,
        value.id ? 'PUT' : 'POST',
      );
      onUpdated(g);
      setGearDraft(null);
      toast.success('道具を保存しました');
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSet(value: GearSet) {
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      const s = await gearRequest<GearSet>(
        '/api/gear-sets' + (value.id ? `/${value.id}` : ''),
        value,
        value.id ? 'PUT' : 'POST',
      );
      onSetUpdated(s);
      onSetDraft(null);
      toast.success('基本セットを保存しました');
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function showHistory(gearId = '', setId = '') {
    setHistory({ gearId, setId });
    setTab('history');
  }

  const visible = (v: { name: string; favorite: boolean; retired: boolean }) =>
    v.name.toLowerCase().includes(query.toLowerCase()) &&
    (!favorite || v.favorite) &&
    (status === 'all' || v.retired === (status === 'retired'));
  return (
    <section className="container gear-manager" aria-label="道具の管理">
      <h1>道具と基本セット</h1>
      <p>
        自分の道具・お気に入りと使用履歴を管理できます。管理用メモは本人だけに表示されます。
      </p>
      {error && (
        <p role="alert">
          {error}
          <Button type="button" onClick={onReload}>
            再読み込み
          </Button>
        </p>
      )}
      <div className="gear-tabs" role="tablist" aria-label="道具の表示">
        <button
          role="tab"
          aria-selected={tab === 'gear'}
          onClick={() => setTab('gear')}
        >
          所有道具
        </button>
        <button
          role="tab"
          aria-selected={tab === 'sets'}
          onClick={() => setTab('sets')}
        >
          基本セット
        </button>
        <button
          role="tab"
          aria-selected={tab === 'history'}
          onClick={() => showHistory()}
        >
          使用履歴
        </button>
      </div>
      {tab !== 'history' && (
        <div className="gear-filters">
          <Input
            aria-label="道具・セットの名前検索"
            data-cy="gear-search"
            value={query}
            placeholder="名前で検索"
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="状態"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">使用中</option>
            <option value="retired">使用終了・登録解除</option>
            <option value="all">すべて</option>
          </select>
          <label className="gear-check">
            <input
              type="checkbox"
              checked={favorite}
              onChange={(e) => setFavorite(e.target.checked)}
            />
            ★ お気に入りだけ
          </label>
          {tab === 'gear' && (
            <select
              aria-label="道具の種類"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">すべての種類</option>
              {gearKinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          )}
        </div>
      )}
      <div hidden={tab !== 'gear'}>
        <Button
          data-cy="new-gear"
          type="button"
          onClick={() => {
            setGearDraft(emptyGear());
            setFormError('');
          }}
        >
          道具を登録
        </Button>
        {draft && (
          <form
            className="entry-form gear-edit"
            onSubmit={(e) => {
              e.preventDefault();
              void saveGear(draft);
            }}
          >
            <h2>{draft.id ? '道具を編集' : '新しい道具'}</h2>
            <label>
              種類 ※
              <select
                value={draft.kind}
                onChange={(e) =>
                  setGearDraft({
                    ...draft,
                    kind: e.target.value as Gear['kind'],
                  })
                }
              >
                {gearKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            {(
              [
                ['name', '名前 ※', 120],
                ['manufacturer', 'メーカー', 120],
                ['model', '型番', 120],
                ['spec', 'スペック', 300],
              ] as const
            ).map(([key, label, max]) => (
              <label key={key}>
                {label}
                <Input
                  data-cy={`gear-${key}`}
                  value={draft[key]}
                  maxLength={max}
                  required={key === 'name'}
                  onChange={(e) =>
                    setGearDraft({ ...draft, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <label>
              管理用メモ（本人限定）
              <textarea
                data-cy="gear-memo"
                value={draft.memo}
                maxLength={2000}
                onChange={(e) =>
                  setGearDraft({ ...draft, memo: e.target.value })
                }
              />
            </label>
            <label className="gear-check">
              <input
                type="checkbox"
                checked={draft.favorite}
                onChange={(e) =>
                  setGearDraft({ ...draft, favorite: e.target.checked })
                }
              />
              ★ お気に入り
            </label>
            <label className="gear-check">
              <input
                type="checkbox"
                checked={draft.retired}
                onChange={(e) =>
                  setGearDraft({ ...draft, retired: e.target.checked })
                }
              />
              使用終了
            </label>
            {formError && <p role="alert">{formError}</p>}
            <div className="gear-actions">
              <Button data-cy="save-gear" disabled={busy}>
                保存する
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setGearDraft(null)}
              >
                キャンセル
              </Button>
            </div>
          </form>
        )}
        {gearKinds
          .filter((k) => !kind || kind === k)
          .map((k) => {
            const rows = gear.filter((g) => g.kind === k && visible(g));
            return (
              rows.length > 0 && (
                <section key={k}>
                  <h2>{k}</h2>
                  <div className="gear-grid">
                    {rows.map((g) => (
                      <article
                        key={g.id}
                        className="gear-card"
                        data-cy="gear-card"
                        data-gear-id={g.id}
                      >
                        <h3>
                          {g.name}
                          {g.retired && <small>（使用終了）</small>}
                        </h3>
                        <p>
                          {[g.manufacturer, g.model, g.spec]
                            .filter(Boolean)
                            .join(' ／ ')}
                        </p>
                        {g.memo && (
                          <p className="gear-private-memo">{g.memo}</p>
                        )}
                        <div className="gear-actions">
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`${g.name}のお気に入り`}
                            aria-pressed={g.favorite}
                            onClick={() =>
                              saveGear({ ...g, favorite: !g.favorite })
                            }
                          >
                            {g.favorite ? '★' : '☆'}
                          </button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setGearDraft({ ...g });
                              setFormError('');
                            }}
                          >
                            編集
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => showHistory(String(g.id))}
                          >
                            使用履歴
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )
            );
          })}
        {!gear.some((g) => visible(g) && (!kind || g.kind === kind)) && (
          <p>該当する道具はありません。</p>
        )}
      </div>
      <div hidden={tab !== 'sets'}>
        <Button
          data-cy="new-gear-set"
          type="button"
          onClick={() => {
            onSetDraft(emptySet());
            setFormError('');
          }}
        >
          基本セットを登録
        </Button>
        {sets.filter(visible).map((s) => (
          <article
            className="gear-card"
            data-cy="gear-set-card"
            key={s.id}
            data-set-id={s.id}
          >
            <h2>
              {s.name}
              {s.retired && '（登録解除）'}
            </h2>
            <p>
              {s.targetSpecies} {s.method}
            </p>
            <p>
              {s.gear
                .map(
                  (g) =>
                    `${g.name}${gear.find((v) => v.id === g.id)?.retired ? '（使用終了）' : ''}`,
                )
                .join('、') || '道具未選択'}
            </p>
            <div className="gear-actions">
              <button
                type="button"
                disabled={busy}
                aria-label={`${s.name}のお気に入り`}
                aria-pressed={s.favorite}
                onClick={() => saveSet({ ...s, favorite: !s.favorite })}
              >
                {s.favorite ? '★' : '☆'}
              </button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onSetDraft(structuredClone(s));
                  setFormError('');
                }}
              >
                編集
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => showHistory('', String(s.id))}
              >
                使用履歴
              </Button>
            </div>
          </article>
        ))}
        {!sets.some(visible) && <p>該当する基本セットはありません。</p>}
      </div>
      {setDraft && (
        <form
          className="entry-form gear-edit"
          data-cy="set-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveSet(setDraft);
          }}
        >
          <h2>{setDraft.id ? '基本セットを編集' : '基本セットとして保存'}</h2>
          <label>
            セット名 ※
            <Input
              data-cy="set-name"
              value={setDraft.name}
              required
              maxLength={120}
              onChange={(e) =>
                onSetDraft({ ...setDraft, name: e.target.value })
              }
            />
          </label>
          <label>
            対象魚種
            <Input
              value={setDraft.targetSpecies}
              maxLength={80}
              onChange={(e) =>
                onSetDraft({ ...setDraft, targetSpecies: e.target.value })
              }
            />
          </label>
          <label>
            釣り方
            <Input
              value={setDraft.method}
              maxLength={200}
              onChange={(e) =>
                onSetDraft({ ...setDraft, method: e.target.value })
              }
            />
          </label>
          <GearPicker
            gear={gear}
            value={setDraft.gear}
            onChange={(gear) => onSetDraft({ ...setDraft, gear })}
            onCreated={onCreated}
          />
          <label className="gear-check">
            <input
              type="checkbox"
              checked={setDraft.favorite}
              onChange={(e) =>
                onSetDraft({ ...setDraft, favorite: e.target.checked })
              }
            />
            ★ お気に入り
          </label>
          <label className="gear-check">
            <input
              type="checkbox"
              checked={setDraft.retired}
              onChange={(e) =>
                onSetDraft({ ...setDraft, retired: e.target.checked })
              }
            />
            登録解除（過去の使用履歴は保持）
          </label>
          {formError && <p role="alert">{formError}</p>}
          <div className="gear-actions">
            <Button data-cy="save-gear-set" disabled={busy}>
              保存する
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onSetDraft(null)}
            >
              キャンセル
            </Button>
          </div>
        </form>
      )}
      <div hidden={tab !== 'history'}>
        {(history.gearId || history.setId) && (
          <p>
            選択した{history.gearId ? '道具' : '基本セット'}の履歴{' '}
            <Button
              type="button"
              variant="outline"
              onClick={() => showHistory()}
            >
              すべての履歴へ
            </Button>
          </p>
        )}
        <GearHistoryPanel
          active={active && tab === 'history'}
          gearId={history.gearId}
          setId={history.setId}
          onCopy={onCopy}
          onSaveSet={(c) =>
            onSetDraft({
              ...emptySet(),
              name: c.setName,
              method: c.method,
              targetSpecies: c.species.join('・').slice(0, 80),
              gear: structuredClone(c.gear),
            })
          }
          onViewCatch={onViewCatch}
        />
      </div>
      {formError && !draft && !setDraft && <p role="alert">{formError}</p>}
    </section>
  );
}
