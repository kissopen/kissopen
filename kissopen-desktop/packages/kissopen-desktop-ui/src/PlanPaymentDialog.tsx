import { t } from "kissopen-desktop-state";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { QRCode } from "./QRCode";

export type PlanPaymentDialogProps = {
    planName: string;
    /** What the plan costs, in 分. */
    amountFen: number;
    /** How long one purchase lasts. */
    days: number;
    periodLabel?: string;
    termNote?: string;
    /** A pack of points is being bought instead of a plan: this many. */
    points?: number;
    /** The methods the server takes, e.g. "alipay", "wxpay". */
    methods: readonly string[];
    method: string;
    status: "loading" | "scan" | "open" | "paid" | "failed" | "review" | "expired";
    /** What the payment app scans, while status is "scan". */
    qrcode: string;
    /** The payment page, while status is "open". */
    url: string;
    /** Why no order could be placed, while status is "failed". */
    message: string;
    onMethod: (method: string) => void;
    onOpenPage: (url: string) => void;
    onRetry: () => void;
    onClose: () => void;
};

function methodName(method: string): string {
    if (method === "alipay") return t("支付宝");
    if (method === "wxpay") return t("微信支付");
    if (method === "qqpay") return t("QQ 钱包");
    return method;
}

function scanHint(method: string): string {
    if (method === "alipay") return t("请用支付宝扫一扫付款");
    if (method === "wxpay") return t("请用微信扫一扫付款");
    return t("请用 {name} 扫码付款", { name: methodName(method) });
}

/**
 * C-290 PlanPaymentDialog — paying for a plan without leaving the app.
 *
 * The reader picks how to pay and scans the code with that app on their
 * phone; the dialog turns to "paid" by itself once the payment lands, because
 * the owner keeps asking about the order. A method the platform can only take
 * on its own page offers to open that page instead. Alipay HTTPS payment pages
 * also offer a QR link to try on the phone, without claiming it is a native
 * payment code. The code is always drawn
 * black on white: payment apps read an inverted code badly, so it does not
 * follow the dark theme.
 */
export function PlanPaymentDialog(props: PlanPaymentDialogProps) {
    const paid = props.status === "paid";
    const finished = paid || props.status === "review";
    // Only encode the signed platform's HTTPS payment page, not arbitrary
    // HTML or app-launch schemes that a scanner may not be able to open.
    const alipayPageCode =
        props.status === "open" &&
        props.method === "alipay" &&
        URL.canParse(props.url) &&
        new URL(props.url).protocol === "https:";
    return (
        <Modal
            className="kissopen-plan-payment"
            closeLabel={finished ? t("完成") : t("取消")}
            footer={
                <Button
                    onClick={props.onClose}
                    size="medium"
                    variant={finished ? "primary" : "ghost"}
                >
                    {finished ? t("完成") : t("取消")}
                </Button>
            }
            onClose={props.onClose}
            size="small"
            title={
                props.points
                    ? t("购买 {name}", { name: props.planName })
                    : t("升级至 {name}", { name: props.planName })
            }
        >
            <div className="kissopen-plan-payment__body">
                <p className="kissopen-plan-payment__amount">
                    <span className="kissopen-plan-payment__money">
                        ¥{(props.amountFen / 100).toFixed(2)}
                    </span>
                    <span className="kissopen-plan-payment__period">
                        {props.periodLabel ??
                            (props.points
                                ? t("{count} 点", { count: props.points })
                                : t("{count} 天", { count: props.days }))}
                    </span>
                </p>
                {props.termNote && (
                    <span className="kissopen-plan-payment__note">{props.termNote}</span>
                )}
                {!finished && props.methods.length > 1 && (
                    <div
                        aria-label={t("支付方式")}
                        className="kissopen-plan-payment__methods"
                        role="radiogroup"
                    >
                        {props.methods.map((method) => (
                            <button
                                aria-checked={method === props.method}
                                className="kissopen-plan-payment__method"
                                disabled={props.status === "loading"}
                                key={method}
                                onClick={() => method !== props.method && props.onMethod(method)}
                                role="radio"
                                type="button"
                            >
                                {methodName(method)}
                            </button>
                        ))}
                    </div>
                )}
                <div className="kissopen-plan-payment__stage" data-status={props.status}>
                    {props.status === "loading" && (
                        <span className="kissopen-plan-payment__hint">{t("正在生成付款码…")}</span>
                    )}
                    {props.status === "scan" && (
                        <>
                            <QRCode
                                className="kissopen-plan-payment__code"
                                data={props.qrcode}
                                label={scanHint(props.method)}
                                size={188}
                            />
                            <span className="kissopen-plan-payment__hint">
                                {scanHint(props.method)}
                            </span>
                            <span className="kissopen-plan-payment__note">
                                {t("付款后这里会自动更新，不用关闭窗口。")}
                            </span>
                        </>
                    )}
                    {props.status === "open" && (
                        <>
                            {alipayPageCode && (
                                <QRCode
                                    className="kissopen-plan-payment__code"
                                    data={props.url}
                                    label={t("请用支付宝扫一扫打开支付页面")}
                                    size={188}
                                />
                            )}
                            <span className="kissopen-plan-payment__hint">
                                {alipayPageCode
                                    ? t("请用支付宝扫一扫打开支付页面")
                                    : t("这种方式需要在支付页面完成。")}
                            </span>
                            <Button
                                onClick={() => props.onOpenPage(props.url)}
                                size="medium"
                                variant="primary"
                            >
                                {t("打开支付页面")}
                            </Button>
                            <span className="kissopen-plan-payment__note">
                                {alipayPageCode
                                    ? t(
                                          "扫码未能付款？请点击「打开支付页面」。付款成功后会自动更新。",
                                      )
                                    : t("付款后这里会自动更新，不用关闭窗口。")}
                            </span>
                        </>
                    )}
                    {paid && (
                        <>
                            <Icon
                                className="kissopen-plan-payment__done"
                                name="check-circle"
                                size={32}
                            />
                            <span className="kissopen-plan-payment__hint">
                                {props.points
                                    ? t("支付成功，{count} 点已到账。", { count: props.points })
                                    : t("支付成功，{name} 已生效。", { name: props.planName })}
                            </span>
                        </>
                    )}
                    {props.status === "expired" && (
                        <>
                            <Icon name="clock" size={32} />
                            <span className="kissopen-plan-payment__hint">
                                {t("二维码需要刷新")}
                            </span>
                            <span
                                className="kissopen-plan-payment__note"
                                role={props.message ? "alert" : undefined}
                            >
                                {props.message ||
                                    t(
                                        "此付款码已展示 15 分钟，请刷新后再付款。切换支付方式不会重新下单。",
                                    )}
                            </span>
                            <Button onClick={props.onRetry} size="medium" variant="primary">
                                {t("刷新二维码")}
                            </Button>
                        </>
                    )}
                    {props.status === "failed" && (
                        <>
                            <Icon
                                className="kissopen-plan-payment__problem"
                                name="alert"
                                size={32}
                            />
                            <span className="kissopen-plan-payment__hint" role="alert">
                                {props.message || t("没有下单成功。")}
                            </span>
                            {props.methods.length > 0 && (
                                <Button onClick={props.onRetry} size="medium" variant="secondary">
                                    {t("重试")}
                                </Button>
                            )}
                        </>
                    )}
                    {props.status === "review" && (
                        <span className="kissopen-plan-payment__hint" role="alert">
                            {t(
                                "付款已收到，但下单后的套餐状态已变化。原套餐保留，请联系客服处理此账单。",
                            )}
                        </span>
                    )}
                </div>
            </div>
        </Modal>
    );
}
