import type { Context } from 'hono';
import type { OperationId } from '../lib/api/generated/operations.gen';
import * as version from '../app/api/version/handlers';
import * as bootstrap from '../app/api/bootstrap/handlers';
import * as catches from '../app/api/catches/handlers';
import * as catchById from '../app/api/catches/[id]/handlers';
import * as likes from '../app/api/catches/[id]/like/handlers';
import * as photoUpload from '../app/api/catches/[id]/photos/handlers';
import * as photoDelete from '../app/api/catches/[id]/photos/[photoId]/handlers';
import * as photos from '../app/api/photos/[photoId]/handlers';
import * as profile from '../app/api/profile/handlers';
import * as profiles from '../app/api/profiles/[userId]/handlers';
import * as storage from '../app/api/profile/storage/handlers';
import * as spots from '../app/api/spots/handlers';
import * as spotById from '../app/api/spots/[id]/handlers';
import * as gear from '../app/api/gear/handlers';
import * as gearById from '../app/api/gear/[id]/handlers';
import * as sets from '../app/api/gear-sets/handlers';
import * as setById from '../app/api/gear-sets/[id]/handlers';
import * as history from '../app/api/gear-history/handlers';
import * as demo from '../app/api/demo-data/handlers';
import * as login from '../app/api/auth/google/handlers';
import * as callback from '../app/api/auth/google/callback/handlers';
import * as logout from '../app/api/auth/logout/handlers';

export const handlers = {
  getVersion: () => version.GET(),
  getBootstrap: (c) => bootstrap.GET(c.req.raw),
  listCatches: (c) => catches.GET(c.req.raw),
  createCatch: (c) => catches.POST(c.req.raw),
  updateCatch: (c) =>
    catchById.PUT(c.req.raw, {
      params: Promise.resolve({ id: c.req.param('id')! }),
    }),
  deleteCatch: (c) =>
    catchById.DELETE(c.req.raw, {
      params: Promise.resolve({ id: c.req.param('id')! }),
    }),
  likeCatch: (c) =>
    likes.PUT(c.req.raw, {
      params: Promise.resolve({ id: c.req.param('id')! }),
    }),
  unlikeCatch: (c) =>
    likes.DELETE(c.req.raw, {
      params: Promise.resolve({ id: c.req.param('id')! }),
    }),
  uploadPhoto: (c) =>
    photoUpload.POST(c.req.raw, {
      params: Promise.resolve({ id: c.req.param('id')! }),
    }),
  deletePhoto: (c) =>
    photoDelete.DELETE(c.req.raw, {
      params: Promise.resolve({
        id: c.req.param('id')!,
        photoId: c.req.param('photoId')!,
      }),
    }),
  getPhoto: (c) =>
    photos.GET(c.req.raw, {
      params: Promise.resolve({ photoId: c.req.param('photoId')! }),
    }),
  getProfile: (c) => profile.GET(c.req.raw),
  updateProfile: (c) => profile.PUT(c.req.raw),
  getUserProfile: (c) =>
    profiles.GET(c.req.raw, {
      params: Promise.resolve({ userId: c.req.param('userId')! }),
    }),
  getPhotoStorage: (c) => storage.GET(c.req.raw),
  listSpots: (c) => spots.GET(c.req.raw),
  updateSpot: (c) =>
    spotById.PUT(c.req.raw, {
      params: Promise.resolve({ id: c.req.param('id')! }),
    }),
  listGear: (c) => gear.GET(c.req.raw),
  createGear: (c) => gear.POST(c.req.raw),
  updateGear: (c) =>
    gearById.PUT(c.req.raw, {
      params: Promise.resolve({ id: c.req.param('id')! }),
    }),
  listGearSets: (c) => sets.GET(c.req.raw),
  createGearSet: (c) => sets.POST(c.req.raw),
  updateGearSet: (c) =>
    setById.PUT(c.req.raw, {
      params: Promise.resolve({ id: c.req.param('id')! }),
    }),
  getGearHistory: (c) => history.GET(c.req.raw),
  getDemoState: (c) => demo.GET(c.req.raw),
  createDemoData: (c) => demo.POST(c.req.raw),
  deleteDemoData: (c) => demo.DELETE(c.req.raw),
  startGoogleLogin: (c) => login.GET(c.req.raw),
  completeGoogleLogin: (c) => callback.GET(c.req.raw),
  logout: (c) => logout.POST(c.req.raw),
} satisfies Record<
  OperationId,
  (context: Context) => Response | Promise<Response>
>;
