# Changelog

All notable changes to this project will be documented in this file.

## [1.1.2] – 2025-12-06
### Security
- 🛡️ **CRITICAL**: Updated Next.js from 15.3.2 to 15.3.6 (fixes CVE-2025-66478)
- 🛡️ **CRITICAL**: Updated React from 19.0.0 to 19.0.1 (fixes CVE-2025-55182)
- 🛡️ Updated React-DOM from 19.0.0 to 19.0.1

### Fixed
- 📅 Fixed email confirmation date formatting to show correct event date instead of day before

## [1.1.1] – 2025-11-03
### Fixed
- 📅 Fixed email confirmation date formatting issue where timezone conversion caused emails to show the day before the actual event date

## [1.1.0] – 2025-05-16
### Added
- ✅ Inline checkmark animation when a volunteer is confirmed
- 💨 Smooth fade-out animation with upward slide on confirmation
- ⏳ Delay before `fetchSignups()` to allow UI animations to complete
- 🧠 Unique keying per volunteer to ensure animation stability across re-renders

### Changed
- 🔄 Combined directory update + event confirmation into a single Confirm button
- ✅ Success messages now reflect both contact updates and confirmation result
- 🚫 Removed standalone "Add to Directory" and "Update in Directory" buttons for cleaner UX

## [1.0.1] – 2025-05-16
### Added
- Mobile-first `<Header />` with animated hamburger nav
- Dark mode styling for header and dropdown

### Fixed
- Email confirmation date formatting (PST)
- Signup form now blocks full events
- Fixed import paths using `@/components`

### Changed
- Removed header from signup page for a cleaner UX
- Improved layout consistency across all pages

## [1.0.0] – 2025-05-13
### Added
- Initial event data display using Google Sheets as backend
- Volunteer attendance tracking per event
- Signup form with event, name, phone, email inputs
- Confirmation emails to volunteer and admin via Resend
- Calendar invite integration
- hCaptcha protection
- Privacy and terms disclaimer
- Inline toast notifications
- Elegant Apple-style loader
- Dark mode styling improvements
- Typography and spacing refinements
- Lead contact + SMS link in event cards
