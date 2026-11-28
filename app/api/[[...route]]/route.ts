import { api } from '../../../server/api';

const handle = (request: Request) => api.fetch(request);

export {
  handle as GET,
  handle as HEAD,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
};
