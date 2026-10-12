import {getDb} from '../catches/db';
import {authenticate,json,apiError} from '../access';
export async function GET(req:Request){try{
 const user=await authenticate(req),rows=await getDb().prepare('SELECT id,name,latitude,longitude,favorite FROM fishing_spots WHERE owner_id=? ORDER BY favorite DESC,name,id').bind(user.userId).all();
 return json(rows.results.map(row=>({...row,favorite:!!row.favorite})));
}catch(e){return apiError(e)}}
