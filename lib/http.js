// Tiny helpers so the same handlers run on Vercel and in the local dev server.
import { isAdmin } from './auth.js';

const MESSAGES = {
  TAKEN: [409, 'That time was just taken. Please choose another.'],
  DUPLICATE: [409, 'You already have an appointment that day.'],
  NOT_FOUND: [404, 'Not found.'],
  NO_DATABASE: [500, 'Database is not configured (FIREBASE_SERVICE_ACCOUNT).']
};

export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let pre; try { pre = req.body; } catch { return {}; } // Vercel pre-parses JSON bodies
  if (pre !== undefined) return typeof pre === 'string' ? safeJson(pre) : Buffer.isBuffer(pre) ? safeJson(pre.toString('utf8')) : (pre || {});
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 20_000) break; chunks.push(c); }
  return safeJson(Buffer.concat(chunks).toString('utf8'));
}
const safeJson = s => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

// route({ GET, POST, ... }, { admin: true })
export function route(methods, { admin = false } = {}) {
  return async (req, res) => {
    const fn = methods[req.method];
    if (!fn) return send(res, 405, { error: 'METHOD' });
    if (admin && !isAdmin(req)) return send(res, 401, { error: 'UNAUTHORIZED' });
    try {
      const query = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
      const out = await fn({ req, res, body, query });
      if (!res.writableEnded) {
        const [status, data, headers] = Array.isArray(out) ? out : [200, out];
        send(res, status, data, headers);
      }
    } catch (e) {
      const [status, message] = MESSAGES[e?.code] || [500, 'Something went wrong. Please try again.'];
      if (!MESSAGES[e?.code]) console.error(e);
      send(res, status, { error: e?.code || 'ERROR', message });
    }
  };
}

export const bad = message => [400, { error: 'INVALID', message }];
