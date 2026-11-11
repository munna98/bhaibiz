# Finish BhaiBiz MVP

Complete the remaining agreed phases in one implementation pass, keeping the current attendance and collection workflows intact.

## Reports and dashboard
- Add Reports for attendance, commission earned, collections, outstanding dues and advances.
- Include date-range, worker and status filters as appropriate, totals, empty states and links back to worker records or receipts.
- Export the selected report as Excel and printable PDF (using the browser’s Save as PDF).
- Complete dashboard attendance counts, collections, active-worker outstanding totals, advance balances and a recent daily trend.

## Malayalam and navigation
- Add a persistent English / മലയാളം selector and translate the app’s screens, forms, statuses and common messages.
- Preserve user-entered names, notes, company details and identifiers without translation.
- Use five mobile navigation destinations: Dashboard, Attendance, Collect, Workers and More. Put reports, team, company and owner-only audit history under More.
- Make company switching available on mobile, and reset company-specific screen state when switching.

## Audit history and final checks
- Add owner-only audit history with date/action filters and readable event details, excluding full Aadhaar numbers and encrypted identity data.
- Review existing audit coverage and complete missing change records for money and worker/team actions using the existing company permissions.
- Run rule tests and signed-in desktop/mobile checks with isolated temporary records, including reports and exports, language switching, audit visibility, company separation and core money flows.
- Remove temporary records after testing and mark the implementation phases complete only when verified.

## Technical details
- Reuse existing tenant-scoped queries and RLS; reports do not use privileged reads. Paginate report reads so exports cannot silently stop at the Data API row limit.
- Use a central translation dictionary and React provider, loading the saved language after hydration; use an appropriate Malayalam font.
- Generate Excel downloads in browser event handlers; printable reports remain in the app and do not require a document-generation service.
- Add migrations only for missing audit coverage or demonstrated rule defects, preserving the existing RPC-based write paths.
- Add focused tests for report calculations, inactive-worker exclusions, exports and access rules; inspect page metadata and the latest app checks before finishing.

## Boundaries
- SaaS pricing and subscription billing remain deferred: no invented prices or charges.
- Publishing and a real-company pilot are not automatic. Provide the finished app for your review, with any remaining external checks stated clearly.