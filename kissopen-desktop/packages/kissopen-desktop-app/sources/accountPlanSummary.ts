import { t } from "kissopen-desktop-state";
import type { PlanSummary } from "kissopen-desktop-state";
import type { AccountPlanSummaryProps } from "kissopen-desktop-ui";

export function accountPlanSummary(plan: PlanSummary, dateOnly = false): AccountPlanSummaryProps {
    const validity =
        plan.expires_at === undefined
            ? t("到期时间暂不可用")
            : plan.expires_at > 0
              ? t("到期时间：{date}", {
                    date: new Date(plan.expires_at).toLocaleString(undefined, {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        ...(dateOnly
                            ? {}
                            : { hour: "2-digit" as const, minute: "2-digit" as const }),
                    }),
                })
              : plan.id === "free"
                ? t("免费套餐，无需续费")
                : t("长期有效，无到期限制");
    return { name: plan.name, validity };
}
