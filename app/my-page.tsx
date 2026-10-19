'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Profile } from './profile-dialog';
import { gearRequest } from './gear-controls';

type StorageSummary = {
  usedBytes: number;
  limitBytes: number;
  initialized: boolean;
};

export default function MyPage({
  profile,
  active,
  onSave,
  onLogout,
}: {
  profile: Profile;
  active: boolean;
  onSave: (name: string, bio: string) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<{ name: string; bio: string } | null>(
      null,
    ),
    [storage, setStorage] = useState<StorageSummary | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [storageError, setStorageError] = useState('');
  const apply = useEffectEvent((v: StorageSummary) => {
    setStorage(v);
    setStorageError('');
  });
  const report = useEffectEvent((e: Error) => setStorageError(e.message));
  useEffect(() => {
    if (!active) return;
    let current = true;
    void gearRequest<StorageSummary>('/api/profile/storage')
      .then((v) => {
        if (current) apply(v);
      })
      .catch((e) => {
        if (current) report(e);
      });
    return () => {
      current = false;
    };
  }, [active]);
  return (
    <section className="container my-page">
      <h1>マイページ</h1>
      <section className="gear-card">
        <h2>{profile.displayName}</h2>
        <p>{profile.bio || '自己紹介はまだありません。'}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setDraft({ name: profile.displayName, bio: profile.bio })
          }
        >
          プロフィールを編集
        </Button>
        {draft && (
          <form
            className="entry-form gear-edit"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                await onSave(draft.name, draft.bio);
                setDraft(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              表示名（姓 名）
              <Input
                value={draft.name}
                required
                maxLength={50}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              自己紹介
              <textarea
                value={draft.bio}
                maxLength={500}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <Button disabled={busy}>保存する</Button>
          </form>
        )}
      </section>
      <section className="gear-card">
        <h2>写真の保存容量</h2>
        {storage ? (
          <>
            <p>
              {(storage.usedBytes / 1000000).toFixed(1)} MB /{' '}
              {(storage.limitBytes / 1000000).toFixed(0)} MB
            </p>
            <progress
              aria-label="写真の保存容量"
              max={Math.max(1, storage.limitBytes)}
              value={storage.usedBytes}
            />
            {!storage.initialized && <p>既存写真の容量を集計しています。</p>}
          </>
        ) : (
          <p role="status">{storageError || '読み込み中…'}</p>
        )}
      </section>
      <section className="gear-card">
        <h2>設定</h2>
        <Button type="button" variant="outline" onClick={onLogout}>
          ログアウト
        </Button>
      </section>
    </section>
  );
}
