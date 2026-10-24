import { env } from 'cloudflare:workers';
import type { Bootstrap } from '../../bootstrap';
import { authenticate, ensureProfile, json, apiError } from '../access';
import { canManageDemo } from '../demo-data/route';

export async function GET(req: Request) {
  try {
    const user = await authenticate(req);
    const profile = await ensureProfile(user);
    return json({
      userId: user.userId,
      initialName: profile.displayName,
      mapsApiKey:
        (env as unknown as { GOOGLE_MAPS_API_KEY?: string })
          .GOOGLE_MAPS_API_KEY || '',
      canManageDemo: await canManageDemo(user.userId),
    } satisfies Bootstrap);
  } catch (error) {
    return apiError(error);
  }
}
