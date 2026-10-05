import { env } from 'cloudflare:workers';
export function getDb(){const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw Error('Database unavailable');return db}
export {parseCatch,type FishInput} from '../../catch-validation';
export function fail(e:unknown){console.error('Catch storage error',e);return Response.json({error:'記録を保存・読み込みできませんでした。再試行してください。'},{status:500})}
