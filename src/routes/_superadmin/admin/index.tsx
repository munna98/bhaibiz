import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listTenants } from "@/lib/superadmin.functions";
import { Building2, Users, HardHat, LogOut, ArrowRight, TrendingUp, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

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
  const totalWorkers = tenants.reduce((s, t) => s + t.worker_count, 0);
  const totalActiveWorkers = tenants.reduce((s, t) => s + t.active_worker_count, 0);
  const totalMembers = tenants.reduce((s, t) => s + t.member_count, 0);

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
            { label: "Companies", value: totalCompanies, icon: Building2 },
            { label: "Total Members", value: totalMembers, icon: Users },
            { label: "Total Workers", value: totalWorkers, icon: HardHat },
            { label: "Active Workers", value: totalActiveWorkers, icon: TrendingUp },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className="h-4 w-4" />
                <span className="text-xs">{s.label}</span>
              </div>
              <div className="text-2xl font-bold">{loading ? "—" : s.value}</div>
            </div>
          ))}
        </div>

        {/* Tenants table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">All Tenants</h2>
            <span className="text-xs text-muted-foreground">{totalCompanies} companies</span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : tenants.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No tenants yet.</div>
          ) : (
            <div className="divide-y">
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => navigate({ to: "/admin/$companyId", params: { companyId: t.id } })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate text-base">{t.name}</span>
                      {t.owner_name && (
                        <span className="text-xs text-muted-foreground truncate">
                          ({t.owner_name})
                        </span>
                      )}
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
                  <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {t.member_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardHat className="h-3.5 w-3.5" />
                      {t.active_worker_count}/{t.worker_count}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
