import { VISIT_TYPES, DOCTOR, typeLabel } from '/shared/config.js';
import { fmtTime, fmtDay, slotTimes, slotKey, addDays, isWorkingDay, isPast, toMin, prettyPhone, nowBeirut } from '/shared/time.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const I = {
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg>',
  bellOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/><path d="M3 5.5A9 9 0 0 1 5.5 3M21 5.5A9 9 0 0 0 18.5 3"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 5 5 0 0 0 1 2.6 11.3 11.3 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  share: '<svg class="share-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12H8M12 6l-6 6 6 6"/></svg>'
};

const S = { data: null, view: 'day', day: null, highlight: null, push: 'off', installEvt: null };
const STATUS = { pending: 'Waiting', confirmed: 'Confirmed', cancelled: 'Cancelled', done: 'Done', noshow: 'No-show' };

/* ───────────────────────── api ───────────────────────── */
async function api(path, method = 'GET', body) {
  const r = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'same-origin' });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.endsWith('/login')) { showLogin(); throw Object.assign(new Error('Signed out'), { silent: true }); }
  if (!r.ok) throw Object.assign(new Error(data.message || 'Something went wrong'), { code: data.error });
  return data;
}
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3000); }
const oops = e => { if (!e.silent) toast(e.message || 'Something went wrong'); };

/* ───────────────────────── login ───────────────────────── */
let pin = '';
function showLogin() {
  $('#app').hidden = true; $('#login').hidden = false; closeSheet(); pin = '';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];
  $('#pad').innerHTML = keys.map(k => k === 'del'
    ? `<button class="k-alt" data-k="del" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6h11v12H9l-6-6z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg></button>`
    : k === 'go' ? `<button class="k-go" data-k="go" aria-label="Enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button>`
    : `<button data-k="${k}">${k}</button>`).join('');
  drawDots();
}
function drawDots() {
  const n = Math.max(4, pin.length, Number(ls.get('mr_pinlen')) || 4);
  $('#dots').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
}
async function pinKey(k) {
  if ($('#login').hidden) return;
  if (k === 'del') pin = pin.slice(0, -1);
  else if (k === 'go') return submitPin();
  else if (pin.length < 8) pin += k;
  $('#loginErr').textContent = '';
  drawDots();
  if (pin.length === Number(ls.get('mr_pinlen'))) submitPin();
}
async function submitPin() {
  if (pin.length < 4) return;
  try {
    await api('/api/admin/login', 'POST', { pin });
    ls.set('mr_pinlen', String(pin.length));
    pin = ''; startApp();
  } catch (e) {
    $('#loginErr').textContent = e.message; pin = ''; drawDots();
    $('#dots').classList.add('shake'); setTimeout(() => $('#dots').classList.remove('shake'), 400);
  }
}
$('#pad').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) pinKey(b.dataset.k); });
document.addEventListener('keydown', e => {
  if ($('#login').hidden) { if (e.key === 'Escape') closeSheet(); return; }
  if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === 'Backspace') pinKey('del'); else if (e.key === 'Enter') pinKey('go');
});

/* ───────────────────────── data helpers ───────────────────────── */
const st = () => S.data.settings;
const today = () => S.data.now.date;
const active = b => b.status !== 'cancelled';
const byKey = () => { const m = new Map(); S.data.bookings.filter(active).forEach(b => m.set(b.key, b)); return m; };
const blocked = () => new Set(S.data.blocked);
const firstName = n => String(n || '').trim().split(/\s+/)[0];
const waLink = (phone, text) => `https://wa.me/${phone}${text ? '?text=' + encodeURIComponent(text) : ''}`;
const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

