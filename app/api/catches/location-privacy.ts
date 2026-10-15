import { ApiError } from '../access';
import { getDb } from './db';
import type { Position } from '../../fishing-position';
import {
  approximateArea,
  parseVisibility,
  type LocationVisibility,
} from '../../location-privacy';

export function visibilityInput(
  body: Record<string, unknown>,
  fallback: LocationVisibility = 'area',
) {
  if (!Object.hasOwn(body, 'locationVisibility')) return fallback;
  const visibility = parseVisibility(body.locationVisibility);
  if (!visibility)
    throw new ApiError(400, '場所の公開範囲を確認してください。');
  return visibility;
}

export async function visibilityStatement(
  id: number,
  body: Record<string, unknown>,
  position: Position | null | undefined,
) {
  // Older clients preserve both the visibility and the unpublished legacy snapshot.
  if (position === undefined && !Object.hasOwn(body, 'locationVisibility'))
    return null;
  const db = getDb(),
    current = await db
      .prepare('SELECT location_visibility FROM catches WHERE id=?')
      .bind(id)
      .first<{ location_visibility: LocationVisibility }>();
  const visibility = visibilityInput(body, current?.location_visibility);
  const saved =
    position === undefined
      ? await db
          .prepare(
            'SELECT latitude,longitude FROM catch_positions WHERE catch_id=?',
          )
          .bind(id)
          .first<Position>()
      : position;
  const area = visibility === 'area' && saved ? approximateArea(saved) : null;
  return db
    .prepare(
      'UPDATE catches SET location_visibility=?,public_latitude=?,public_longitude=? WHERE id=?',
    )
    .bind(visibility, area?.latitude ?? null, area?.longitude ?? null, id);
}
