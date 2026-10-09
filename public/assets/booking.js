import { VISIT_TYPES, DOCTOR } from '/shared/config.js';
import { fmtTime, fmtDay } from '/shared/time.js';

const $ = s => document.querySelector(s);
const ICONS = {
  consult: '<path d="M5 3.5v4.5a5 5 0 0 0 10 0V3.5"/><path d="M10 13v1.5a5 5 0 0 0 10 0V12"/><circle cx="20" cy="10" r="2"/>',
  followup: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>',
  results: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  endoscopy: '<path d="M9 3c0 3 .8 4.5 3 5.5 3.2 1.4 7.5 1.5 7.5 5.5a7 7 0 0 1-12.4 4.4C6.3 17.6 5 17.6 4 18.6"/><path d="M12 13.5c1.5.9 3.6.8 4.6-.6"/>'
};
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

const T = {
  en: {
    docName: DOCTOR.en.name, docTitle: DOCTOR.en.title, hours: 'Clinic hours', waNote: 'Confirmation on WhatsApp',
    h1: 'Book an appointment', s1: 'Visit', s2: 'Time', s3: 'Details', q1: 'What is the visit for?', q2: 'Choose a day', q3: 'Choose a time',
    back: 'Back', name: 'Full name', phone: 'Phone (WhatsApp)', note: 'Anything the doctor should know?', optional: '(optional)',
    submit: 'Request appointment', fine: 'The clinic will confirm your appointment on WhatsApp.',
    doneH: 'Request sent', doneP: 'The clinic will confirm on WhatsApp shortly.', cal: 'Add to calendar', waClinic: 'Message the clinic', maps: 'Directions', again: 'Book another appointment',
    noDays: 'No free times in the next few weeks. Please message the clinic.', free: n => n === 1 ? '1 free' : `${n} free`, full: 'Full', booked: 'Booked',
    change: 'Change', ref: 'Reference', visit: 'Visit', when: 'When', patient: 'Patient',
    eName: 'Please enter your full name.', ePhone: 'Please enter a valid phone number.', taken: 'Sorry — that time was just taken. Please pick another.',
    dup: 'You already have an appointment on that day.', net: 'Connection problem. Please try again.', lang: 'عربي'
  },
  ar: {
    docName: DOCTOR.ar.name, docTitle: DOCTOR.ar.title, hours: 'دوام العيادة', waNote: 'التأكيد عبر واتساب',
    h1: 'احجز موعدك', s1: 'الزيارة', s2: 'الوقت', s3: 'المعلومات', q1: 'شو سبب الزيارة؟', q2: 'اختر النهار', q3: 'اختر الساعة',
    back: 'رجوع', name: 'الاسم الكامل', phone: 'رقم الهاتف (واتساب)', note: 'في شي لازم يعرفه الدكتور؟', optional: '(اختياري)',
    submit: 'أرسل طلب الموعد', fine: 'العيادة رح تأكدلك الموعد على واتساب.',
    doneH: 'تم إرسال الطلب', doneP: 'العيادة رح تأكدلك على واتساب قريباً.', cal: 'أضف إلى التقويم', waClinic: 'راسل العيادة', maps: 'الموقع', again: 'احجز موعد تاني',
    noDays: 'ما في مواعيد فاضية بالأسابيع الجاية. راسل العيادة لو سمحت.', free: n => `${n} فاضي`, full: 'مليان', booked: 'محجوز',
    change: 'تغيير', ref: 'رقم الحجز', visit: 'الزيارة', when: 'الموعد', patient: 'المريض',
    eName: 'اكتب اسمك الكامل لو سمحت.', ePhone: 'اكتب رقم هاتف صحيح لو سمحت.', taken: 'عذراً، هيدا الوقت انحجز هلق. اختار وقت تاني.',
    dup: 'عندك موعد أصلاً بهيدا النهار.', net: 'في مشكلة بالاتصال. جرّب مرة تانية.', lang: 'English'
  }
};

const state = { lang: localStorageGet('mr_lang') || ((navigator.language || '').startsWith('ar') ? 'ar' : 'en'), step: 1, type: null, date: null, time: null, days: [], clinic: {}, done: null };
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
const t = k => T[state.lang][k];

