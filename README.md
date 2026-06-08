# MCMA Kitchen Volunteer App – Version 1.1.2

A polished, mobile-friendly volunteer scheduling and attendance app built using **Next.js**, **Tailwind CSS**, and Google Sheets as the backend.

## 🛡️ Security Update (December 6, 2025)
**IMPORTANT**: Updated to address critical React Server Components vulnerability:
- **Next.js**: 15.3.2 → 15.3.6 (fixes CVE-2025-66478)
- **React**: 19.0.0 → 19.0.1 (fixes CVE-2025-55182)
- All users should update immediately

---

## ✅ Version 1.1.2 – Current Feature Summary

### 🔄 Admin Dashboard & Google Sheets Reliability (3/23/2026)
- Added a shared Google Sheets helper so admin and signup routes use the same service-account auth handling
- Normalized `GOOGLE_PRIVATE_KEY` parsing to support escaped newline values in environment variables
- Admin signup review now tolerates incomplete historical signup rows instead of failing the whole dashboard response
- `Schedule of Events` sheet selection now supports the current matching tab automatically, with optional `GOOGLE_EVENTS_SHEET_NAME` override
- Review Signups now renders newest entries first and uses unique per-signup keys so rows do not collide on the dashboard

### 📊 Spreadsheet Layout Notes (6/8/2026)
- The app now expects the event schedule sheet to use this column layout:
  - `A` = Event date
  - `B` = Event name
  - `C` = Expected attendees
  - `D` = `VOLUNTEERS NEEDED`
  - `E/F` = Kitchen lead and lead phone
  - `G/H, I/J, K/L, M/N, O/P, Q/R` = Volunteer 1-6 name/phone pairs
  - `S:X` = Volunteer 1-6 attendance markers
- Volunteer availability is calculated from `VOLUNTEERS NEEDED`, so events can now require fewer than six volunteer slots
- The schedule tab may be named either `Schedule of Events` or a year-prefixed variant such as `2026 Schedule of Events`
- Signup and directory tabs are now resolved through shared helpers instead of relying on hard-coded tab names in each route

---

### 🛠️ Initial Setup
- Built using **Next.js 15.3.6** (security patched)
- Styled with **Tailwind CSS**
- Hosted on **Vercel**
- Backend data powered by **Google Sheets API** via service account
- Event data pulled and displayed dynamically
- Volunteers tracked per event
- Events sorted into **Upcoming** and **Past** using date parsing

---

### 🧑‍🍳 Signup & Email Confirmation (5/12/2025)
- Volunteers can sign up for any event by selecting:
  - Event
  - Name, phone, and email
- Post-submission:
  - Confirmation message appears inline
  - Info cleared and displayed to user
  - Confirmation emails sent via **Resend API**
    - Volunteer receives event details + calendar invite link
    - Admin (Peter) receives a copy
  - Emails include:
    - MCMA logo
    - Reply-to header
    - Clean design

---

### 🔐 Security & Trust
- **Google reCAPTCHA** integration protects form from spam
- **Privacy and Terms disclaimer** added
- Basic **error logging** built in for form and API

---

### 🎨 UI / UX Upgrades (5/13/2025)
- Lead name + SMS link added to each event card
- Vertical spacing refined for:
  - Lead info and volunteer list
  - Event headers and content
- Font and spacing adjusted for clean, Apple-style readability

---

### 🌙 Dark Mode Support
- Header sections (`Upcoming Events`, `Past Events`) now visible in dark mode
- Theming respects `prefers-color-scheme`
- Past events no longer disappear in dark mode

---

### 🧩 Inline Feedback
- `alert()` replaced with toast-style inline confirmations
  - Example: `Attendance saved ✔`
  - Auto-dismisses after 2 seconds

---

### ⏳ Elegant Apple-style Loader
- Spinner shows while fetching event data
- Smooth, minimal (CSS only)
- Auto-hides after data loads

---

## 🔁 Deployment
- All changes committed and pushed
- Ready for deployment via **Git + Vercel**

---

## 🚀 Stack
- **Frontend:** Next.js, Tailwind CSS
- **Backend:** Google Sheets API (via service account)
- **Email:** Resend API
- **Security:** Google reCAPTCHA
- **Hosting:** Vercel

---

## 📌 Roadmap Ideas
- [ ] Admin filters for event management
- [ ] Export volunteer data to CSV
- [ ] Edit/cancel functionality for volunteers
- [ ] Admin dashboard view
- [ ] Multi-language support

---

## 👏 Built with care by Peter Bassett
