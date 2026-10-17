import { encodeRequest } from '../_shared/api.js';

export async function onRequestPost({ request }) {
  return encodeRequest(request);
}