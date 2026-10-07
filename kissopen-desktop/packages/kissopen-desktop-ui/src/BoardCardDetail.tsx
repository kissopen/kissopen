import {
    t,
    type KissopenAgentProjectCard,
    type KissopenAgentProjectDecision,
} from "kissopen-desktop-state";
import { useCallback } from "react";
import { BoardCardStateBadge, type BoardCard } from "./BoardBlocks";
import { ScrollArea } from "./Scrollbar";
import { Ionicon } from "./vectorIcons/VectorIcon";

/** Read-only evidence first. Opening this panel never starts an agent. */
export function BoardCardDetail(props: {
    readonly card: BoardCard;
    readonly record?: KissopenAgentProjectCard;
    readonly decisions: readonly KissopenAgentProjectDecision[];
    readonly updatedLabel?: string;
    readonly unavailable?: boolean;
    readonly focusOnOpen?: boolean;
    readonly onClose: () => void;
    readonly onContinue?: () => void;
    readonly onConversationOpen?: () => void;
    readonly onFileOpen?: (path: string) => void;
}) {
    const { card, record } = props;
    const state = record?.state ?? card.state;
    const focusClose = useCallback(
        (node: HTMLButtonElement | null) => {
            if (props.focusOnOpen) node?.focus({ preventScroll: true });
        },
        [props.focusOnOpen],
    );
    return (
        <aside
            className="kissopen-board-detail"
            aria-label={t("卡片详情")}
            data-kissopen-desktop-ui="board-card-detail"
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.stopPropagation();
                    props.onClose();
                }
            }}
        >
            <header className="kissopen-board-detail__header">
                <strong>{t("卡片详情")}</strong>
                <button
                    type="button"
                    className="kissopen-board-detail__close"
                    aria-label={t("关闭详情")}
                    ref={focusClose}
                    onClick={props.onClose}
                >
                    <Ionicon name="close" size={20} />
                </button>
            </header>
            <ScrollArea
                className="kissopen-board__scroll"
                viewportClassName="kissopen-board-detail__viewport"
            >
                <div className="kissopen-board-detail__body">
                    <BoardCardStateBadge state={state} />
                    <h2>{card.title}</h2>
                    <span className="kissopen-board-detail__muted">
                        {t("来自项目看板与卡片记录，不代表实时执行状态。")}
                    </span>
                    {props.updatedLabel && (
                        <span className="kissopen-board-detail__muted">{props.updatedLabel}</span>
                    )}
                    <section className="kissopen-board-detail__section">
                        <h3>{t("最近进展摘要")}</h3>
                        <p>{record?.note || card.detail || t("暂时没有进展记录。")}</p>
                    </section>
                    {record?.question && (
                        <section className="kissopen-board-detail__section">
                            <h3>{t("需要你决定")}</h3>
                            <p>{record.question.text}</p>
                            {record.question.options.length > 0 && (
                                <ul>
                                    {record.question.options.map((option) => (
                                        <li key={option}>{option}</li>
                                    ))}
                                </ul>
                            )}
                            <span className="kissopen-board-detail__muted">
                                {t("进入对话确认选择，也可以补充自己的想法。")}
                            </span>
                        </section>
                    )}
                    {record?.files.length || state === "done" ? (
                        <section className="kissopen-board-detail__section">
                            <h3>{t("已有成果")}</h3>
                            {record?.files.length ? (
                                record.files.map((path) => (
                                    <button
                                        type="button"
                                        key={path}
                                        className="kissopen-board-detail__file"
                                        disabled={!props.onFileOpen || props.unavailable}
                                        onClick={() => props.onFileOpen?.(path)}
                                    >
                                        <Ionicon name="document-text-outline" size={18} />
                                        <span>{path}</span>
                                        <Ionicon name="arrow-forward" size={16} />
                                    </button>
                                ))
                            ) : (
                                <p className="kissopen-board-detail__muted">
                                    {t("这张卡片还没有关联成果文件。")}
                                </p>
                            )}
                        </section>
                    ) : null}
                    {props.decisions.length > 0 && (
                        <section className="kissopen-board-detail__section">
                            <h3>{t("已确认的决定")}</h3>
                            {props.decisions.map((decision, index) => (
                                <div
                                    className="kissopen-board-detail__decision"
                                    key={`${decision.at}:${index}`}
                                >
                                    <p>{decision.question}</p>
                                    <strong>{decision.choice}</strong>
                                </div>
                            ))}
                        </section>
                    )}
                    {card.action && (
                        <section className="kissopen-board-detail__section">
                            <h3>{t("下一步")}</h3>
                            <p>{card.action.label}</p>
                        </section>
                    )}
                    {props.unavailable && (
                        <p className="kissopen-board-detail__muted" role="status">
                            {t("当前离线，可查看已有内容；连接恢复后可继续处理。")}
                        </p>
                    )}
                </div>
            </ScrollArea>
            <footer className="kissopen-board-detail__footer">
                {props.onContinue && state !== "done" && (
                    <button
                        type="button"
                        className="kissopen-board__primary"
                        disabled={props.unavailable}
                        onClick={props.onContinue}
                    >
                        {state === "needs_decision"
                            ? t("进入对话做决定")
                            : state === "waiting_material"
                              ? t("进入对话补充资料")
                              : state === "todo"
                                ? t("开始处理")
                                : t("继续处理")}
                        <Ionicon name="arrow-forward" size={16} />
                    </button>
                )}
                {props.onConversationOpen && (
                    <button
                        type="button"
                        className="kissopen-board__outline"
                        onClick={props.onConversationOpen}
                    >
                        {t("查看相关对话")}
                    </button>
                )}
            </footer>
        </aside>
    );
}
