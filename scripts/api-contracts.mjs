import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';

const spec = parse(await readFile('openapi/openapi.yaml', 'utf8'));
const operations = [];
for (const [path, item] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(item)) {
    if (
      !['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(
        method,
      )
    )
      continue;
    const id = operation.operationId;
    operations.push(
      `{ id: '${id}', method: '${method.toUpperCase()}', path: '${path.replace(/\{([^}]+)\}/g, ':$1')}' }`,
    );
  }
}
await writeFile(
  'lib/api/generated/operations.gen.ts',
  `// Generated from openapi/openapi.yaml. Do not edit.\nexport const operations = [\n${operations.join(',\n')}\n] as const;\n\nexport type OperationId = (typeof operations)[number]['id'];\n`,
);
const browser = [];
for (const item of Object.values(spec.paths))
  for (const [method, op] of Object.entries(item)) {
    if (
      !['get', 'post', 'put', 'delete', 'patch'].includes(method) ||
      op.operationId === 'getPhoto' ||
      op.operationId.includes('GoogleLogin')
    )
      continue;
    const name = op.operationId;
    browser.push(
      `${name}: (...args: Parameters<typeof sdk.${name}>) => apiResponse(sdk.${name}({ ...args[0], client: browserClient() })),`,
    );
  }
await writeFile(
  'lib/api/generated/browser.gen.ts',
  `// Generated from openapi/openapi.yaml. Do not edit.\nimport * as sdk from './sdk.gen';\nimport { apiResponse, browserClient } from '../browser';\n\nexport const browserApi = {\n${browser.join('\n')}\n};\n`,
);
