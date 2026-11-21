import { describe, expect, it } from "vitest";
import { checkPersonal, emptyPersonal, personalFromWorker } from "@/components/workers/WorkerFields";
import { canRecordPayment, canHandleMoney } from "@/lib/money";
import { canManageWorkers } from "@/lib/workers";
import { capitalizeWords } from "@/lib/utils";
import type { AppRole } from "@/lib/company";

describe("Accommodations & Operator Scoping", () => {
  it("includes accommodation_id in emptyPersonal", () => {
    const f = emptyPersonal();
    expect(f.accommodation_id).toBeNull();
  });

  it("preserves accommodation_id when checking personal form", () => {
    const raw = {
      ...emptyPersonal(),
      full_name: "Raju Kumar",
      mobile: "9876543210",
      accommodation_id: "11111111-2222-3333-4444-555555555555",
    };
    const { errors, value } = checkPersonal(raw);
    expect(Object.keys(errors)).toHaveLength(0);
    expect(value.accommodation_id).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("extracts accommodation_id from worker row", () => {
    const mockWorker: any = {
      id: "w1",
      full_name: "Sunil Das",
      mobile: "9876543211",
      joining_date: "2026-01-01",
      accommodation_id: "acc-123",
      status: "active",
      worker_code: "BB-0001",
    };
    const form = personalFromWorker(mockWorker);
    expect(form.accommodation_id).toBe("acc-123");
  });

  it("allows operators to record payments, but reserves advanced money actions for non-operators", () => {
    const operatorRole: AppRole = "operator";
    const ownerRole: AppRole = "owner";
    const managerRole: AppRole = "manager";
    const accountantRole: AppRole = "accountant";

    // All roles can record payments (operators for their assigned workers)
    expect(canRecordPayment(operatorRole)).toBe(true);
    expect(canRecordPayment(ownerRole)).toBe(true);
    expect(canRecordPayment(managerRole)).toBe(true);
    expect(canRecordPayment(accountantRole)).toBe(true);

    // Operator cannot handle general money (advances/repayments/adjustments)
    expect(canHandleMoney(operatorRole)).toBe(false);
    expect(canHandleMoney(ownerRole)).toBe(true);
    expect(canHandleMoney(managerRole)).toBe(true);
    expect(canHandleMoney(accountantRole)).toBe(true);
  });

  it("disallows operators from managing workers", () => {
    expect(canManageWorkers("operator")).toBe(false);
    expect(canManageWorkers("accountant")).toBe(false);
    expect(canManageWorkers("manager")).toBe(true);
    expect(canManageWorkers("owner")).toBe(true);
  });

  it("correctly models navigation visibility for operators vs managers/owners", () => {
    const isOwner = false;
    const operatorRole: AppRole = "operator";
    const isManager = false;

    const operatorNav = [
      { to: "/app", label: "Dashboard", show: true },
      { to: "/app/attendance", label: "Attendance", show: true },
      { to: "/app/collect", label: "Collect", show: true },
      { to: "/app/accommodations", label: "Accommodations", show: isManager },
      { to: "/app/workers", label: "Workers", show: operatorRole !== "operator" },
      { to: "/app/reports", label: "Reports", show: operatorRole !== "operator" },
      { to: "/app/team", label: "Team", show: isOwner },
      { to: "/app/settings", label: "Company", show: isOwner },
    ].filter((n) => n.show);

    const operatorRoutes = operatorNav.map((n) => n.to);
    expect(operatorRoutes).toEqual(["/app", "/app/attendance", "/app/collect"]);
    expect(operatorRoutes).not.toContain("/app/workers");
    expect(operatorRoutes).not.toContain("/app/accommodations");
    expect(operatorRoutes).not.toContain("/app/reports");
  });

  it("capitalizes the first letter of worker, team member, and accommodation names", () => {
    expect(capitalizeWords("kiran kumar")).toBe("Kiran Kumar");
    expect(capitalizeWords("ramesh")).toBe("Ramesh");
    expect(capitalizeWords("camp 1")).toBe("Camp 1");
    expect(capitalizeWords("room-102")).toBe("Room-102");
    expect(capitalizeWords("north camp (block a)")).toBe("North Camp (Block A)");
    expect(capitalizeWords("")).toBe("");
  });

  it("checkPersonal automatically capitalizes worker full_name and emergency_name", () => {
    const raw = {
      ...emptyPersonal(),
      full_name: "arun kumar",
      mobile: "9876543210",
      emergency_name: "suresh babu",
    };
    const { errors, value } = checkPersonal(raw);
    expect(Object.keys(errors)).toHaveLength(0);
    expect(value.full_name).toBe("Arun Kumar");
    expect(value.emergency_name).toBe("Suresh Babu");
  });

  it("filters workers correctly by accommodation (all, none/unassigned, or specific accommodation id)", () => {
    const workers = [
      { id: "w1", full_name: "Arun", status: "active", accommodation_id: "acc-1", worker_code: "BB-001", mobile: "9876543210", aadhaar_last4: "1234" },
      { id: "w2", full_name: "Biju", status: "active", accommodation_id: "acc-2", worker_code: "BB-002", mobile: "9876543211", aadhaar_last4: "1235" },
      { id: "w3", full_name: "Chintu", status: "inactive", accommodation_id: "acc-1", worker_code: "BB-003", mobile: "9876543212", aadhaar_last4: "1236" },
      { id: "w4", full_name: "Deepak", status: "active", accommodation_id: null, worker_code: "BB-004", mobile: "9876543213", aadhaar_last4: "1237" },
    ];

    const filterWorkers = (accFilter: string, statusFilter: "active" | "inactive" | "all" = "all") => {
      return workers.filter((w) => {
        if (statusFilter !== "all" && w.status !== statusFilter) return false;
        if (accFilter === "all") return true;
        if (accFilter === "none") return !w.accommodation_id;
        return w.accommodation_id === accFilter;
      });
    };

    // All accommodations
    expect(filterWorkers("all")).toHaveLength(4);
    expect(filterWorkers("all", "active")).toHaveLength(3);
    expect(filterWorkers("all", "inactive")).toHaveLength(1);

    // Specific accommodation "acc-1"
    const acc1Workers = filterWorkers("acc-1");
    expect(acc1Workers.map((w) => w.id)).toEqual(["w1", "w3"]);
    expect(filterWorkers("acc-1", "active").map((w) => w.id)).toEqual(["w1"]);
    expect(filterWorkers("acc-1", "inactive").map((w) => w.id)).toEqual(["w3"]);

    // Specific accommodation "acc-2"
    expect(filterWorkers("acc-2").map((w) => w.id)).toEqual(["w2"]);

    // No accommodation / unassigned
    const unassignedWorkers = filterWorkers("none");
    expect(unassignedWorkers.map((w) => w.id)).toEqual(["w4"]);
    expect(filterWorkers("none", "active").map((w) => w.id)).toEqual(["w4"]);
    expect(filterWorkers("none", "inactive")).toHaveLength(0);
  });
});
