import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Building2, ChevronDown, ChevronRight, HardHat, Settings, Users } from "lucide-react";
import { useState } from "react";
import { useActiveMembership, REPORT_NAV_ITEMS } from "../app";
import { canViewReports } from "@/lib/report-data";
import { useT } from "@/lib/i18n";
import { LanguageSelect } from "@/components/LanguageSelect";

export const Route = createFileRoute("/_authenticated/app/more")({
  head: () => ({
    meta: [
      { title: "More — BhaiBiz" },
      { name: "description", content: "Company reports, language, and team." },
      { property: "og:title", content: "More — BhaiBiz" },
      { property: "og:description", content: "Company tools and language preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MorePage,
});

function MorePage() {
  const { active } = useActiveMembership();
  const t = useT();
  const [reportsOpen, setReportsOpen] = useState(false);

  const isOwner = active.role === "owner";
  const hasReports = canViewReports(active.role);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">{t("More")}</h1>
      <div className="mt-5 flex items-center justify-between border-y py-4">
        <span>{t("Language")}</span>
        <LanguageSelect />
      </div>

      <nav className="mt-4 divide-y">
        {hasReports && (
          <div className="py-2">
            <div className="flex items-center justify-between py-2">
              <Link
                to="/app/reports"
                search={{ kind: "outstanding" }}
                className="flex items-center gap-3 text-base font-semibold text-primary"
              >
                <BarChart3 className="h-5 w-5" />
                <span>{t("Reports")}</span>
              </Link>
              <button
                type="button"
                onClick={() => setReportsOpen((o) => !o)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label={reportsOpen ? t("Collapse reports") : t("Expand reports")}
              >
                {reportsOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
            </div>
            {reportsOpen && (
              <div className="ml-4 mt-1 grid gap-1 border-l pl-3">
                {REPORT_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.kind}
                    to="/app/reports"
                    search={{ kind: item.kind }}
                    className="flex items-center gap-2.5 py-2 text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    <item.icon className="h-4 w-4 text-primary/80" />
                    <span>{t(item.label)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {active.role !== "operator" && (
          <Link to="/app/workers" className="flex items-center gap-3 py-4 text-primary">
            <HardHat className="h-5 w-5" />
            {t("Workers")}
          </Link>
        )}

        {(isOwner || active.role === "manager") && (
          <Link to="/app/accommodations" className="flex items-center gap-3 py-4 text-primary">
            <Building2 className="h-5 w-5" />
            {t("Accommodations")}
          </Link>
        )}

        {isOwner && (
          <Link to="/app/team" className="flex items-center gap-3 py-4 text-primary">
            <Users className="h-5 w-5" />
            {t("Team")}
          </Link>
        )}

        {isOwner && (
          <Link to="/app/settings" className="flex items-center gap-3 py-4 text-primary">
            <Settings className="h-5 w-5" />
            {t("Company")}
          </Link>
        )}
      </nav>
    </div>
  );
}