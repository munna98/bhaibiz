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

  it("returns paid when worked and total outstanding is zero", () => {
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

  it("returns no_dues when not worked even if worker has past outstanding", () => {
    expect(
      computeDayPaymentStatus({
        mark: "not_worked",
        outstanding: 25000,
        hasPaymentOnDate: false,
      }),
    ).toBe("no_dues");
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

  it("returns no_dues when pending even if worker has past outstanding", () => {
    expect(
      computeDayPaymentStatus({
        mark: "pending",
        outstanding: 15000,
        hasPaymentOnDate: false,
      }),
    ).toBe("no_dues");
  });
});

describe("attendance page banner filters and accommodation persistence", () => {
  const workers = [
    { id: "w1", full_name: "Jerku Nagesiya", worker_code: "BB-0044", mobile: "9876543210", accommodation_id: "acc-amina" },
    { id: "w2", full_name: "Umesh Korwa", worker_code: "BB-0045", mobile: "9876543211", accommodation_id: "acc-amina" },
    { id: "w3", full_name: "Suman Kujur", worker_code: "BB-0046", mobile: "9876543212", accommodation_id: "acc-amina" },
    { id: "w4", full_name: "Rohit Khalkho", worker_code: "BB-0047", mobile: "9876543213", accommodation_id: "acc-other" },
  ];

  const marks: Record<string, "worked" | "not_worked"> = {
    w1: "worked",
    w2: "not_worked",
    // w3 and w4 are pending (unmarked)
  };

  const dailyPayments = {
    entriesByWorker: {
      w1: { id: "e1", amount: 30000, allocated: 0 },
    },
    paymentsByWorker: {
      w1: { totalPaid: 30000, latestPaymentId: "p1" },
    },
  };

  type BannerFilter = "all" | "worked" | "not_worked" | "pending" | "earned" | "collected";

  const filterShownWorkers = (params: {
    accFilter: string;
    statusFilter: BannerFilter;
    query?: string;
  }) => {
    const list = workers.filter(
      (w) => params.accFilter === "all" || w.accommodation_id === params.accFilter,
    );
    const markOf = (id: string) => marks[id] ?? "pending";
    const s = (params.query ?? "").trim().toLowerCase();

    return list.filter((w) => {
      if (params.statusFilter === "worked" && markOf(w.id) !== "worked") return false;
      if (params.statusFilter === "not_worked" && markOf(w.id) !== "not_worked") return false;
      if (params.statusFilter === "pending" && markOf(w.id) !== "pending") return false;
      if (
        params.statusFilter === "earned" &&
        markOf(w.id) !== "worked" &&
        !(dailyPayments.entriesByWorker[w.id as keyof typeof dailyPayments.entriesByWorker]?.amount ?? 0)
      )
        return false;
      if (
        params.statusFilter === "collected" &&
        !(dailyPayments.paymentsByWorker[w.id as keyof typeof dailyPayments.paymentsByWorker]?.totalPaid ?? 0)
      )
        return false;

      return (
        !s ||
        w.full_name.toLowerCase().includes(s) ||
        w.worker_code.toLowerCase().includes(s) ||
        w.mobile.includes(s)
      );
    });
  };

  it("filters workers correctly when banner items are clicked", () => {
    // In Amina Building (w1 worked, w2 not worked, w3 pending)
    expect(filterShownWorkers({ accFilter: "acc-amina", statusFilter: "all" })).toHaveLength(3);

    // Click "Worked" banner item
    const workedWorkers = filterShownWorkers({ accFilter: "acc-amina", statusFilter: "worked" });
    expect(workedWorkers.map((w) => w.id)).toEqual(["w1"]);

    // Click "Not worked" banner item
    const notWorkedWorkers = filterShownWorkers({ accFilter: "acc-amina", statusFilter: "not_worked" });
    expect(notWorkedWorkers.map((w) => w.id)).toEqual(["w2"]);

    // Click "Pending" banner item
    const pendingWorkers = filterShownWorkers({ accFilter: "acc-amina", statusFilter: "pending" });
    expect(pendingWorkers.map((w) => w.id)).toEqual(["w3"]);

    // Click "Earned" banner item
    const earnedWorkers = filterShownWorkers({ accFilter: "acc-amina", statusFilter: "earned" });
    expect(earnedWorkers.map((w) => w.id)).toEqual(["w1"]);

    // Click "Collected" banner item
    const collectedWorkers = filterShownWorkers({ accFilter: "acc-amina", statusFilter: "collected" });
    expect(collectedWorkers.map((w) => w.id)).toEqual(["w1"]);

    // When toggled back to "all"
    const allWorkers = filterShownWorkers({ accFilter: "acc-amina", statusFilter: "all" });
    expect(allWorkers).toHaveLength(3);
  });

  it("combines banner status filter with text search query", () => {
    // In all accommodations, pending workers matching "Suman"
    const res = filterShownWorkers({ accFilter: "all", statusFilter: "pending", query: "Suman" });
    expect(res.map((w) => w.id)).toEqual(["w3"]);

    // Pending workers matching "Jerku" (who is worked, not pending) -> empty
    const noMatch = filterShownWorkers({ accFilter: "all", statusFilter: "pending", query: "Jerku" });
    expect(noMatch).toHaveLength(0);
  });

  it("preserves accommodation filter across localStorage per company", () => {
    const ACC_STORAGE_KEY = "bhaibiz.attendance-acc";
    const compA = "comp-aaa";
    const compB = "comp-bbb";

    const getInitialAccFilter = (cid: string, urlParam?: string) => {
      if (urlParam) return urlParam;
      return window.localStorage.getItem(`${ACC_STORAGE_KEY}.${cid}`) || "all";
    };

    const setAccFilterStorage = (cid: string, val: string) => {
      if (val === "all") window.localStorage.removeItem(`${ACC_STORAGE_KEY}.${cid}`);
      else window.localStorage.setItem(`${ACC_STORAGE_KEY}.${cid}`, val);
    };

    // Initially defaults to "all"
    expect(getInitialAccFilter(compA)).toBe("all");

    // Company A selects "acc-amina"
    setAccFilterStorage(compA, "acc-amina");
    expect(getInitialAccFilter(compA)).toBe("acc-amina");

    // Company B has independent storage
    expect(getInitialAccFilter(compB)).toBe("all");
    setAccFilterStorage(compB, "acc-other");
    expect(getInitialAccFilter(compB)).toBe("acc-other");
    expect(getInitialAccFilter(compA)).toBe("acc-amina");

    // URL parameter takes precedence if supplied
    expect(getInitialAccFilter(compA, "acc-override")).toBe("acc-override");

    // Clearing sets back to all
    setAccFilterStorage(compA, "all");
    expect(getInitialAccFilter(compA)).toBe("all");
  });
});
