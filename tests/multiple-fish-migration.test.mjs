import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';

const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
for(const name of ['0000_slim_matthew_murdock.sql','0001_cloudy_glorian.sql','0002_dizzy_greymalkin.sql','0003_green_lily_hollister.sql'])db.exec((await readFile('drizzle/'+name,'utf8')).replaceAll('--> statement-breakpoint',''));
db.prepare('INSERT INTO profiles(user_id,display_name,bio) VALUES (?,?,?)').run('google:owner','釣り人','');
db.prepare('INSERT INTO catches(id,date,location,species,count,length,method,memo,created_at,owner_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(1,'2026-09-29','海岸','シロギス',4,21,'ちょい投げ','','2026-09-29T00:00:00Z','google:owner');
db.prepare('INSERT INTO catch_photos(id,catch_id,object_key,content_type,created_at) VALUES (?,?,?,?,?)').run(10,1,'catches/1/a','image/jpeg','2026-09-29T00:00:00Z');
db.exec((await readFile('drizzle/0004_mushy_frightful_four.sql','utf8')).replaceAll('--> statement-breakpoint',''));
assert.deepEqual({...db.prepare('SELECT species,count,length,sort_order FROM catch_fish WHERE catch_id=1').get()},{species:'シロギス',count:4,length:21,sort_order:0});
assert.equal(db.prepare('SELECT species FROM catch_photos WHERE id=10').get().species,'シロギス');
assert.equal(db.prepare('SELECT featured_photo_id FROM catches WHERE id=1').get().featured_photo_id,10);
console.log('Multiple-fish migration preserved the existing species, count, length and photo representative.');
