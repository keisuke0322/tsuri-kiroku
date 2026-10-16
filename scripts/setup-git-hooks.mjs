import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
    stdio: 'inherit',
  });
  console.log('Git pre-push hook enabled (.githooks/pre-push).');
} catch (error) {
  console.error('Could not enable Git hooks:', error.message);
  process.exitCode = 1;
}
