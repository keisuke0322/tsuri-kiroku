import { authenticate, ownedCatch, json, apiError, ApiError } from '../../../access';
import { getDb } from '../../db';
import { getBucket, photoType, validId } from '../../photos';
import { PHOTO_FILE_LIMIT, initializePhotoStorage, reservePhoto, discardPhoto, retryPhotoCleanup } from '../../photo-storage';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(req);
    const id = validId((await ctx.params).id);
    if (!id) return json({ error: '記録が見つかりません。' }, 400);
    const stated = Number(req.headers.get('content-length') || 0);
    if (stated > PHOTO_FILE_LIMIT + 65536) return json({ error: '写真は1枚8MiB以下にしてください。' }, 413);
    await ownedCatch(id, user.userId);
    const db = getDb(), bucket = getBucket();
    const form = await req.formData(), file = form.get('photo');
    const species = String(form.get('species') || '').trim(), featured = form.get('featured') === 'true';
    if (!(file instanceof File)) return json({ error: '写真を選んでください。' }, 400);
    if (!species || !await db.prepare('SELECT id FROM catch_fish WHERE catch_id=? AND species=?').bind(id, species).first()) {
      return json({ error: '写真の魚種を選んでください。' }, 400);
    }
    if (!file.size || file.size > PHOTO_FILE_LIMIT) return json({ error: '写真は1枚8MiB以下にしてください。' }, 413);
    const bytes = new Uint8Array(await file.arrayBuffer()), type = photoType(bytes);
    if (!type) return json({ error: 'JPEG、PNG、WebP、HEIC形式の写真を選んでください。' }, 400);
    await retryPhotoCleanup();
    try { await initializePhotoStorage(); }
    catch (error) {
      if (error instanceof ApiError) throw error;
      console.error('Photo inventory incomplete', error);
      throw new ApiError(503, '写真の保存容量を確認できませんでした。釣果の文字情報は保存できます。しばらくしてから写真を追加してください。');
    }
    const key = `catches/${id}/${crypto.randomUUID()}`;
    await reservePhoto(key, user.userId, id, bytes.byteLength);
    try {
      await bucket.put(key, bytes, { httpMetadata: { contentType: type } });
      // One D1 transaction: photo + featured image + reservation finalization.
      const saved = await db.batch([
        db.prepare('INSERT INTO catch_photos (catch_id,object_key,content_type,created_at,species) VALUES (?,?,?,?,?)')
          .bind(id, key, type, new Date().toISOString(), species),
        db.prepare(`UPDATE catches SET featured_photo_id=(SELECT id FROM catch_photos WHERE object_key=?)
          WHERE id=? AND (?=1 OR featured_photo_id IS NULL)`).bind(key, id, featured ? 1 : 0),
        db.prepare("UPDATE photo_storage_objects SET state='stored' WHERE object_key=? AND state='reserved'").bind(key),
      ]);
      const photoId = Number(saved[0].meta.last_row_id);
      return json({ id: photoId, species, featured: saved[1].meta.changes > 0 }, 201);
    } catch (error) {
      // R2 may have accepted put even if its response failed. Always delete first.
      try { await discardPhoto(key); }
      catch (cleanupError) { console.error('Photo rollback queued for retry', cleanupError); }
      if (String(error).includes('photo_catch_unavailable')) throw new ApiError(409, '記録が削除されたため、写真を追加できませんでした。');
      throw error;
    }
  } catch (error) { return apiError(error); }
}
