# Finish payment collection and receipts

The payment screens are already present. Complete and verify this phase before moving on to reports.

## What you will get
- Collect a worker’s commission, clear the oldest unpaid days first, and open the numbered receipt.
- Share or print the receipt; the owner can void a mistaken payment with a reason.
- View payments, waivers and adjustments in the worker’s ledger.
- Give advances and record repayments separately from commission.
- Keep dashboard outstanding totals limited to active workers.

## Completion work
- Check the existing screens against the saved business rules and correct any gaps found.
- Make amount and date validation consistent; block payments above the amount due and repayments above the advance balance before saving.
- Make receipt printing show only the receipt, and remove outdated “next phase” messages.
- Test collection, receipt, voiding, ledger updates and separate advance repayment using a signed-in account. If no suitable worker exists, use clearly labelled temporary test records and remove them afterwards.
- Mark phase 4 complete only after verification. Dashboard reports and exports remain the next phase; SaaS pricing remains deferred.

## Technical details
- Preserve existing company isolation, role checks and money-writing RPCs; do not introduce a second payment workflow.
- Reuse the existing form and design-system controls, with small tests for amount limits and separate balances.
- Inspect content-page metadata, run relevant tests, and check the live app on desktop and mobile.