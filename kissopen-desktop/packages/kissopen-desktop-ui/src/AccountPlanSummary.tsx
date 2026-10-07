import { t } from "kissopen-desktop-state";

export type AccountPlanSummaryProps = {
    readonly name: string;
    /** Formatted by the account owner, never inferred from a pending order. */
    readonly validity: string;
};

/** C-311 AccountPlanSummary — the account's effective entitlement, not a purchase. */
export function AccountPlanSummary(props: AccountPlanSummaryProps) {
    return (
        <section
            className="account-plan-summary"
            aria-label={t("当前套餐")}
            data-kissopen-desktop-ui="account-plan-summary"
        >
            <div className="account-plan-summary__identity">
                <span>{t("当前套餐")}</span>
                <strong>{props.name}</strong>
            </div>
            <p>{props.validity}</p>
        </section>
    );
}
