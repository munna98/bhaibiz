import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getTenantDetail, getTenantStats } from "@/lib/superadmin.functions";
import { setActiveCompanyId } from "@/lib/company";
import {
  ArrowLeft,
  Building2,
  Users,
  HardHat,
  Eye,
  Phone,
  MapPin,
  Calendar,
  Badge,
  Wallet,
  TrendingUp,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_superadmin/admin/$companyId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tenant Detail — BhaiBiz Admin" }] }),
  component: TenantDetail,
});

type Detail = Awaited<ReturnType<typeof getTenantDetail>>;
type Stats = Awaited<ReturnType<typeof getTenantStats>>;

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  manager: "bg-blue-100 text-blue-700",
  operator: "bg-amber-100 text-amber-700",
  accountant: "bg-green-100 text-green-700",
};

function TenantDetail() {
  const { companyId } = Route.useParams();
  const navigate = useNavigate();
  const fetchDetail = useServerFn(getTenantDetail);
  const fetchStats = useServerFn(getTenantStats);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchDetail({ data: { companyId } }),
      fetchStats({ data: { companyId } }),
    ])
      .then(([d, s]) => {
        setDetail(d);
        setStats(s);
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [companyId, fetchDetail, fetchStats]);

  function handleImpersonate() {
    setActiveCompanyId(companyId);
    navigate({ to: "/app" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        Loading tenant…
      </div>
    );
  }

  if (!detail) return null;

  const { company, members, workers } = detail;
  const activeWorkers = workers.filter((w) => w.status === "active");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-0.5">
            Tenant
          </div>
          <h1 className="text-xl font-bold truncate">{company.name}</h1>
        </div>
        <Button size="sm" onClick={handleImpersonate}>
          <Eye className="h-4 w-4 mr-2" /> View as tenant
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Company info */}
        <section className="rounded-xl border bg-card shadow-sm p-5 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={Building2} label="Name" value={company.name} />
          <InfoRow icon={Phone} label="Phone" value={company.phone ?? "—"} />
          <InfoRow icon={MapPin} label="Address" value={company.address ?? "—"} />
          <InfoRow icon={Badge} label="Receipt prefix" value={company.receipt_prefix} />
          <InfoRow
            icon={Calendar}
            label="Created"
            value={new Date(company.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          />
        </section>

        {/* Financial stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total Earned", value: fmt(stats.total_earned_paise), icon: TrendingUp },
              { label: "Total Collected", value: fmt(stats.total_collected_paise), icon: Wallet },
              {
                label: "Advance Outstanding",
                value: fmt(stats.advance_outstanding_paise),
                icon: CircleDot,
              },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <s.icon className="h-4 w-4" />
                  <span className="text-xs">{s.label}</span>
                </div>
                <div className="text-2xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Members */}
        <section className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Members ({members.length})</h2>
          </div>
          {members.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No members.</p>
          ) : (
            <div className="divide-y">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {m.profile.full_name ?? m.profile.username ?? m.user_id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.profile.email ?? m.profile.username ?? "—"}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                      ROLE_BADGE[m.role] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Workers */}
        <section className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <HardHat className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">
              Workers ({activeWorkers.length} active / {workers.length} total)
            </h2>
          </div>
          {workers.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No workers yet.</p>
          ) : (
            <div className="divide-y">
              {workers.map((w) => (
                <div key={w.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{w.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {w.worker_code} · {w.mobile}
                      {w.category ? ` · ${w.category}` : ""}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      w.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

