import {spawn} from 'node:child_process';

// Invoke installed Node CLIs directly and keep captured command output private.
export function command(args, {env = process.env, quiet = false} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {env, stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit'});
    let output = '';
    if (quiet) { child.stdout.on('data', chunk => {output += chunk;}); child.stderr.resume(); }
    child.on('error', () => reject(Error('Could not start E2E command.')));
    child.on('close', code => code === 0 ? resolve(output) : reject(Error('E2E command failed; no credential-bearing output is printed.')));
  });
}
