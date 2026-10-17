import { decodeRequest } from '../_shared/api.js';

export async function onRequestPost({ request }) {
  return decodeRequest(request);
}