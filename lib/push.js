import { store } from './store.js';

// Env values pasted into Vercel often carry spaces, line breaks, quotes or "KEY=" prefixes — strip all of that.
const cleanKey = v => String(v || '').replace(/[\s"']/g, '').replace(/^[A-Z_]+=/, '').replace(/[^A-Za-z0-9_-]/g, '');
const cleanSubject = v => {
  const s = String(v || '').trim().replace(/^["']|["']$/g, '').replace(/^[A-Z_]+\s*=/, '').trim();
  if (/^(mailto:|https:\/\/)/.test(s)) return s;
  return s.includes('@') ? 'mailto:' + s : 'mailto:admin@example.com';
};
export const vapidPublic = () => cleanKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY);

// Sends a push notification to every phone/computer where the admin turned alerts on.
export async function notifyAdmins(payload) {
  const pub = vapidPublic(), priv = cleanKey(process.env.VAPID_PRIVATE_KEY);
  if (!pub || !priv) return { sent: 0, devices: 0, reason: 'NO_VAPID' };
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(cleanSubject(process.env.VAPID_SUBJECT), pub, priv);
  const subs = await store.listSubs();
  let sent = 0;
  await Promise.allSettled(subs.map(async s => {
    try {
      await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: 'high' });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await store.removeSub(s.id); // phone unsubscribed / app removed
      else console.error('push failed', e.statusCode, e.body || e.message);
    }
  }));
  return { sent, devices: subs.length };
}
