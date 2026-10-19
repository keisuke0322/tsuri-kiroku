import { authenticate, json, apiError, ApiError } from '../access';
import { getDb } from '../catches/db';
import { readCombination, type CombinationRow } from '../gear/storage';

export async function GET(req: Request) {
  try {
    const user = await authenticate(req),
      q = new URL(req.url).searchParams;
    const where = ['c.owner_id=?'],
      args: (string | number)[] = [user.userId];
    for (const [key, clause] of [
      [
        'gearId',
        "EXISTS (SELECT 1 FROM json_each(cc.gear_json) g WHERE json_extract(g.value,'$.id')=?)",
      ],
      ['setId', 'cc.set_id=?'],
    ] as const) {
      if (!q.has(key)) continue;
      const id = Number(q.get(key));
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new ApiError(400, '検索条件を確認してください。');
      where.push(clause);
      args.push(id);
    }
    for (const [key, clause, max] of [
      [
        'species',
        'EXISTS (SELECT 1 FROM json_each(cc.species_json) s WHERE s.value=?)',
        80,
      ],
    ] as const) {
      if (!q.get(key)) continue;
      if (q.get(key)!.length > max)
        throw new ApiError(400, '検索条件が長すぎます。');
      where.push(clause);
      args.push(q.get(key)!);
    }
    if (q.has('combinationId')) {
      const id = Number(q.get('combinationId'));
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new ApiError(400, '組み合わせを確認してください。');
      where.push(
        'cc.signature=(SELECT source.signature FROM catch_combinations source JOIN catches owner ON owner.id=source.catch_id WHERE source.id=? AND owner.owner_id=?)',
      );
      args.push(id, user.userId);
    }
    const offset = Number(q.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new ApiError(400, 'ページを確認してください。');
    const rows = await getDb()
      .prepare(
        `SELECT cc.*,c.date FROM catch_combinations cc JOIN catches c ON c.id=cc.catch_id WHERE ${where.join(' AND ')} ORDER BY c.date DESC,c.id DESC,cc.sort_order LIMIT 51 OFFSET ?`,
      )
      .bind(...args, offset)
      .all<CombinationRow>();
    return json({
      items: rows.results.slice(0, 50).map((r) => ({
        ...readCombination(r),
        id: r.id,
        catchId: r.catch_id,
        date: r.date,
      })),
      more: rows.results.length > 50,
    });
  } catch (e) {
    return apiError(e);
  }
}
