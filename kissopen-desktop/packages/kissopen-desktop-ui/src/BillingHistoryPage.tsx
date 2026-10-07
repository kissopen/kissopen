import { t } from "kissopen-desktop-state";
import { Button } from "./Button";
import { Banner } from "./Banner";
import { EmptyState } from "./EmptyState";
import { ScrollArea } from "./Scrollbar";
import { AccountPlanSummary, type AccountPlanSummaryProps } from "./AccountPlanSummary";

export type BillingHistoryRow = {
    readonly id: string;
    readonly date: string;
    readonly name: string;
    readonly detail: string;
    readonly amount: string;
    readonly method: string;
    readonly status: string;
    readonly paid: boolean;
};
export type BillingHistoryPageProps = {
    readonly plan?: AccountPlanSummaryProps;
    readonly rows: readonly BillingHistoryRow[] | null;
    readonly kind: "all" | "plan" | "points";
    readonly loading: boolean;
    readonly error: string;
    readonly page: number;
    readonly hasNext: boolean;
    readonly onKindChange: (kind: "all" | "plan" | "points") => void;
    readonly onPrevious: () => void;
    readonly onNext: () => void;
    readonly onViewPlans?: () => void;
};

/** C-310 BillingHistoryPage — account purchases, distinct from usage. */
export function BillingHistoryPage(props: BillingHistoryPageProps) {
    return (
        <section className="billing-history" data-kissopen-desktop-ui="billing-history">
            <ScrollArea
                className="billing-history__scroll"
                viewportClassName="billing-history__viewport"
            >
                <div className="billing-history__content">
                    <header className="billing-history__intro">
                        <div>
                            <h1>{t("账单")}</h1>
                            <p>{t("查看订阅与点数购买记录。")}</p>
                        </div>
                        {props.onViewPlans && (
                            <Button variant="secondary" onClick={props.onViewPlans}>
                                {t("管理套餐")}
                            </Button>
                        )}
                    </header>
                    {props.plan && <AccountPlanSummary {...props.plan} />}
                    <nav className="billing-history__filters" aria-label={t("账单类型")}>
                        {(["all", "plan", "points"] as const).map((kind) => (
                            <Button
                                key={kind}
                                variant={props.kind === kind ? "secondary" : "ghost"}
                                size="small"
                                aria-pressed={props.kind === kind}
                                onClick={() => props.onKindChange(kind)}
                            >
                                {kind === "all"
                                    ? t("全部")
                                    : kind === "plan"
                                      ? t("订阅")
                                      : t("点数购买")}
                            </Button>
                        ))}
                    </nav>
                    {props.error && (
                        <Banner tone="warning">
                            {props.error}
                            {props.rows !== null
                                ? ` ${t("已有账单仍保留，连接恢复后会自动更新。")}`
                                : ""}
                        </Banner>
                    )}
                    {props.rows === null ? (
                        props.error && !props.loading ? (
                            <EmptyState
                                icon="doc"
                                title={t("账单暂时无法加载")}
                                description={t("连接恢复后会自动重试。")}
                            />
                        ) : (
                            <div
                                className="billing-history__skeleton"
                                role="status"
                                aria-label={t("正在读取账单")}
                            >
                                {[0, 1, 2, 3].map((row) => (
                                    <div key={row}>
                                        <span />
                                        <span />
                                        <span />
                                    </div>
                                ))}
                            </div>
                        )
                    ) : props.rows.length === 0 ? (
                        <EmptyState
                            icon="doc"
                            title={t("暂无账单")}
                            description={
                                props.page > 1
                                    ? t("这一页没有更多账单，请返回上一页。")
                                    : t("购买订阅或点数后，记录会显示在这里。")
                            }
                        />
                    ) : (
                        <div
                            className="billing-history__table"
                            role="table"
                            aria-label={t("账单历史")}
                        >
                            <div className="billing-history__row billing-history__head" role="row">
                                <span className="billing-history__date" role="columnheader">
                                    {t("日期")}
                                </span>
                                <span className="billing-history__item" role="columnheader">
                                    {t("购买项目")}
                                </span>
                                <span className="billing-history__method" role="columnheader">
                                    {t("支付方式")}
                                </span>
                                <span className="billing-history__amount" role="columnheader">
                                    {t("金额")}
                                </span>
                                <span className="billing-history__status" role="columnheader">
                                    {t("状态")}
                                </span>
                            </div>
                            {props.rows.map((row) => (
                                <div className="billing-history__row" role="row" key={row.id}>
                                    <span className="billing-history__date" role="cell">
                                        {row.date}
                                    </span>
                                    <div className="billing-history__item" role="cell">
                                        <strong>{row.name}</strong>
                                        <span>{row.detail}</span>
                                        <span className="billing-history__order">
                                            {t("订单号")} {row.id}
                                        </span>
                                    </div>
                                    <span className="billing-history__method" role="cell">
                                        {row.method}
                                    </span>
                                    <span className="billing-history__amount" role="cell">
                                        {row.amount}
                                    </span>
                                    <span className="billing-history__status" role="cell">
                                        <span
                                            className="billing-history__badge"
                                            data-paid={row.paid}
                                        >
                                            {row.status}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    {(props.page > 1 || props.hasNext) && (
                        <footer className="billing-history__pagination">
                            <span>{t("第 {page} 页", { page: props.page })}</span>
                            <Button
                                size="small"
                                variant="secondary"
                                disabled={props.page === 1 || props.loading}
                                onClick={props.onPrevious}
                            >
                                {t("上一页")}
                            </Button>
                            <Button
                                size="small"
                                variant="secondary"
                                disabled={!props.hasNext || props.loading}
                                onClick={props.onNext}
                            >
                                {t("下一页")}
                            </Button>
                        </footer>
                    )}
                    <p className="billing-history__note">
                        {t("以支付确认状态为准。待支付订单不代表已扣款。")}
                    </p>
                </div>
            </ScrollArea>
        </section>
    );
}
