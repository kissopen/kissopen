import { localeCurrent, t } from "kissopen-desktop-state";
import type { CSSProperties } from "react";
import { Button } from "./Button";
import { Octicon } from "./vectorIcons/VectorIcon";

export interface ConversationUsageLimitCardProps {
    readonly resetAt?: number;
    readonly onUsageOpen?: () => void;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly "data-testid"?: string;
}

/** Shared with transcript geometry so localized wrapping reserves the card's actual height. */
export function conversationUsageLimitRecoveryText(resetAt?: number): string {
    const date = resetAt === undefined ? undefined : new Date(resetAt);
    const reset =
        date === undefined || Number.isNaN(date.getTime())
            ? undefined
            : date.toLocaleString(localeCurrent() === "zh" ? "zh-CN" : "en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
              });
    return reset === undefined
        ? t("查看用量，了解套餐和点数选项。")
        : t("额度恢复时间：{date}。也可以查看套餐和点数选项。", { date: reset });
}

/** A terminal account allowance refusal, not a connection error to retry. */
export function ConversationUsageLimitCard(props: ConversationUsageLimitCardProps) {
    return (
        <div
            className={["kissopen-conversation-usage-limit", props.className]
                .filter(Boolean)
                .join(" ")}
            data-kissopen-desktop-ui="conversation-usage-limit"
            data-testid={props["data-testid"]}
            style={props.style}
            role="status"
        >
            <div className="kissopen-conversation-usage-limit__card">
                <span className="kissopen-conversation-usage-limit__icon" aria-hidden="true">
                    <Octicon name="meter" size={20} />
                </span>
                <div className="kissopen-conversation-usage-limit__content">
                    <strong>{t("当前用量不足")}</strong>
                    <p>{t("本次请求未能完成，已停止自动重试。")}</p>
                    <p>{conversationUsageLimitRecoveryText(props.resetAt)}</p>
                    {props.onUsageOpen && (
                        <Button size="small" variant="secondary" onClick={props.onUsageOpen}>
                            {t("查看用量")}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
