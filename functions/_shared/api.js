import encoderModule from '../_lib/encoder/index.js';
import decoderModule from '../_lib/decoder/index.js';

const { encodeBuffer } = encoderModule;
const { decodeBuffer } = decoderModule;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function validateImagePayload(payload, includeFormat = false) {
  const { width, height, channels, data, toFormat } = payload || {};
  if (!Number.isInteger(width) || width <= 0 ||
      !Number.isInteger(height) || height <= 0 ||
      !Number.isInteger(channels) || channels < 1 || channels > 4 ||
      !Array.isArray(data) || (includeFormat && !toFormat)) {
    throw new TypeError('Invalid image payload');
  }

  return { width, height, channels, data, toFormat };
}

export async function encodeRequest(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON' }, 400);
  }

  try {
    const { width, height, channels, data } = validateImagePayload(payload);
    const lcfData = await encodeBuffer(Buffer.from(data), {
      width,
      height,
      channels,
      bitDepth: payload.bitDepth || 8,
      colorSpace: payload.colorSpace !== undefined ? payload.colorSpace : 0
    });

    return new Response(lcfData, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="image.lcf"'
      }
    });
  } catch (error) {
    const status = error instanceof TypeError ? 400 : 500;
    return jsonResponse({ error: error.message }, status);
  }
}

export async function decodeRequest(request) {
  try {
    const lcfData = Buffer.from(await request.arrayBuffer());
    if (lcfData.length === 0) {
      return jsonResponse({ error: 'No LCF data provided' }, 400);
    }

    const decoded = await decodeBuffer(lcfData);
    return jsonResponse({
      width: decoded.width,
      height: decoded.height,
      channels: decoded.channels,
      data: Array.from(decoded.pixels)
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }
}

export async function convertRequest(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON' }, 400);
  }

  try {
    const { width, height, channels, data, toFormat } = validateImagePayload(payload, true);
    if (toFormat !== 'lcf') {
      return jsonResponse({ error: `Unsupported format: ${toFormat}` }, 400);
    }

    const lcfData = await encodeBuffer(Buffer.from(data), {
      width,
      height,
      channels,
      bitDepth: payload.bitDepth || 8,
      colorSpace: payload.colorSpace !== undefined ? payload.colorSpace : 0
    });

    return new Response(lcfData, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="converted.lcf"'
      }
    });
  } catch (error) {
    const status = error instanceof TypeError ? 400 : 500;
    return jsonResponse({ error: error.message }, status);
  }
}