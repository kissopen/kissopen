import { t } from "kissopen-desktop-state";
import type { CSSProperties } from "react";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { ScrollArea } from "./Scrollbar";
import { partitionComponentProps } from "./componentProps";
import { AccountPlanSummary, type AccountPlanSummaryProps } from "./AccountPlanSummary";

export type PlanCatalogEntry = {
    id: string;
    name: string;
    /** Monthly price in 分; 0 reads as free. */
    priceFen: number;
    /** One line under the name saying what this plan is for. */
    tagline: string;
    /** What the plan gives, in the reader's terms. */
    features: readonly string[];
    /** Marks the plan the page leads with. */
    featured?: boolean;
    actionLabel?: string;
    actionDisabled?: boolean;
    actionNote?: string;
};
/** A pack of points on sale. */
export type PlanCatalogPack = {
    id: string;
    name: string;
    points: number;
    /** Price in 分. */
    priceFen: number;
};
export type PlanCatalogProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    plans: readonly PlanCatalogEntry[];
    /** The plan the reader is on; its card says so instead of offering itself. */
    currentPlanId: string;
    currentPlan?: AccountPlanSummaryProps;
    onBack?: () => void;
    onSelect?: (id: string) => void;
    /** Said under the cards when no real payment can be taken yet. */
    notice?: string;
    /** Bought or granted points not yet spent. */
    balance?: number;
    /** Points on sale; the section is left out when there are none. */
    packs?: readonly PlanCatalogPack[];
    onBuyPack?: (id: string) => void;
};

const featureIcons: readonly IconName[] = ["spark", "chat", "image", "agents", "files", "zap"];

function priceText(fen: number): string {
    return fen > 0 ? `¥${Math.round(fen / 100)}` : "¥0";
}

/**
 * C-285 PlanCatalog — the plans side by side, as a page of its own.
 *
 * Nothing here states an amount of money you may spend. A plan is described by
 * what it lets you do and how it compares to the one beside it, because "¥200 a
 * month of usage" is not a quantity anyone can picture, and printing it invites
 * exactly the arithmetic this billing model set out to remove.
 */
export function PlanCatalog(props: PlanCatalogProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "plans",
        "currentPlanId",
        "currentPlan",
        "onBack",
        "onSelect",
        "notice",
        "balance",
        "packs",
        "onBuyPack",
    ]);
    return (
        <section
            className={["kissopen-plans", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="plan-catalog"
            data-testid={local["data-testid"]}
            style={local.style}
        >
            <header className="kissopen-plans__header">
                {local.onBack && (
                    <Button
                        aria-label={t("返回")}
                        className="kissopen-plans__back"
                        icon="arrow-right"
                        iconOnly
                        onClick={local.onBack}
                        size="small"
                        variant="ghost"
                    />
                )}
                <h1 className="kissopen-plans__title">{t("升级套餐")}</h1>
            </header>
            <ScrollArea
                className="kissopen-plans__scroll"
                viewportClassName="kissopen-plans__viewport"
            >
                {local.currentPlan && (
                    <div className="kissopen-plans__summary">
                        <AccountPlanSummary {...local.currentPlan} />
                    </div>
                )}
                <div className="kissopen-plans__list">
                    {local.plans.map((plan) => {
                        const current = plan.id === local.currentPlanId;
                        return (
                            <article
                                className="kissopen-plans__card"
                                data-current={current ? "" : undefined}
                                data-featured={plan.featured ? "" : undefined}
                                key={plan.id}
                            >
                                <h2 className="kissopen-plans__name">{plan.name}</h2>
                                <p className="kissopen-plans__price">
                                    <span className="kissopen-plans__amount">
                                        {priceText(plan.priceFen)}
                                    </span>
                                    <span className="kissopen-plans__period">
                                        {plan.priceFen > 0 ? t("CNY / 月") : t("免费")}
                                    </span>
                                </p>
                                <p className="kissopen-plans__tagline">{plan.tagline}</p>
                                {current ? (
                                    <Button disabled fullWidth size="medium" variant="secondary">
                                        {t("你当前的套餐")}
                                    </Button>
                                ) : (
                                    <Button
                                        disabled={!local.onSelect || plan.actionDisabled}
                                        fullWidth
                                        onClick={() => local.onSelect?.(plan.id)}
                                        size="medium"
                                        variant={plan.featured ? "primary" : "secondary"}
                                    >
                                        {plan.actionLabel ??
                                            (plan.priceFen > 0
                                                ? t("升级至 {name}", { name: plan.name })
                                                : t("切换至 {name}", { name: plan.name }))}
                                    </Button>
                                )}
                                {plan.actionNote && (
                                    <p className="kissopen-plans__action-note">{plan.actionNote}</p>
                                )}
                                <ul className="kissopen-plans__features">
                                    {plan.features.map((feature, index) => (
                                        <li className="kissopen-plans__feature" key={feature}>
                                            <Icon
                                                name={
                                                    featureIcons[index % featureIcons.length] ??
                                                    "check"
                                                }
                                                size={16}
                                            />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        );
                    })}
                </div>
                {local.packs && local.packs.length > 0 && (
                    <section className="kissopen-plans__packs" aria-label={t("点数包")}>
                        <header className="kissopen-plans__packs-header">
                            <h2 className="kissopen-plans__packs-title">{t("点数包")}</h2>
                            <p className="kissopen-plans__packs-note">
                                {t("套餐额度用完后自动使用，不会过期。")}
                                {local.balance !== undefined &&
                                    " " + t("当前余额 {count} 点。", { count: local.balance })}
                            </p>
                        </header>
                        <div className="kissopen-plans__pack-list">
                            {local.packs.map((pack) => (
                                <article className="kissopen-plans__pack" key={pack.id}>
                                    <span className="kissopen-plans__pack-name">{pack.name}</span>
                                    <span className="kissopen-plans__pack-points">
                                        {t("{count} 点", { count: pack.points })}
                                    </span>
                                    <Button
                                        disabled={!local.onBuyPack}
                                        onClick={() => local.onBuyPack?.(pack.id)}
                                        size="small"
                                        variant="secondary"
                                    >
                                        {`¥${(pack.priceFen / 100).toFixed(2)}`}
                                    </Button>
                                </article>
                            ))}
                        </div>
                    </section>
                )}
                {local.notice && <p className="kissopen-plans__notice">{local.notice}</p>}
            </ScrollArea>
        </section>
    );
}
