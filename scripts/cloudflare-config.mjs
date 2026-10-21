import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const stage = process.argv[2];
if (!['staging', 'production'].includes(stage))
  throw Error('Choose staging or production');
const envFile = `cloudflare/environments/${stage}.json`;
const saved = existsSync(envFile)
  ? JSON.parse(readFileSync(envFile, 'utf8'))
  : {};
if (!process.env.D1_DATABASE_ID && saved.database_id)
  process.env.D1_DATABASE_ID = saved.database_id;
if (!process.env.APP_ORIGIN && saved.app_origin)
  process.env.APP_ORIGIN = saved.app_origin;
if (!process.env.GOOGLE_CLIENT_ID && saved.google_client_id)
  process.env.GOOGLE_CLIENT_ID = saved.google_client_id;
const required = [
  'CLOUDFLARE_ACCOUNT_ID',
  'D1_DATABASE_ID',
  'APP_ORIGIN',
  'GOOGLE_CLIENT_ID',
];
for (const name of required)
  if (!process.env[name]) throw Error(`Missing ${name}`);
if (!/^[a-f0-9]{32}$/.test(process.env.CLOUDFLARE_ACCOUNT_ID))
  throw Error('Invalid account ID');
if (
  !/^[a-f0-9-]{36}$/.test(process.env.D1_DATABASE_ID) ||
  process.env.D1_DATABASE_ID.startsWith('00000000-')
)
  throw Error('Use the real D1 database ID');
const name = `tsuri-kiroku-${stage}`,
  origin = new URL(process.env.APP_ORIGIN);
if (
  origin.protocol !== 'https:' ||
  origin.origin !== process.env.APP_ORIGIN ||
  !origin.hostname.startsWith(name + '.') ||
  !origin.hostname.endsWith('.workers.dev')
)
  throw Error('Use this environment’s exact workers.dev origin');
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
config.name = name;
config.account_id = process.env.CLOUDFLARE_ACCOUNT_ID;
config.d1_databases = [
  {
    binding: 'DB',
    database_name: name,
    database_id: process.env.D1_DATABASE_ID,
    migrations_dir: 'drizzle',
  },
];
config.r2_buckets = [
  { binding: 'BUCKET', bucket_name: `tsuri-kiroku-photos-${stage}` },
];
config.vars = {
  APP_ORIGIN: origin.origin,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
};
const recordPath = '.release-runtime/record.json';
if (existsSync(recordPath)) {
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  if (record.environment !== stage)
    throw Error('Deployment record environment mismatch');
  config.version_metadata = { binding: 'CF_VERSION_METADATA' };
  config.vars.APP_BUILD_INFO = JSON.stringify({
    environment: stage,
    sha: record.sha,
    version: record.release?.version || null,
    runId: record.runId,
    runAttempt: record.runAttempt,
    builtAt: record.builtAt,
  });
}
if (process.env.GOOGLE_MAPS_API_KEY)
  config.vars.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
for (const [key, fallback] of [
  ['PHOTO_STORAGE_GLOBAL_LIMIT_BYTES', '8000000000'],
  ['PHOTO_STORAGE_USER_LIMIT_BYTES', '100000000'],
]) {
  // GitHub's unset optional environment variables arrive as empty strings.
  const value = process.env[key] || fallback;
  if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw Error(`Invalid ${key}: use a nonnegative safe integer in bytes`);
  config.vars[key] = value;
}
writeFileSync('wrangler.deploy.json', JSON.stringify(config, null, 2) + '\n');
if (existsSync(recordPath)) {
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  record.configSha256 = createHash('sha256')
    .update(readFileSync('wrangler.deploy.json'))
    .digest('hex');
  writeFileSync(recordPath, JSON.stringify(record, null, 2) + '\n');
}
console.log(`Prepared ${stage} configuration (no secrets).`);
