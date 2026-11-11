import { describe, expect, it } from "vitest";
import { buildReport, canViewAudit, canViewReports, excelRows, readAllPages, workerActiveOn, type ReportData } from "@/lib/report-data";
const data: ReportData = {
  workers: [{ id: "a", full_name: "Active Worker", worker_code: "BB-0001", status: "active", joining_date: "2026-11-09" }, { id: "i", full_name: "Inactive Worker", worker_code: "BB-0002", status: "inactive", joining_date: "2026-11-09" }],
  attendance: [{ id: "a1", worker_id: "a", work_date: "2026-11-09", status: "worked" }],
  commission: [{ id: "c1", worker_id: "a", work_date: "2026-11-09", amount_paise: 15000 }, { id: "c2", worker_id: "a", work_date: "2026-11-10", amount_paise: 15000 }, { id: "c3", worker_id: "i", work_date: "2026-11-09", amount_paise: 90000 }],
  payments: [{ id: "p1", worker_id: "a", paid_on: "2026-11-11", amount_paise: 10000, method: "cash", receipt_no: "RCPT-2026-00001", voided_at: null }, { id: "p2", worker_id: "a", paid_on: "2026-11-10", amount_paise: 5000, method: "cash", receipt_no: "RCPT-2026-00002", voided_at: "2026-11-11" }],
  adjustments: [{ id: "adj", worker_id: "a", on_date: "2026-11-11", amount_paise: 5000, kind: "waiver" }],
  advances: [{ id: "av", worker_id: "a", given_on: "2026-11-09", amount_paise: 50000 }],
  repayments: [{ id: "r", worker_id: "a", paid_on: "2026-11-11", amount_paise: 20000 }],
  history: [{ id: "h1", worker_id: "i", status: "active", effective_date: "2026-11-09", changed_at: "2026-11-09T00:00:00Z" }, { id: "h2", worker_id: "i", status: "inactive", effective_date: "2026-11-10", changed_at: "2026-11-10T00:00:00Z" }],
};
describe("report business rules", () => {
  it("default outstanding excludes inactive workers and subtracts ₹100 payment and ₹50 waiver", () => {
    expect(buildReport(data, "outstanding", "2026-11-11", "2026-11-11").total).toBe(15000);
    expect(buildReport(data, "outstanding", "2026-11-11", "2026-11-11").rows).toHaveLength(1);
  });
  it("all-status report keeps inactive dues collectible", () => { expect(buildReport(data, "outstanding", "2026-11-11", "2026-11-11", "all").total).toBe(105000); });
  it("balances include days before from but exclude payments after as-of date", () => { expect(buildReport(data, "outstanding", "2026-11-10", "2026-11-10").total).toBe(30000); });
  it("collections exclude voided receipts", () => { expect(buildReport(data, "collections", "2026-11-09", "2026-11-11").total).toBe(10000); });
  it("advance balance ₹300 remains separate from commission due ₹150", () => { expect(buildReport(data, "advances", "2026-11-09", "2026-11-11").total).toBe(30000); });
  it("attendance includes pending only during active periods", () => {
    expect(buildReport(data, "attendance", "2026-11-09", "2026-11-11", "all").rows).toHaveLength(4);
    expect(workerActiveOn(data.workers[1] as ReportData["workers"][number], "2026-11-10", data.history)).toBe(false);
  });
  it("commission reversals cancel earnings without deleting the worked-day history", () => {
    const reversed = { ...data, commission: [...data.commission, { id: "rv", worker_id: "a", work_date: "2026-11-10", amount_paise: -15000 }] };
    expect(buildReport(reversed, "earned", "2026-11-09", "2026-11-11").total).toBe(15000);
  });
  it("operators cannot view reports and only owners can view audit", () => {
    expect(canViewReports("operator")).toBe(false); expect(canViewReports("accountant")).toBe(true);
    expect(canViewAudit("manager")).toBe(false); expect(canViewAudit("owner")).toBe(true);
  });
});
it("reads past the first database page without silently truncating export", async () => {
  const result = await readAllPages(async (from, to) => ({ data: [1, 2, 3, 4, 5].slice(from, to + 1), error: null }), 2);
  expect(result).toEqual([1, 2, 3, 4, 5]);
});
it("Excel export keeps a formula-like worker name as literal text", () => {
  const rows = excelRows(["Worker"], [{ id: "x", workerId: "x", amount: 0, cells: ["=HYPERLINK(\"bad\")"] }]);
  expect(rows[1]?.[0]?.type).toBe(String);
  expect(rows[1]?.[0]?.value).toBe('=HYPERLINK("bad")');
});