function message(kind, b) {
  const s = st(), ar = b.lang === 'ar', L = ar ? 'ar' : 'en';
  const day = fmtDay(b.date, L, 'long'), time = fmtTime(b.time, L), name = firstName(b.name);
  const where = [s.address, s.mapsUrl].filter(Boolean).join('\n');
  const book = s.siteUrl ? `${s.siteUrl}/booking` : '';
  if (kind === 'confirm') return ar
    ? `مرحبا ${name}، معك عيادة ${DOCTOR.ar.name}.\nتم تأكيد موعدك يوم ${day} الساعة ${time} ✅${where ? '\n📍 ' + where : ''}\nإذا ما فيك تجي، بلّغنا هون لو سمحت.`
    : `Hello ${name}, this is ${DOCTOR.en.name}'s clinic.\nYour appointment is confirmed for ${day} at ${time} ✅${where ? '\n📍 ' + where : ''}\nIf you can't make it, please let us know here.`;
  if (kind === 'cancel') return ar
    ? `مرحبا ${name}، معك عيادة ${DOCTOR.ar.name}.\nللأسف ما منقدر نشوفك يوم ${day} الساعة ${time}. ${book ? 'فيك تختار وقت تاني من هون: ' + book : 'رد علينا هون ومنلاقيلك وقت تاني.'}`
    : `Hello ${name}, this is ${DOCTOR.en.name}'s clinic.\nUnfortunately we can't keep your appointment on ${day} at ${time}. ${book ? 'Please pick another time here: ' + book : "Reply here and we'll find you another time."}`;
  return '';
}

/* ───────────────────────── rendering ───────────────────────── */
function card(b, { showDate = false } = {}) {
  const t = VISIT_TYPES.find(v => v.id === b.type);
  const hasPhone = !!b.phone;
  const act = [];
  if (b.status === 'pending') {
    act.push(hasPhone
      ? `<a class="btn btn-wa" data-act="confirm" data-id="${b.id}" href="${waLink(b.phone, message('confirm', b))}" target="_blank" rel="noopener">${I.wa}Confirm</a>`
      : `<button class="btn btn-green" data-act="confirm" data-id="${b.id}">Confirm</button>`);
  } else if (b.status === 'confirmed' && hasPhone) {
    act.push(`<a class="btn btn-ghost" href="${waLink(b.phone)}" target="_blank" rel="noopener">${I.wa}WhatsApp</a>`);
  } else if (b.status === 'cancelled') {
    act.push(`<button class="btn btn-ghost" data-act="restore" data-id="${b.id}">Restore</button>`);
  }
  if (hasPhone && b.status !== 'cancelled') act.push(`<a class="btn btn-ghost sq" href="tel:+${b.phone}" aria-label="Call">${I.phone}</a>`);
  if (b.status !== 'cancelled') act.push(`<button class="btn btn-ghost sq" data-act="more" aria-label="More">${I.more}</button>`);

  const more = [];
  if (b.status === 'pending') more.push(`<button class="btn btn-danger" data-act="cancel" data-id="${b.id}">Decline</button>`);
  if (b.status === 'confirmed' || b.status === 'noshow') more.push(`<button class="btn btn-ghost" data-act="done" data-id="${b.id}">Mark done</button>`);
  if (b.status === 'confirmed') more.push(`<button class="btn btn-ghost" data-act="noshow" data-id="${b.id}">No-show</button>`);
  if (b.status === 'done' || b.status === 'noshow') more.push(`<button class="btn btn-ghost" data-act="reconfirm" data-id="${b.id}">Undo</button>`);
  if (b.status === 'confirmed') more.push(`<button class="btn btn-danger" data-act="cancel" data-id="${b.id}">Cancel</button>`);

  return `<article class="card st-${b.status}${S.highlight === b.id ? ' flash' : ''}" data-card="${b.id}">
    ${showDate ? `<div class="when">${fmtDay(b.date, 'en', 'short')} · ${fmtTime(b.time)}</div>` : ''}
    <div class="c-top"><div class="c-name"><b>${esc(b.name)}</b><span>${esc(t ? t.en[0] : b.type)}${b.source === 'admin' ? ' · added by you' : ''}${b.lang === 'ar' ? ' · عربي' : ''}</span></div>
      <span class="pill ${b.status}">${STATUS[b.status] || b.status}</span></div>
    <div class="c-meta">${hasPhone ? `<a href="tel:+${b.phone}">${prettyPhone(b.phone)}</a>` : '<span>No phone</span>'}${b.createdAt ? `<span>${b.source === 'admin' ? 'Added' : 'Booked'} ${ago(b.createdAt)}</span>` : ''}</div>
    ${b.note ? `<p class="c-note">${esc(b.note)}</p>` : ''}
    <div class="c-act">${act.join('')}</div>
    ${more.length ? `<div class="c-more">${more.join('')}</div>` : ''}
  </article>`;
}

