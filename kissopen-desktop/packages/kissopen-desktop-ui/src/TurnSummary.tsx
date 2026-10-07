import { t } from "kissopen-desktop-state";
import { useRef, useState, type CSSProperties } from "react";
import { partitionComponentProps } from "./componentProps";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

export interface TurnSummaryProps {
    /** Final assistant text copied by the trailing action. */
    readonly copyText?: string;
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly durationMs?: number;
    /** Tokens consumed by this run. */
    readonly usedTokens?: number;
    /** Conversation context size measured when this run settled. */
    readonly finalContextTokens?: number;
    readonly reason?: "completed" | "steering" | "compaction" | "abort" | "error";
    readonly status: "complete" | "failed" | "steered";
    readonly style?: CSSProperties;
}

/** Formats a final turn duration without allowing its units to split across lines. */
function durationFormat(durationMs: number): string {
    const total = Math.max(0, Math.floor(durationMs / 1_000));
    if (total < 60) return `${total}s`;
    const minutes = Math.floor(total / 60);
    if (minutes < 60) return `${minutes}m\u00a0${total % 60}s`;
    return `${Math.floor(minutes / 60)}h\u00a0${minutes % 60}m`;
}

const TOKENS = new Intl.NumberFormat("en-US");

/** Exact token detail kept behind the settled row rather than in its resting layout. */
function tokenDetail(usedTokens?: number, finalContextTokens?: number): string | undefined {
    const parts: string[] = [];
    if (usedTokens !== undefined && Number.isFinite(usedTokens))
        parts.push(`Used ${TOKENS.format(Math.max(0, Math.round(usedTokens)))} tokens`);
    if (finalContextTokens !== undefined && Number.isFinite(finalContextTokens))
        parts.push(
            t("Final context {round} tokens", {
                round: TOKENS.format(Math.max(0, Math.round(finalContextTokens))),
            }),
        );
    return parts.length === 0 ? undefined : parts.join(" · ");
}

/** Neutral settled footer for one turn, including duration and final-message copy action. */
export function TurnSummary(props: TurnSummaryProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "copyText",
        "data-testid",
        "durationMs",
        "usedTokens",
        "finalContextTokens",
        "reason",
        "status",
        "style",
    ]);
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const reason = local.reason ?? (local.status === "steered" ? "steering" : undefined);
    // This footer settles a model turn, not the user's objective. A goal may
    // still be waiting or require further verification.
    const [verb, joiner] =
        reason === "steering"
            ? ["Steered", "after"]
            : reason === "compaction"
              ? ["Worked", "for"]
              : reason === "abort"
                ? ["Stopped", "after"]
                : reason === "error" || local.status === "failed"
                  ? ["Failed", "after"]
                  : ["Replied", "in"];
    const label =
        local.durationMs === undefined
            ? verb
            : `${verb} ${joiner}\u00a0${durationFormat(local.durationMs)}`;
    const detail = tokenDetail(local.usedTokens, local.finalContextTokens);
    const copy = async () => {
        try {
            if (local.copyText === undefined) return;
            await navigator.clipboard.writeText(local.copyText);
            setCopied(true);
            if (copiedTimer.current !== undefined) clearTimeout(copiedTimer.current);
            copiedTimer.current = setTimeout(() => {
                copiedTimer.current = undefined;
                setCopied(false);
            }, 1_600);
        } catch {
            // The browser owns clipboard permission; keep the copy affordance retryable.
        }
    };
    return (
        <div
            className={["kissopen-turn-summary", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="turn-summary"
            data-status={local.status}
            data-testid={local["data-testid"]}
            style={local.style}
        >
            {local.status === "complete" && local.copyText !== undefined ? (
                <button
                    aria-label={copied ? "Final message copied" : "Copy final message"}
                    className="kissopen-turn-summary__copy"
                    data-copied={copied ? "" : undefined}
                    data-kissopen-desktop-ui="turn-summary-copy"
                    onClick={() => void copy()}
                    type="button"
                >
                    <Icon name={copied ? "check" : "copy"} size={16} />
                </button>
            ) : null}
            <Tooltip className="kissopen-turn-summary__detail" label={detail} placement="top">
                <span
                    className="kissopen-turn-summary__label"
                    data-kissopen-desktop-ui="turn-summary-label"
                >
                    {label}
                </span>
            </Tooltip>
        </div>
    );
}
