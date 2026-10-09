// All clinic times are Beirut time, whatever device or server runs the code.
export const TZ = 'Asia/Beirut';

export function nowBeirut() {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const p = Object.fromEntries(f.formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const utc = ymd => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const addDays = (ymd, n) => { const d = utc(ymd); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const weekday = ymd => utc(ymd).getUTCDay();
export const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fromMin = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export const slotKey = (date, time) => `${date}_${time.replace(':', '')}`;

export function slotTimes(s) {
  const out = [];
  const step = Math.max(5, Number(s.slotMinutes) || 15);
  for (let t = toMin(s.start); t + step <= toMin(s.end); t += step) out.push(fromMin(t));
  return out;
}

export const isWorkingDay = (s, ymd) => s.days.includes(weekday(ymd)) && !(s.closedDates || []).includes(ymd);

// Every date patients may book right now (today .. today+daysAhead), working days only.
export function bookableDates(s, now = nowBeirut()) {
  const out = [];
  for (let i = 0; i <= s.daysAhead; i++) {
    const d = addDays(now.date, i);
    if (isWorkingDay(s, d)) out.push(d);
  }
  return out;
}

export const isPast = (s, date, time, now = nowBeirut(), notice = s.minNoticeMinutes) =>
  date < now.date || (date === now.date && toMin(time) < now.minutes + (notice || 0));

export function fmtTime(t, lang = 'en') {
  const [h, m] = t.split(':').map(Number);
  const h12 = ((h + 11) % 12) + 1;
  const ap = lang === 'ar' ? (h < 12 ? 'ص' : 'م') : (h < 12 ? 'AM' : 'PM');
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

export function fmtDay(ymd, lang = 'en', style = 'long') {
  const opts = style === 'long'
    ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }
    : style === 'wd' ? { weekday: 'short', timeZone: 'UTC' }
    : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB-u-nu-latn' : 'en-GB', opts).format(utc(ymd));
}

export function normalizePhone(raw) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (/^0?\d{7}$/.test(d) || /^0?(3|7\d|8\d)\d{6}$/.test(d)) d = '961' + d.replace(/^0/, ''); // local Lebanese number
  d = d.replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export function prettyPhone(d) {
  if (!d) return '';
  if (d.startsWith('961')) { const r = d.slice(3); return `+961 ${r.length === 7 ? r.slice(0, 1) + ' ' + r.slice(1, 4) + ' ' + r.slice(4) : r.slice(0, 2) + ' ' + r.slice(2, 5) + ' ' + r.slice(5)}`; }
  return '+' + d;
}
