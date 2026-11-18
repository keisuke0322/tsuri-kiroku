import { cp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export async function stageStorybook(
  config,
  {
    destination = 'dist/client/storybook',
    source = 'storybook-static',
    build = () => {
      const result = spawnSync('corepack', ['pnpm', 'run', 'build-storybook'], {
        stdio: 'inherit',
        env: process.env,
      });
      if (result.error) throw result.error;
      if (result.status !== 0) throw Error('Storybook build failed');
    },
  } = {},
) {
  // Always remove old output, even when switching from staging to production.
  await rm(destination, { recursive: true, force: true });
  if (
    config.name !== 'tsuri-kiroku-staging' ||
    config.vars?.APP_ENV !== 'staging'
  ) {
    console.log('Storybook excluded from this application build.');
    return;
  }
  await build();
  await cp(source, destination, { recursive: true });
  console.log('Storybook included at /storybook/ (staging only).');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = JSON.parse(
    await readFile(process.env.CF_CONFIG || 'wrangler.jsonc', 'utf8'),
  );
  await stageStorybook(config);
}
