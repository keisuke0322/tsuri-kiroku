import { authenticate, ownedCatch, json, apiError } from '../../../../access';
import { getDb } from '../../../db';
import { validId } from '../../../photos';
import { discardPhoto, retryPhotoCleanup } from '../../../photo-storage';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const user = await authenticate(req);
    const raw = await ctx.params, id = validId(raw.id), photoId = validId(raw.photoId);
    if (!id || !photoId) return json({ error: '写真が見つかりません。' }, 400);
    await ownedCatch(id, user.userId);
    const photo = await getDb().prepare('SELECT object_key FROM catch_photos WHERE id=? AND catch_id=?')
      .bind(photoId, id).first<{ object_key: string }>();
    if (!photo) return json({ error: '写真が見つかりません。' }, 404);
    await discardPhoto(photo.object_key);
    await retryPhotoCleanup();
    return json({ ok: true });
  } catch (error) { return apiError(error); }
}
