export type SubscriptionStatusKind =
  | "trial_active"
  | "trial_expiring_soon"
  | "trial_expired"
  | "paid_active"
  | "paid_expiring_soon"
  | "paid_expired";

export interface SubscriptionStatus {
  kind: SubscriptionStatusKind;
  isPaid: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialEndsAt: string;
  subscriptionExpiresAt: string | null;
  message: string | null;
  showOwnerBanner: boolean;
  bannerTone: "warning" | "danger" | "none";
}

export const SUPPORT_PHONE = "8086094070";

export const SUPPORT_WHATSAPP_LINK = (companyName?: string) => {
  const text = companyName
    ? `Hi BhaiBiz, I want to activate/renew the subscription for my company: ${companyName}`
    : "Hi BhaiBiz, I want to activate/renew my subscription";
  return `https://wa.me/918086094070?text=${encodeURIComponent(text)}`;
};

/**
 * Calculates calendar days difference between target date and fromDate (defaulting to today).
 * Both dates are compared at midnight boundary so days are accurate calendar days.
 */
export function getCalendarDaysRemaining(
  targetDate: string | Date | number,
  fromDate?: string | Date | number
): number {
  const target = new Date(targetDate);
  const from = fromDate ? new Date(fromDate) : new Date();

  const targetMidnight = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();

  const fromMidnight = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate()
  ).getTime();

  return Math.round((targetMidnight - fromMidnight) / (24 * 60 * 60 * 1000));
}

/**
 * Calculates current subscription state based on trial and annual plan expiry dates.
 *
 * Rules:
 * - 14-day free trial strictly calculated from company creation date (created_at).
 * - Days 1-12 of trial: no banner shown (`showOwnerBanner: false`).
 * - Day 13 (expires tomorrow, 1 day left): warning banner (`showOwnerBanner: true`, tone: warning).
 * - Day 14+ (trial ended, <= 0 days): expired banner (`showOwnerBanner: true`, tone: danger).
 * - Paid annual activation: expires after 1 year.
 * - <= 7 days before annual expiry: warning banner (`showOwnerBanner: true`, tone: warning).
 * - After annual expiry: expired banner (`showOwnerBanner: true`, tone: danger).
 */
export function getSubscriptionStatus(company: {
  created_at?: string;
  trial_ends_at?: string | null;
  subscription_expires_at?: string | null;
  subscription_notes?: string | null;
}): SubscriptionStatus {
  const now = Date.now();
  const createdAtMs = company.created_at ? new Date(company.created_at).getTime() : now;

  // If trial was manually extended by super admin, respect trial_ends_at.
  // Otherwise, 14-day trial is strictly 14 calendar days from creation date.
  const isManuallyExtended = !!(
    company.subscription_notes && company.subscription_notes.includes("Trial extended")
  );

  let trialEndsMs: number;
  if (isManuallyExtended && company.trial_ends_at) {
    trialEndsMs = new Date(company.trial_ends_at).getTime();
  } else if (company.created_at) {
    const createdDate = new Date(company.created_at);
    const trialEndDate = new Date(
      createdDate.getFullYear(),
      createdDate.getMonth(),
      createdDate.getDate() + 14,
      createdDate.getHours(),
      createdDate.getMinutes(),
      createdDate.getSeconds()
    );
    trialEndsMs = trialEndDate.getTime();
  } else {
    trialEndsMs = createdAtMs + 14 * 24 * 60 * 60 * 1000;
  }

  const subExpiresMs = company.subscription_expires_at
    ? new Date(company.subscription_expires_at).getTime()
    : null;

  // Case 1: Paid Annual Plan
  if (subExpiresMs !== null) {
    const daysRemaining = getCalendarDaysRemaining(subExpiresMs, now);

    if (daysRemaining <= 0) {
      return {
        kind: "paid_expired",
        isPaid: true,
        isExpired: true,
        daysRemaining: 0,
        trialEndsAt: new Date(trialEndsMs).toISOString(),
        subscriptionExpiresAt: new Date(subExpiresMs).toISOString(),
        message: "Your annual subscription has expired. Please contact support to renew your plan.",
        showOwnerBanner: true,
        bannerTone: "danger",
      };
    }

    if (daysRemaining <= 7) {
      return {
        kind: "paid_expiring_soon",
        isPaid: true,
        isExpired: false,
        daysRemaining,
        trialEndsAt: new Date(trialEndsMs).toISOString(),
        subscriptionExpiresAt: new Date(subExpiresMs).toISOString(),
        message:
          daysRemaining === 1
            ? "Your annual subscription will expire tomorrow! Contact support to renew your plan."
            : `Your annual subscription will expire in ${daysRemaining} days. Contact support to renew your plan.`,
        showOwnerBanner: true,
        bannerTone: "warning",
      };
    }

    return {
      kind: "paid_active",
      isPaid: true,
      isExpired: false,
      daysRemaining,
      trialEndsAt: new Date(trialEndsMs).toISOString(),
      subscriptionExpiresAt: new Date(subExpiresMs).toISOString(),
      message: null,
      showOwnerBanner: false,
      bannerTone: "none",
    };
  }

  // Case 2: Free 14-Day Trial
  const daysTrialRemaining = getCalendarDaysRemaining(trialEndsMs, now);

  if (daysTrialRemaining <= 0) {
    return {
      kind: "trial_expired",
      isPaid: false,
      isExpired: true,
      daysRemaining: 0,
      trialEndsAt: new Date(trialEndsMs).toISOString(),
      subscriptionExpiresAt: null,
      message: "Your 14-day free trial has expired. Please contact support to activate your annual plan.",
      showOwnerBanner: true,
      bannerTone: "danger",
    };
  }

  // 1 day remaining: warn owner (Day 13)
  if (daysTrialRemaining <= 1) {
    return {
      kind: "trial_expiring_soon",
      isPaid: false,
      isExpired: false,
      daysRemaining: daysTrialRemaining,
      trialEndsAt: new Date(trialEndsMs).toISOString(),
      subscriptionExpiresAt: null,
      message: "Your 14-day free trial will expire tomorrow! Contact support to activate your annual plan.",
      showOwnerBanner: true,
      bannerTone: "warning",
    };
  }

  // Days 1-12: Normal trial — no banner needed per user instructions
  return {
    kind: "trial_active",
    isPaid: false,
    isExpired: false,
    daysRemaining: daysTrialRemaining,
    trialEndsAt: new Date(trialEndsMs).toISOString(),
    subscriptionExpiresAt: null,
    message: null,
    showOwnerBanner: false,
    bannerTone: "none",
  };
}

export function getSubscriptionBadge(status: SubscriptionStatus): {
  label: string;
  badgeClass: string;
  isAttention: boolean;
} {
  switch (status.kind) {
    case "paid_active":
      return {
        label: `Active Paid (${status.daysRemaining}d left)`,
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
        isAttention: false,
      };
    case "paid_expiring_soon":
      return {
        label: `Paid: Expires in ${status.daysRemaining}d!`,
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 animate-pulse",
        isAttention: true,
      };
    case "paid_expired":
      return {
        label: "Plan Expired",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
        isAttention: true,
      };
    case "trial_expiring_soon":
      return {
        label: "Trial Expires Tomorrow!",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 animate-pulse",
        isAttention: true,
      };
    case "trial_expired":
      return {
        label: "Trial Expired",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
        isAttention: true,
      };
    case "trial_active":
    default:
      return {
        label: `Trial (${status.daysRemaining}d left)`,
        badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
        isAttention: false,
      };
  }
}
