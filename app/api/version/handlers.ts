import { env } from 'cloudflare:workers';

// Only deployment identifiers are public. Never serialize the Worker environment.
export function GET() {
  const config = env as unknown as {
    APP_BUILD_INFO?: string;
    CF_VERSION_METADATA?: { id?: string; timestamp?: string };
  };
  const headers = { 'Cache-Control': 'no-store' };
  if (!config.APP_BUILD_INFO)
    return Response.json(
      { error: 'Version information is unavailable.' },
      { status: 503, headers },
    );
  const info = JSON.parse(config.APP_BUILD_INFO);
  return Response.json(
    {
      environment: info.environment,
      sha: info.sha,
      version: info.version,
      runId: info.runId,
      runAttempt: info.runAttempt,
      builtAt: info.builtAt,
      cloudflareVersionId: config.CF_VERSION_METADATA?.id || null,
      deployedAt: config.CF_VERSION_METADATA?.timestamp || null,
    },
    { headers },
  );
}