function stripDays() {
  const s = st(), t = today();
  const set = new Set();
  for (let i = -7; i <= s.daysAhead; i++) set.add(addDays(t, i));
  S.data.bookings.filter(active).forEach(b => { if (b.date >= addDays(t, -7)) set.add(b.date); });
  return [...set].sort();
}

function renderDay() {
  const s = st(), t = today(), d = S.day, now = S.data.now;
  const map = byKey(), blk = blocked();
  const days = stripDays();
  const counts = {};
  S.data.bookings.filter(active).forEach(b => { (counts[b.date] ||= []).push(b.status); });

  const strip = days.map(x => {
    const c = counts[x] || [];
    const pips = c.slice(0, 5).map(stt => `<b class="${stt === 'pending' ? 'p' : ''}"></b>`).join('');
    return `<button class="chip ${x === t ? 'today' : ''} ${isWorkingDay(s, x) ? '' : 'off'} ${x < t ? 'past' : ''}" data-day="${x}" aria-selected="${x === d}">
      <span class="wd">${x === t ? 'Today' : fmtDay(x, 'en', 'wd')}</span><span class="dn">${Number(x.slice(8))}</span><span class="pips">${pips}</span></button>`;
  }).join('');

  const times = [...new Set([...slotTimes(s), ...S.data.bookings.filter(b => b.date === d && active(b)).map(b => b.time)])].sort((a, b) => toMin(a) - toMin(b));
  const dayBookings = S.data.bookings.filter(b => b.date === d);
  const nActive = dayBookings.filter(active).length, nPending = dayBookings.filter(b => b.status === 'pending').length;
  const isClosed = (s.closedDates || []).includes(d), isClinicDay = s.days.includes(new Date(d + 'T00:00:00Z').getUTCDay());
  const nFree = isWorkingDay(s, d) ? slotTimes(s).filter(x => !map.has(slotKey(d, x)) && !blk.has(slotKey(d, x)) && !isPast(s, d, x, now, 0)).length : 0;

  const rows = (isWorkingDay(s, d) || nActive) ? times.map(x => {
    const k = slotKey(d, x), b = map.get(k), past = isPast(s, d, x, now, 0);
    const label = `<div class="slot-t">${fmtTime(x).replace(' PM', '').replace(' AM', '')}<small>${toMin(x) < 720 ? 'AM' : 'PM'}</small></div>`;
    if (b) return `<div class="slot">${label}${card(b)}</div>`;
    if (blk.has(k)) return `<div class="slot">${label}<div class="free blocked">${I.lock}<span>Closed</span><button class="mini" data-act="unblock" data-time="${x}">Reopen</button></div></div>`;
    if (past || !isWorkingDay(s, d)) return `<div class="slot">${label}<div class="free past"><span>—</span></div></div>`;
    return `<div class="slot">${label}<div class="free"><span>Free</span><button class="mini" data-act="add" data-time="${x}">${I.plus}Add</button><button class="mini" data-act="block" data-time="${x}">Close</button></div></div>`;
  }).join('') : '';

  const cancelled = dayBookings.filter(b => !active(b));
  $('#view').innerHTML = `
    <div class="strip"><div class="strip-in">${strip}</div></div>
    <div class="dayhead"><div><h2>${d === t ? 'Today' : fmtDay(d, 'en', 'wd')}, ${fmtDay(d, 'en', 'long').replace(/^\w+,?\s*/, '')}</h2>
      <p>${nActive} booked${nPending ? ` · <b style="color:var(--amber)">${nPending} waiting</b>` : ''}${isWorkingDay(s, d) && d >= t ? ` · ${nFree} free` : ''}</p></div>
      ${d >= t && isClinicDay ? `<button class="btn btn-ghost" data-act="${isClosed ? 'openday' : 'closeday'}">${isClosed ? 'Reopen day' : 'Close day'}</button>` : ''}</div>
    ${isClosed ? '<div class="closed-note">This day is closed — patients can’t book it.</div>' : !isClinicDay ? '<div class="closed-note">Not a clinic day. Change working days in Settings.</div>' : ''}
    <div class="slots">${rows}</div>
    ${cancelled.length ? `<div class="group"><h3>Cancelled · ${cancelled.length}</h3>${cancelled.map(b => card(b, { showDate: false })).join('')}</div>` : ''}`;

  requestAnimationFrame(() => {
    const el = document.querySelector(`.chip[data-day="${d}"]`);
    if (el) { const strip = el.closest('.strip'); strip.scrollLeft = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2; }
  });
}

