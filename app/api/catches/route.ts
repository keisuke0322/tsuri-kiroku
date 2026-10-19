import {
  combinationsInput,
  combinationStatements,
  readCombination,
  type CombinationRow,
} from '../gear/storage';
import { visibilityInput } from './location-privacy';
import { approximateArea } from '../../location-privacy';
import { positionInput, rememberSpot, positionStatement } from './positions';
import { getDb, parseCatch } from './db';
import {
  authenticate,
  ensureProfile,
  json,
  apiError,
  ApiError,
} from '../access';
import { initializePhotoStorage } from './photo-storage';

export async function GET(req: Request) {
  try {
    const user = await authenticate(req),
      db = getDb();
    // Advance the first inventory on normal visits, without blocking viewing on
    // maintenance, incomplete inventory, or R2 availability.
    try {
      await initializePhotoStorage();
    } catch (error) {
      if (!(error instanceof ApiError))
        console.error('Photo inventory will resume on the next request', error);
    }
    const r = await db
      .prepare(
        `SELECT c.*,p.display_name AS authorName,
 (SELECT COUNT(*) FROM catch_likes l WHERE l.catch_id=c.id) AS likeCount,
 EXISTS(SELECT 1 FROM catch_likes l WHERE l.catch_id=c.id AND l.user_id=?) AS liked
 FROM catches c JOIN profiles p ON p.user_id=c.owner_id ORDER BY c.date DESC,c.id DESC`,
      )
      .bind(user.userId)
      .all();
    const fish = await db
      .prepare(
        'SELECT id,catch_id,species,count,length,sort_order FROM catch_fish ORDER BY catch_id,sort_order,id',
      )
      .all<{
        id: number;
        catch_id: number;
        species: string;
        count: number;
        length: number | null;
        sort_order: number;
      }>();
    const photos = await db
      .prepare('SELECT id,catch_id,species FROM catch_photos ORDER BY id')
      .all<{ id: number; catch_id: number; species: string | null }>();
    const positions = await db
      .prepare(
        "SELECT cp.* FROM catch_positions cp JOIN catches c ON c.id=cp.catch_id WHERE c.owner_id=? OR c.location_visibility='exact'",
      )
      .bind(user.userId)
      .all<{
        catch_id: number;
        spot_id: number | null;
        latitude: number;
        longitude: number;
        source: string;
      }>();
    const combinations = await db
      .prepare('SELECT * FROM catch_combinations ORDER BY catch_id,sort_order')
      .all<CombinationRow>();
    return json(
      r.results.map((row) => {
        const rows = fish.results.filter((f) => f.catch_id === row.id),
          fallback = [
            {
              id: 0,
              catch_id: Number(row.id),
              species: String(row.species),
              count: Number(row.count),
              length: row.length == null ? null : Number(row.length),
              sort_order: 0,
            },
          ],
          catchFish = rows.length ? rows : fallback,
          catchPhotos = photos.results
            .filter((p) => p.catch_id === row.id)
            .map((p) => ({
              id: p.id,
              species: p.species || catchFish[0].species,
            }));
        const p = positions.results.find((p) => p.catch_id === row.id);
        const {
          location_visibility,
          public_latitude,
          public_longitude,
          guest_public: _retiredGuestPublic,
          ...shared
        } = row;
        const own = row.owner_id === user.userId,
          hidden = !own && location_visibility === 'private';
        return {
          ...shared,
          location: hidden ? '' : row.location,
          locationVisibility: location_visibility,
          locationHidden: hidden,
          publicArea:
            location_visibility === 'area' &&
            public_latitude != null &&
            public_longitude != null
              ? {
                  latitude: public_latitude,
                  longitude: public_longitude,
                  radius: 8000,
                }
              : null,
          position: p
            ? {
                latitude: p.latitude,
                longitude: p.longitude,
                source: own ? p.source : 'map',
                ...(own ? { spotId: p.spot_id } : {}),
              }
            : null,
          combinations: combinations.results
            .filter((c) => c.catch_id === row.id)
            .map(readCombination),
          liked: !!row.liked,
          fish: catchFish.map(({ id, species, count, length }) => ({
            id,
            species,
            count,
            length,
          })),
          photos: catchPhotos,
          photoIds: catchPhotos.map((p) => p.id),
        };
      }),
    );
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await authenticate(req),
      body = (await req.json()) as Record<string, unknown>,
      v = parseCatch(body);
    if (!v) return json({ error: '入力内容を確認してください。' }, 400);
    const combinations = await combinationsInput(
      body.combinations,
      user.userId,
      v.fish.map((f) => f.species),
    );
    const visibility = visibilityInput(body),
      position = await positionInput(body, user.userId);
    await ensureProfile(user);
    const spotId = position
      ? await rememberSpot(position, v.location, user.userId)
      : null;
    const area =
      visibility === 'area' && position ? approximateArea(position) : null;
    const db = getDb(),
      first = v.fish[0],
      r = await db
        .prepare(
          'INSERT INTO catches (date,location,species,count,length,method,memo,created_at,owner_id,location_visibility,public_latitude,public_longitude) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          v.date,
          v.location,
          first.species,
          first.count,
          first.length,
          v.method,
          v.memo,
          new Date().toISOString(),
          user.userId,
          visibility,
          area?.latitude ?? null,
          area?.longitude ?? null,
        )
        .run(),
      id = Number(r.meta.last_row_id);
    await db.batch([
      ...combinationStatements(id, combinations),
      ...v.fish.map((fish, index) =>
        db
          .prepare(
            'INSERT INTO catch_fish (catch_id,species,count,length,sort_order) VALUES (?,?,?,?,?)',
          )
          .bind(id, fish.species, fish.count, fish.length, index),
      ),
      ...(position ? [positionStatement(id, position, spotId)] : []),
    ]);
    return json({ id }, 201);
  } catch (e) {
    return apiError(e);
  }
}
