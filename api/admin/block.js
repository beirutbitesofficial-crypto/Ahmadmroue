import { route, bad } from '../../lib/http.js';
import { store } from '../../lib/store.js';
import { isYmd, slotTimes, slotKey } from '../../public/shared/time.js';

// Close / reopen one time slot.
export default route({
  async POST({ body }) {
    const s = await store.getSettings();
    if (!isYmd(body.date) || !slotTimes(s).includes(body.time)) return bad('Invalid slot.');
    await store.setBlocked(body.date, body.time, slotKey(body.date, body.time), !!body.blocked);
    return { ok: true };
  }
}, { admin: true });