function renderUpcoming() {
  const t = today();
  const list = S.data.bookings.filter(b => b.date >= t && (b.status === 'pending' || b.status === 'confirmed'))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const pending = list.filter(b => b.status === 'pending');
  if (!list.length) { $('#view').innerHTML = `<div class="empty">${I.cal}<p>No upcoming appointments yet.</p></div>`; return; }
  const groups = {};
  list.forEach(b => (groups[b.date] ||= []).push(b));
  $('#view').innerHTML = (pending.length ? `<div class="closed-note"><b>${pending.length}</b> waiting for your confirmation.</div>` : '') +
    Object.entries(groups).map(([d, bs]) => `<div class="group"><h3><b>${d === t ? 'Today' : d === addDays(t, 1) ? 'Tomorrow' : fmtDay(d, 'en', 'wd')}</b> · ${fmtDay(d, 'en', 'short').replace(/^\w+,?\s*/, '')}</h3>
      ${bs.map(b => `<div class="slot"><div class="slot-t">${fmtTime(b.time).replace(/ (AM|PM)/, '')}<small>${toMin(b.time) < 720 ? 'AM' : 'PM'}</small></div>${card(b)}</div>`).join('')}</div>`).join('');
}

function render() {
  if (!S.data) return;
  const t = today();
  if (!S.day) S.day = isWorkingDay(st(), t) ? t : stripDays().find(x => x > t && isWorkingDay(st(), x)) || t;
  $('#todayLbl').textContent = fmtDay(t, 'en', 'long');
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === S.view)));
  const nPending = S.data.bookings.filter(b => b.status === 'pending' && b.date >= t).length;
  $('#pendingBadge').hidden = !nPending; $('#pendingBadge').textContent = nPending;
  if (navigator.setAppBadge) { (nPending ? navigator.setAppBadge(nPending) : navigator.clearAppBadge()).catch(() => {}); }
  S.view === 'day' ? renderDay() : renderUpcoming();
  if (S.highlight) {
    const el = document.querySelector(`[data-card="${S.highlight}"]`);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { el.classList.remove('flash'); S.highlight = null; }, 2400); }
  }
}

/* ───────────────────────── loading ───────────────────────── */
let loading = null;
async function load() {
  if (loading) return loading;
  loading = api('/api/admin/bookings').then(d => { S.data = d; render(); }).catch(oops).finally(() => { loading = null; });
  return loading;
}

function openFromUrl(href) {
  const u = new URL(href, location.origin);
  const d = u.searchParams.get('d'), b = u.searchParams.get('b');
  if (d) { S.day = d; S.view = 'day'; }
  if (b) S.highlight = b;
  if (d || b) history.replaceState(null, '', '/admin');
}

