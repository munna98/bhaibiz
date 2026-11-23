import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkerRent } from "@/components/rent/WorkerRent";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

describe("WorkerRent component UI", () => {
  it("renders with charges, payments and opens collect and adjust dialogs", async () => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Seed query cache with sample charges and payments
    qc.setQueryData(["worker-rent", "w1"], {
      charges: [
        {
          id: "rc1",
          company_id: "c1",
          worker_id: "w1",
          period: "2026-09",
          amount_paise: 50000,
          due_date: "2026-09-20",
          notes: "Prorated",
          created_by: "u1",
          created_at: "2026-09-20T00:00:00Z",
        },
      ],
      payments: [
        {
          id: "rp1",
          company_id: "c1",
          worker_id: "w1",
          period: "2026-09",
          amount_paise: 50000,
          paid_on: "2026-09-21",
          method: "cash",
          reference: "Paid at camp",
          receipt_no: "BB-RNT-2026-00001",
          recorded_by: "u1",
          created_at: "2026-09-21T00:00:00Z",
          voided_at: null,
          void_reason: null,
          voided_by: null,
        },
      ],
    });

    render(
      <QueryClientProvider client={qc}>
        <WorkerRent
          workerId="w1"
          companyId="c1"
          role="owner"
          monthlyRentPaise={150000}
          joiningDate="2026-08-15"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText("Monthly rent breakdown")).toBeDefined();
    expect(screen.getByText("Custom charge")).toBeDefined();
    expect(screen.getByText("BB-RNT-2026-00001")).toBeDefined();

    // Click "Adjust month rent" to open dialog
    const adjustBtn = screen.getByText("Adjust month rent");
    fireEvent.click(adjustBtn);
    expect(screen.getByText("Override the automatic rent charge for a specific month (e.g., proration, waiver, or special fee).")).toBeDefined();
  });

  it("handles null joiningDate and 0 monthlyRentPaise gracefully", () => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    qc.setQueryData(["worker-rent", "w2"], {
      charges: [],
      payments: [],
    });

    render(
      <QueryClientProvider client={qc}>
        <WorkerRent
          workerId="w2"
          companyId="c1"
          role="manager"
          monthlyRentPaise={0}
          joiningDate={null}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText("Monthly rent breakdown")).toBeDefined();
    expect(screen.getByText("No rent charges or payments recorded yet for this worker.")).toBeDefined();

    // Verify Set button is available when rent setting is None
    const setBtn = screen.getByText("Set");
    expect(setBtn).toBeDefined();
    fireEvent.click(setBtn);
    expect(screen.getByText("Set the recurring monthly accommodation rent for this worker. This will automatically accrue every active month.")).toBeDefined();
  });
});
