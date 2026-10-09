# Dr. Ahmad Mroue — Booking system

Same workflow as Basst booking, built for a clinic:

**Patient** → opens the booking link → picks the visit type → picks a day + time (3:00–4:00 PM, 15‑min slots) → name + WhatsApp number → **request sent** (status *Waiting*).

**Doctor's phone** → gets a push notification instantly → opens the admin app → taps **Confirm** → WhatsApp opens with the confirmation message ready to send (English or Arabic, matching the patient).

| Page | URL |
|---|---|
| Booking (patients) | `/` and `/booking` |
| Admin app (doctor) | `/admin` — PIN login, installable on the phone |

Admin can: confirm / decline / cancel (with ready WhatsApp messages), mark done or no‑show, add phone‑call bookings, close one time slot, close a whole day, set holidays, and change days / hours / appointment length — all from the phone.

---

## Setup (≈15 minutes, all free)

### 1 · Firebase (the database)
1. https://console.firebase.google.com → **Add project** → name it `dr-mroue` (Analytics off).
2. Left menu **Build → Firestore Database → Create database** → location **eur3 (Europe)** → *production mode*.
3. **Rules** tab → paste `firestore.rules` from this folder → Publish.
4. ⚙️ **Project settings → Service accounts → Generate new private key** → a `.json` file downloads.
5. Open that file, copy **all** of it, and make it one line (any "JSON minify" site, or just remove the line breaks). That's `FIREBASE_SERVICE_ACCOUNT`.

### 2 · GitHub
New repo (e.g. `dr-mroue-booking`) → upload everything in this folder **except** `ENV-VALUES-PRIVATE.txt`.

### 3 · Vercel (hosting)
1. https://vercel.com → **Add New → Project** → import the repo. Framework: **Other**. Leave build settings empty.
2. **Environment Variables** → add every line from `ENV-VALUES-PRIVATE.txt` (PIN, secret, VAPID keys already generated) + `FIREBASE_SERVICE_ACCOUNT`.
3. **Deploy**. Then add the domain under **Settings → Domains** if you have one.

> Change `ADMIN_PIN` to the doctor's own PIN. Changing it later signs every phone out.

### 4 · The doctor's phone (once)
**iPhone (iOS 16.4+)**
1. Open `https://YOUR-SITE/admin` in **Safari** → enter the PIN.
2. Share button → **Add to Home Screen** → Add.
3. Open **Mroue Admin** from the Home Screen → tap **Turn on alerts** → Allow. A test alert arrives.

**Android**
1. Open `https://YOUR-SITE/admin` in **Chrome** → PIN → **Install app** (or ⋮ → Add to Home screen).
2. Tap **Turn on alerts** → Allow. A test alert arrives.

Do the same on the secretary's phone if she should get alerts too — every phone that turns alerts on gets them.

### 5 · Clinic details
In the admin app → ⚙️ Settings: clinic WhatsApp number, address, Google Maps link, website address. These appear on the booking page and inside the WhatsApp messages.

---

## Changing things
- **Hours, days, slot length, holidays** → admin app Settings (no code).
- **Visit types / doctor title / Arabic text** → `public/shared/config.js`.
- **WhatsApp message wording** → `message()` in `public/assets/admin.js`.
- **Colors / fonts** → top of `public/assets/base.css`.

## Try it on a computer
`npm run dev` → http://localhost:3000 (PIN `1234`). Without Firebase it saves to `.data/db.json`; alerts need the real deploy.

## How it's built
Plain HTML/CSS/JS pages (no build step) + Vercel serverless functions in `/api` + Firestore (server-side only, browsers can't touch the database) + Web Push (VAPID). Double-booking is blocked with a database transaction on each time slot.
