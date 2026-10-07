/** Operator-only recovery; never releases a reservation while a writer can run. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const exec=promisify(execFile);
const args=process.argv.slice(2),action=args[0],config=args[args.indexOf('--config')+1];
if(!['usage','pause','cleanup','resume'].includes(action)||!args.includes('--config')||!config) {
  throw Error('Usage: node scripts/photo-storage-maintenance.mjs usage|pause|cleanup|resume --config CONFIG [--remote] [--quiesced]');
}
const target=JSON.parse(await readFile(config,'utf8'));
const bucket=target.r2_buckets?.find(x=>x.binding==='BUCKET')?.bucket_name;
if(!bucket||target.d1_databases?.filter(x=>x.binding==='DB').length!==1)throw Error('The config must identify this app’s DB and BUCKET.');
const location=args.includes('--remote')?'--remote':'--local';
const wrangler=resolve('node_modules/wrangler/bin/wrangler.js');
async function run(commands) {
  const {stdout}=await exec(process.execPath,[wrangler,...commands,'--config',config,location],{maxBuffer:8*1024*1024});
  return stdout;
}
async function query(sql) {
  const result=JSON.parse(await run(['d1','execute','DB','--command',sql,'--json']));
  if(result.some(r=>r.success===false))throw Error('D1 maintenance query failed');
  return result.flatMap(r=>r.results||[]);
}
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
if(action==='usage') {
  console.log(JSON.stringify({settings:await query('SELECT * FROM photo_storage_settings'),states:await query('SELECT state,COUNT(*) objects,SUM(byte_size) bytes FROM photo_storage_objects GROUP BY state'),users:await query('SELECT * FROM photo_storage_users ORDER BY used_bytes DESC LIMIT 50')},null,2));
} else if(action==='pause') {
  await query('UPDATE photo_storage_settings SET maintenance=1 WHERE id=1');
  console.log('New uploads paused. Existing writers must be stopped/drained before cleanup.');
} else if(action==='cleanup') {
  if(!args.includes('--quiesced'))throw Error('Stop/drain every upload writer first, then pass --quiesced. Age alone is not proof that a writer has stopped.');
  if(!(await query('SELECT maintenance FROM photo_storage_settings WHERE id=1'))[0]?.maintenance)throw Error('Run pause before cleanup.');
  let deleted=0;
  for(;;) {
    const rows=await query("SELECT object_key FROM photo_storage_objects WHERE state IN ('reserved','deleting') LIMIT 100");
    if(!rows.length)break;
    for(const row of rows) {
      const key=literal(row.object_key);
      await query(`UPDATE photo_storage_objects SET state='deleting' WHERE object_key=${key}`);
      // A failed R2 delete throws before accounting is released; rerun to retry.
      await run(['r2','object','delete',`${bucket}/${row.object_key}`]);
      await query(`UPDATE catches SET featured_photo_id=(SELECT MIN(id) FROM catch_photos WHERE catch_id=catches.id AND object_key!=${key}) WHERE featured_photo_id IN (SELECT id FROM catch_photos WHERE object_key=${key}); DELETE FROM catch_photos WHERE object_key=${key}; DELETE FROM photo_storage_objects WHERE object_key=${key} AND state='deleting';`);
      deleted++;
    }
  }
  console.log(`Cleaned ${deleted} interrupted/failed uploads. Accounting remains charged until each R2 delete succeeds.`);
} else {
  const pending=await query("SELECT COUNT(*) n FROM photo_storage_objects WHERE state IN ('reserved','deleting')");
  if(pending[0]?.n)throw Error('Finish cleanup before resuming.');
  await query("UPDATE photo_storage_objects SET inventory_seen=0 WHERE state='stored'; UPDATE photo_storage_settings SET maintenance=0,initialized=0,inventory_cursor=NULL WHERE id=1;");
  console.log('Uploads will resume after the next bounded inventory completes.');
}
