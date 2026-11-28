import assert from 'node:assert/strict';
import * as valibot from 'valibot';
import specification from '../lib/api/generated/openapi.json' with { type: 'json' };

// Exercise the same Hono dispatcher as production while retaining readable test calls.
export function routeFacade(filename, loadModule) {
  const route = filename.replace(/^app/, '').replace(/\/handlers\.ts$/, '');
  return new Proxy(
    {},
    {
      get(_target, method) {
        if (method === 'then' || typeof method !== 'string') return undefined;
        const template = route.replace(/\[([^\]]+)\]/g, '{$1}');
        if (!specification.paths[template]?.[method.toLowerCase()])
          return undefined;
        return async (request, context) => {
          const params = (await context?.params) || {};
          const url = new URL(request.url);
          url.pathname = route.replace(/\[([^\]]+)\]/g, (_, name) =>
            encodeURIComponent(params[name]),
          );
          const { api } = await loadModule('server/api.ts');
          const response = await api.fetch(new Request(url, request));
          const template = route.replace(/\[([^\]]+)\]/g, '{$1}');
          const operation =
            specification.paths[template]?.[String(method).toLowerCase()];
          assert.ok(operation, `${method} ${template} must be documented`);
          const contract = operation.responses[response.status];
          assert.ok(
            contract,
            `${method} ${template}: undocumented status ${response.status}`,
          );
          const media = response.headers.get('content-type')?.split(';')[0];
          if (
            response.status === 204 ||
            (response.status >= 300 && response.status < 400)
          ) {
            assert.equal(await response.clone().text(), '');
          } else if (media === 'application/json') {
            assert.ok(
              contract.content?.[media],
              `${template}: undocumented JSON response`,
            );
            const schemas = await loadModule(
              'lib/api/generated/valibot.gen.ts',
            );
            const name = operation.operationId;
            const schema = response.ok
              ? schemas[`v${name[0].toUpperCase()}${name.slice(1)}Response`]
              : schemas.vError;
            assert.ok(schema, `Missing generated response schema for ${name}`);
            const checked = valibot.safeParse(
              schema,
              await response.clone().json(),
            );
            assert.ok(
              checked.success,
              `${method} ${template}: ${JSON.stringify(checked.issues)}`,
            );
          } else {
            assert.ok(
              contract.content?.[media] ||
                (media?.startsWith('image/') && contract.content?.['image/*']),
              `${template}: undocumented content type ${media}`,
            );
          }
          return response;
        };
      },
    },
  );
}
