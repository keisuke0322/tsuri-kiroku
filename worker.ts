import handler from 'vinext/server/fetch-handler';
import { GET as listCatches } from './app/api/catches/route';

type ShellEnv = {
  ASSETS: Fetcher;
  APP_SHELL_BUILD?: string;
};

const worker = {
  async fetch(request: Request, env: ShellEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    // This handler uses the supplied Request and Cloudflare bindings directly;
    // it does not need Vinext's React rendering or request-context setup.
    if (url.pathname === '/api/catches' && request.method === 'GET')
      return listCatches(request);
    if (
      import.meta.env.PROD &&
      env.APP_SHELL_BUILD !== 'true' &&
      url.pathname === '/' &&
      ['GET', 'HEAD'].includes(request.method)
    ) {
      const rsc = request.headers.get('RSC') === '1';
      url.pathname = rsc ? '/app-shell.rsc' : '/app-shell.html';
      url.search = '';
      const asset = await env.ASSETS.fetch(
        new Request(url, { method: request.method }),
      );
      if (asset.status !== 200) {
        return new Response(
          '画面を読み込めませんでした。再度お試しください。',
          {
            status: 503,
            headers: { 'Cache-Control': 'no-store' },
          },
        );
      }
      const headers = new Headers(asset.headers);
      headers.set(
        'Content-Type',
        rsc ? 'text/x-component' : 'text/html; charset=utf-8',
      );
      headers.set('Cache-Control', 'private, no-store');
      headers.set('Vary', 'RSC');
      return new Response(asset.body, { status: 200, headers });
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
