import { authenticate, ensureProfile, json, apiError } from '../access';
import { getDb } from '../catches/db';
import { setInput, ownSets } from '../gear/storage';
import { gearLimits } from '../../gear';

export async function GET(req: Request) {
  try {
    const user = await authenticate(req);
    return json(await ownSets(user.userId));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await authenticate(req),
      v = await setInput(await req.json(), user.userId);
    await ensureProfile(user);
    const r = await getDb()
      .prepare(
        'INSERT INTO gear_sets (owner_id,name,target_species,method,gear_json,favorite,retired) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM gear_sets WHERE owner_id=?)<?',
      )
      .bind(
        user.userId,
        v.name,
        v.targetSpecies,
        v.method,
        JSON.stringify(v.gear),
        Number(v.favorite),
        Number(v.retired),
        user.userId,
        gearLimits.sets,
      )
      .run();
    if (!r.meta.changes)
      return json({ error: 'セットは100組まで登録できます。' }, 400);
    return json({ id: Number(r.meta.last_row_id), ...v }, 201);
  } catch (e) {
    return apiError(e);
  }
}
