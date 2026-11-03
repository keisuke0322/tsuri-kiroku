import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDevelopmentBranch,
  getDevelopmentBranch,
} from '../scripts/development-branch.cjs';

const context = { repo: { owner: 'owner', repo: 'repo' } };

test('only develop is accepted as the development branch', () => {
  assert.equal(isDevelopmentBranch('develop'), true);
  for (const name of [
    'main',
    'feature/example',
    'retired-development',
    '',
    undefined,
  ])
    assert.equal(isDevelopmentBranch(name), false);
});

test('development lookup reads the develop commit', async () => {
  const calls = [];
  const data = { object: { type: 'commit', sha: 'head' } };
  const github = {
    rest: {
      git: {
        getRef: async (args) => {
          calls.push(args);
          return { data };
        },
      },
    },
  };
  assert.deepEqual(await getDevelopmentBranch({ github, context }), {
    name: 'develop',
    data,
  });
  assert.deepEqual(calls, [{ ...context.repo, ref: 'heads/develop' }]);
});

for (const status of [404, 403, 429, 500])
  test(`lookup error ${status} stops without selecting an alternative branch`, async () => {
    const calls = [];
    const error = Object.assign(Error('GitHub unavailable'), { status });
    const github = {
      rest: {
        git: {
          getRef: async ({ ref }) => {
            calls.push(ref);
            throw error;
          },
        },
      },
    };
    await assert.rejects(
      getDevelopmentBranch({ github, context }),
      (actual) => actual === error,
    );
    assert.deepEqual(calls, ['heads/develop']);
  });

test('a missing or non-commit development ref is rejected', async () => {
  for (const object of [
    { type: 'tag', sha: 'head' },
    { type: 'commit' },
    undefined,
  ]) {
    const github = {
      rest: { git: { getRef: async () => ({ data: { object } }) } },
    };
    await assert.rejects(
      getDevelopmentBranch({ github, context }),
      /Invalid development branch/,
    );
  }
});
