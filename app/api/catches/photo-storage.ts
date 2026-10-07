import { env } from 'cloudflare:workers';
import { ApiError } from '../access';
import { getDb } from './db';
import { getBucket } from './photos';

type Settings = { initialized: number; maintenance: number; inventory_cursor: string | null; global_limit_bytes: number; user_limit_bytes: number };
export const PHOTO_FILE_LIMIT = 8 * 1024 * 1024;
const INVENTORY_FINISH = '__reconcile__';
const inventoryPending = () => new ApiError(503, '既存写真の保存容量を集計しています。釣果の文字情報は保存できます。しばらくしてから写真を追加してください。');

function storageLimit(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new ApiError(503, '写真の容量上限の設定に問題があるため、写真を追加できません。管理者にお問い合わせください。写真の閲覧・削除と、写真なしの釣果登録は引き続き利用できます。');
  }
  return Number(value);
}

/** Bounded, resumable inventory of the entire bound bucket (including orphans).
 * Each request stays below the free Worker's subrequest budget. Progress is
 * persisted in D1; concurrent scans use compare-and-set to advance the cursor.
 * No upload writes to R2 until every page and legacy reference is accounted for. */
export async function initializePhotoStorage() {
  const db = getDb();
  const settings = await db.prepare('SELECT * FROM photo_storage_settings WHERE id=1').first<Settings>();
  if (settings?.maintenance) throw new ApiError(503, '写真の保存容量をメンテナンス中です。写真なしの釣果登録・閲覧・削除は引き続き利用できます。');
  if (settings?.initialized) return;
  const bucket = getBucket();
  const cursor = settings?.inventory_cursor ?? null;
  if (cursor !== INVENTORY_FINISH) {
    const page = await bucket.list({ cursor: cursor ?? undefined, limit: 200 });
    // At most 14 D1 statements (75 bindings each) for 200 objects; batching
    // individual INSERTs would exceed the free plan's 50-query invocation limit.
    const statements: D1PreparedStatement[] = [];
    for (let i = 0; i < page.objects.length; i += 15) {
      const objects = page.objects.slice(i, i + 15);
      const values = objects.map(() => `(?,(SELECT c.owner_id FROM catch_photos p JOIN catches c ON c.id=p.catch_id WHERE p.object_key=? LIMIT 1),
        (SELECT catch_id FROM catch_photos WHERE object_key=? LIMIT 1),?,'stored',1,?)`).join(',');
      statements.push(db.prepare(`INSERT INTO photo_storage_objects (object_key,owner_id,catch_id,byte_size,state,inventory_seen,created_at)
        VALUES ${values} ON CONFLICT(object_key) DO UPDATE SET byte_size=excluded.byte_size,inventory_seen=1
        WHERE photo_storage_objects.state='stored' AND (SELECT initialized FROM photo_storage_settings WHERE id=1)=0`)
        .bind(...objects.flatMap(object => [object.key, object.key, object.key, object.size, new Date().toISOString()])));
    }
    if (statements.length) await db.batch(statements);
    await db.prepare('UPDATE photo_storage_settings SET inventory_cursor=? WHERE id=1 AND inventory_cursor IS ? AND initialized=0')
      .bind(page.truncated ? page.cursor : INVENTORY_FINISH, cursor).run();
    if (page.objects.length || page.truncated) throw inventoryPending();
  }
  // Missing legacy objects must not consume the conservative 8MiB placeholder.
  // Bounded HEAD checks also resume safely after a transient service failure.
  const unseen = await db.prepare("SELECT object_key FROM photo_storage_objects WHERE state='stored' AND inventory_seen=0 LIMIT 10")
    .all<{ object_key: string }>();
  for (const row of unseen.results) {
    const object = await bucket.head(row.object_key);
    await db.prepare("UPDATE photo_storage_objects SET byte_size=?,inventory_seen=1 WHERE object_key=? AND state='stored' AND inventory_seen=0 AND (SELECT initialized FROM photo_storage_settings WHERE id=1)=0")
      .bind(object?.size ?? 0, row.object_key).run();
  }
  if (await db.prepare("SELECT 1 FROM photo_storage_objects WHERE state='stored' AND inventory_seen=0 LIMIT 1").first()) throw inventoryPending();
  await db.prepare('UPDATE photo_storage_settings SET initialized=1 WHERE id=1 AND maintenance=0 AND inventory_cursor=?')
    .bind(INVENTORY_FINISH).run();
}

