import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getTenantDetail,
  getTenantStats,
  activateCompanySubscription,
  extendCompanyTrial,
} from "@/lib/superadmin.functions";
import { setActiveCompanyId } from "@/lib/company";
import { getSubscriptionBadge, getSubscriptionStatus } from "@/lib/subscription";
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
  Mail,
  CheckCircle2,
  Clock,
  Sparkles,
  MessageSquare,
  Loader2,
  ShieldCheck,
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
  const activateSub = useServerFn(activateCompanySubscription);
  const extendTrial = useServerFn(extendCompanyTrial);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

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

  async function handleActivate1Year() {
    if (!detail) return;
    const ok = window.confirm(`Activate 1-year annual subscription for "${detail.company.name}"?`);
    if (!ok) return;

    setActionBusy(true);
    try {
      await activateSub({ data: { companyId, months: 12 } });
      toast.success("1-Year Annual Subscription Activated!");
      const [d, s] = await Promise.all([
        fetchDetail({ data: { companyId } }),
        fetchStats({ data: { companyId } }),
      ]);
      setDetail(d);
      setStats(s);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleExtendTrial() {
    if (!detail) return;
    const ok = window.confirm(`Extend 14-day trial for "${detail.company.name}"?`);
    if (!ok) return;

    setActionBusy(true);
    try {
      await extendTrial({ data: { companyId, days: 14 } });
      toast.success("Trial extended by 14 days!");
      const [d, s] = await Promise.all([
        fetchDetail({ data: { companyId } }),
        fetchStats({ data: { companyId } }),
      ]);
      setDetail(d);
      setStats(s);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActionBusy(false);
    }
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
  const subStatus = (company as any).subscription_status || getSubscriptionStatus(company);
  const badge = getSubscriptionBadge(subStatus);
  const ownerPhone = company.phone;

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
        {/* Subscription & Plan Card */}
        <section className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-base">Subscription & Plan</h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${badge.badgeClass}`}
              >
                {badge.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                onClick={handleActivate1Year}
                disabled={actionBusy}
              >
                {actionBusy ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                )}
                Activate 1 Year Plan
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExtendTrial}
                disabled={actionBusy}
              >
                <Clock className="h-3.5 w-3.5 mr-1" />
                Extend 14 Days
              </Button>

              {ownerPhone && (
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`https://wa.me/${ownerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Hi ${company.name}, regarding your BhaiBiz subscription...`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                    WhatsApp Owner
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Plan Type</span>
              <span className="font-medium">
                {subStatus.isPaid ? "Paid Annual Plan" : "14-Day Free Trial"}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">
                {subStatus.isPaid ? "Annual Plan Expires On" : "Trial Ends On"}
              </span>
              <span className="font-medium">
                {new Date(subStatus.subscriptionExpiresAt || subStatus.trialEndsAt).toLocaleDateString(
                  "en-IN",
                  { day: "numeric", month: "short", year: "numeric" }
                )}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Status / Days Remaining</span>
              <span className="font-medium">
                {subStatus.isExpired ? (
                  <span className="text-rose-600 font-semibold">Expired</span>
                ) : (
                  <span>{subStatus.daysRemaining} days remaining</span>
                )}
              </span>
            </div>
          </div>

          {(company as any).subscription_notes && (
            <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-dashed">
              <span className="font-medium text-foreground">Notes:</span>{" "}
              {(company as any).subscription_notes}
            </div>
          )}
        </section>

        {/* Company info */}
        <section className="rounded-xl border bg-card shadow-sm p-5 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={Building2} label="Name" value={company.name} />
          <InfoRow icon={Mail} label="Owner email" value={(company as { owner_email?: string | null }).owner_email ?? "—"} />
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

