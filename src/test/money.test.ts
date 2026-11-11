import { describe, expect, it } from "vitest";
import { allocateFIFO, toBalance, totalOutstanding, validMoneyAmount, validMoneyDate } from "@/lib/money";

describe("payments clear the oldest days first", () => {
  const days = [
    { id: "b", work_date: "2026-11-09", unpaid: 15000 },
    { id: "a", work_date: "2026-11-08", unpaid: 15000 },
    { id: "c", work_date: "2026-11-10", unpaid: 15000 },
  ];
  it("₹300 against ₹450 due pays the two oldest days and leaves ₹150", () => {
    expect(allocateFIFO(days, 30000)).toEqual([
      { id: "a", work_date: "2026-11-08", take: 15000 },
      { id: "b", work_date: "2026-11-09", take: 15000 },
    ]);
  });
  it("a partial payment part-pays the oldest day", () => {
    expect(allocateFIFO(days, 10000)).toEqual([{ id: "a", work_date: "2026-11-08", take: 10000 }]);
  });
  it("skips days already paid", () => {
    expect(allocateFIFO([{ id: "a", work_date: "2026-11-01", unpaid: 0 }, ...days.slice(0, 1)], 5000)[0]?.id).toBe("b");
  });
});

it("outstanding = earned − collected − waivers/credits", () => {
  expect(toBalance({ worker_id: "w", status: "active", earned_paise: 45000, collected_paise: 30000, adjusted_paise: 5000, advance_balance_paise: 0 }).outstanding).toBe(10000);
});

it("dashboard total excludes inactive workers", () => {
  const b = (status: string, earned: number) => toBalance({ worker_id: status, status, earned_paise: earned, collected_paise: 0, adjusted_paise: 0, advance_balance_paise: 0 });
  expect(totalOutstanding([b("active", 20000), b("inactive", 90000)])).toBe(20000);
});

it("cannot collect ₹301 when only ₹300 is due", () => {
  expect(validMoneyAmount(30100, 30000)).toBe(false);
  expect(validMoneyAmount(30000, 30000)).toBe(true);
});

it("cannot repay ₹501 against a ₹500 advance balance", () => {
  expect(validMoneyAmount(50100, 50000)).toBe(false);
  expect(validMoneyAmount(50000, 50000)).toBe(true);
});

it("advance debt does not change commission outstanding", () => {
  const balance = toBalance({ worker_id: "w", status: "active", earned_paise: 45000, collected_paise: 30000, adjusted_paise: 0, advance_balance_paise: 50000 });
  expect(balance.outstanding).toBe(15000);
  expect(balance.advance).toBe(50000);
});

it("money dates must be present, valid and not future", () => {
  expect(validMoneyDate("", "2026-11-11")).toBe(false);
  expect(validMoneyDate("2026-11-12", "2026-11-11")).toBe(false);
  expect(validMoneyDate("2026-02-30", "2026-11-11")).toBe(false);
  expect(validMoneyDate("2026-11-11", "2026-11-11")).toBe(true);
});
