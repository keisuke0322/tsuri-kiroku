import { authenticate, ensureProfile, json, apiError } from '../access';
import { getDb } from '../catches/db';
import { gearInput, ownGear } from './storage';
import { gearLimits } from '../../gear';

export async function GET(req: Request) {
  try {
    const user = await authenticate(req);
    return json(await ownGear(user.userId));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await authenticate(req),
      v = gearInput(await req.json());
    await ensureProfile(user);
    const r = await getDb()
      .prepare(
        'INSERT INTO gear (owner_id,kind,name,manufacturer,model,spec,memo,favorite,retired) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM gear WHERE owner_id=?)<?',
      )
      .bind(
        user.userId,
        v.kind,
        v.name,
        v.manufacturer,
        v.model,
        v.spec,
        v.memo,
        Number(v.favorite),
        Number(v.retired),
        user.userId,
        gearLimits.items,
      )
      .run();
    if (!r.meta.changes)
      return json({ error: '道具は1000点まで登録できます。' }, 400);
    return json({ id: Number(r.meta.last_row_id), ...v }, 201);
  } catch (e) {
    return apiError(e);
  }
}
