import { convertRequest } from '../_shared/api.js';

export async function onRequestPost({ request }) {
  return convertRequest(request);
}