import { t, type KissopenAgentProjectDocument } from "kissopen-desktop-state";
import { useCallback, useRef, useState, type FormEvent } from "react";
import {
    BoardBlockView,
    boardCardOf,
    boardIconOf,
    type BoardBlock,
    type BoardCard,
} from "./BoardBlocks";
import { BoardCardDetail } from "./BoardCardDetail";
import { ScrollArea } from "./Scrollbar";
import { Ionicon } from "./vectorIcons/VectorIcon";

/*
A project's first screen: the board its agent built from the project's chats
and files, drawn from whatever blocks the agent chose for this project, above
the project's own recent conversations and an ask bar that speaks into it.

Props only. The caller owns reading the board file (it is kept current while
`onWatch` holds), building it, its schedule, and what asking means.
*/

export type ProjectBoardDocument = {
    readonly title: string;
    readonly subtitle: string;
    readonly icon: string;
    readonly due: string;
    readonly blocks: readonly BoardBlock[];
};

/** One of the project's conversations, newest first. */
export type ProjectBoardRecent = {
    readonly id: string;
    readonly agentId?: string;
    readonly title: string;
    /** Epoch milliseconds of its newest message. */
    readonly updatedAt: number;
};

/** Where building the board stands. */
export type ProjectBoardBuild = {
    /** A build is queued or running now. */
    readonly running: boolean;
    /** Before execution: submitting locally, or accepted and waiting to start. */
    readonly phase?: "submitting" | "waiting";
    /** When it builds on its own, in words, e.g. "每天 09:00 自动更新"; absent when it does not. */
    readonly schedule?: string;
    /** When the last build ended, epoch milliseconds. */
    readonly lastEndedAt?: number;
    /** Why the last build did not finish, when it did not. */
    readonly lastError?: string;
};

export type ProjectBoardProps = {
    /** The project's own name, shown until the board names it. */
    readonly name: string;
    readonly now: number;
    readonly state: "loading" | "missing" | "ready" | "invalid";
    readonly document?: ProjectBoardDocument;
    readonly project?: KissopenAgentProjectDocument;
    /** Background reads never replace a readable board with a loader. */
    readonly sync?: "cached" | "refreshing" | "current" | "unavailable";
    /** Why the board file could not be drawn, when state is invalid. */
    readonly invalidReason?: string;
    readonly build: ProjectBoardBuild;
    readonly recent: readonly ProjectBoardRecent[];
    /** Nothing can be sent in this project right now. */
    readonly unavailable?: boolean;
    /** Keeps the board current while it is on screen; returns the way to stop. */
    readonly onWatch: () => () => void;
    /** Builds the board now; absent where it cannot be built from here. */
    readonly onBuild?: () => void;
    /**
     * Starts the project's setup: a conversation that asks what the project is
     * and builds the first board once it knows. What an empty board leads with.
     */
    readonly onSetup?: () => void;
    /** Why the board cannot be built from here, when it cannot. */
    readonly buildUnavailable?: string;
    /** Opens the project's settings, where its scheduled build is set. */
    readonly onScheduleOpen?: () => void;
    /** Says something to KISSOPEN in this project. */
    /**
     * Asks the project's assistant. `label`, given for a board button, is all a
     * person sees of the prompt in the conversation; the ask bar's own words
     * are the person's and carry none.
     */
    readonly onAsk: (text: string, label?: string) => void;
    /** Opens a board card's own conversation; without it a card's action is asked as text. */
    readonly onCard?: (card: BoardCard) => void;
    readonly onConversationOpen: (id: string) => void;
    /** Opens a file of the project by its path inside the project. */
    readonly onFileOpen?: (path: string) => void;
    /** Shows every file of the project, in the panel beside the board. */
    readonly onFilesOpen?: () => void;
    /**
     * Whether the AI reads material uploaded into the project, and the switch.
     * `dueAt` is when the next reading starts, 0 when none is waiting.
     */
    readonly analysis?: {
        readonly enabled: boolean;
        readonly dueAt: number;
        readonly onToggle: () => void;
    };
};

