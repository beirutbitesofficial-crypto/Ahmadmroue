import { store } from './store.js';

export const vapidPublic = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';

// Sends a push notification to every phone/computer where the admin turned alerts on.
export async function notifyAdmins(payload) {
  const pub = vapidPublic(), priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return { sent: 0, devices: 0, reason: 'NO_VAPID' };
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
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
