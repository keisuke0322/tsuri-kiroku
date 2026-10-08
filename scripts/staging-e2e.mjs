import {readFile, writeFile} from 'node:fs/promises';
import {command} from './e2e-command.mjs';
import {validateTarget, createSession, createRunMarker, cleanupQuery} from './e2e-policy.mjs';

const config = JSON.parse(await readFile('wrangler.deploy.json', 'utf8'));
const origin = validateTarget(config, process.env.E2E_USER_ID, process.env.E2E_OTHER_USER_ID);
const sessions = [createSession(process.env.E2E_USER_ID)];
if (process.env.E2E_OTHER_USER_ID) sessions.push(createSession(process.env.E2E_OTHER_USER_ID));
const marker = createRunMarker();
let failed = false;

async function sql(statement) {
  // Remote --file is a bulk import: it emits progress and returns an import
  // summary rather than SELECT rows. Use the query endpoint for small statements.
  const output = await command(['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--remote', '--config', 'wrangler.deploy.json', '--command', statement, '--json'], {quiet: true});
  const result = JSON.parse(output);
  if (!Array.isArray(result) || result.some(item => item.success !== true)) throw Error('Staging D1 query failed.');
  return result.flatMap(item => item.results || []);
}
try {
  for (const session of sessions) {
    if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${session.token}`);
    await sql(`INSERT INTO auth_sessions (token_hash,user_id,expires_at)
      SELECT '${session.hash}', user_id, ${session.expires} FROM profiles WHERE user_id='${session.userId}'`);
    const response = await fetch(origin + '/api/profile', {
      headers: {Cookie: '__Host-tsuri_session=' + session.token}, redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    if (response.status !== 200 || (await response.json()).userId !== session.userId) {
      throw Error('E2E user must already have logged in to staging.');
    }
  }
  if (sessions.length === 1) console.log('Other-user write protection E2E: NOT VERIFIED (E2E_OTHER_USER_ID is unset).');
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY,
    `\n### Staging E2E\n- Google OAuth screen flow: not covered by E2E; covered by existing auth tests.\n- Other-user write protection: ${sessions.length === 2 ? 'included' : 'NOT VERIFIED (E2E_OTHER_USER_ID unset)'}\n`, {flag: 'a'});
  await command(['node_modules/cypress/bin/cypress', 'run', '--browser', 'electron'], {env: {...process.env,
    E2E_BASE_URL: origin, E2E_RUN_MARKER: marker, E2E_SESSION_TOKEN: sessions[0].token,
    E2E_OTHER_SESSION_TOKEN: sessions[1]?.token || '',
  }});
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Staging E2E failed.');
  failed = true;
} finally {
  // Always remove only this run's records through the normal API, including photo cleanup.
  try {
    const rows = await sql(cleanupQuery(sessions[0].userId, marker));
    for (const row of rows) {
      if (!Number.isSafeInteger(row.id) || row.id <= 0) throw Error('Invalid cleanup record ID.');
      const response = await fetch(`${origin}/api/catches/${row.id}`, {method: 'DELETE', redirect: 'error',
        headers: {Origin: origin, Cookie: '__Host-tsuri_session=' + sessions[0].token}, signal: AbortSignal.timeout(20000)});
      if (![200, 404].includes(response.status)) throw Error('Test record cleanup failed.');
    }
  } catch { console.error('Test record cleanup failed; inspect records with marker ' + marker); failed = true; }
  for (const session of sessions) {
    try { await sql(`DELETE FROM auth_sessions WHERE token_hash='${session.hash}' AND user_id='${session.userId}'`); }
    catch { console.error('Temporary session cleanup failed; it expires within one hour.'); failed = true; }
  }
}
process.exitCode = failed ? 1 : 0;
