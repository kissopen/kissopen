import { BillingHistoryPage, type BillingHistoryPageProps } from "../../src/BillingHistoryPage";
import { t } from "kissopen-desktop-state";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-310";
const noop = () => undefined;
const defaults: BillingHistoryPageProps = {
    plan: { name: "Plus", validity: t("到期时间：{date}", { date: "2026/11/02 18:30" }) },
    kind: "all",
    page: 1,
    hasNext: true,
    loading: false,
    error: "",
    onKindChange: noop,
    onPrevious: noop,
    onNext: noop,
    onViewPlans: noop,
    rows: [
        {
            id: "DEMO-20261002-001",
            date: "2026/10/02",
            name: t("{name} 订阅", { name: "Plus" }),
            detail: t("{days} 天", { days: 30 }),
            amount: "¥99.00",
            method: t("微信支付"),
            status: t("已支付"),
            paid: true,
        },
        {
            id: "DEMO-20261001-002",
            date: "2026/10/01",
            name: t("点数购买"),
            detail: t("{name} · {points} 点", { name: "Standard", points: "5,000" }),
            amount: "¥49.00",
            method: t("支付宝"),
            status: t("已支付"),
            paid: true,
        },
        {
            id: "DEMO-20260928-003",
            date: "2026/09/28",
            name: t("{name} 订阅", { name: "Pro" }),
            detail: t("{days} 天", { days: 30 }),
            amount: "¥399.00",
            method: t("微信支付"),
            status: t("待支付"),
            paid: false,
        },
    ],
};
export function BillingHistoryPagePage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="BillingHistoryPage"
            summary="Subscription and points purchases. Real payment states; no simulated invoice download. Account-scoped pagination and resilient loading."
        >
            <Specimen
                number="01"
                label="Purchase history"
                detail="Date, purchase, amount and confirmed status · illustrative records only"
                stage="app"
            >
                <div style={{ display: "flex", width: 1024, height: 560 }}>
                    <BillingHistoryPage {...defaults} />
                </div>
            </Specimen>
            <Specimen
                number="02"
                label="Narrow content"
                detail="Columns adapt to the panel width"
                stage="app"
            >
                <div style={{ display: "flex", width: 390, height: 680 }}>
                    <BillingHistoryPage {...defaults} />
                </div>
            </Specimen>
            <Specimen number="03" label="First load" detail="No blank screen" stage="app">
                <div style={{ display: "flex", width: 900, height: 460 }}>
                    <BillingHistoryPage {...defaults} rows={null} loading hasNext={false} />
                </div>
            </Specimen>
            <Specimen
                number="04"
                label="Empty history"
                detail="An honest account with no purchases"
                stage="app"
            >
                <div style={{ display: "flex", width: 900, height: 460 }}>
                    <BillingHistoryPage {...defaults} rows={[]} hasNext={false} />
                </div>
            </Specimen>
            <Specimen
                number="05"
                label="Disconnected"
                detail="Old records remain readable"
                stage="app"
            >
                <div style={{ display: "flex", width: 1024, height: 600 }}>
                    <BillingHistoryPage {...defaults} error="暂时无法连接，正在自动重试。" />
                </div>
            </Specimen>
            <Specimen
                number="06"
                label="Long purchase history"
                detail="Twenty illustrative records · wheel and draggable scrollbar reach pagination"
                stage="app"
            >
                <div style={{ display: "flex", width: 1024, height: 560 }}>
                    <BillingHistoryPage
                        {...defaults}
                        rows={Array.from({ length: 20 }, (_, index) => ({
                            ...defaults.rows![index % defaults.rows!.length]!,
                            id: `DEMO-LONG-${index + 1}`,
                        }))}
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
