import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './openapi/openapi.yaml',
  output: 'lib/api/generated',
  plugins: [
    '@hey-api/typescript',
    '@hey-api/client-fetch',
    '@hey-api/sdk',
    { name: 'valibot', requests: true, responses: true, definitions: true },
  ],
});
