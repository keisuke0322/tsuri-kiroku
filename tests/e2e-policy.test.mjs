import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {command} from '../scripts/e2e-command.mjs';
import {validateTarget, createSession, createRunMarker, cleanupQuery} from '../scripts/e2e-policy.mjs';
const config = {name: 'tsuri-kiroku-staging', vars: {APP_ORIGIN: 'https://tsuri-kiroku-staging.keisuke0322.workers.dev'},
  d1_databases: [{database_name: 'tsuri-kiroku-staging', database_id: 'bd5eb98e-edc9-4c26-8d2b-f1fd8e825ba5'}]};
test('E2E rejects production, mixed databases, missing users and SQL injection', () => {
  assert.equal(validateTarget(config, 'google:123'), config.vars.APP_ORIGIN);
  for (const bad of [{...config, name: 'tsuri-kiroku-production'}, {...config, vars: {APP_ORIGIN: 'https://other.example'}},
    {...config, d1_databases: [{...config.d1_databases[0], database_id: 'production-id'}]}]) assert.throws(() => validateTarget(bad, 'google:123'), /staging/);
  for (const id of ['', "google:123'; DELETE FROM catches; --", '123']) assert.throws(() => validateTarget(config, id));
  assert.throws(() => validateTarget(config, 'google:123', 'google:123'));
});
test('cleanup selects only this run and owner, leaving existing data intact', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE catches (id INTEGER, owner_id TEXT, memo TEXT)');
  const marker = createRunMarker();
  const insert = db.prepare('INSERT INTO catches VALUES (?,?,?)');
  insert.run(1, 'google:123', marker);
  insert.run(2, 'google:123', 'my existing catch');
  insert.run(3, 'google:456', marker);
  insert.run(4, 'google:123', createRunMarker());
  assert.deepEqual(db.prepare(cleanupQuery('google:123', marker)).all().map(row => row.id), [1]);
  assert.throws(() => cleanupQuery('google:123', '%'));
  assert.throws(() => cleanupQuery("google:123' OR 1=1", marker));
  db.close();
});
test('temporary sessions are random, hashed and expire within an hour', () => {
  const session = createSession('google:123');
  assert.match(session.token, /^[a-f0-9]{64}$/);
  assert.equal(session.hash, createHash('sha256').update(session.token).digest('hex'));
  assert.notEqual(session.token, createSession('google:123').token);
  assert.ok(session.expires <= Math.floor(Date.now()/1000) + 3600);
});
test('D1 CLI JSON remains parseable without pnpm policy output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tsuri-cli-test-'));
  try {
    const output = await command(['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB',
      '--local', '--config', 'wrangler.jsonc', '--persist-to', directory, '--command', 'SELECT 1 AS n', '--json'], {quiet: true});
    const result = JSON.parse(output);
    assert.equal(result[0].success, true);
    assert.equal(result[0].results[0].n, 1);
  } finally { await rm(directory, {recursive: true, force: true}); }
});
test('command errors do not expose captured credential-bearing output', async () => {
  await assert.rejects(command(['--eval', 'console.log("fake-secret"); console.error("fake-secret"); process.exit(1)'], {quiet: true}),
    error => !error.message.includes('fake-secret'));
});
