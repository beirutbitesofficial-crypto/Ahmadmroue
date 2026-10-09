import { route, bad } from '../../lib/http.js';
import { store } from '../../lib/store.js';
import { VISIT_TYPES } from '../../public/shared/config.js';
import { nowBeirut, addDays, isYmd, slotTimes, slotKey, normalizePhone } from '../../public/shared/time.js';

export default route({
  // Everything the admin screen needs in one call.
  async GET({ query }) {
    const now = nowBeirut();
    const from = isYmd(query.from) ? query.from : addDays(now.date, -30);
    const to = isYmd(query.to) ? query.to : addDays(now.date, 120);
    const [settings, bookings, locks] = await Promise.all([store.getSettings(), store.listBookings(from, to), store.listLocks(from, to)]);
    return { now, settings, bookings, blocked: locks.filter(l => l.blocked).map(l => l.key) };
  },

  // The doctor adds an appointment himself (phone call / walk-in) — confirmed straight away.
  async POST({ body }) {
    const s = await store.getSettings();
    const name = String(body.name || '').trim();
    if (!isYmd(body.date) || !slotTimes(s).includes(body.time)) return bad('Pick a valid time.');
    if (name.length < 2) return bad('Enter the patient name.');
    const booking = await store.createBooking({
      key: slotKey(body.date, body.time), date: body.date, time: body.time,
      type: VISIT_TYPES.some(t => t.id === body.type) ? body.type : 'consult',
      name, phone: normalizePhone(body.phone) || '', note: String(body.note || '').slice(0, 300),
      lang: body.lang === 'ar' ? 'ar' : 'en', status: 'confirmed', source: 'admin', createdAt: Date.now()
    });
    return { ok: true, booking };
  },

  async PATCH({ body }) {
    if (!['pending', 'confirmed', 'cancelled', 'done', 'noshow'].includes(body.status)) return bad('Unknown status.');
    return { ok: true, booking: await store.setStatus(String(body.id), body.status) };
  }
}, { admin: true });
