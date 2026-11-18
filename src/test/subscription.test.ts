import { describe, it, expect } from "vitest";
import { getSubscriptionStatus } from "@/lib/subscription";

describe("Subscription Status Calculation", () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  it("calculates accurate calendar days remaining for past creation dates", () => {
    const now = new Date();
    // 4 days ago -> 10 days remaining
    const d4 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4).toISOString();
    expect(getSubscriptionStatus({ created_at: d4 }).daysRemaining).toBe(10);

    // 2 days ago -> 12 days remaining
    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2).toISOString();
    expect(getSubscriptionStatus({ created_at: d2 }).daysRemaining).toBe(12);

    // 1 day ago -> 13 days remaining
    const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    expect(getSubscriptionStatus({ created_at: d1 }).daysRemaining).toBe(13);

    // Today -> 14 days remaining
    const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    expect(getSubscriptionStatus({ created_at: d0 }).daysRemaining).toBe(14);
  });

  it("does not show banner on days 1 to 12 of trial", () => {
    // Company created 3 days ago -> 11 days remaining
    const createdAt = new Date(Date.now() - 3 * ONE_DAY_MS).toISOString();
    const status = getSubscriptionStatus({ created_at: createdAt });

    expect(status.kind).toBe("trial_active");
    expect(status.isPaid).toBe(false);
    expect(status.isExpired).toBe(false);
    expect(status.daysRemaining).toBe(11);
    expect(status.showOwnerBanner).toBe(false);
    expect(status.bannerTone).toBe("none");
  });

  it("shows warning banner when trial expires tomorrow (<= 1 day remaining)", () => {
    // Company created 13 days ago -> 1 day remaining
    const createdAt = new Date(Date.now() - 13 * ONE_DAY_MS).toISOString();
    const status = getSubscriptionStatus({ created_at: createdAt });

    expect(status.kind).toBe("trial_expiring_soon");
    expect(status.isPaid).toBe(false);
    expect(status.isExpired).toBe(false);
    expect(status.daysRemaining).toBe(1);
    expect(status.showOwnerBanner).toBe(true);
    expect(status.bannerTone).toBe("warning");
    expect(status.message).toContain("expire tomorrow");
  });

  it("shows danger banner when trial has expired", () => {
    // Company created 15 days ago -> 0 days remaining, expired
    const createdAt = new Date(Date.now() - 15 * ONE_DAY_MS).toISOString();
    const status = getSubscriptionStatus({ created_at: createdAt });

    expect(status.kind).toBe("trial_expired");
    expect(status.isPaid).toBe(false);
    expect(status.isExpired).toBe(true);
    expect(status.daysRemaining).toBe(0);
    expect(status.showOwnerBanner).toBe(true);
    expect(status.bannerTone).toBe("danger");
    expect(status.message).toContain("expired");
  });

  it("does not show banner for active paid annual plan (> 7 days remaining)", () => {
    // Plan expires in 200 days
    const expiresAt = new Date(Date.now() + 200 * ONE_DAY_MS).toISOString();
    const status = getSubscriptionStatus({
      subscription_expires_at: expiresAt,
    });

    expect(status.kind).toBe("paid_active");
    expect(status.isPaid).toBe(true);
    expect(status.isExpired).toBe(false);
    expect(status.daysRemaining).toBe(200);
    expect(status.showOwnerBanner).toBe(false);
  });

  it("shows warning banner for active annual plan expiring within 7 days", () => {
    // Plan expires in 5 days
    const expiresAt = new Date(Date.now() + 5 * ONE_DAY_MS).toISOString();
    const status = getSubscriptionStatus({
      subscription_expires_at: expiresAt,
    });

    expect(status.kind).toBe("paid_expiring_soon");
    expect(status.isPaid).toBe(true);
    expect(status.isExpired).toBe(false);
    expect(status.daysRemaining).toBe(5);
    expect(status.showOwnerBanner).toBe(true);
    expect(status.bannerTone).toBe("warning");
    expect(status.message).toContain("5 days");
  });

  it("shows danger banner when annual plan has expired", () => {
    // Plan expired 2 days ago
    const expiresAt = new Date(Date.now() - 2 * ONE_DAY_MS).toISOString();
    const status = getSubscriptionStatus({
      subscription_expires_at: expiresAt,
    });

    expect(status.kind).toBe("paid_expired");
    expect(status.isPaid).toBe(true);
    expect(status.isExpired).toBe(true);
    expect(status.daysRemaining).toBe(0);
    expect(status.showOwnerBanner).toBe(true);
    expect(status.bannerTone).toBe("danger");
    expect(status.message).toContain("expired");
  });
});