/* ───────────────────────── actions ───────────────────────── */
async function setStatus(id, status, msg) {
  try { await api('/api/admin/bookings', 'PATCH', { id, status }); if (msg) toast(msg); await load(); } catch (e) { oops(e); load(); }
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act],[data-day],[data-view]');
  if (!el || $('#app').hidden) return;
  if (el.dataset.view) { S.view = el.dataset.view; return render(); }
  if (el.dataset.day) { S.day = el.dataset.day; return render(); }
  const act = el.dataset.act, id = el.dataset.id;
  const b = id && S.data.bookings.find(x => x.id === id);
  switch (act) {
    case 'more': return el.closest('.card').classList.toggle('open');
    case 'confirm': return setStatus(id, 'confirmed', 'Confirmed ✓'); // the WhatsApp link opens by itself
    case 'restore': return setStatus(id, 'pending', 'Restored');
    case 'reconfirm': return setStatus(id, 'confirmed');
    case 'done': return setStatus(id, 'done', 'Marked done');
    case 'noshow': return setStatus(id, 'noshow', 'Marked no-show');
    case 'cancel': return openCancel(b);
    case 'add': return openAdd(S.day, el.dataset.time);
    case 'block': case 'unblock':
      try { await api('/api/admin/block', 'POST', { date: S.day, time: el.dataset.time, blocked: act === 'block' }); await load(); } catch (err) { oops(err); }
      return;
    case 'closeday': case 'openday': {
      const s = { ...st() };
      s.closedDates = act === 'closeday' ? [...new Set([...(s.closedDates || []), S.day])] : (s.closedDates || []).filter(x => x !== S.day);
      try { await api('/api/admin/settings', 'PUT', s); toast(act === 'closeday' ? 'Day closed for booking' : 'Day reopened'); await load(); } catch (err) { oops(err); }
      return;
    }
  }
});

/* ───────────────────────── sheets ───────────────────────── */
function openSheet(html) {
  $('#sheet').innerHTML = `<div class="grab"></div>${html}`;
  $('#sheet').hidden = false; $('#scrim').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() { $('#sheet').hidden = true; $('#scrim').hidden = true; document.body.style.overflow = ''; }
$('#scrim').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });

function openCancel(b) {
  const verb = b.status === 'pending' ? 'Decline' : 'Cancel';
  openSheet(`<h2>${verb} appointment <button data-close>Close</button></h2>
    <div class="slot-sum">${esc(b.name)} · ${fmtDay(b.date, 'en', 'short')} · ${fmtTime(b.time)}</div>
    <p style="margin:0 0 14px;color:var(--muted);font-size:14px">The time becomes free again for other patients.</p>
    <div style="display:grid;gap:10px">
      ${b.phone ? `<a class="btn btn-wa btn-block" id="cxWa" href="${waLink(b.phone, message('cancel', b))}" target="_blank" rel="noopener">${I.wa}${verb} &amp; tell patient on WhatsApp</a>` : ''}
      <button class="btn btn-ghost btn-block" id="cxQuiet">${verb} without a message</button>
    </div>`);
  const go = () => { closeSheet(); setStatus(b.id, 'cancelled', b.status === 'pending' ? 'Declined' : 'Cancelled'); };
  $('#cxWa')?.addEventListener('click', go);
  $('#cxQuiet').addEventListener('click', go);
}