function sinceOf(at: number, now: number): string {
    const seconds = Math.max(1, Math.round((now - at) / 1000));
    if (seconds < 60) return t("{count} 秒前", { count: seconds });
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return t("{count} 分钟前", { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t("{count} 小时前", { count: hours });
    return t("{count} 天前", { count: Math.round(hours / 24) });
}

export function ProjectBoard(props: ProjectBoardProps) {
    // Status updates must not detach the ref and restart the transport watch.
    const watchRef = useCallback(
        (node: HTMLElement | null) => (node ? props.onWatch() : undefined),
        [props.onWatch],
    );
    const board = props.state === "ready" ? props.document : undefined;
    const [selectedCardId, setSelectedCardId] = useState<string>();
    const opener = useRef<HTMLElement | null>(null);
    const selectedCard = board?.blocks
        .flatMap((block) =>
            block.type === "focus"
                ? [boardCardOf(block)]
                : block.type === "list"
                  ? block.items.map(boardCardOf)
                  : [],
        )
        .find((card) => card?.id === selectedCardId);
    const record = selectedCard ? props.project?.cards[selectedCard.id] : undefined;
    const related = record?.agent
        ? props.recent.find((entry) => entry.agentId === record.agent)
        : undefined;
    const closeDetail = () => {
        setSelectedCardId(undefined);
        opener.current?.focus();
    };
    const openFile = props.onFileOpen
        ? (path: string) => {
              setSelectedCardId(undefined);
              props.onFileOpen!(path);
          }
        : undefined;
    const build = props.build;
    const analysisDue =
        props.analysis?.enabled && props.analysis.dueAt > props.now ? props.analysis.dueAt : 0;
    const busy = build.running || build.phase !== undefined;
    const buildLabel =
        build.phase === "submitting"
            ? t("正在提交…")
            : build.phase === "waiting"
              ? t("等待开始…")
              : t("构建中…");
    const status =
        build.phase === "submitting"
            ? t("正在提交看板构建请求…")
            : build.phase === "waiting"
              ? t("请求已提交，等待执行器开始构建…")
              : build.running
                ? t("AI 正在根据项目的对话和文件构建看板…")
                : build.lastError
                  ? t("上次构建没有完成：{reason}", { reason: build.lastError })
                  : analysisDue
                    ? t("新上传的资料将在 {minutes} 分钟内由 AI 分析", {
                          minutes: Math.max(1, Math.ceil((analysisDue - props.now) / 60_000)),
                      })
                    : [
                          build.schedule,
                          build.lastEndedAt
                              ? t("上次更新 {since}", {
                                    since: sinceOf(build.lastEndedAt, props.now),
                                })
                              : undefined,
                      ]
                          .filter(Boolean)
                          .join(" · ");
    return (
        <section className="kissopen-board" data-kissopen-desktop-ui="project-board" ref={watchRef}>
            <div className="kissopen-board__main">
                <ScrollArea
                    className="kissopen-board__scroll"
                    viewportClassName="kissopen-board__viewport"
                >
                    <div className="kissopen-board__page">
                        <header className="kissopen-board__header">
                            <span className="kissopen-board__mark" aria-hidden="true">
                                <Ionicon name={boardIconOf(board?.icon ?? "rocket")} size={30} />
                            </span>
                            <div className="kissopen-board__heading">
                                <h1 className="kissopen-board__goal">
                                    {board?.title || props.name}
                                </h1>
                                <p className="kissopen-board__summary">
                                    {board?.subtitle || t("AI 根据项目的对话和文件构建的看板")}
                                </p>
                            </div>
                            <div className="kissopen-board__header-side">
                                {props.onFilesOpen && (
                                    <button
                                        className="kissopen-board__adjust"
                                        onClick={() => {
                                            setSelectedCardId(undefined);
                                            props.onFilesOpen?.();
                                        }}
                                        type="button"
                                    >
                                        <Ionicon name="folder-open-outline" size={16} />
                                        {t("项目文件")}
                                    </button>
                                )}
                                {props.analysis && (
                                    <button
                                        aria-pressed={props.analysis.enabled}
                                        className="kissopen-board__adjust"
                                        onClick={props.analysis.onToggle}
                                        title={t(
                                            "上传到项目的新文件会由 AI 读一遍，要点写进 .kissopen/资料摘要.md 和看板。",
                                        )}
                                        type="button"
                                    >
                                        <Ionicon
                                            name={
                                                props.analysis.enabled
                                                    ? "sparkles-outline"
                                                    : "pause-circle-outline"
                                            }
                                            size={16}
                                        />
                                        {props.analysis.enabled
                                            ? t("自动分析新资料：开")
                                            : t("自动分析新资料：关")}
                                    </button>
                                )}
                                {board?.due && (
                                    <span className="kissopen-board__due">
                                        <span className="kissopen-board__due-icon">
                                            <Ionicon name="calendar-outline" size={20} />
                                        </span>
                                        <span className="kissopen-board__due-copy">
                                            <span className="kissopen-board__due-label">
                                                {t("目标日期")}
                                            </span>
                                            <span className="kissopen-board__due-value">
                                                {board.due}
                                            </span>
                                        </span>
                                    </span>
                                )}
                                {props.onScheduleOpen && (
                                    <button
                                        className="kissopen-board__adjust"
                                        onClick={props.onScheduleOpen}
                                        type="button"
                                    >
                                        <Ionicon name="time-outline" size={16} />
                                        {t("定时构建")}
                                    </button>
                                )}
                                {props.onBuild && board && (
                                    <button
                                        className="kissopen-board__adjust"
                                        disabled={busy || props.unavailable}
                                        onClick={props.onBuild}
                                        type="button"
                                    >
                                        <Ionicon name="sparkles-outline" size={16} />
                                        {busy ? buildLabel : t("立即更新")}
                                    </button>
                                )}
                            </div>
                        </header>
                        {status && (
                            <p
                                className="kissopen-board__status"
                                data-running={busy ? "" : undefined}
                            >
                                <Ionicon name={busy ? "sparkles" : "time-outline"} size={14} />
                                {status}
                            </p>
                        )}

                        {props.sync && board && (
                            <p
                                className="kissopen-board__sync"
                                data-unavailable={props.sync === "unavailable" ? "" : undefined}
                                role="status"
                            >
                                <Ionicon
                                    name={
                                        props.sync === "unavailable"
                                            ? "cloud-offline-outline"
                                            : "cloud-outline"
                                    }
                                    size={14}
                                />
                                {props.sync === "unavailable"
                                    ? t(
                                          "暂时未能更新，正在显示上次保存的内容；恢复连接后会自动重试。",
                                      )
                                    : props.sync === "current"
                                      ? t("已同步最新看板")
                                      : t("已显示保存的看板，正在后台检查更新…")}
                            </p>
                        )}
                        {props.state === "loading" && props.sync === "unavailable" ? (
                            <section
                                className="kissopen-board__card kissopen-board__empty"
                                role="status"
                            >
                                <Ionicon name="cloud-offline-outline" size={32} />
                                <h2 className="kissopen-board__next-title">
                                    {t("暂时无法读取看板")}
                                </h2>
                                <p className="kissopen-board__quiet">
                                    {t(
                                        "本机还没有可显示的看板。连接恢复后会自动重试，不必重新打开项目。",
                                    )}
                                </p>
                                {props.onBuild && (
                                    <button
                                        className="kissopen-board__primary"
                                        type="button"
                                        disabled={busy || props.unavailable}
                                        onClick={props.onBuild}
                                    >
                                        {busy ? buildLabel : t("生成看板")}
                                    </button>
                                )}
                            </section>
                        ) : props.state === "loading" ? (
                            <div className="kissopen-board__loading" aria-busy="true">
                                <p className="kissopen-board__loading-status" role="status">
                                    <span
                                        className="kissopen-board__loading-dot"
                                        aria-hidden="true"
                                    />
                                    {t("正在读取项目看板…")}
                                </p>
                                <div className="kissopen-board__skeleton" aria-hidden="true">
                                    {(["overview", "detail", "detail"] as const).map(
                                        (kind, index) => (
                                            <div
                                                className="kissopen-board__skeleton-card"
                                                data-kind={kind}
                                                key={index}
                                            >
                                                <div className="kissopen-board__skeleton-heading">
                                                    <span className="kissopen-board__skeleton-icon" />
                                                    <span
                                                        className="kissopen-board__skeleton-line"
                                                        data-size="title"
                                                    />
                                                </div>
                                                <span
                                                    className="kissopen-board__skeleton-line"
                                                    data-size="long"
                                                />
                                                <span
                                                    className="kissopen-board__skeleton-line"
                                                    data-size="short"
                                                />
                                                <span
                                                    className="kissopen-board__skeleton-line"
                                                    data-size="bar"
                                                />
                                            </div>
                                        ),
                                    )}
                                </div>
                            </div>
                        ) : !board ? (
                            <section className="kissopen-board__card kissopen-board__empty">
                                <span className="kissopen-board__files-art" aria-hidden="true">
                                    <Ionicon name="sparkles-outline" size={40} />
                                </span>
                                <h2 className="kissopen-board__next-title">
                                    {props.state === "invalid"
                                        ? t("看板文件读不出来")
                                        : t("这个项目还没有看板")}
                                </h2>
                                <p className="kissopen-board__quiet">
                                    {props.state === "invalid"
                                        ? (props.invalidReason ?? "")
                                        : props.onSetup
                                          ? t(
                                                "先初始化项目：AI 会问你几个问题，把目标、时间和资料弄清楚，然后按项目的样子搭一个看板。",
                                            )
                                          : t(
                                                "AI 会读这个项目里的对话、uploads 里的资料和 outputs 里的成果，按项目的样子搭一个看板。可以现在生成，也可以设置定时更新。",
                                            )}
                                </p>
                                {props.buildUnavailable && props.state !== "invalid" ? (
                                    <p className="kissopen-board__quiet">
                                        {props.buildUnavailable}
                                    </p>
                                ) : null}
                                <span className="kissopen-board__empty-actions">
                                    {props.onSetup && props.state !== "invalid" && (
                                        <button
                                            className="kissopen-board__primary"
                                            disabled={busy || props.unavailable}
                                            onClick={props.onSetup}
                                            type="button"
                                        >
                                            {t("初始化项目")}
                                            <Ionicon name="arrow-forward" size={16} />
                                        </button>
                                    )}
                                    {props.onBuild && (
                                        <button
                                            className={
                                                props.onSetup && props.state !== "invalid"
                                                    ? "kissopen-board__outline"
                                                    : "kissopen-board__primary"
                                            }
                                            disabled={busy || props.unavailable}
                                            onClick={props.onBuild}
                                            type="button"
                                        >
                                            {busy
                                                ? buildLabel
                                                : props.onSetup && props.state !== "invalid"
                                                  ? t("直接生成看板")
                                                  : t("生成看板")}
                                            {!(props.onSetup && props.state !== "invalid") && (
                                                <Ionicon name="arrow-forward" size={16} />
                                            )}
                                        </button>
                                    )}
                                    {props.onScheduleOpen && (
                                        <button
                                            className="kissopen-board__outline"
                                            onClick={props.onScheduleOpen}
                                            type="button"
                                        >
                                            {t("设置定时构建")}
                                        </button>
                                    )}
                                </span>
                            </section>
                        ) : (
                            <div className="kissopen-board__blocks">
                                {board.blocks.map((block, index) => (
                                    <BoardBlockView
                                        block={block}
                                        key={`${block.type}:${index}`}
                                        onAsk={props.onAsk}
                                        onCard={(card) => {
                                            opener.current =
                                                document.activeElement instanceof HTMLElement
                                                    ? document.activeElement
                                                    : null;
                                            setSelectedCardId(card.id);
                                        }}
                                        {...(openFile ? { onFileOpen: openFile } : {})}
                                        unavailable={props.unavailable}
                                    />
                                ))}
                            </div>
                        )}

                        {props.recent.length > 0 && (
                            <section
                                className="kissopen-board__card kissopen-board__recent"
                                aria-labelledby="board-recent"
                            >
                                <h2 className="kissopen-board__card-title" id="board-recent">
                                    {t("最近的对话")}
                                </h2>
                                {props.recent.slice(0, 4).map((entry) => (
                                    <button
                                        className="kissopen-board__progress"
                                        key={entry.id}
                                        onClick={() => props.onConversationOpen(entry.id)}
                                        type="button"
                                    >
                                        <span className="kissopen-board__tile">
                                            <Ionicon name="chatbubble-ellipses-outline" size={20} />
                                        </span>
                                        <span className="kissopen-board__progress-copy">
                                            <span className="kissopen-board__progress-title">
                                                {entry.title}
                                            </span>
                                        </span>
                                        <span className="kissopen-board__progress-time">
                                            {sinceOf(entry.updatedAt, props.now)}
                                        </span>
                                    </button>
                                ))}
                            </section>
                        )}
                    </div>
                </ScrollArea>
                <AskBar onAsk={props.onAsk} unavailable={props.unavailable} />
            </div>
            {selectedCard && (
                <BoardCardDetail
                    focusOnOpen
                    card={selectedCard}
                    {...(record ? { record } : {})}
                    decisions={
                        props.project?.decisions.filter(
                            (decision) => decision.card === selectedCard.id,
                        ) ?? []
                    }
                    {...(record?.updated
                        ? { updatedLabel: t("记录更新时间：{time}", { time: record.updated }) }
                        : build.lastEndedAt
                          ? {
                                updatedLabel: t("上次更新 {since}", {
                                    since: sinceOf(build.lastEndedAt, props.now),
                                }),
                            }
                          : {})}
                    unavailable={props.unavailable}
                    onClose={closeDetail}
                    {...(props.onCard
                        ? {
                              onContinue: () => {
                                  setSelectedCardId(undefined);
                                  props.onCard!(selectedCard);
                              },
                          }
                        : selectedCard.action
                          ? {
                                onContinue: () => {
                                    setSelectedCardId(undefined);
                                    props.onAsk(
                                        selectedCard.action!.prompt,
                                        selectedCard.action!.label,
                                    );
                                },
                            }
                          : {})}
                    {...(related
                        ? {
                              onConversationOpen: () => {
                                  setSelectedCardId(undefined);
                                  props.onConversationOpen(related.id);
                              },
                          }
                        : {})}
                    {...(openFile ? { onFileOpen: openFile } : {})}
                />
            )}
        </section>
    );
}

function AskBar(props: { onAsk: (text: string) => void; unavailable?: boolean }) {
    const [text, setText] = useState("");
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const value = text.trim();
        if (!value || props.unavailable) return;
        props.onAsk(value);
        setText("");
    };
    return (
        <form className="kissopen-board__ask" onSubmit={submit}>
            <input
                aria-label={t("在这个项目中，问KissOpen…")}
                className="kissopen-board__ask-input"
                disabled={props.unavailable}
                onChange={(event) => setText(event.target.value)}
                placeholder={t("在这个项目中，问KissOpen…")}
                value={text}
            />
            <button
                aria-label={t("发送")}
                className="kissopen-board__ask-send"
                disabled={props.unavailable || text.trim() === ""}
                type="submit"
            >
                <Ionicon name="arrow-up" size={18} />
            </button>
        </form>
    );
}
