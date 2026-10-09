import { route, bad } from '../../lib/http.js';
import { store } from '../../lib/store.js';
import { isYmd, toMin } from '../../public/shared/time.js';

const hhmm = v => /^\d{2}:\d{2}$/.test(v || '');
const url = v => /^https?:\/\//.test(v || '') ? String(v).replace(/\/$/, '').slice(0, 500) : '';

export default route({
  async PUT({ body: b }) {
    if (!hhmm(b.start) || !hhmm(b.end) || toMin(b.end) <= toMin(b.start)) return bad('Closing time must be after opening time.');
    const slot = Math.round(Number(b.slotMinutes));
    if (!(slot >= 5 && slot <= 120)) return bad('Appointment length must be 5–120 minutes.');
    const clean = {
      days: [...new Set((b.days || []).map(Number).filter(d => d >= 0 && d <= 6))].sort((x, y) => x - y),
      start: b.start, end: b.end, slotMinutes: slot,
      daysAhead: Math.min(120, Math.max(1, Math.round(Number(b.daysAhead) || 21))),
      minNoticeMinutes: Math.min(1440, Math.max(0, Math.round(Number(b.minNoticeMinutes) || 0))),
      closedDates: [...new Set((b.closedDates || []).filter(isYmd))].sort(),
      clinicWhatsapp: String(b.clinicWhatsapp || '').replace(/\D/g, '').slice(0, 15),
      address: String(b.address || '').slice(0, 200),
      mapsUrl: url(b.mapsUrl), siteUrl: url(b.siteUrl)
    };
    return { ok: true, settings: await store.saveSettings(clean) };
  }
}, { admin: true });
