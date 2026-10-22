import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('contribution CI runs validation without privileged triggers or deployment access', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/contribution-checks.yml', import.meta.url),
    'utf8',
  );
  assert.match(
    workflow,
    /pull_request:\s*\n\s*branches: \[cloudflare-migration, main\]/,
  );
  assert.match(
    workflow,
    /types: \[opened, synchronize, reopened, ready_for_review\]/,
  );
  assert.match(workflow, /permissions:\s*\n\s*contents: read\s*\nconcurrency:/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(
    workflow,
    /pull_request_target|secrets\.|environment:|wrangler|e2e:staging|write|github-token:|CF_CONFIG/,
  );
  for (const command of [
    'corepack pnpm run typecheck',
    'corepack pnpm test',
    'corepack pnpm build',
  ])
    assert.ok(workflow.includes(`run: ${command}`));
});

test('release workflow still limits PR checks to main and deployments to trusted branches', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/cloudflare.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /pull_request:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /github.event_name != 'pull_request'/);
  assert.match(workflow, /checkProduction/);
  assert.match(workflow, /checkPullRequest/);
});
