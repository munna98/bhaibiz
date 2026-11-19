import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  Wallet,
  HardHat,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  BarChart3,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Coins,
  CalendarDays,
  TrendingUp,
  ReceiptText,
  HandCoins,
  ShieldAlert,
  ArrowLeft,
  Building2,
} from "lucide-react";
import { useEffect, useState, createContext, useContext } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  myMembershipsQuery,
  myProfileQuery,
  pickActive,
  ROLE_LABELS,
  setActiveCompanyId,
  type MyMembership,
} from "@/lib/company";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useT } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { REPORT_CONFIG_ITEMS, type ReportKind } from "@/lib/report-data";
import { getImpersonatedCompany } from "@/lib/superadmin.functions";
import { isSuperAdminEmail } from "@/lib/superadmin";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { getSubscriptionStatus } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/app")({
  loader: async ({ context }) => {
    const email = (context as { email?: string }).email;
    if (isSuperAdminEmail(email)) {
      const activeCompany =
        typeof window !== "undefined" ? window.localStorage.getItem("bhaibiz.activeCompany") : null;
      if (activeCompany) return;
      throw redirect({ to: "/admin" });
    }
    const list = await context.queryClient.ensureQueryData(myMembershipsQuery());
    if (list.length === 0) throw redirect({ to: "/onboarding" });
  },
  component: AppShell,
});

const ActiveMembershipContext = createContext<{
  active: MyMembership;
  all: MyMembership[];
} | null>(null);

export function useActiveMembership() {
  const ctx = useContext(ActiveMembershipContext);
  if (ctx) return ctx;
  const { data } = useSuspenseQuery(myMembershipsQuery());
  const active = (pickActive(data) ?? data[0])!;
  return { active, all: data };
}

const REPORT_ICONS: Record<ReportKind, typeof Coins> = {
  outstanding: Coins,
  attendance: CalendarDays,
  earned: TrendingUp,
  collections: ReceiptText,
  advances: HandCoins,
};

export const REPORT_NAV_ITEMS = REPORT_CONFIG_ITEMS.map((item) => ({
  kind: item.value,
  label: item.label,
  icon: REPORT_ICONS[item.value],
  badge: item.badge,
  explanation: item.explanation,
}));

// ---------------------------------------------------------------------------
// AppShell — forks between super admin impersonation and normal tenant shell
// ---------------------------------------------------------------------------
function AppShell() {
  const { email } = Route.useRouteContext() as { email?: string };
  const isSuperAdmin = isSuperAdminEmail(email);
  return isSuperAdmin ? <SuperAdminImpersonationShell /> : <TenantAppShell />;
}

// ---------------------------------------------------------------------------
// SuperAdminImpersonationShell — fetches impersonated company via server fn
// and renders the full shell with an amber "exit" banner at the top
// ---------------------------------------------------------------------------
function SuperAdminImpersonationShell() {
  const navigate = useNavigate();
  const fetchCompany = useServerFn(getImpersonatedCompany);
  const [membership, setMembership] = useState<MyMembership | null>(null);
  const [loading, setLoading] = useState(true);

  const companyId =
    typeof window !== "undefined" ? window.localStorage.getItem("bhaibiz.activeCompany") : null;

  useEffect(() => {
    if (!companyId) {
      navigate({ to: "/admin" });
      return;
    }
    fetchCompany({ data: { companyId } })
      .then(setMembership)
      .catch(() => navigate({ to: "/admin" }))
      .finally(() => setLoading(false));
  }, [companyId, fetchCompany, navigate]);

  function exitImpersonation() {
    navigate({ to: "/admin" });
  }

  if (loading || !membership) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Impersonation banner */}
      <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            Super admin view — <strong>{membership.company.name}</strong>{" "}
            <span className="font-normal opacity-80">(read-only)</span>
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-white/50 bg-transparent text-white hover:bg-white/20 hover:text-white"
          onClick={exitImpersonation}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Exit
        </Button>
      </div>
      {/* Render the full app shell with the impersonated company */}
      <div className="flex flex-1 md:flex">
        <ShellContent active={membership} all={[membership]} onSignOut={exitImpersonation} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TenantAppShell — normal authenticated tenant path
