import crypto from 'node:crypto';

export const COOKIE = 'mr_admin';
const DAYS = 180; // the doctor's phone stays signed in for 6 months

const prod = () => !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const pin = () => process.env.ADMIN_PIN || (prod() ? '' : '1234');
const secret = () => process.env.ADMIN_SECRET || `${pin()}::mroue`;
const sign = exp => crypto.createHmac('sha256', secret()).update(`admin.${exp}.${pin()}`).digest('base64url');

export function checkPin(input) {
  const a = Buffer.from(String(input || '')), b = Buffer.from(pin());
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function loginCookie() {
  const exp = Date.now() + DAYS * 864e5;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${prod() ? '; Secure' : ''}`;
}
export const logoutCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function isAdmin(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  const [exp, sig] = (m?.[1] || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = Buffer.from(sign(exp)), got = Buffer.from(sig);
  return good.length === got.length && crypto.timingSafeEqual(good, got);
}
