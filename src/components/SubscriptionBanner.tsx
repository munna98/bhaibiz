import { Phone, MessageSquare, AlertTriangle, AlertCircle } from "lucide-react";
import {
  SubscriptionStatus,
  SUPPORT_PHONE,
  SUPPORT_WHATSAPP_LINK,
} from "@/lib/subscription";
import { Button } from "@/components/ui/button";

interface SubscriptionBannerProps {
  status: SubscriptionStatus;
  companyName?: string;
}

export function SubscriptionBanner({ status, companyName }: SubscriptionBannerProps) {
  if (!status.showOwnerBanner || !status.message) return null;

  const isDanger = status.bannerTone === "danger";

  return (
    <div
      role="alert"
      className={`border-b px-4 py-3 text-sm transition-colors ${
        isDanger
          ? "bg-rose-50 border-rose-200 text-rose-950 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-100"
          : "bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-100"
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start md:items-center gap-2.5 min-w-0">
          {isDanger ? (
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 md:mt-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 md:mt-0" />
          )}
          <span className="font-medium text-xs sm:text-sm">{status.message}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {/* Call button */}
          <Button
            asChild
            size="sm"
            variant="outline"
            className={`h-8 text-xs font-semibold ${
              isDanger
                ? "border-rose-300 text-rose-800 hover:bg-rose-100 dark:border-rose-700 dark:text-rose-200"
                : "border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
            }`}
          >
            <a href={`tel:${SUPPORT_PHONE}`} className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              <span>Call {SUPPORT_PHONE}</span>
            </a>
          </Button>

          {/* WhatsApp button */}
          <Button
            asChild
            size="sm"
            className="h-8 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
          >
            <a
              href={SUPPORT_WHATSAPP_LINK(companyName)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>WhatsApp Support</span>
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
