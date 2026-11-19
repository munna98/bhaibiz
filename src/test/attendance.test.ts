import { describe, expect, it } from "vitest";
import {
  addDays,
  canEditDate,
  computeDayPaymentStatus,
  needsReason,
  nextTileStatus,
  summarize,
} from "@/lib/attendance";

const today = "2026-11-10";

describe("who can mark which dates", () => {
  it("operators can mark today and yesterday only", () => {
    expect(canEditDate("operator", today, today)).toBe(true);
    expect(canEditDate("operator", "2026-11-09", today)).toBe(true);
    expect(canEditDate("operator", "2026-11-08", today)).toBe(false);
  });
  it("managers and owners can mark older dates", () => {
    expect(canEditDate("manager", "2026-10-01", today)).toBe(true);
    expect(canEditDate("owner", "2026-01-01", today)).toBe(true);
  });
  it("nobody can mark a future date", () => {
    expect(canEditDate("owner", "2026-11-11", today)).toBe(false);
  });
  it("accountants cannot mark attendance", () => {
    expect(canEditDate("accountant", today, today)).toBe(false);
  });
});

describe("corrections", () => {
  it("changing a past marked day needs a reason", () => {
    expect(needsReason("worked", "not_worked", "2026-11-09", today)).toBe(true);
  });
  it("first marking or today's change needs no reason", () => {
    expect(needsReason("pending", "worked", "2026-11-09", today)).toBe(false);
    expect(needsReason("worked", "not_worked", today, today)).toBe(false);
  });
});

it("counts unmarked workers as pending", () => {
  expect(summarize(["worked", "worked", "not_worked", "pending"])).toEqual({ total: 4, worked: 2, not_worked: 1, pending: 1 });
});

it("addDays crosses month ends", () => {
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
});

describe("tile view status cycling", () => {
  it("defaults pending to worked on first tap", () => {
    expect(nextTileStatus("pending")).toBe("worked");
  });
  it("toggles worked to not_worked", () => {
    expect(nextTileStatus("worked")).toBe("not_worked");
  });
  it("toggles not_worked back to worked", () => {
    expect(nextTileStatus("not_worked")).toBe("worked");
  });
});

describe("computeDayPaymentStatus", () => {
  it("returns paid when commission entry is fully allocated", () => {
    expect(
      computeDayPaymentStatus({
        mark: "worked",
        outstanding: 50000,
        hasPaymentOnDate: false,
        entryAmount: 50000,
        allocatedAmount: 50000,
      }),
    ).toBe("paid");
  });

  it("returns paid when a payment occurred on that date", () => {
    expect(
      computeDayPaymentStatus({
        mark: "worked",
        outstanding: 50000,
        hasPaymentOnDate: true,
        entryAmount: 50000,
        allocatedAmount: 0,
      }),
    ).toBe("paid");
  });

  it("returns paid when total outstanding is zero", () => {
    expect(
      computeDayPaymentStatus({
        mark: "worked",
        outstanding: 0,
        hasPaymentOnDate: false,
        entryAmount: 50000,
        allocatedAmount: 0,
      }),
    ).toBe("paid");
  });

  it("returns partial when commission entry is partially allocated", () => {
    expect(
      computeDayPaymentStatus({
        mark: "worked",
        outstanding: 30000,
        hasPaymentOnDate: false,
        entryAmount: 50000,
        allocatedAmount: 20000,
      }),
    ).toBe("partial");
  });

  it("returns unpaid when worked but unallocated with positive outstanding and no payment on date", () => {
    expect(
      computeDayPaymentStatus({
        mark: "worked",
        outstanding: 50000,
        hasPaymentOnDate: false,
        entryAmount: 50000,
        allocatedAmount: 0,
      }),
    ).toBe("unpaid");
  });

  it("returns paid when not worked and outstanding is zero", () => {
    expect(
      computeDayPaymentStatus({
        mark: "not_worked",
        outstanding: 0,
        hasPaymentOnDate: false,
      }),
    ).toBe("paid");
  });

  it("returns paid when not worked but payment was made on that date", () => {
    expect(
      computeDayPaymentStatus({
        mark: "not_worked",
        outstanding: 25000,
        hasPaymentOnDate: true,
      }),
    ).toBe("paid");
  });

  it("returns unpaid when not worked but has past outstanding and no payment on date", () => {
    expect(
      computeDayPaymentStatus({
        mark: "not_worked",
        outstanding: 25000,
        hasPaymentOnDate: false,
      }),
    ).toBe("unpaid");
  });

  it("returns paid when pending and outstanding is zero", () => {
    expect(
      computeDayPaymentStatus({
        mark: "pending",
        outstanding: 0,
        hasPaymentOnDate: false,
      }),
    ).toBe("paid");
  });

  it("returns unpaid when pending with positive outstanding and no payment on date", () => {
    expect(
      computeDayPaymentStatus({
        mark: "pending",
        outstanding: 15000,
        hasPaymentOnDate: false,
      }),
    ).toBe("unpaid");
  });
});
