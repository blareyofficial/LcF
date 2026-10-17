export async function onRequestGet() {
  return Response.json({
    ok: true,
    name: 'LcF',
    status: 'running',
    timestamp: new Date().toISOString()
  });
}