import { authenticate, json, apiError } from '../../access';
import { getDb } from '../../catches/db';
import { setInput } from '../../gear/storage';
import { validId } from '../../catches/photos';

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticate(req),
      id = validId((await ctx.params).id);
    if (!id) return json({ error: 'セットが見つかりません。' }, 404);
    const owned = await getDb()
      .prepare('SELECT id FROM gear_sets WHERE id=? AND owner_id=?')
      .bind(id, user.userId)
      .first();
    if (!owned) return json({ error: 'セットが見つかりません。' }, 404);
    const v = await setInput(await req.json(), user.userId);
    const r = await getDb()
      .prepare(
        'UPDATE gear_sets SET name=?,target_species=?,method=?,gear_json=?,favorite=?,retired=? WHERE id=? AND owner_id=?',
      )
      .bind(
        v.name,
        v.targetSpecies,
        v.method,
        JSON.stringify(v.gear),
        Number(v.favorite),
        Number(v.retired),
        id,
        user.userId,
      )
      .run();
    return r.meta.changes
      ? json({ id, ...v })
      : json({ error: 'セットが見つかりません。' }, 404);
  } catch (e) {
    return apiError(e);
  }
}