function openAdd(date, time) {
  openSheet(`<h2>Add appointment <button data-close>Close</button></h2>
    <div class="slot-sum">${fmtDay(date, 'en', 'long')} · ${fmtTime(time)}</div>
    <form id="addForm" style="display:grid;gap:12px">
      <p class="err" id="addErr" hidden></p>
      <label class="field"><span>Patient name</span><input class="input" name="name" required autocomplete="off"></label>
      <label class="field"><span>Phone</span><input class="input" name="phone" type="tel" inputmode="tel" placeholder="03 123 456"></label>
      <div class="field"><span>Visit</span><div class="types-pick">${VISIT_TYPES.map((v, i) => `<label><input type="radio" name="type" value="${v.id}" ${i ? '' : 'checked'}><span>${v.en[0]}</span></label>`).join('')}</div></div>
      <label class="field"><span>Note</span><input class="input" name="note" autocomplete="off"></label>
      <div class="field"><span>Patient's WhatsApp language</span><div class="types-pick"><label><input type="radio" name="lang" value="en" checked><span>English</span></label><label><input type="radio" name="lang" value="ar"><span>عربي</span></label></div></div>
      <button class="btn btn-primary btn-block" type="submit">Save appointment</button>
    </form>`);
  $('#addForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, fd = Object.fromEntries(new FormData(f));
    try { await api('/api/admin/bookings', 'POST', { ...fd, date, time }); closeSheet(); toast('Appointment added'); load(); }
    catch (err) { $('#addErr').hidden = false; $('#addErr').textContent = err.message; }
  });
  setTimeout(() => $('#addForm [name=name]').focus(), 250);
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function openSettings(focus) {
  const s = st();
  let closed = [...(s.closedDates || [])].filter(x => x >= today());
  const closedHtml = () => closed.length ? closed.map(x => `<button type="button" data-rm="${x}">${fmtDay(x, 'en', 'short')} ✕</button>`).join('') : '<span style="color:var(--faint);font-size:13px">None</span>';
  openSheet(`<h2>Settings <button data-close>Done</button></h2>
    <section class="sec" id="alertsSec"><h4>Booking alerts</h4><div class="alerts-row" id="alertsRow"></div>
      <p class="help">Each phone needs alerts turned on once. On iPhone, open the app from the Home Screen icon. If alerts don’t ring, check that Focus / Do Not Disturb allows “Mroue Admin”.</p></section>
    <form id="setForm">
      <section class="sec"><h4>Clinic hours</h4>
        <div class="field"><span>Working days</span><div class="wdays">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="days" value="${d}" ${s.days.includes(d) ? 'checked' : ''}><span>${WD[d]}</span></label>`).join('')}</div></div>
        <div class="two"><label class="field"><span>First appointment</span><input class="input" type="time" name="start" value="${s.start}" step="300"></label>
          <label class="field"><span>Clinic closes</span><input class="input" type="time" name="end" value="${s.end}" step="300"></label></div>
        <div class="two"><label class="field"><span>Appointment length</span><select class="input" name="slotMinutes">${[10, 15, 20, 30, 45, 60].map(m => `<option value="${m}" ${m === s.slotMinutes ? 'selected' : ''}>${m} min</option>`).join('')}</select></label>
          <label class="field"><span>Book ahead (days)</span><input class="input" type="number" name="daysAhead" min="1" max="120" value="${s.daysAhead}"></label></div>
        <label class="field"><span>Same-day notice (minutes)</span><input class="input" type="number" name="minNoticeMinutes" min="0" max="1440" value="${s.minNoticeMinutes}"></label>
        <p class="help" id="slotPreview"></p>
      </section>
      <section class="sec"><h4>Closed dates</h4><p class="help">Holidays, conferences, travel — patients can’t book these days.</p>
        <div class="dates" id="closedList">${closedHtml()}</div>
        <div class="addrow"><input class="input" type="date" id="closedAdd" min="${today()}"><button type="button" class="btn btn-ghost" id="closedBtn">Add</button></div>
      </section>
      <section class="sec"><h4>Clinic details</h4>
        <label class="field"><span>Clinic WhatsApp number</span><input class="input" name="clinicWhatsapp" inputmode="tel" placeholder="96171123456" value="${esc(s.clinicWhatsapp)}"></label>
        <label class="field"><span>Address</span><input class="input" name="address" placeholder="Building, street, city" value="${esc(s.address)}"></label>
        <label class="field"><span>Google Maps link</span><input class="input" name="mapsUrl" inputmode="url" placeholder="https://maps.app.goo.gl/…" value="${esc(s.mapsUrl)}"></label>
        <label class="field"><span>Website address</span><input class="input" name="siteUrl" inputmode="url" placeholder="https://…" value="${esc(s.siteUrl || location.origin)}"></label>
      </section>
      <p class="err" id="setErr" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">Save settings</button>
    </form>
    <button class="btn btn-text btn-block" id="logout" style="margin-top:10px">Sign out of this phone</button>`);

  const f = $('#setForm');
  const preview = () => {
    const v = Object.fromEntries(new FormData(f));
    try { const t = slotTimes({ start: v.start, end: v.end, slotMinutes: Number(v.slotMinutes) }); $('#slotPreview').textContent = t.length ? `Times: ${t.map(x => fmtTime(x)).join(', ')}` : 'No appointment fits between those times.'; } catch { }
  };
  f.addEventListener('input', preview); preview();
  $('#closedList').addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) { closed = closed.filter(x => x !== r.dataset.rm); $('#closedList').innerHTML = closedHtml(); } });
  $('#closedBtn').addEventListener('click', () => { const v = $('#closedAdd').value; if (v && !closed.includes(v)) { closed = [...closed, v].sort(); $('#closedList').innerHTML = closedHtml(); $('#closedAdd').value = ''; } });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(f), v = Object.fromEntries(fd);
    const body = { ...v, days: fd.getAll('days').map(Number), closedDates: [...closed, ...(s.closedDates || []).filter(x => x < today())] };
    try { await api('/api/admin/settings', 'PUT', body); closeSheet(); toast('Settings saved'); load(); }
    catch (err) { $('#setErr').hidden = false; $('#setErr').textContent = err.message; }
  });
  $('#logout').addEventListener('click', async () => { await api('/api/admin/login', 'DELETE').catch(() => {}); showLogin(); });
  renderAlertsRow();
  if (focus === 'alerts') setTimeout(() => $('#alertsSec').scrollIntoView({ block: 'start' }), 50);
}

/* ───────────────────────── push alerts ───────────────────────── */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function pushState() {
  if (!pushSupported()) return isIOS && !standalone() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

const b64 = key => {
  const s = String(key || '').replace(/[^A-Za-z0-9_+/-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const out = Uint8Array.from(atob(s + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
  if (out.length !== 65) throw new Error('The push key on the server looks wrong — re-paste NEXT_PUBLIC_VAPID_PUBLIC_KEY in Vercel and redeploy.');
  return out;
};

async function enablePush() {
  try {
    const perm = await Notification.requestPermission(); // must run straight from the tap (iPhone rule)
    if (perm !== 'granted') { S.push = perm === 'denied' ? 'denied' : 'off'; return refreshPushUI(); }
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    const { publicKey } = await api('/api/admin/push');
    if (!publicKey) throw new Error('Server is missing the VAPID keys — see the setup guide.');
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
    await api('/api/admin/push', 'POST', { sub: sub.toJSON() });
    S.push = 'on'; refreshPushUI();
    toast('Alerts are on for this phone');
    api('/api/admin/push', 'POST', { test: true }).catch(() => {});
  } catch (e) { oops(e); }
}

async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) { await api('/api/admin/push', 'DELETE', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
  S.push = 'off'; refreshPushUI();
}

async function resyncPush() { // keeps the server's list in step (e.g. after a database reset)
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub && Notification.permission === 'granted') await api('/api/admin/push', 'POST', { sub: sub.toJSON() });
  } catch { }
}

function renderSetup() {
  const el = $('#setup'), p = S.push;
  if (p === 'on' || ls.get('mr_setup_hidden') === p) { el.hidden = true; return; }
  el.hidden = false;
  const bell = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg>`;
  if (p === 'install') el.innerHTML = `<h3>${bell}Install the app to get booking alerts</h3>
    <ol><li>Tap ${I.share} <b>Share</b> at the bottom of Safari</li><li>Choose <b>Add to Home Screen</b> → Add</li><li>Open <b>Mroue Admin</b> from your Home Screen and turn on alerts</li></ol>`;
  else if (p === 'off') el.innerHTML = `<h3>${bell}Turn on booking alerts</h3><p>Get a notification on this phone the moment a patient books.</p>
    <div class="row"><button class="btn btn-light" data-push="on">Turn on alerts</button>${S.installEvt ? '<button class="btn btn-line" data-push="install">Install app</button>' : ''}</div>`;
  else if (p === 'denied') el.innerHTML = `<h3>${bell}Alerts are blocked on this phone</h3><p>Open your phone’s Settings → Notifications → Mroue Admin (or your browser) and allow notifications, then reopen the app.</p>
    <div class="row"><button class="btn btn-line" data-push="hide">Hide</button></div>`;
  else el.innerHTML = `<h3>${bell}This browser can’t receive alerts</h3><p>Use Chrome on Android, or Safari on iPhone (iOS 16.4 or newer) and add the app to the Home Screen.</p>
    <div class="row"><button class="btn btn-line" data-push="hide">Hide</button></div>`;
}

