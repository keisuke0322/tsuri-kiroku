import { authenticate, json, apiError } from '../../access';
import { photoStorageSummary } from '../../catches/photo-storage';

export async function GET(req: Request) {
  try {
    const user = await authenticate(req);
    return json(await photoStorageSummary(user.userId));
  } catch (e) {
    return apiError(e);
  }
}
