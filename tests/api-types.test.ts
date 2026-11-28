import { browserApi } from '../lib/api/generated/browser.gen';

// Compile-only regressions for the public generated client interface.
async function checkApiTypes() {
  // @ts-expect-error API path parameters are required.
  browserApi.updateCatch({ body: { date: '2026-11-28', location: '港' } });
  // @ts-expect-error API body fields are checked against OpenAPI.
  browserApi.createGear({ body: { kind: 'unknown', name: '道具' } });
  const response = await browserApi.getProfile();
  const profile = await response.json();
  const name: string = profile.displayName;
  // @ts-expect-error The response keeps its generated field types.
  const invalid: number = profile.displayName;
  return { name, invalid };
}

void checkApiTypes;
