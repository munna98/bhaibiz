import { describe, expect, it, vi, beforeEach } from "vitest";
import { formatReceiptNo, pickActive, myMembershipsQuery, type MyMembership } from "@/lib/company";

const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              order: (...orderArgs: unknown[]) => mockOrder(...orderArgs),
            };
          },
        };
      },
    }),
  },
}));

describe("Company and Membership utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("formats receipt number correctly", () => {
    expect(formatReceiptNo("RCPT", 2026, 42)).toBe("RCPT-2026-00042");
    expect(formatReceiptNo("AB", 2025, 1)).toBe("AB-2025-00001");
  });

  it("pickActive selects membership based on saved activeCompanyId", () => {
    const list: MyMembership[] = [
      {
        company_id: "comp-1",
        company_name: "Company One",
        role: "owner",
        company: { id: "comp-1", name: "Company One", phone: null, address: null, receipt_prefix: "RCPT" },
      },
      {
        company_id: "comp-2",
        company_name: "Company Two",
        role: "manager",
        company: { id: "comp-2", name: "Company Two", phone: null, address: null, receipt_prefix: "RCPT" },
      },
    ];

    expect(pickActive(list)?.company_id).toBe("comp-1");

    localStorage.setItem("bhaibiz.activeCompany", "comp-2");
    expect(pickActive(list)?.company_id).toBe("comp-2");
    expect(pickActive(list)?.company_name).toBe("Company Two");
  });

  it("myMembershipsQuery requests company_name in select query", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRpc.mockResolvedValueOnce({ data: 0, error: null });
    const mockData: MyMembership[] = [
      {
        company_id: "comp-1",
        company_name: "Alpha Corp",
        role: "owner",
        company: { id: "comp-1", name: "Alpha Corp", phone: null, address: null, receipt_prefix: "ALPH" },
      },
    ];
    mockOrder.mockResolvedValueOnce({ data: mockData, error: null });

    const query = myMembershipsQuery();
    expect(query.queryKey).toEqual(["my-memberships"]);

    const result = await (query.queryFn as () => Promise<MyMembership[]>)();
    expect(mockSelect).toHaveBeenCalledWith(
      "company_id, company_name, role, company:companies(id, name, phone, address, receipt_prefix)"
    );
    expect(result).toHaveLength(1);
    expect(result[0].company_name).toBe("Alpha Corp");
  });
});
