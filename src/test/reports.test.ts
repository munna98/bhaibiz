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
  it("outstanding report includes worker opening balance in due calculation", () => {
    const dataWithOpening: ReportData = {
      ...data,
      workers: [
        { ...data.workers[0]!, opening_balance_paise: 10000 },
        data.workers[1]!,
      ],
    };
    expect(buildReport(dataWithOpening, "outstanding", "2026-11-11", "2026-11-11").total).toBe(25000);
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

describe("reports configuration and navigation", () => {
  it("report config items cover all 6 user-friendly report kinds", async () => {
    const { REPORT_CONFIG_ITEMS } = await import("@/lib/report-data");

    expect(REPORT_CONFIG_ITEMS).toHaveLength(6);
    const kinds = REPORT_CONFIG_ITEMS.map((item) => item.value);
    expect(kinds).toEqual(["outstanding", "attendance", "earned", "collections", "advances", "rent"]);

    REPORT_CONFIG_ITEMS.forEach((cfg) => {
      expect(cfg.label).toBeTruthy();
      expect(cfg.explanation).toBeTruthy();
      expect(cfg.badge).toBeTruthy();
    });
  });

  it("builds rent report accurately with charges and collections", () => {
    const rentData = {
      ...data,
      rentCharges: [
        { id: "rc1", worker_id: "a", period: "2026-11", amount_paise: 150000, due_date: "2026-11-01" },
        { id: "rc2", worker_id: "i", period: "2026-11", amount_paise: 200000, due_date: "2026-11-01" },
      ],
      rentPayments: [
        { id: "rp1", worker_id: "a", period: "2026-11", paid_on: "2026-11-05", amount_paise: 100000, method: "cash", receipt_no: "BB-RNT-001", voided_at: null },
        { id: "rp2", worker_id: "i", period: "2026-11", paid_on: "2026-11-06", amount_paise: 200000, method: "upi", receipt_no: "BB-RNT-002", voided_at: "2026-11-07" },
      ],
    };
    const report = buildReport(rentData, "rent", "2026-11-01", "2026-11-30", "all");
    expect(report.headers).toContain("Rent Charged (₹)");
    expect(report.headers).toContain("Rent Collected (₹)");
    expect(report.headers).toContain("Rent Due (₹)");

    // Worker 'a': 1500 charged - 1000 collected = 500 due
    const waRow = report.rows.find((r) => r.workerId === "a");
    expect(waRow).toBeDefined();
    expect(waRow?.amount).toBe(50000); // 500 rupees in paise

    // Worker 'i': 2000 charged - 0 collected (voided) = 2000 due
    const wiRow = report.rows.find((r) => r.workerId === "i");
    expect(wiRow).toBeDefined();
    expect(wiRow?.amount).toBe(200000); // 2000 rupees in paise
  });

  it("automatically accrues rent in report based on joining date and monthly_rent_paise setting", () => {
    const autoRentData: ReportData = {
      ...data,
      workers: [
        {
          id: "a",
          full_name: "Active Worker",
          worker_code: "BB-0001",
          status: "active",
          joining_date: "2026-09-01", // joined in Sep -> Sep, Oct, Nov (3 months)
          monthly_rent_paise: 150000, // ₹1,500/month
        },
        {
          id: "i",
          full_name: "Inactive Worker",
          worker_code: "BB-0002",
          status: "inactive",
          joining_date: "2026-11-01",
          monthly_rent_paise: 0, // No rent
        },
      ],
      rentCharges: [], // no manual charges!
      rentPayments: [
        {
          id: "rp1",
          worker_id: "a",
          period: "2026-09",
          paid_on: "2026-09-05",
          amount_paise: 150000,
          method: "cash",
          receipt_no: "BB-RNT-001",
          voided_at: null,
        },
      ],
    };

    const report = buildReport(autoRentData, "rent", "2026-11-01", "2026-11-30", "all");
    const waRow = report.rows.find((r) => r.workerId === "a");
    expect(waRow).toBeDefined();
    // 3 months * 1500 = 4500 charged, 1500 collected, 3000 due
    expect(waRow?.cells[4]).toBe(4500); // Charged (₹)
    expect(waRow?.cells[5]).toBe(1500); // Collected (₹)
    expect(waRow?.cells[6]).toBe(3000); // Due (₹)
    expect(waRow?.amount).toBe(300000); // 3000 rupees in paise

    const wiRow = report.rows.find((r) => r.workerId === "i");
    expect(wiRow).toBeDefined();
    expect(wiRow?.cells[4]).toBe(0);
    expect(wiRow?.amount).toBe(0);
  });

  it("filters workers with pending balances correctly", () => {
    const report = buildReport(data, "outstanding", "2026-11-11", "2026-11-11", "all");
    const withBalance = report.rows.filter((r) => Number(r.cells[6]) > 0);
    expect(report.rows.length).toBeGreaterThanOrEqual(withBalance.length);
    expect(withBalance.every((r) => Number(r.cells[6]) > 0)).toBe(true);
  });

  it("filters room rent report by accommodation (specific accommodation, none/unassigned, or all)", () => {
    const accRentData: ReportData = {
      ...data,
      workers: [
        {
          id: "w1",
          full_name: "Worker in Camp A",
          worker_code: "BB-0001",
          status: "active",
          joining_date: "2026-11-01",
          monthly_rent_paise: 200000,
          accommodation_id: "acc-camp-a",
        },
        {
          id: "w2",
          full_name: "Worker in Camp B",
          worker_code: "BB-0002",
          status: "active",
          joining_date: "2026-11-01",
          monthly_rent_paise: 150000,
          accommodation_id: "acc-camp-b",
        },
        {
          id: "w3",
          full_name: "Worker Without Camp",
          worker_code: "BB-0003",
          status: "active",
          joining_date: "2026-11-01",
          monthly_rent_paise: 100000,
          accommodation_id: null,
        },
      ],
      rentCharges: [],
      rentPayments: [],
    };

    // Filter by specific accommodation "acc-camp-a"
    const campAReport = buildReport(accRentData, "rent", "2026-11-01", "2026-11-30", "all", "", "acc-camp-a");
    expect(campAReport.rows).toHaveLength(1);
    expect(campAReport.rows[0]?.workerId).toBe("w1");
    expect(campAReport.rows[0]?.cells[3]).toBe(2000); // Monthly rent ₹2,000

    // Filter by specific accommodation "acc-camp-b"
    const campBReport = buildReport(accRentData, "rent", "2026-11-01", "2026-11-30", "all", "", "acc-camp-b");
    expect(campBReport.rows).toHaveLength(1);
    expect(campBReport.rows[0]?.workerId).toBe("w2");
    expect(campBReport.rows[0]?.cells[3]).toBe(1500); // Monthly rent ₹1,500

    // Filter by "none" (workers with no accommodation assigned)
    const unassignedReport = buildReport(accRentData, "rent", "2026-11-01", "2026-11-30", "all", "", "none");
    expect(unassignedReport.rows).toHaveLength(1);
    expect(unassignedReport.rows[0]?.workerId).toBe("w3");

    // All accommodations
    const allReport = buildReport(accRentData, "rent", "2026-11-01", "2026-11-30", "all", "", "");
    expect(allReport.rows).toHaveLength(3);
  });

  it("worker combobox search filter matches workers by name, worker code and handles empty search", () => {
    const workerFilter = (val: string, s: string, kw?: string[]) => {
      const q = s.trim().toLowerCase();
      if (!q) return 1;
      const text = (kw ? kw.join(" ") : val).toLowerCase();
      return text.includes(q) ? 1 : 0;
    };

    const worker = {
      id: "w-uuid-1",
      full_name: "Ramesh Kumar",
      worker_code: "BB-0105",
      status: "active",
    };
    const keywords = [worker.worker_code, worker.full_name, worker.status];

    // Search by name
    expect(workerFilter(worker.id, "ramesh", keywords)).toBe(1);
    expect(workerFilter(worker.id, "KUMAR", keywords)).toBe(1);
    // Search by code
    expect(workerFilter(worker.id, "0105", keywords)).toBe(1);
    expect(workerFilter(worker.id, "bb-0105", keywords)).toBe(1);
    // Empty search matches all
    expect(workerFilter(worker.id, "", keywords)).toBe(1);
    expect(workerFilter(worker.id, "   ", keywords)).toBe(1);
    // Non-matching query
    expect(workerFilter(worker.id, "suresh", keywords)).toBe(0);
    expect(workerFilter(worker.id, "9999", keywords)).toBe(0);

    // "All workers" item
    const allKeywords = ["all", "workers", "all workers", "All workers"];
    expect(workerFilter("all", "all", allKeywords)).toBe(1);
    expect(workerFilter("all", "worker", allKeywords)).toBe(1);
    expect(workerFilter("all", "xyz", allKeywords)).toBe(0);
  });
});