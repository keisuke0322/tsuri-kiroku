import {createHash, randomBytes, randomUUID} from 'node:crypto';

export function validateTarget(config, userId, otherUserId = '') {
  if (config.name !== 'tsuri-kiroku-staging' ||
      config.vars?.APP_ORIGIN !== 'https://tsuri-kiroku-staging.keisuke0322.workers.dev' ||
      config.d1_databases?.length !== 1 || config.d1_databases[0].database_name !== 'tsuri-kiroku-staging' ||
      config.d1_databases[0].database_id !== 'bd5eb98e-edc9-4c26-8d2b-f1fd8e825ba5') {
    throw Error('E2E may only use the configured staging Worker and D1 database.');
  }
  if (!/^google:[0-9]+$/.test(userId || '')) throw Error('Set staging Secret E2E_USER_ID to your existing Google userId.');
  if (otherUserId && (!/^google:[0-9]+$/.test(otherUserId) || otherUserId === userId)) {
    throw Error('E2E_OTHER_USER_ID must identify a different existing Google user.');
  }
  return config.vars.APP_ORIGIN;
}

export function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  return {userId, token, hash, expires: Math.floor(Date.now() / 1000) + 3600};
}

export function createRunMarker() { return 'E2E-' + randomUUID(); }

// The marker is generated here, never supplied by a browser or selected from old records.
export function cleanupQuery(userId, marker) {
  if (!/^google:[0-9]+$/.test(userId) || !/^E2E-[a-f0-9-]{36}$/.test(marker)) throw Error('Invalid cleanup scope.');
  return `SELECT id FROM catches WHERE owner_id='${userId}' AND memo='${marker}'`;
}