function renderAlertsRow() {
  const row = $('#alertsRow'); if (!row) return;
  const p = S.push;
  const label = { on: '🟢 On for this phone', off: '⚪ Off on this phone', denied: '🔴 Blocked in phone settings', install: '📲 Add to Home Screen first', unsupported: '— Not supported here' }[p];
  row.innerHTML = `<span class="state">${label}</span>` +
    (p === 'on' ? `<button class="btn btn-ghost" data-push="test">Send test</button><button class="btn btn-ghost" data-push="off">Turn off</button>`
      : p === 'off' ? `<button class="btn btn-primary" data-push="on">Turn on</button>` : '');
}

function refreshPushUI() {
  const btn = $('#bellBtn');
  btn.innerHTML = S.push === 'on' ? I.bellOn : I.bell;
  btn.className = `icon-btn ${S.push === 'on' ? 'on' : 'warn'}`;
  renderSetup(); renderAlertsRow();
}

document.addEventListener('click', async e => {
  const p = e.target.closest('[data-push]'); if (!p) return;
  const a = p.dataset.push;
  if (a === 'on') return enablePush();
  if (a === 'off') return disablePush();
  if (a === 'hide') { ls.set('mr_setup_hidden', S.push); return renderSetup(); }
  if (a === 'install' && S.installEvt) { S.installEvt.prompt(); S.installEvt = null; return renderSetup(); }
  if (a === 'test') { try { const r = await api('/api/admin/push', 'POST', { test: true }); toast(r.reason === 'NO_VAPID' ? 'Server is missing VAPID keys' : `Test sent to ${r.sent} device${r.sent === 1 ? '' : 's'}`); } catch (err) { oops(err); } }
});
$('#bellBtn').addEventListener('click', () => openSettings('alerts'));
$('#gearBtn').addEventListener('click', () => openSettings());
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; renderSetup(); });

/* ───────────────────────── start ───────────────────────── */
let started = false;
async function startApp() {
  $('#login').hidden = true; $('#app').hidden = false;
  openFromUrl(location.href);
  await load();
  if (started) return;
  started = true;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'booking') { toast('New booking'); load(); }
      if (e.data?.type === 'open') { openFromUrl(e.data.url); load(); }
    });
  }
  S.push = await pushState().catch(() => 'unsupported');
  refreshPushUI();
  if (S.push === 'on') resyncPush();
  setInterval(() => { if (document.visibilityState === 'visible' && $('#sheet').hidden) load(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
  window.addEventListener('scroll', () => $('.top').classList.toggle('scrolled', scrollY > 4), { passive: true });
}

(async () => {
  try { const r = await api('/api/admin/login'); r.ok ? startApp() : showLogin(); } catch { showLogin(); }
})();
