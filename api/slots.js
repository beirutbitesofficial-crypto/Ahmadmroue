import { route } from '../lib/http.js';
import { store } from '../lib/store.js';
import { nowBeirut, bookableDates, slotTimes, slotKey, isPast } from '../public/shared/time.js';

// Public: which days/times are free.
export default route({
  async GET() {
    const s = await store.getSettings();
    const now = nowBeirut();
    const dates = bookableDates(s, now);
    const taken = new Set(dates.length ? (await store.listLocks(dates[0], dates.at(-1))).map(l => l.key) : []);
    const times = slotTimes(s);
    const days = dates
      .map(date => ({ date, slots: times.map(time => ({ time, available: !taken.has(slotKey(date, time)) && !isPast(s, date, time, now) })) }))
      .filter(d => !(d.date === now.date && d.slots.every(x => !x.available))); // hide today once it's over
    return { days, clinic: { start: s.start, end: s.end, whatsapp: s.clinicWhatsapp, address: s.address, mapsUrl: s.mapsUrl } };
  }
});
