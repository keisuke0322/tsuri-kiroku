import { authenticate, json, apiError } from '../../access';
import { getDb } from '../../catches/db';
import { gearInput } from '../storage';
import { validId } from '../../catches/photos';

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticate(req),
      id = validId((await ctx.params).id),
      v = gearInput(await req.json());
    if (!id) return json({ error: '道具が見つかりません。' }, 404);
    const r = await getDb()
      .prepare(
        'UPDATE gear SET kind=?,name=?,manufacturer=?,model=?,spec=?,memo=?,favorite=?,retired=? WHERE id=? AND owner_id=?',
      )
      .bind(
        v.kind,
        v.name,
        v.manufacturer,
        v.model,
        v.spec,
        v.memo,
        Number(v.favorite),
        Number(v.retired),
        id,
        user.userId,
      )
      .run();
    return r.meta.changes
      ? json({ id, ...v })
      : json({ error: '道具が見つかりません。' }, 404);
  } catch (e) {
    return apiError(e);
  }
}
