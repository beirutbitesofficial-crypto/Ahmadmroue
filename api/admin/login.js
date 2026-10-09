import { route } from '../../lib/http.js';
import { checkPin, loginCookie, logoutCookie, isAdmin } from '../../lib/auth.js';

const tries = new Map(); // light per-instance throttle on wrong PINs

export default route({
  GET: ({ req }) => ({ ok: isAdmin(req) }),
  async POST({ req, body }) {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0];
    const t = tries.get(ip) || { n: 0, until: 0 };
    if (t.until > Date.now()) return [429, { error: 'LOCKED', message: 'Too many tries — wait a minute.' }];
    if (!checkPin(body.pin)) {
      if (++t.n >= 5) { t.until = Date.now() + 60_000; t.n = 0; }
      tries.set(ip, t);
      await new Promise(r => setTimeout(r, 400));
      return [401, { error: 'WRONG_PIN', message: 'Wrong PIN' }];
    }
    tries.delete(ip);
    return [200, { ok: true }, { 'Set-Cookie': loginCookie() }];
  },
  DELETE: () => [200, { ok: true }, { 'Set-Cookie': logoutCookie() }]
});
