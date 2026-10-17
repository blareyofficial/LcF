export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const token = form.get('g-recaptcha-response');

  if (!token) {
    return new Response('Captcha missing', { status: 400 });
  }
  if (!env.RECAPTCHA_API_KEY) {
    return new Response('Captcha verification is not configured', { status: 503 });
  }

  const verification = new URLSearchParams({
    secret: env.RECAPTCHA_API_KEY,
    response: token
  });
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: verification
  });
  const result = await response.json();

  if (result.success) {
    return new Response('Captcha passed!');
  }
  return new Response('Captcha failed', { status: 400 });
}