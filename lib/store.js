// Data layer. Uses Firebase Firestore (via the Admin SDK, server-side only) when FIREBASE_* env vars exist.
// Without them, in local development only, it falls back to a JSON file in .data/ so the app can be tried offline.
import crypto from 'node:crypto';
import { DEFAULT_SETTINGS } from '../public/shared/config.js';

const hasFirebase = !!(process.env.FIREBASE_SERVICE_ACCOUNT || (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY));

export class StoreError extends Error { constructor(code) { super(code); this.code = code; } }

const mergeSettings = s => ({ ...DEFAULT_SETTINGS, ...(s || {}) });
const subId = endpoint => crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 40);

/* ---------------- Firestore ---------------- */
let _db;
async function fdb() {
  if (_db) return _db;
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (!getApps().length) {
    const creds = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : { projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') };
    initializeApp({ credential: cert(creds) });
  }
  _db = getFirestore();
  return _db;
}

const firestore = {
  async getSettings() {
    const snap = await (await fdb()).doc('settings/main').get();
    return mergeSettings(snap.exists ? snap.data() : null);
  },
  async saveSettings(s) { await (await fdb()).doc('settings/main').set(s); return mergeSettings(s); },

  async listLocks(from, to) {
    const q = await (await fdb()).collection('slots').where('date', '>=', from).where('date', '<=', to).get();
    return q.docs.map(d => ({ key: d.id, ...d.data() }));
  },

  async createBooking(b) {
    const db = await fdb();
    return db.runTransaction(async tx => {
      const lockRef = db.collection('slots').doc(b.key);
      const [lock, same] = await Promise.all([tx.get(lockRef), tx.get(db.collection('bookings').where('date', '==', b.date))]);
      if (lock.exists) throw new StoreError('TAKEN');
      if (b.checkDuplicate && same.docs.some(d => d.data().phone === b.phone && d.data().status !== 'cancelled')) throw new StoreError('DUPLICATE');
      const ref = db.collection('bookings').doc();
      const { checkDuplicate, ...data } = b;
      tx.set(ref, data);
      tx.set(lockRef, { date: b.date, time: b.time, bookingId: ref.id });
      return { id: ref.id, ...data };
    });
  },

  async listBookings(from, to) {
    const q = await (await fdb()).collection('bookings').where('date', '>=', from).where('date', '<=', to).get();
    return q.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async setStatus(id, status) {
    const db = await fdb();
    return db.runTransaction(async tx => {
      const ref = db.collection('bookings').doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new StoreError('NOT_FOUND');
      const b = snap.data();
      const lockRef = db.collection('slots').doc(b.key);
      const lock = await tx.get(lockRef);
      if (status === 'cancelled') { if (lock.exists && lock.data().bookingId === id) tx.delete(lockRef); }
      else if (b.status === 'cancelled') { // re-opening a cancelled booking needs its slot back
        if (lock.exists) throw new StoreError('TAKEN');
        tx.set(lockRef, { date: b.date, time: b.time, bookingId: id });
      }
      tx.update(ref, { status, updatedAt: Date.now() });
      return { id, ...b, status };
    });
  },

  async setBlocked(date, time, key, blocked) {
    const db = await fdb();
    const ref = db.collection('slots').doc(key);
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (blocked) { if (snap.exists) throw new StoreError('TAKEN'); tx.set(ref, { date, time, blocked: true }); }
      else if (snap.exists && snap.data().blocked) tx.delete(ref);
    });
  },

  async addSub(sub, ua) { await (await fdb()).collection('pushSubs').doc(subId(sub.endpoint)).set({ sub, ua: ua || '', createdAt: Date.now() }); },
  async removeSub(endpointOrId) { await (await fdb()).collection('pushSubs').doc(endpointOrId.length === 40 ? endpointOrId : subId(endpointOrId)).delete(); },
  async listSubs() { const q = await (await fdb()).collection('pushSubs').get(); return q.docs.map(d => ({ id: d.id, ...d.data() })); }
};

/* ---------------- Local JSON file (development only) ---------------- */
let chain = Promise.resolve();
async function withFile(fn) {
  const fs = await import('node:fs/promises');
  const path = (await import('node:path')).join(process.cwd(), '.data', 'db.json');
  const run = chain.then(async () => {
    let db;
    try { db = JSON.parse(await fs.readFile(path, 'utf8')); } catch { db = { settings: null, bookings: {}, slots: {}, subs: {} }; }
    const res = await fn(db);
    await fs.mkdir((await import('node:path')).dirname(path), { recursive: true });
    await fs.writeFile(path, JSON.stringify(db, null, 2));
    return res;
  });
  chain = run.catch(() => {});
  return run;
}

const local = {
  getSettings: () => withFile(db => mergeSettings(db.settings)),
  saveSettings: s => withFile(db => { db.settings = s; return mergeSettings(s); }),
  listLocks: (from, to) => withFile(db => Object.entries(db.slots).filter(([, v]) => v.date >= from && v.date <= to).map(([key, v]) => ({ key, ...v }))),
  createBooking: b => withFile(db => {
    if (db.slots[b.key]) throw new StoreError('TAKEN');
    if (b.checkDuplicate && Object.values(db.bookings).some(x => x.date === b.date && x.phone === b.phone && x.status !== 'cancelled')) throw new StoreError('DUPLICATE');
    const id = crypto.randomBytes(10).toString('hex');
    const { checkDuplicate, ...data } = b;
    db.bookings[id] = data; db.slots[b.key] = { date: b.date, time: b.time, bookingId: id };
    return { id, ...data };
  }),
  listBookings: (from, to) => withFile(db => Object.entries(db.bookings).filter(([, v]) => v.date >= from && v.date <= to).map(([id, v]) => ({ id, ...v }))),
  setStatus: (id, status) => withFile(db => {
    const b = db.bookings[id]; if (!b) throw new StoreError('NOT_FOUND');
    if (status === 'cancelled') { if (db.slots[b.key]?.bookingId === id) delete db.slots[b.key]; }
    else if (b.status === 'cancelled') { if (db.slots[b.key]) throw new StoreError('TAKEN'); db.slots[b.key] = { date: b.date, time: b.time, bookingId: id }; }
    b.status = status; b.updatedAt = Date.now(); return { id, ...b };
  }),
  setBlocked: (date, time, key, blocked) => withFile(db => {
    if (blocked) { if (db.slots[key]) throw new StoreError('TAKEN'); db.slots[key] = { date, time, blocked: true }; }
    else if (db.slots[key]?.blocked) delete db.slots[key];
  }),
  addSub: (sub, ua) => withFile(db => { db.subs[subId(sub.endpoint)] = { sub, ua: ua || '', createdAt: Date.now() }; }),
  removeSub: e => withFile(db => { delete db.subs[e.length === 40 ? e : subId(e)]; }),
  listSubs: () => withFile(db => Object.entries(db.subs).map(([id, v]) => ({ id, ...v })))
};

function pick() {
  if (hasFirebase) return firestore;
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_LOCAL_STORE) {
    return new Proxy({}, { get: () => async () => { throw new StoreError('NO_DATABASE'); } });
  }
  return local;
}

export const store = pick();
