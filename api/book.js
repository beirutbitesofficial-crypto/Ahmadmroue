import { route, bad } from '../lib/http.js';
import { store } from '../lib/store.js';
import { notifyAdmins } from '../lib/push.js';
import { VISIT_TYPES, typeLabel } from '../public/shared/config.js';
import { nowBeirut, bookableDates, slotTimes, slotKey, isPast, normalizePhone, fmtDay, fmtTime, prettyPhone } from '../public/shared/time.js';

// Public: a patient requests an appointment. It lands as "pending" and the doctor's phone gets a push.
export default route({
  async POST({ body }) {
    if (body.website) return { ok: true, id: 'x', ref: 'MR-0000' }; // honeypot: only bots fill the hidden field

    const s = await store.getSettings();
    const now = nowBeirut();
    const { type, date, time } = body;
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    const note = String(body.note || '').trim().slice(0, 300);
    const phone = normalizePhone(body.phone);
    const lang = body.lang === 'ar' ? 'ar' : 'en';

    if (!VISIT_TYPES.some(t => t.id === type)) return bad('Choose a visit type.');
    if (!bookableDates(s, now).includes(date) || !slotTimes(s).includes(time) || isPast(s, date, time, now)) return bad('That time is not available.');
    if (name.length < 2 || name.length > 60) return bad('Enter your full name.');
    if (!phone) return bad('Enter a valid phone number.');

    const b = await store.createBooking({
      key: slotKey(date, time), date, time, type, name, phone, note, lang,
      status: 'pending', source: 'online', createdAt: Date.now(), checkDuplicate: true
    });

    await notifyAdmins({
      title: `New booking · ${fmtDay(date, 'en', 'short')} ${fmtTime(time)}`,
      body: `${name} · ${typeLabel(type)}\n${prettyPhone(phone)}${note ? '\n“' + note.slice(0, 80) + '”' : ''}`,
      url: `/admin?d=${date}&b=${b.id}`,
      tag: b.id
    }).catch(e => console.error('notify', e));

    return { ok: true, id: b.id, ref: 'MR-' + b.id.slice(-4).toUpperCase() };
  }
});