function applyLang() {
  const ar = state.lang === 'ar';
  document.documentElement.lang = state.lang;
  document.documentElement.dir = ar ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-t]').forEach(el => { const v = t(el.dataset.t); if (typeof v === 'string') el.textContent = v; });
  $('#lang').textContent = t('lang');
  document.title = ar ? `احجز موعد — ${DOCTOR.ar.name}` : `Book an appointment — ${DOCTOR.en.name}`;
  renderHours(); renderTypes(); renderDays(); renderSummary(); if (state.done) renderTicket();
}

function renderHours() {
  if (!state.clinic.start) return;
  $('#hours').textContent = `${fmtTime(state.clinic.start, state.lang).replace(/ (PM|AM|م|ص)$/, '')} – ${fmtTime(state.clinic.end, state.lang)}`;
  $('#addrRow').hidden = !state.clinic.address;
  $('#addr').textContent = state.clinic.address || '';
}

function renderTypes() {
  const L = state.lang;
  $('#types').innerHTML = VISIT_TYPES.map(v => `
    <button class="type" role="radio" type="button" aria-checked="${state.type === v.id}" data-type="${v.id}">
      <span class="ic">${svg(ICONS[v.id] || ICONS.consult)}</span>
      <span><b>${v[L][0]}</b><small>${v[L][1]}</small></span>
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>
    </button>`).join('');
}

function renderDays() {
  const L = state.lang;
  $('#noDays').hidden = state.days.some(d => d.slots.some(s => s.available));
  $('#days').innerHTML = state.days.map(d => {
    const free = d.slots.filter(s => s.available).length;
    const [, , dd] = d.date.split('-');
    return `<button class="day ${free ? '' : 'full'}" role="option" type="button" data-date="${d.date}" aria-selected="${state.date === d.date}" ${free ? '' : 'aria-disabled="true"'}>
      <span class="wd">${fmtDay(d.date, L, 'wd')}</span><span class="dn">${Number(dd)}</span>
      <span class="mo">${new Intl.DateTimeFormat(L === 'ar' ? 'ar-LB-u-nu-latn' : 'en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(d.date + 'T00:00:00Z'))}</span>
      <span class="free">${free ? t('free')(free) : t('full')}</span></button>`;
  }).join('');
  const day = state.days.find(d => d.date === state.date);
  $('#dayLabel').textContent = day ? '· ' + fmtDay(day.date, L, 'long') : '';
  $('#times').innerHTML = day ? day.slots.map(s => `<button class="time" type="button" data-time="${s.time}" ${s.available ? '' : 'disabled'}>${fmtTime(s.time, L)}${s.available ? '' : `<small>${t('booked')}</small>`}</button>`).join('') : '';
  $('.q-time').hidden = !day;
}

function renderSummary() {
  if (!state.type || !state.date || !state.time) return;
  const v = VISIT_TYPES.find(x => x.id === state.type)[state.lang];
  $('#summary').innerHTML = `<span class="ic">${svg(ICONS[state.type])}</span>
    <div><b>${fmtDay(state.date, state.lang, 'long')} · <span dir="ltr">${fmtTime(state.time, state.lang)}</span></b><span>${v[0]}</span></div>
    <button type="button" data-go="2">${t('change')}</button>`;
}

