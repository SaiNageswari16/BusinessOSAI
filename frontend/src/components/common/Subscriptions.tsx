import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Check,
  Crown,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Truck,
} from "lucide-react";
import { Panel } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { getActiveTenant } from "@/lib/auth-tokens";
import {
  platformService,
  type PlanCard,
  type TenantPlan,
} from "@/services/platformService";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

const planIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  FREE: Truck,
  STARTER: Rocket,
  PRO: Crown,
};

function limitChips(limits: Record<string, unknown>): string[] {
  const out: string[] = [];
  const m = limits["max_outlets"];
  if (m != null) out.push(`${m} outlets`);
  const u = limits["max_users"];
  if (u != null) out.push(`${u} users`);
  const mods = limits["modules"];
  if (Array.isArray(mods) && mods.length) out.push(`${mods.length} modules`);
  return out;
}

/**
 * Subscriptions settings tab: the FREE / STARTER / PRO plan cards from
 * /platform/plans with this tenant's active plan highlighted and a
 * "switch plan" action.
 *
 * Platform reads fail-soft — if the control plane is unreachable the cards
 * fall back to a built-in catalogue so the settings page still renders.
 */
export function SubscriptionsSection() {
  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [activePlan, setActivePlan] = useState<TenantPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  const tenantId = getActiveTenant() || "";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cards, plan] = await Promise.all([
        platformService.getPlans().catch(() => [] as PlanCard[]),
        platformService.getTenantPlan(tenantId).catch(() => null),
      ]);
      setPlans(cards);
      setActivePlan(plan);
    } catch (e) {
      console.warn("Platform service unavailable:", e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayed: PlanCard[] =
    plans.length > 0
      ? plans
      : [
          {
            code: "FREE",
            name: "Free",
            price_monthly: 0,
            currency: "INR",
            limits: { max_outlets: 1, modules: ["restaurant", "pos", "kitchen"] },
            is_active: true,
            created_at: new Date().toISOString(),
          },
          {
            code: "STARTER",
            name: "Starter",
            price_monthly: 2499,
            currency: "INR",
            limits: { max_outlets: 2, max_users: 5, modules: ["restaurant", "pos", "kitchen", "inventory"] },
            is_active: true,
            created_at: new Date().toISOString(),
          },
          {
            code: "PRO",
            name: "Pro",
            price_monthly: 7999,
            currency: "INR",
            limits: { max_outlets: 10, max_users: 25, modules: [] },
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ];

  const activeCode = activePlan?.plan_code?.toUpperCase();

  const switchPlan = async (plan: PlanCard) => {
    setSwitching(plan.code);
    try {
      const result = await platformService.switchTenantPlan(tenantId, plan.code);
      toast.success(`Switched to the ${plan.name} plan`, {
        description: `Status ${result.status} · ${result.module_entitlements.length} module entitlements applied.`,
      });
      setActivePlan(result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Plan switch failed");
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="space-y-5">
      <Panel
        title="Subscription"
        subtitle="The active plan gates module entitlements and outlet/user limits for this tenant."
        action={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        }
      >
        {activePlan ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
            <span className="grid size-9 place-items-center rounded-full bg-ai/10 text-ai">
              <BadgeCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {displayed.find((p) => p.code === activeCode)?.name ?? activePlan.plan_code}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {activePlan.status}
                {activePlan.price_monthly != null
                  ? ` · ${money(Number(activePlan.price_monthly))} ${activePlan.currency || ""}/mo`
                  : ""}
                {activePlan.renews_at ? ` · renews ${new Date(activePlan.renews_at).toLocaleDateString()}` : ""}
              </div>
            </div>
            {Array.isArray(activePlan.module_entitlements) && activePlan.module_entitlements.length > 0 && (
              <div className="flex max-w-xs flex-wrap gap-1">
                {activePlan.module_entitlements.slice(0, 6).map((m) => (
                  <span key={m} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            {loading ? "Loading tenant plan…" : "No active plan found for this tenant."}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        {displayed.map((plan) => {
          const Icon = planIcon[plan.code] ?? Sparkles;
          const isActive = activeCode === plan.code?.toUpperCase();
          const chips = limitChips(plan.limits || {});
          return (
            <div
              key={plan.code}
              className={cn(
                "panel relative flex flex-col p-4",
                isActive && "ring-2 ring-primary"
              )}
            >
              {isActive && (
                <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  CURRENT
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4.5" />
                </span>
                <div>
                  <div className="text-sm font-semibold">{plan.name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {plan.code}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular">
                  {Number(plan.price_monthly) === 0 ? "Free" : money(Number(plan.price_monthly))}
                </span>
                {Number(plan.price_monthly) !== 0 && (
                  <span className="text-xs text-muted-foreground">/{plan.currency || "INR"}</span>
                )}
              </div>
              <div className="mt-3 flex flex-1 flex-wrap gap-1.5">
                {chips.length ? (
                  chips.map((c) => (
                    <span key={c} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-muted-foreground">Full feature access</span>
                )}
              </div>
              <Button
                size="sm"
                variant={isActive ? "outline" : "secondary"}
                className="mt-4 justify-center"
                disabled={isActive || switching !== null}
                onClick={() => void switchPlan(plan)}
              >
                {switching === plan.code ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : isActive ? (
                  <Check className="size-3.5" />
                ) : null}
                {isActive ? "Active plan" : "Switch to this plan"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
