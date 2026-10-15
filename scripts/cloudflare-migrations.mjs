import {
  appendFile,
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { command } from './e2e-command.mjs';

export const cleanupMigration = '0009_remove_guest_public.sql';
const cli = ['node_modules/wrangler/bin/wrangler.js', 'd1'];

export async function beforeDeployment(
  configPath = 'wrangler.deploy.json',
  run = command,
) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const directory = await mkdtemp(join(tmpdir(), 'tsuri-migrations-'));
  try {
    const database = config.d1_databases.find((db) => db.binding === 'DB');
    const migrations = resolve(dirname(configPath), database.migrations_dir);
    for (const file of await readdir(migrations))
      if (file.endsWith('.sql') && file !== cleanupMigration)
        await copyFile(join(migrations, file), join(directory, file));
    const temporary = join(directory, 'wrangler.json');
    await writeFile(
      temporary,
      JSON.stringify({
        name: config.name,
        account_id: config.account_id,
        compatibility_date: config.compatibility_date,
        d1_databases: [{ ...database, migrations_dir: directory }],
      }),
    );
    await run(
      [...cli, 'migrations', 'apply', 'DB', '--remote', '--config', temporary],
      {
        quiet: true,
      },
    );
    console.log(
      'Applied compatible migrations; guest column removal is deferred until after Worker verification.',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function afterDeployment(
  configPath = 'wrangler.deploy.json',
  run = command,
  record = async (bookmark) => {
    const message = `D1 recovery bookmark before ${cleanupMigration}: ${bookmark}\n`;
    console.log(message.trim());
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, message);
  },
) {
  const query = async (sql) => {
    const results = JSON.parse(
      await run(
        [
          ...cli,
          'execute',
          'DB',
          '--remote',
          '--config',
          configPath,
          '--command',
          sql,
          '--json',
        ],
        { quiet: true },
      ),
    );
    if (!Array.isArray(results) || results.some((result) => !result.success))
      throw Error('D1 schema verification failed.');
    return results.flatMap((result) => result.results);
  };
  if (
    (
      await query(
        "SELECT name FROM pragma_table_info('catches') WHERE name='guest_public'",
      )
    ).length
  ) {
    // Time Travel is D1's managed backup. Refuse the destructive migration without a recovery point.
    const { bookmark } = JSON.parse(
      await run(
        [...cli, 'time-travel', 'info', 'DB', '--config', configPath, '--json'],
        {
          quiet: true,
        },
      ),
    );
    if (typeof bookmark !== 'string' || !/^[-a-zA-Z0-9]+$/.test(bookmark))
      throw Error(
        'Missing valid D1 recovery bookmark; cleanup was not applied.',
      );
    await record(bookmark);
  }
  await run(
    [...cli, 'migrations', 'apply', 'DB', '--remote', '--config', configPath],
    {
      quiet: true,
    },
  );
  if (
    (
      await query(
        "SELECT name FROM pragma_table_info('catches') WHERE name='guest_public' UNION ALL SELECT name FROM sqlite_master WHERE name='idx_catches_guest_date'",
      )
    ).length
  )
    throw Error('Guest schema was not fully removed.');
  if ((await query('PRAGMA foreign_key_check')).length)
    throw Error('Foreign key validation failed after cleanup.');
  console.log(
    'Verified guest column and index removed; foreign key check passed. No catches or photo objects deleted.',
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const phase = process.argv[2];
  if (phase === 'before') await beforeDeployment();
  else if (phase === 'after') await afterDeployment();
  else throw Error('Choose before or after deployment.');
}
