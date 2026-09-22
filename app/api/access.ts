import { getChatGPTUser, type ChatGPTUser } from '../chatgpt-auth';
import { getDb } from './catches/db';

export const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' };
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function authenticate(req?: Request): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (!user) throw new ApiError(401, 'ログインしてください。');
  if (req && !['GET', 'HEAD'].includes(req.method)) {
    const origin = req.headers.get('origin');
    if (origin !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site') {
      throw new ApiError(403, 'この操作はサイト内から行ってください。');
    }
  }
  return user;
}
export function apiError(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return json({ error: '入力内容を確認してください。' }, 400);
  console.error('Fishing log request failed', error);
  return json({ error: '読み込み・保存に失敗しました。もう一度お試しください。' }, 500);
}

// The imported full-name claim does not provide reliable surname/given-name
// fields. Apply only the owner's explicitly requested correction, once, and
// leave nicknames and other users' names untouched.
export async function correctOwnerDisplayName() {
  const db=getDb();
  if(await db.prepare("SELECT name FROM data_migrations WHERE name='owner-name-family-first'").first())return;
  await db.batch([
    db.prepare(`UPDATE profiles SET display_name='高山 圭介'
      WHERE user_id=(SELECT owner_id FROM data_migrations WHERE name='legacy-catches')
      AND display_name IN ('圭介 高山','圭介　高山','高山　圭介')
      AND NOT EXISTS(SELECT 1 FROM data_migrations WHERE name='owner-name-family-first')`),
    db.prepare(`INSERT INTO data_migrations (name,owner_id)
      SELECT 'owner-name-family-first',owner_id FROM data_migrations
      WHERE name='legacy-catches'
      AND EXISTS(SELECT 1 FROM profiles WHERE user_id=data_migrations.owner_id)
      ON CONFLICT(name) DO NOTHING`)
  ]);
}

export type Profile = { userId: string; displayName: string; bio: string };
export async function ensureProfile(user: ChatGPTUser): Promise<Profile> {
  const db = getDb();
  await correctOwnerDisplayName();
  const name = Array.from(user.fullName?.trim() || '釣り人').slice(0, 50).join('');
  await db.prepare('INSERT INTO profiles (user_id,display_name,bio) VALUES (?,?,?) ON CONFLICT(user_id) DO NOTHING')
    .bind(user.userId, name, '').run();
  return (await db.prepare('SELECT user_id AS userId,display_name AS displayName,bio FROM profiles WHERE user_id=?').bind(user.userId).first<Profile>())!;
}
export async function ownedCatch(id: number, userId: string) {
  const row = await getDb().prepare('SELECT owner_id FROM catches WHERE id=?').bind(id).first<{ owner_id: string | null }>();
  if (!row) throw new ApiError(404, '記録が見つかりません。');
  if (row.owner_id !== userId) throw new ApiError(403, '自分の記録だけ変更できます。');
}
