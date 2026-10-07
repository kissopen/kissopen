import { t } from "kissopen-desktop-state";
import { AccountPlanSummary } from "../../src/AccountPlanSummary";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-311";
export function AccountPlanSummaryPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="AccountPlanSummary"
            summary="Effective account plan with an explicit expiry; never inferred from order history."
        >
            <Specimen
                number="01"
                label="Paid entitlement"
                detail="Current plan and exact local expiry"
                stage="app"
            >
                <div style={{ display: "flex", flexDirection: "column", width: 900 }}>
                    <AccountPlanSummary
                        name="Plus"
                        validity={t("到期时间：{date}", { date: "2026/11/02 18:30" })}
                    />
                </div>
            </Specimen>
            <Specimen number="02" label="Free account" detail="No renewal implied" stage="app">
                <div style={{ display: "flex", flexDirection: "column", width: 390 }}>
                    <AccountPlanSummary name="Free" validity={t("免费套餐，无需续费")} />
                </div>
            </Specimen>
            <Specimen
                number="03"
                label="No time limit"
                detail="Admin-granted entitlement with no expiry"
                stage="app"
            >
                <div style={{ display: "flex", flexDirection: "column", width: 900 }}>
                    <AccountPlanSummary name="Pro Max" validity={t("长期有效，无到期限制")} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
