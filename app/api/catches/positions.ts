import { getDb } from './db';
import { ApiError } from '../access';
import { parsePosition, type Position } from '../../fishing-position';

export async function positionInput(
  body: Record<string, unknown>,
  userId: string,
): Promise<Position | null | undefined> {
  if (!Object.hasOwn(body, 'position')) return undefined; // Older clients keep existing snapshots.
  if (body.position === null) return null;
  const position = parsePosition(body.position);
  if (!position) throw new ApiError(400, '地図上の位置を確認してください。');
  if (
    position.spotId != null &&
    !(await getDb()
      .prepare('SELECT id FROM fishing_spots WHERE id=? AND owner_id=?')
      .bind(position.spotId, userId)
      .first())
  )
    throw new ApiError(403, '自分の釣り場だけ選択できます。');
  return position;
}

export async function rememberSpot(
  position: Position,
  name: string,
  userId: string,
) {
  if (position.spotId != null) return position.spotId;
  const db = getDb(),
    old = await db
      .prepare(
        'SELECT id FROM fishing_spots WHERE owner_id=? AND name=? AND latitude=? AND longitude=?',
      )
      .bind(userId, name, position.latitude, position.longitude)
      .first<{ id: number }>();
  if (old) return old.id;
  const result = await db
    .prepare(
      'INSERT INTO fishing_spots (owner_id,name,latitude,longitude) VALUES (?,?,?,?)',
    )
    .bind(userId, name, position.latitude, position.longitude)
    .run();
  return Number(result.meta.last_row_id);
}

export function positionStatement(
  id: number,
  position: Position | null,
  spotId: number | null,
) {
  const db = getDb();
  return position
    ? db
        .prepare(
          'INSERT INTO catch_positions (catch_id,spot_id,latitude,longitude,source) VALUES (?,?,?,?,?) ON CONFLICT(catch_id) DO UPDATE SET spot_id=excluded.spot_id,latitude=excluded.latitude,longitude=excluded.longitude,source=excluded.source',
        )
        .bind(
          id,
          spotId,
          position.latitude,
          position.longitude,
          position.source,
        )
    : db.prepare('DELETE FROM catch_positions WHERE catch_id=?').bind(id);
}
