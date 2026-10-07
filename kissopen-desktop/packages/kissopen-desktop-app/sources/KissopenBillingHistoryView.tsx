import { useSyncExternalStore } from "react";
import { t, type BillingHistoryStore, type PlanSummary } from "kissopen-desktop-state";
import { BillingHistoryPage } from "kissopen-desktop-ui";
import { accountPlanSummary } from "./accountPlanSummary";

export function KissopenBillingHistoryView(props: {
    store: BillingHistoryStore;
    onViewPlans: () => void;
    /** Show the already loaded account plan while history is being fetched. */
    plan?: PlanSummary;
}) {
    const state = useSyncExternalStore(props.store.subscribe, props.store.get, props.store.get);
    const plan = state.history?.plan ?? props.plan;
    return (
        <BillingHistoryPage
            {...(plan ? { plan: accountPlanSummary(plan) } : {})}
            kind={state.kind}
            page={state.page}
            loading={state.loading}
            error={state.error}
            rows={
                state.history?.orders.map((order) => ({
                    id: order.id,
                    date: new Date(order.created).toLocaleDateString(),
                    name:
                        order.plan_action === "upgrade"
                            ? t("{name} 升级补差价", { name: order.name })
                            : order.kind === "points"
                              ? t("点数购买")
                              : t("{name} 订阅", { name: order.name }),
                    detail:
                        order.plan_action === "upgrade"
                            ? t("到期时间不变：{date}", {
                                  date: new Date(order.expires_at).toLocaleString(),
                              })
                            : order.kind === "points"
                              ? t("{name} · {points} 点", {
                                    name: order.name,
                                    points: order.points.toLocaleString(),
                                })
                              : t("{days} 天", { days: order.days }),
                    amount: new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "CNY",
                    }).format(order.amount_fen / 100),
                    method:
                        order.pay_type === "wxpay"
                            ? t("微信支付")
                            : order.pay_type === "alipay"
                              ? t("支付宝")
                              : order.pay_type === "qqpay"
                                ? t("QQ 支付")
                                : order.pay_type || "—",
                    paid: order.status === "paid",
                    status: order.needs_review
                        ? t("已支付，待处理")
                        : order.status === "paid"
                          ? t("已支付")
                          : order.status === "pending"
                            ? t("待支付")
                            : order.status === "failed"
                              ? t("支付失败")
                              : order.status === "cancelled"
                                ? t("已取消")
                                : t("处理中"),
                })) ?? null
            }
            hasNext={Boolean(state.history?.next_cursor)}
            onKindChange={props.store.select}
            onPrevious={props.store.previous}
            onNext={props.store.next}
            onViewPlans={props.onViewPlans}
        />
    );
}
