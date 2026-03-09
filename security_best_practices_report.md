# Security Best Practices Report
Date: 2026-03-09
Project: mcma-kitchen-volunteers
Reviewer: Codex (`security-best-practices` skill)

## Executive Summary
The app has multiple critical and high-risk issues centered on missing authentication/authorization for admin and data-mutating APIs, plus unsafe handling of untrusted spreadsheet/email input. The current design allows unauthenticated users to read volunteer PII and modify scheduling data. Immediate priority should be adding server-side authz, restricting sensitive data exposure, and hardening input handling.

## Critical Findings

### SBP-001: Missing server-side authn/authz on admin and mutating endpoints
Severity: Critical
Impact: Any unauthenticated user can read volunteer PII and modify volunteer/event records.
Evidence:
- `src/app/api/signups-overview/route.js:3` serves full signup + directory-derived data with no auth checks.
- `src/app/api/add-to-directory/route.js:3` writes to `Volunteer Directory` with no auth checks.
- `src/app/api/confirm-to-event/route.js:3` writes volunteers into event schedule with no auth checks.
- `src/app/api/update-attendance/route.js:3` writes attendance state with no auth checks.
- `src/app/admin/review-signups/page.js:17` loads sensitive signups directly from `/api/signups-overview`.
Recommendations:
1. Require server-side authentication and role checks for `/admin/*` and all privileged APIs.
2. Enforce authorization in each route handler (do not rely on frontend route hiding).
3. Restrict PII and mutation endpoints to authenticated admin users only.

## High Findings

### SBP-002: Spreadsheet formula injection via `USER_ENTERED` writes
Severity: High
Impact: Malicious input beginning with `=`, `+`, `-`, or `@` can execute as a spreadsheet formula, enabling data exfiltration or phishing payloads when the sheet is opened.
Evidence:
- `src/app/api/signup/route.js:130` appends user-controlled fields with `valueInputOption: 'USER_ENTERED'`.
- `src/app/api/add-to-directory/route.js:52` writes user-controlled fields with `valueInputOption: 'USER_ENTERED'`.
- `src/app/api/confirm-to-event/route.js:77` writes user-controlled fields with `valueInputOption: 'USER_ENTERED'`.
Recommendations:
1. Use `valueInputOption: 'RAW'` for untrusted text fields where possible.
2. If `USER_ENTERED` is required, escape dangerous leading characters by prefixing `'`.
3. Add strict runtime validation/normalization (length, charset, allowed patterns).

### SBP-003: Public exposure of volunteer PII via events API/dashboard data model
Severity: High
Impact: Volunteer names, phone numbers, and attendance can be scraped by anyone with app access.
Evidence:
- `src/app/api/get-events/route.js:43` returns `raw: padded` (full row data including volunteer/phone columns).
- `src/app/page.js:106` parses volunteer and phone fields from `raw`.
- `src/app/page.js:154` renders volunteer phone numbers as links.
Recommendations:
1. Split public event data from private volunteer/contact data.
2. Remove `raw` from public API responses; return only minimal fields needed by public views.
3. Require admin auth for any response that includes volunteer identity/contact data.

### SBP-004: Known vulnerable dependency set in production tree
Severity: High
Impact: Running on known-vulnerable versions increases exposure to publicly disclosed framework vulnerabilities.
Evidence:
- `package.json:13` pins `next` to `15.3.6`.
- `npm audit --omit=dev` reports high/moderate advisories and recommends `next@15.5.12`.
Recommendations:
1. Upgrade `next` to `15.5.12` or newer patched release.
2. Regenerate lockfile and run regression tests before deploy.
3. Add dependency update cadence and CI vulnerability checks.

## Medium Findings

### SBP-005: Sensitive internal error details exposed to clients
Severity: Medium
Impact: Error details can leak internals useful for targeted attacks.
Evidence:
- `src/app/api/update-attendance/route.js:36` returns `err.message` and `err.stack`.
- `src/app/api/signup/route.js:217` returns raw `err.message`.
- `src/app/api/signups-overview/route.js:117` returns raw `err.message`.
- `src/app/api/add-to-directory/route.js:63` returns raw `err.message`.
Recommendations:
1. Return generic client-safe errors.
2. Log full details server-side only (with redaction).

### SBP-006: Incomplete runtime validation for mutable sheet coordinates and payloads
Severity: Medium
Impact: Malformed or hostile inputs can target unexpected cells/records and increase abuse risk.
Evidence:
- `src/app/api/update-attendance/route.js:5` trusts `row`/`index` from JSON.
- `src/app/api/update-attendance/route.js:18` only checks `index > 23` (no lower bound/type/range checks for row).
- `src/app/api/confirm-to-event/route.js:4` accepts unvalidated strings before writes.
Recommendations:
1. Add schema validation (e.g., zod) for all API request bodies.
2. Enforce integer bounds for row/column indices and strict allowlists for event identifiers.

### SBP-007: CAPTCHA verification missing contextual checks
Severity: Medium
Impact: Token replay/misuse from unexpected contexts is less constrained.
Evidence:
- `src/app/api/signup/route.js:79` checks only `success` and `score`.
- No checks for expected `action`, `hostname`, or token age (`challenge_ts`).
Recommendations:
1. Verify `captchaResult.action === 'submit'`.
2. Verify allowed hostname(s) and enforce token freshness window.

### SBP-008: Security headers/CSP not visible in app config
Severity: Medium
Impact: Missing defense-in-depth against XSS, clickjacking, and content sniffing.
Evidence:
- `next.config.mjs:2` has no `headers()` policy.
Notes:
- These controls may exist at Vercel/edge layer, but they are not visible in this repo.
Recommendations:
1. Verify runtime headers in production.
2. Ensure baseline headers are set (CSP, `X-Content-Type-Options`, `Referrer-Policy`, clickjacking protections, permissions policy).

### SBP-009: Unescaped user-controlled values in HTML/ICS email generation
Severity: Medium
Impact: Crafted input can manipulate email/ICS content presented to recipients.
Evidence:
- `src/app/api/signup/route.js:30` interpolates `eventName` into ICS summary.
- `src/app/api/signup/route.js:31` interpolates `name` into ICS description.
- `src/app/api/signup/route.js:156` and `src/app/api/signup/route.js:158` interpolate user-controlled fields into HTML.
Recommendations:
1. Escape/sanitize all user-controlled values before HTML/ICS interpolation.
2. Strip CR/LF and disallowed characters for ICS-safe fields.

## Prioritized Remediation Plan
1. Implement authn/authz guardrails for `/admin/*` and privileged APIs (SBP-001).
2. Remove public PII exposure and redesign API payloads (SBP-003).
3. Fix spreadsheet injection and add input schemas (SBP-002, SBP-006).
4. Upgrade Next.js and re-audit dependencies (SBP-004).
5. Sanitize errors and tighten abuse controls (`rate limiting`, CAPTCHA context checks, headers) (SBP-005, SBP-007, SBP-008).
