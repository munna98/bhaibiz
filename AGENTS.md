<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Multi-company tenancy: every business table carries `company_id`; RLS uses `is_member`/`has_role` security-definer functions over `memberships`. Why: keeps each company's data isolated without per-query filters.
- Staff join via `invites` (email + role) consumed by `accept_my_invites()` on load. Why: no email sending needed for invites.
- Signed-in pages live under `src/routes/_authenticated/` (client-only guard); app shell is `/app`. Why: session lives in the browser.
- Aadhaar numbers are encrypted (AES-GCM) and HMAC-hashed only inside server functions (`src/lib/workers.functions.ts`, secret `AADHAAR_KEY`); ciphertext lives in owner-only `worker_aadhaar`, `workers` keeps last4 + hash. Why: staff never receive full numbers; hash enables per-company duplicate checks.
- Worker creation, status changes and Aadhaar corrections go through security-definer RPCs; clients may update only granted personal columns on `workers`. Why: keeps worker code sequence, history rows and status audit consistent.
- Rates are insert-only `commission_agreements` rows with `effective_from`; the rate for a date is the latest row on or before it (`rateOn`). Why: rate changes never rewrite past days.
- Worker files live in private bucket `worker-files` at `{company_id}/{worker_id}/{photo|aadhaar}/…`; storage policies read the path, Aadhaar copies are owner-only. Why: tenant isolation without extra lookups.
- Attendance writes go only through `mark_attendance`/`mark_attendance_bulk` RPCs, which also insert commission earn/reversal rows (insert-only; earn rows get `reversed_at`). Why: one place enforces date/role rules and keeps commission in step with attendance.
- Money writes use the existing payment, advance and adjustment RPCs; shared AmountForm validation is only an early guard. Why: role enforcement, balances and receipt numbering remain authoritative in the database.
- Attendance mutations invalidate money queries as well as attendance queries. Why: cached worker dues and ledgers must reflect new earnings and reversals immediately.
- Audit financial, attendance and record changes with tenant-scoped database triggers; identity reveals fail closed when audit recording fails. Why: keeps the owner history complete without leaking protected identity data.
- Browser worker queries explicitly select permitted columns, excluding identity fingerprints. Why: database column grants protect duplicate-check hashes from staff.
- Localize interface labels through the shared language context, never user-entered values; reports paginate database reads and export explicit text/number cells. Why: preserves names and prevents truncated or formula-interpreted exports.
