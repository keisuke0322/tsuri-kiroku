import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { Scalar } from '@scalar/hono-api-reference';
import { authenticate, apiError } from '../app/api/access';
import { operations } from '../lib/api/generated/operations.gen';
import specification from '../lib/api/generated/openapi.json';
import { handlers } from './handlers';

export const api = new Hono();

api.onError((error) => apiError(error));
api.use('*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  await next();
});

for (const path of ['/api/docs', '/api/openapi.json']) {
  api.use(path, async (c, next) => {
    const stage = (env as unknown as { APP_ENV?: string }).APP_ENV;
    if (stage !== 'local' && stage !== 'staging') return c.notFound();
    await authenticate(c.req.raw);
    await next();
  });
}

api.get('/api/openapi.json', (c) => c.json(specification));
api.get(
  '/api/docs',
  Scalar({
    url: '/api/openapi.json',
    cdn: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.85.0',
    bundle: false,
    proxyUrl: '',
    persistAuth: false,
    showDeveloperTools: 'never',
    authentication: { preferredSecurityScheme: [] },
    customFetch: (input, init) =>
      fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store' }),
  }),
);

for (const operation of operations) {
  api.on(operation.method, operation.path, async (c) => {
    return handlers[operation.id](c);
  });
}

api.all('*', (c) => {
  const allowed = api.routes
    .filter((route) => route.method !== 'ALL' && route.method !== 'HEAD')
    .filter((route) => {
      const expected = route.path.split('/');
      const actual = c.req.path.split('/');
      return (
        expected.length === actual.length &&
        expected.every((part, i) => part.startsWith(':') || part === actual[i])
      );
    })
    .map((route) => route.method);
  if (!allowed.length) return c.notFound();
  if (allowed.includes('GET')) allowed.push('HEAD');
  allowed.push('OPTIONS');
  return new Response(null, {
    status: c.req.method === 'OPTIONS' ? 204 : 405,
    headers: { Allow: [...new Set(allowed)].join(', ') },
  });
});
