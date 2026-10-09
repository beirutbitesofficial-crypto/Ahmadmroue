import { route, bad } from '../../lib/http.js';
import { store } from '../../lib/store.js';
import { notifyAdmins, vapidPublic } from '../../lib/push.js';

export default route({
  GET: async () => ({ publicKey: vapidPublic(), devices: (await store.listSubs()).length }),

  // { sub } → this phone gets alerts.   { test: true } → send a test alert to every phone.
  async POST({ req, body }) {
    if (body.test) return notifyAdmins({ title: 'Alerts are on ✓', body: 'New bookings for Dr. Ahmad Mroue will appear like this.', url: '/admin', tag: 'test' });
    if (!body.sub?.endpoint || !body.sub?.keys?.p256dh) return bad('Invalid subscription.');
    await store.addSub(body.sub, req.headers['user-agent']);
    return { ok: true };
  },

  async DELETE({ body }) { if (body.endpoint) await store.removeSub(body.endpoint); return { ok: true }; }
}, { admin: true });
