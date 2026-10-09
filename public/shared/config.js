// Clinic defaults. Everything here except VISIT_TYPES can be changed later from the admin app (Settings).
export const DEFAULT_SETTINGS = {
  days: [1, 2, 3, 4, 5, 6], // 0 = Sunday ... 6 = Saturday  → Mon–Sat
  start: '15:00',           // first appointment 3:00 PM
  end: '16:00',             // clinic closes 4:00 PM
  slotMinutes: 15,          // 3:00, 3:15, 3:30, 3:45
  daysAhead: 21,            // how far ahead patients can book
  minNoticeMinutes: 30,     // same-day booking needs this much notice
  closedDates: [],          // ['2026-12-25', ...] holidays / travel
  clinicWhatsapp: '',       // e.g. 96171123456 (digits only) — patients can message the clinic
  address: '',              // shown on the booking page + in WhatsApp confirmations
  mapsUrl: '',              // Google Maps link for "Directions"
  siteUrl: ''               // public URL, used in cancellation messages (e.g. https://drmroue.com)
};

export const DOCTOR = {
  en: { name: 'Dr. Ahmad Mroue', title: 'Gastroenterologist & Endoscopy Specialist' },
  ar: { name: 'د. أحمد مروّة', title: 'اختصاصي أمراض الجهاز الهضمي والتنظير' }
};

export const VISIT_TYPES = [
  { id: 'consult', en: ['Consultation', 'First visit or a new complaint'], ar: ['استشارة', 'زيارة أولى أو شكوى جديدة'] },
  { id: 'followup', en: ['Follow-up', 'Checking in on ongoing treatment'], ar: ['متابعة', 'متابعة علاج قائم'] },
  { id: 'results', en: ['Results review', 'Lab tests, imaging or biopsy results'], ar: ['مراجعة نتائج', 'تحاليل، صور أو نتائج خزعة'] },
  { id: 'endoscopy', en: ['Endoscopy / colonoscopy', 'Discuss or plan a scope'], ar: ['تنظير معدة / قولون', 'التحضير أو التخطيط للتنظير'] }
];

export const typeLabel = (id, lang = 'en') => (VISIT_TYPES.find(t => t.id === id) || { en: [id], ar: [id] })[lang === 'ar' ? 'ar' : 'en'][0];
