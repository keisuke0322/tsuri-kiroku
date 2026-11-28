// Generated from openapi/openapi.yaml. Do not edit.
import * as sdk from './sdk.gen';
import { apiResponse, browserClient } from '../browser';

export const browserApi = {
getVersion: (...args: Parameters<typeof sdk.getVersion>) => apiResponse(sdk.getVersion({ ...args[0], client: browserClient() })),
getBootstrap: (...args: Parameters<typeof sdk.getBootstrap>) => apiResponse(sdk.getBootstrap({ ...args[0], client: browserClient() })),
listCatches: (...args: Parameters<typeof sdk.listCatches>) => apiResponse(sdk.listCatches({ ...args[0], client: browserClient() })),
createCatch: (...args: Parameters<typeof sdk.createCatch>) => apiResponse(sdk.createCatch({ ...args[0], client: browserClient() })),
updateCatch: (...args: Parameters<typeof sdk.updateCatch>) => apiResponse(sdk.updateCatch({ ...args[0], client: browserClient() })),
deleteCatch: (...args: Parameters<typeof sdk.deleteCatch>) => apiResponse(sdk.deleteCatch({ ...args[0], client: browserClient() })),
likeCatch: (...args: Parameters<typeof sdk.likeCatch>) => apiResponse(sdk.likeCatch({ ...args[0], client: browserClient() })),
unlikeCatch: (...args: Parameters<typeof sdk.unlikeCatch>) => apiResponse(sdk.unlikeCatch({ ...args[0], client: browserClient() })),
uploadPhoto: (...args: Parameters<typeof sdk.uploadPhoto>) => apiResponse(sdk.uploadPhoto({ ...args[0], client: browserClient() })),
deletePhoto: (...args: Parameters<typeof sdk.deletePhoto>) => apiResponse(sdk.deletePhoto({ ...args[0], client: browserClient() })),
getProfile: (...args: Parameters<typeof sdk.getProfile>) => apiResponse(sdk.getProfile({ ...args[0], client: browserClient() })),
updateProfile: (...args: Parameters<typeof sdk.updateProfile>) => apiResponse(sdk.updateProfile({ ...args[0], client: browserClient() })),
getUserProfile: (...args: Parameters<typeof sdk.getUserProfile>) => apiResponse(sdk.getUserProfile({ ...args[0], client: browserClient() })),
getPhotoStorage: (...args: Parameters<typeof sdk.getPhotoStorage>) => apiResponse(sdk.getPhotoStorage({ ...args[0], client: browserClient() })),
listSpots: (...args: Parameters<typeof sdk.listSpots>) => apiResponse(sdk.listSpots({ ...args[0], client: browserClient() })),
updateSpot: (...args: Parameters<typeof sdk.updateSpot>) => apiResponse(sdk.updateSpot({ ...args[0], client: browserClient() })),
listGear: (...args: Parameters<typeof sdk.listGear>) => apiResponse(sdk.listGear({ ...args[0], client: browserClient() })),
createGear: (...args: Parameters<typeof sdk.createGear>) => apiResponse(sdk.createGear({ ...args[0], client: browserClient() })),
updateGear: (...args: Parameters<typeof sdk.updateGear>) => apiResponse(sdk.updateGear({ ...args[0], client: browserClient() })),
listGearSets: (...args: Parameters<typeof sdk.listGearSets>) => apiResponse(sdk.listGearSets({ ...args[0], client: browserClient() })),
createGearSet: (...args: Parameters<typeof sdk.createGearSet>) => apiResponse(sdk.createGearSet({ ...args[0], client: browserClient() })),
updateGearSet: (...args: Parameters<typeof sdk.updateGearSet>) => apiResponse(sdk.updateGearSet({ ...args[0], client: browserClient() })),
getGearHistory: (...args: Parameters<typeof sdk.getGearHistory>) => apiResponse(sdk.getGearHistory({ ...args[0], client: browserClient() })),
getDemoState: (...args: Parameters<typeof sdk.getDemoState>) => apiResponse(sdk.getDemoState({ ...args[0], client: browserClient() })),
createDemoData: (...args: Parameters<typeof sdk.createDemoData>) => apiResponse(sdk.createDemoData({ ...args[0], client: browserClient() })),
deleteDemoData: (...args: Parameters<typeof sdk.deleteDemoData>) => apiResponse(sdk.deleteDemoData({ ...args[0], client: browserClient() })),
logout: (...args: Parameters<typeof sdk.logout>) => apiResponse(sdk.logout({ ...args[0], client: browserClient() })),
};
