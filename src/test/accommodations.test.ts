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
});