function renderTicket() {
  const d = state.done, v = VISIT_TYPES.find(x => x.id === d.type)[state.lang][0];
  $('#ticket').innerHTML = `
    <div><dt>${t('when')}</dt><dd>${fmtDay(d.date, state.lang, 'long')} · <span dir="ltr">${fmtTime(d.time, state.lang)}</span></dd></div>
    <div><dt>${t('visit')}</dt><dd>${v}</dd></div>
    <div><dt>${t('patient')}</dt><dd>${esc(d.name)}</dd></div>
    <div><dt>${t('ref')}</dt><dd dir="ltr">${d.ref}</dd></div>`;
  const c = state.clinic;
  const wa = $('#waClinic');
  wa.hidden = !c.whatsapp;
  if (c.whatsapp) wa.href = `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(state.lang === 'ar'
    ? `مرحبا، حجزت موعد عند د. أحمد مروّة يوم ${fmtDay(d.date, 'ar', 'long')} الساعة ${fmtTime(d.time, 'ar')} (${d.ref}) باسم ${d.name}.`
    : `Hello, I just booked an appointment with Dr. Ahmad Mroue on ${fmtDay(d.date, 'en', 'long')} at ${fmtTime(d.time)} (${d.ref}) under ${d.name}.`)}`;
  $('#maps').hidden = !c.mapsUrl; if (c.mapsUrl) $('#maps').href = c.mapsUrl;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function go(step) {
  state.step = step;
  document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = Number(p.dataset.panel) !== step; });
  document.querySelectorAll('#steps li').forEach(li => {
    const n = Number(li.dataset.step);
    li.className = step === 4 || n < step ? 'done' : n === step ? 'on' : '';
  });
  if (step === 3) renderSummary();
  if (step === 2 && state.date) requestAnimationFrame(() => document.querySelector(`.day[data-date="${state.date}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }));
  if (window.scrollY > 120) window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadSlots() {
  const r = await fetch('/api/slots', { cache: 'no-store' });
  const data = await r.json();
  state.days = data.days || []; state.clinic = data.clinic || {};
  if (!state.days.some(d => d.date === state.date && d.slots.some(s => s.available))) state.date = (state.days.find(d => d.slots.some(s => s.available)) || {}).date || null;
  renderHours(); renderDays();
}

function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3200); }

/* ── events ── */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) return go(Number(g.dataset.go));
  const ty = e.target.closest('[data-type]'); if (ty) { state.type = ty.dataset.type; renderTypes(); return setTimeout(() => go(2), 120); }
  const d = e.target.closest('.day'); if (d && !d.classList.contains('full')) { state.date = d.dataset.date; state.time = null; return renderDays(); }
  const tm = e.target.closest('.time'); if (tm && !tm.disabled) { state.time = tm.dataset.time; return go(3); }
});

$('#lang').addEventListener('click', () => { state.lang = state.lang === 'ar' ? 'en' : 'ar'; localStorageSet('mr_lang', state.lang); applyLang(); });

$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, err = $('#err'), btn = $('#submit');
  const name = f.name.value.trim(), phone = f.phone.value.trim();
  f.name.classList.toggle('invalid', name.length < 2);
  f.phone.classList.toggle('invalid', phone.replace(/\D/g, '').length < 7);
  if (name.length < 2) { err.hidden = false; err.textContent = t('eName'); return f.name.focus(); }
  if (phone.replace(/\D/g, '').length < 7) { err.hidden = false; err.textContent = t('ePhone'); return f.phone.focus(); }
  err.hidden = true; btn.classList.add('loading');
  try {
    const r = await fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: state.type, date: state.date, time: state.time, name, phone, note: f.note.value, website: f.website.value, lang: state.lang }) });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      state.done = { ...data, type: state.type, date: state.date, time: state.time, name };
      renderTicket(); go(4); return;
    }
    if (data.error === 'TAKEN') { toast(t('taken')); state.time = null; await loadSlots(); return go(2); }
    err.hidden = false;
    err.textContent = data.error === 'DUPLICATE' ? t('dup') : /phone/i.test(data.message || '') ? t('ePhone') : (state.lang === 'en' && data.message) || t('net');
  } catch { err.hidden = false; err.textContent = t('net'); }
  finally { btn.classList.remove('loading'); }
});

$('#ics').addEventListener('click', () => {
  const d = state.done; if (!d) return;
  const [h, m] = d.time.split(':').map(Number);
  const startUtc = new Date(Date.UTC(...d.date.split('-').map((x, i) => i === 1 ? x - 1 : +x), h, m) - beirutOffsetMin(d.date) * 60000);
  const endUtc = new Date(startUtc.getTime() + 15 * 60000);
  const z = x => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dr Ahmad Mroue//Booking//EN', 'BEGIN:VEVENT', `UID:${d.id}@drmroue`, `DTSTAMP:${z(new Date())}`,
    `DTSTART:${z(startUtc)}`, `DTEND:${z(endUtc)}`, 'SUMMARY:Dr. Ahmad Mroue — appointment', `DESCRIPTION:Ref ${d.ref}`,
    state.clinic.address ? `LOCATION:${state.clinic.address.replace(/[,;]/g, '\\$&')}` : '', 'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Appointment', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'dr-mroue-appointment.ics' });
  document.body.append(a); a.click(); a.remove();
});
// Beirut UTC offset on a given date (handles summer/winter time).
function beirutOffsetMin(ymd) {
  const d = new Date(ymd + 'T12:00:00Z');
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Beirut', hour: 'numeric', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return (Number(p.hour) - 12) * 60;
}

$('#again').addEventListener('click', async () => { state.done = null; state.time = null; state.type = null; $('#form').reset(); renderTypes(); go(1); await loadSlots(); });

applyLang();
go(1);
loadSlots().catch(() => toast(t('net')));
