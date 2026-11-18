import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listTenants } from "@/lib/superadmin.functions";
import {
  Building2,
  Users,
  HardHat,
  LogOut,
  ArrowRight,
  TrendingUp,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getSubscriptionBadge } from "@/lib/subscription";

export const Route = createFileRoute("/_superadmin/admin/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Admin — BhaiBiz" }],
  }),
  component: AdminDashboard,
});

type Tenant = Awaited<ReturnType<typeof listTenants>>[number];

function AdminDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchTenants = useServerFn(listTenants);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "attention" | "paid" | "trial" | "expired">("all");

  useEffect(() => {
    fetchTenants()
      .then(setTenants)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [fetchTenants]);

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }

  const totalCompanies = tenants.length;
  const paidTenants = tenants.filter(
    (t) => t.subscription_status.isPaid && !t.subscription_status.isExpired
  );
  const trialTenants = tenants.filter(
    (t) => !t.subscription_status.isPaid && !t.subscription_status.isExpired
  );
  const attentionTenants = tenants.filter(
    (t) =>
      t.subscription_status.isExpired ||
      t.subscription_status.kind === "trial_expiring_soon" ||
      t.subscription_status.kind === "paid_expiring_soon"
  );
  const expiredTenants = tenants.filter((t) => t.subscription_status.isExpired);

  const filteredTenants = tenants.filter((t) => {
    if (filter === "attention") {
      return (
        t.subscription_status.isExpired ||
        t.subscription_status.kind === "trial_expiring_soon" ||
        t.subscription_status.kind === "paid_expiring_soon"
      );
    }
    if (filter === "paid") {
      return t.subscription_status.isPaid && !t.subscription_status.isExpired;
    }
    if (filter === "trial") {
      return !t.subscription_status.isPaid && !t.subscription_status.isExpired;
    }
    if (filter === "expired") {
      return t.subscription_status.isExpired;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-0.5">
            BhaiBiz
          </div>
          <h1 className="text-xl font-bold text-primary">Super Admin</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Total Companies",
              value: totalCompanies,
              icon: Building2,
              color: "text-foreground",
            },
            {
              label: "Active Paid Plans",
              value: paidTenants.length,
              icon: CheckCircle2,
              color: "text-emerald-600",
            },
            {
              label: "On 14-Day Trial",
              value: trialTenants.length,
              icon: Clock,
              color: "text-blue-600",
            },
            {
              label: "Needs Attention",
              value: attentionTenants.length,
              icon: AlertTriangle,
              color: attentionTenants.length > 0 ? "text-amber-600 animate-pulse" : "text-muted-foreground",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <div className={`text-2xl font-bold ${s.color}`}>{loading ? "—" : s.value}</div>
            </div>
          ))}
        </div>

        {/* Tenants table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-lg">All Tenants</h2>
              <span className="text-xs text-muted-foreground">
                Showing {filteredTenants.length} of {totalCompanies} companies
              </span>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: "all", label: `All (${totalCompanies})` },
                {
                  id: "attention",
                  label: `⚠️ Attention (${attentionTenants.length})`,
                  highlight: attentionTenants.length > 0,
                },
                { id: "paid", label: `Paid (${paidTenants.length})` },
                { id: "trial", label: `Trial (${trialTenants.length})` },
                { id: "expired", label: `Expired (${expiredTenants.length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    filter === f.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : f.highlight
                      ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : filteredTenants.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              No companies match the selected filter.
            </div>
          ) : (
            <div className="divide-y">
              {filteredTenants.map((t) => {
                const badge = getSubscriptionBadge(t.subscription_status);
                return (
                  <div
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => navigate({ to: "/admin/$companyId", params: { companyId: t.id } })}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold truncate text-base">{t.name}</span>
                        {t.owner_name && (
                          <span className="text-xs text-muted-foreground truncate">
                            ({t.owner_name})
                          </span>
                        )}
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${badge.badgeClass}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
                        {t.owner_email ? (
                          <span className="inline-flex items-center gap-1 font-medium text-foreground/90 bg-muted/60 px-2 py-0.5 rounded">
                            <Mail className="h-3 w-3 text-primary shrink-0" />
                            <span className="truncate">{t.owner_email}</span>
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/70">No owner email</span>
                        )}
                        <span>·</span>
                        <span>{t.phone ?? "No phone"}</span>
                        <span>·</span>
                        <span>
                          Created{" "}
                          {new Date(t.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 text-xs sm:text-sm">
                        <Users className="h-3.5 w-3.5" /> {t.member_count} members
                      </span>
                      <span className="flex items-center gap-1 text-xs sm:text-sm">
                        <HardHat className="h-3.5 w-3.5" />
                        {t.active_worker_count}/{t.worker_count} workers
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
