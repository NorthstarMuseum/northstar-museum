## v2.4.3: Text cleanup

Removed long dash punctuation from website text and documentation. All existing site features remain unchanged.

## v2.4.2: Fix website stuck on “Opening Northstar…”

- Fixed `startup.js` and `student-ui.js` returning the HTML page instead of JavaScript.
- Return HTTP 404 for unknown `.js` and `.css` assets instead of the SPA HTML fallback.
- Version-bumped entry scripts and added MIME-type regression tests.
- No change to existing database format or user data.

# Northstar Changes

## v2.4: Fictional museum student activities

- Added public side-by-side artifact comparison (`/compare`) without needing an account.
- Added a clearly marked fictional archive timeline (`/timeline`).
- Added user-owned mini-exhibitions (`/my-exhibitions`): create, edit, delete and save 3 to 6 objects in each, with server-side validation and ownership checks.
- Added private mini-exhibitions to the personal JSON data export and cascade deletion.
- Added a safe classroom demo database setup with random temporary credentials and an isolated startup command. No existing data files are overwritten.
- Added integration, UI and demo tests, plus updated API/database notes.
- Preserved the editorial light/gray/navy design, v2.3 booking rules, and existing account deletion confirmations.

## v2.3: Sprint user stories

- Added adult/student/child booking tickets, calculated admission total in CAD cents, backend price validation and a safe migration for existing SQLite bookings.
- Added printable visitor booking cards and estimated prices to admin bookings.
- Added event keyword search, event-date filtering and event detail pages.
- Added visitor information on the Visit page: hours, prices, accessibility and no-physical-address disclaimer.
- Added admin search by booking reference/name/email, status filters and keyboard improvements.
- Included optional Express adapter using the original request handler. **Express runtime is not verified here** because npm registry access was unavailable; standard Node server is verified.
- Added sprint API/backend/database documentation and final QA checklist.
- Continued to preserve account deletion confirmation, private collections, quiz, hidden mysteries and admin activity logs from v2.2.

## Verification

See `docs/QA_RELEASE_CHECKLIST.md`. Test outcomes must come from actual `npm test` runs; visual and Express validation must be done separately.