// ---------------------------------------------------------------------------
function TenantAppShell() {
  const { active, all } = useActiveMembership();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <ShellContent active={active} all={all} onSignOut={signOut} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShellContent — shared sidebar / header / nav, accepts membership as props
// ---------------------------------------------------------------------------
function ShellContent({
  active,
  all,
  onSignOut,
}: {
  active: MyMembership;
  all: MyMembership[];
  onSignOut: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const isOwner = active.role === "owner";
  const t = useT();
  const { data: profile } = useQuery(myProfileQuery());
  const userDisplay =
    (profile?.username ? `@${profile.username}` : null) ??
    (profile?.email && !profile.email.endsWith("@staff.bhaibiz.internal") ? profile.email : null) ??
    profile?.full_name ??
    (profile?.email || "");

  const isReportsPath = location.pathname.startsWith("/app/reports");
  const currentReportKind = isReportsPath
    ? (location.search as Record<string, string | undefined>)?.["kind"] || "outstanding"
    : null;

  const [reportsOpen, setReportsOpen] = useState(isReportsPath);

  useEffect(() => {
    if (isReportsPath) setReportsOpen(true);
  }, [isReportsPath]);

  const switchCompany = async (id: string) => {
    setActiveCompanyId(id);
    await qc.invalidateQueries({ queryKey: ["my-memberships"] });
    await navigate({ to: "/app", search: {} });
  };

  const companyPicker =
    all.length > 1 ? (
      <Select value={active.company_id} onValueChange={switchCompany}>
        <SelectTrigger
          aria-label={t("Company")}
          className="mt-3 w-full border-sidebar-border bg-sidebar-accent text-sidebar-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {all.map((m) => (
            <SelectItem key={m.company_id} value={m.company_id}>
              {m.company_name || m.company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <div className="mt-3 truncate text-sm font-medium">
        {active.company_name || active.company.name}
      </div>
    );

  const isManager = active.role === "owner" || active.role === "manager";

  const nav = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/app/attendance", label: "Attendance", icon: CalendarCheck, show: true },
    { to: "/app/collect", label: "Collect", icon: Wallet, show: true },
    { to: "/app/workers", label: "Workers", icon: HardHat, show: active.role !== "operator" },
    { to: "/app/accommodations", label: "Accommodations", icon: Building2, show: isManager },
    { to: "/app/reports", label: "Reports", icon: BarChart3, show: active.role !== "operator" },
    { to: "/app/team", label: "Team", icon: Users, show: isOwner },
    { to: "/app/settings", label: "Company", icon: Settings, show: isOwner },
  ] as const;

  const mobileNav = [
    ...nav.filter((n) => n.show).slice(0, 4),
    { to: "/app/more", label: "More", icon: MoreHorizontal, show: true },
  ] as const;

  const subStatus = getSubscriptionStatus(active.company);

  return (
    <ActiveMembershipContext.Provider value={{ active, all }}>
      <aside className="app-navigation hidden w-60 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="text-xl font-bold text-sidebar-primary font-[family-name:var(--font-display)]">
          BhaiBiz
        </div>
        {companyPicker}
        {userDisplay && (
          <div className="text-xs opacity-70 truncate mt-0.5" title={userDisplay}>
            {userDisplay}
          </div>
        )}
        <div className="mt-4 text-sidebar-foreground">
          <LanguageSelect />
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav
            .filter((n) => n.show)
            .map((n) => {
              if (n.to === "/app/reports") {
                return (
                  <div key="/app/reports" className="flex flex-col">
                    <div
                      className={`flex items-center justify-between rounded-md transition-colors ${
                        isReportsPath
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      <Link
                        to="/app/reports"
                        search={{ kind: currentReportKind || "outstanding" }}
                        className="flex flex-1 items-center gap-2 px-3 py-2 text-sm"
                        onClick={() => setReportsOpen(true)}
                      >
                        <BarChart3 className="h-4 w-4 shrink-0" />
                        <span>{t("Reports")}</span>
                      </Link>
                      <button
                        type="button"
                        aria-label={reportsOpen ? t("Collapse reports") : t("Expand reports")}
                        className="mr-1 rounded p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setReportsOpen((prev) => !prev);
                        }}
                      >
                        {reportsOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {reportsOpen && (
                      <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-sidebar-border/60 pl-2">
                        {REPORT_NAV_ITEMS.map((sub) => {
                          const isSubActive = isReportsPath && currentReportKind === sub.kind;
                          return (
                            <Link
                              key={sub.kind}
                              to="/app/reports"
                              search={{ kind: sub.kind }}
                              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                                isSubActive
                                  ? "bg-sidebar-accent/80 font-medium text-sidebar-primary shadow-xs"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                              }`}
                            >
                              <sub.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                              <span className="truncate">{t(sub.label)}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={n.to}
                  to={n.to}
                  activeOptions={{ exact: n.to === "/app" }}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary"
                >
                  <n.icon className="h-4 w-4" /> {t(n.label)}
                </Link>
              );
            })}
        </nav>
        <Button
          variant="ghost"
          className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={onSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" /> {t("Sign out")}
        </Button>
      </aside>

      <header className="app-navigation flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <div className="min-w-0 flex-1 pr-3">
          <div className="font-bold text-sidebar-primary">BhaiBiz</div>
          {companyPicker}
          {userDisplay && (
            <div className="text-xs opacity-80 truncate mt-0.5" title={userDisplay}>
              {userDisplay}
            </div>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("Sign out")}
          onClick={onSignOut}
          className="hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 flex flex-col min-w-0">
        {active.role === "owner" && (
          <SubscriptionBanner
            status={subStatus}
            companyName={active.company_name || active.company.name}
          />
        )}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8 print:p-0">
          <Outlet key={active.company_id} />
        </main>
      </div>

      <nav className="app-navigation fixed inset-x-0 bottom-0 flex border-t bg-card md:hidden">
        {mobileNav
          .filter((n) => n.show)
          .map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/app" }}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground data-[status=active]:text-primary"
            >
              <n.icon className="h-5 w-5" />
              <span className="mobile-nav-label">{t(n.label)}</span>
            </Link>
          ))}
      </nav>
    </ActiveMembershipContext.Provider>
  );
}

