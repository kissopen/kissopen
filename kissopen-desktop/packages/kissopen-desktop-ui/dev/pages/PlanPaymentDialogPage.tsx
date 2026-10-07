import { PlanPaymentDialog } from "../../src/PlanPaymentDialog";
import { ComponentPage, Specimen } from "../kit";
import { t } from "kissopen-desktop-state";

export const componentNumber = "C-312";
const noop = () => undefined;
export function PlanPaymentDialogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="PlanPaymentDialog"
            summary="The signed order amount and retained expiry. A received payment requiring review never claims the new plan is active."
        >
            {(["loading", "scan", "paid", "review", "failed", "expired"] as const).map(
                (status, index) => (
                    <Specimen
                        key={status}
                        number={String(index + 1).padStart(2, "0")}
                        label={status}
                        detail="Illustrative prorated upgrade: Plus to Pro, 15 days remain"
                        stage="app"
                    >
                        <PlanPaymentDialog
                            planName="Pro"
                            amountFen={15000}
                            days={0}
                            periodLabel={t("升级补差价")}
                            termNote={t("到期时间不变：{date}", { date: "2026/10/17 18:30" })}
                            methods={["alipay", "wxpay"]}
                            method="wxpay"
                            status={status}
                            qrcode="DEMO-NOT-A-PAYMENT"
                            url=""
                            message={
                                status === "failed"
                                    ? t("当前套餐有效期内不能降级，请到期后选择较低套餐。")
                                    : ""
                            }
                            onMethod={noop}
                            onOpenPage={noop}
                            onRetry={noop}
                            onClose={noop}
                        />
                    </Specimen>
                ),
            )}
            <Specimen
                number="07"
                label="Alipay payment page QR"
                detail="Illustrative page link, not a real payment; keep the browser fallback"
                stage="app"
            >
                <PlanPaymentDialog
                    planName="1000 点"
                    points={1000}
                    amountFen={2000}
                    days={0}
                    methods={["alipay", "wxpay"]}
                    method="alipay"
                    status="open"
                    qrcode=""
                    url="https://example.com/payment-demo-not-a-real-order"
                    message=""
                    onMethod={noop}
                    onOpenPage={noop}
                    onRetry={noop}
                    onClose={noop}
                />
            </Specimen>
        </ComponentPage>
    );
}