export async function reservePhoto(key: string, ownerId: string, catchId: number, bytes: number) {
  const globalLimit = storageLimit(env.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES, 8000000000);
  const userLimit = storageLimit(env.PHOTO_STORAGE_USER_LIMIT_BYTES, 100000000);
  const db = getDb();
  try {
    // D1 batch is atomic: another Worker cannot change the limits between
    // applying this request's configuration and the reservation trigger check.
    await db.batch([
      db.prepare('UPDATE photo_storage_settings SET global_limit_bytes=?,user_limit_bytes=? WHERE id=1 AND (global_limit_bytes!=? OR user_limit_bytes!=?)')
        .bind(globalLimit, userLimit, globalLimit, userLimit),
      db.prepare(`INSERT INTO photo_storage_objects
      (object_key,owner_id,catch_id,byte_size,state,created_at) VALUES (?,?,?,?,'reserved',?)`)
        .bind(key, ownerId, catchId, bytes, new Date().toISOString()),
    ]);
  } catch (error) {
    const reason = String(error);
    if (reason.includes('photo_global_limit')) throw new ApiError(413,
      `サイト全体の写真保存容量（${globalLimit / 1000000000}GB）に達するため、写真を追加できません。写真の閲覧・削除と、写真なしの釣果登録は引き続き利用できます。`);
    if (reason.includes('photo_user_limit')) throw new ApiError(413,
      `あなたの写真保存容量（${userLimit / 1000000}MB）に達するため、写真を追加できません。不要な写真を削除してください。写真なしの釣果登録は引き続き利用できます。`);
    if (reason.includes('photo_count_limit')) throw new ApiError(400, '写真は1件につき6枚までです。');
    if (reason.includes('photo_catch_unavailable')) throw new ApiError(409, '記録を削除中、または削除済みです。写真を追加できません。');
    if (reason.includes('photo_storage_not_ready')) throw new ApiError(503, '写真の保存容量を確認中です。しばらくしてから写真を追加してください。');
    throw error;
  }
}

/** Only called after put has settled. Retain the charged row until R2 deletion
 * succeeds; retries are idempotent and cannot give a still-stored object free space. */
export async function discardPhoto(key: string) {
  const db = getDb();
  await db.prepare("UPDATE photo_storage_objects SET state='deleting' WHERE object_key=?").bind(key).run();
  await getBucket().delete(key);
  await db.batch([
    db.prepare('UPDATE catches SET featured_photo_id=(SELECT MIN(id) FROM catch_photos WHERE catch_id=catches.id AND object_key!=?) WHERE featured_photo_id IN (SELECT id FROM catch_photos WHERE object_key=?)').bind(key, key),
    db.prepare('DELETE FROM catch_photos WHERE object_key=?').bind(key),
    db.prepare("DELETE FROM photo_storage_objects WHERE object_key=? AND state='deleting'").bind(key),
  ]);
}

/** Retry failed R2/DB cleanups on subsequent mutations. Reserved rows are NOT
 * swept: an active writer may still own them. See the maintenance procedure. */
export async function retryPhotoCleanup() {
  const rows = await getDb().prepare("SELECT object_key FROM photo_storage_objects WHERE state='deleting' LIMIT 2")
    .all<{ object_key: string }>();
  for (const row of rows.results) {
    try { await discardPhoto(row.object_key); }
    catch (error) { console.error('Photo cleanup will be retried', error); }
  }
}

export async function deleteCatchPhotos(id: number) {
  const db = getDb();
  // Serialize against new reservations and attachment via the D1 triggers.
  await db.prepare('UPDATE catches SET photos_deleting=1 WHERE id=?').bind(id).run();
  const rows = await db.prepare("SELECT object_key FROM photo_storage_objects WHERE catch_id=? AND state!='reserved'")
    .bind(id).all<{ object_key: string }>();
  for (const row of rows.results) await discardPhoto(row.object_key);
  // Pending writers remain charged, then attachment fails and they self-clean.
}
