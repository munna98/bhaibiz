import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarCheck, Wallet, HardHat, LayoutDashboard, LogOut, Settings, Users, BarChart3, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myMembershipsQuery, pickActive, ROLE_LABELS, setActiveCompanyId } from "@/lib/company";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useT } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  loader: async ({ context }) => {
    const list = await context.queryClient.ensureQueryData(myMembershipsQuery());
    if (list.length === 0) throw redirect({ to: "/onboarding" });
  },
  component: AppShell,
});

export function useActiveMembership() {
  const { data } = useSuspenseQuery(myMembershipsQuery());
  const active = pickActive(data);
  if (!active) throw redirect({ to: "/onboarding" });
  return { active, all: data };
}

function AppShell() {
  const { active, all } = useActiveMembership();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isOwner = active.role === "owner";
  const t = useT();
  const switchCompany = async (id: string) => {
    setActiveCompanyId(id);
    await qc.invalidateQueries({ queryKey: ["my-memberships"] });
    await navigate({ to: "/app", search: {} });
  };
  const companyPicker = all.length > 1 ? <Select value={active.company_id} onValueChange={switchCompany}>
    <SelectTrigger aria-label={t("Company")} className="mt-3 w-full border-sidebar-border bg-sidebar-accent text-sidebar-foreground"><SelectValue /></SelectTrigger>
    <SelectContent>{all.map(m => <SelectItem key={m.company_id} value={m.company_id}>{m.company.name}</SelectItem>)}</SelectContent>
  </Select> : <div className="mt-3 truncate text-sm font-medium">{active.company.name}</div>;

  const nav = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/app/attendance", label: "Attendance", icon: CalendarCheck, show: true },
    { to: "/app/collect", label: "Collect", icon: Wallet, show: active.role !== "operator" },
    { to: "/app/workers", label: "Workers", icon: HardHat, show: true },
    { to: "/app/reports", label: "Reports", icon: BarChart3, show: active.role !== "operator" },
    // Temporarily hidden from the sidebar; retain the audit page for later introduction.
    // { to: "/app/audit", label: "Audit history", icon: History, show: isOwner },
    { to: "/app/team", label: "Team", icon: Users, show: isOwner },
    { to: "/app/settings", label: "Company", icon: Settings, show: isOwner },
  ] as const;

  const mobileNav = [...nav.slice(0, 4), { to: "/app/more", label: "More", icon: MoreHorizontal, show: true }] as const;

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="app-navigation hidden w-60 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="text-xl font-bold text-sidebar-primary font-[family-name:var(--font-display)]">BhaiBiz</div>
        {companyPicker}
        <div className="text-xs opacity-70">{t(ROLE_LABELS[active.role])}</div>
        <div className="mt-4 text-sidebar-foreground"><LanguageSelect /></div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav.filter((n) => n.show).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/app" }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary"
            >
              <n.icon className="h-4 w-4" /> {t(n.label)}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> {t("Sign out")}
        </Button>
      </aside>

      <header className="app-navigation flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <div className="min-w-0 flex-1 pr-3">
          <div className="font-bold text-sidebar-primary">BhaiBiz</div>
          {companyPicker}
          <div className="text-xs opacity-80">{t(ROLE_LABELS[active.role])}</div>
        </div>
        <Button size="icon" variant="ghost" aria-label={t("Sign out")} onClick={signOut} className="hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-8 print:p-0">
        <Outlet key={active.company_id} />
      </main>

      <nav className="app-navigation fixed inset-x-0 bottom-0 flex border-t bg-card md:hidden">
        {mobileNav.filter((n) => n.show).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/app" }}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground data-[status=active]:text-primary"
          >
            <n.icon className="h-5 w-5" /><span className="mobile-nav-label">{t(n.label)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
