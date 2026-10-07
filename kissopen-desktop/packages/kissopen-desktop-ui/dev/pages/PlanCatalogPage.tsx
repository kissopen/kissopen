import { PlanCatalog, type PlanCatalogEntry } from "../../src/PlanCatalog";
import { t } from "kissopen-desktop-state";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-285";

const noop = () => {};

const plans: PlanCatalogEntry[] = [
    {
        id: "free",
        name: "Free",
        priceFen: 0,
        tagline: "先试试看",
        features: ["核心模型", "少量在线模型用量，用完可升级", "可接入你自己的模型"],
    },
    {
        id: "plus",
        name: "Plus",
        priceFen: 9900,
        tagline: "解锁全面体验",
        features: [
            "全部在线模型，按问题自动选择",
            "充裕的日常用量",
            "生成图片",
            "工作区智能体与终端",
            "聊天与工作共用同一份用量",
        ],
    },
    {
        id: "pro",
        name: "Pro",
        priceFen: 39900,
        tagline: "为长时间的工作留足空间",
        features: [
            "全部在线模型，按问题自动选择",
            "相比 Plus 多 5 倍用量",
            "没有 5 小时限制",
            "生成图片",
            "工作区智能体与终端",
        ],
    },
    {
        id: "promax",
        name: "Pro Max",
        priceFen: 99900,
        tagline: "为长时间的工作留足空间",
        featured: true,
        features: [
            "全部在线模型，按问题自动选择",
            "相比 Plus 多 20 倍用量",
            "没有 5 小时限制",
            "生成图片",
            "工作区智能体与终端",
        ],
    },
];

const stage: Record<string, string> = { display: "flex", width: "1180px", height: "680px" };

export function PlanCatalogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The plans side by side, as a page of its own. No line states an amount of money: a plan is described by what it lets you do and how it compares to the one beside it."
            title="PlanCatalog"
        >
            <Specimen
                detail="four cards in one row · equal height · the dearest plan leads · the reader's own plan says so"
                label="Catalogue"
                number="01"
                stage="app"
            >
                <div style={stage}>
                    <PlanCatalog
                        currentPlanId="plus"
                        currentPlan={{
                            name: "Plus",
                            validity: t("到期时间：{date}", { date: "2026/11/02 18:30" }),
                        }}
                        notice="支付尚未开放，选择套餐后请联系我们开通。"
                        onBack={noop}
                        onSelect={noop}
                        plans={plans}
                    />
                </div>
                <DimensionRule label="card 24px padding · price 30/36 · features 13/18 · no monetary limits anywhere" />
            </Specimen>
            <Specimen
                number="02"
                label="Prorated upgrade"
                detail="15 days left · downgrade blocked · upgrade preserves expiry"
                stage="app"
            >
                <div style={stage}>
                    <PlanCatalog
                        currentPlanId="plus"
                        currentPlan={{ name: "Plus", validity: "Expires: 2026/10/17 18:30" }}
                        onSelect={noop}
                        plans={plans.map((plan) => ({
                            ...plan,
                            ...(plan.id === "free"
                                ? {
                                      actionDisabled: true,
                                      actionLabel: t("暂不可切换"),
                                      actionNote: t(
                                          "当前套餐有效期内不能降级，请到期后选择较低套餐。",
                                      ),
                                  }
                                : plan.priceFen > 9900
                                  ? {
                                        actionLabel: t("补差价 ¥{amount} 升级", {
                                            amount: ((plan.priceFen - 9900) / 200).toFixed(2),
                                        }),
                                        actionNote: t("按剩余有效时间折算，到期时间不变：{date}", {
                                            date: "2026/10/17 18:30",
                                        }),
                                    }
                                  : {}),
                        }))}
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
