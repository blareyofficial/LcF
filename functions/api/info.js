export async function onRequestGet() {
  return Response.json({
    name: 'LcF',
    description: 'Lossless Compression Format',
    runtime: 'cloudflare-pages',
    status: 'ready'
  });
}