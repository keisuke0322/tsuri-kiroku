import type { StorageSummary } from '../../../../lib/api/generated/types.gen';
import { authenticate, json, apiError } from '../../access';
import { photoStorageSummary } from '../../catches/photo-storage';

export async function GET(req: Request) {
  try {
    const user = await authenticate(req);
    return json<StorageSummary>(await photoStorageSummary(user.userId));
  } catch (e) {
    return apiError(e);
  }
}
