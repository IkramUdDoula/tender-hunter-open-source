import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const lifetimeSeconds = 12 * 60 * 60;
const maxLoginBytes = 4096;
const sha256 = value => createHash('sha256').update(value).digest();

export function createAuth(password, secure, loginPage) {
  const cookieName = secure ? '__Host-tender_session' : 'tender_session';
  const cookieAttributes = `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  const key = sha256(password);
  const sign = payload => createHmac('sha256', key).update(payload).digest('base64url');

  function signedIn(request) {
    const cookie = request.headers.cookie?.split(';').map(entry => entry.trim())
      .find(entry => entry.startsWith(`${cookieName}=`));
    const token = cookie?.slice(cookieName.length + 1) ?? '';
    const match = /^(\d{13}\.[\w-]{22})\.([\w-]{43})$/.exec(token);
    if (!match) return false;

    const [, payload, signature] = match;
    return Number(payload.split('.')[0]) > Date.now()
      && timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)));
  }

  function redirect(response, location, cookie) {
    const headers = { Location: location, 'Cache-Control': 'no-store' };
    if (cookie) headers['Set-Cookie'] = cookie;
    response.writeHead(303, headers).end();
  }

  function renderLogin(response, status = 200) {
    const error = status === 401 ? '<p class="login-error" role="alert">Incorrect app password.</p>' : '';
    response.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'X-Content-Type-Options': 'nosniff',
    }).end(loginPage.replace('<!-- login-error -->', error));
  }

  async function receivePassword(request) {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of request) {
      bytes += chunk.length;
      if (bytes > maxLoginBytes) return null;
      chunks.push(chunk);
    }
    return new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('password');
  }

  return async (request, response, pathname) => {
    if (['/style.css', '/app.js', '/favicon.svg'].includes(pathname)) return false;

    if (pathname === '/login' || pathname === '/logout') {
      if (pathname === '/login' && request.method === 'GET') {
        if (signedIn(request)) redirect(response, '/');
        else renderLogin(response);
      } else if (request.method !== 'POST') {
        response.writeHead(405).end('Method not allowed.');
      } else if (request.headers['sec-fetch-site'] === 'cross-site') {
        response.writeHead(403).end('Cross-site request blocked.');
      } else if (pathname === '/logout') {
        redirect(response, '/login', `${cookieName}=; Max-Age=0; ${cookieAttributes}`);
      } else {
        const submitted = await receivePassword(request);
        if (!submitted || !timingSafeEqual(sha256(submitted), key)) {
          renderLogin(response, 401);
        } else {
          const expires = Date.now() + lifetimeSeconds * 1000;
          const payload = `${expires}.${randomBytes(16).toString('base64url')}`;
          redirect(response, '/', `${cookieName}=${payload}.${sign(payload)}; Max-Age=${lifetimeSeconds}; ${cookieAttributes}`);
        }
      }
      return true;
    }

    if (signedIn(request)) return false;
    if (pathname.startsWith('/api/')) {
      response.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        .end(JSON.stringify({ error: 'Sign in to use Tender Hunter.' }));
    } else {
      redirect(response, '/login');
    }
    return true;
  };
}
