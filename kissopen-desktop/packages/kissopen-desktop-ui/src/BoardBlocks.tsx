import { t } from "kissopen-desktop-state";
import type { IoniconName } from "./vectorIcons/ioniconsGlyphs";
import { Ionicon } from "./vectorIcons/VectorIcon";

/*
The pieces a project board is made of. The AI that builds a project's board
chooses which of these it needs and in what order, so a launch reads as a road
of milestones and a sales project as figures and a chart; this file only knows
how each kind is drawn. Props only.
*/

/** How much of the board's width a block takes. */
export type BoardBlockSize = "full" | "wide" | "half" | "third";

/** Something the reader can do from a block: say `prompt` to KISSOPEN in the project. */
export type BoardAction = { readonly label: string; readonly prompt: string };

/** Where one card of the board stands. */
export type BoardCardState =
    | "todo"
    | "in_progress"
    | "waiting_material"
    | "needs_decision"
    | "done";

/** A focus block or list item as a card: the thing its own conversation works on. */
export type BoardCard = {
    readonly id: string;
    readonly title: string;
    readonly detail: string;
    readonly state: BoardCardState;
    readonly action?: BoardAction;
};

/** The words a card's state is shown with; nothing for a card not started. */
export function boardCardStateLabel(state: BoardCardState | undefined): string | undefined {
    switch (state) {
        case "in_progress":
            return t("进行中");
        case "waiting_material":
            return t("等资料");
        case "needs_decision":
            return t("等你决定");
        case "done":
            return t("已完成");
        default:
            return undefined;
    }
}

/** A small badge for a card's state; nothing for a card not started. */
export function BoardCardStateBadge(props: { state: BoardCardState | undefined }) {
    const label = boardCardStateLabel(props.state);
    return label ? (
        <span className="kissopen-board__card-state" data-state={props.state}>
            {label}
        </span>
    ) : null;
}

/** The card an item is, when it carries an id; a card opens when it has something to open. */
export function boardCardOf(item: {
    readonly id?: string;
    readonly state?: BoardCardState;
    readonly title: string;
    readonly detail: string;
    readonly action?: BoardAction;
}): BoardCard | undefined {
    if (!item.id) return undefined;
    const state = item.state ?? "todo";
    return {
        id: item.id,
        title: item.title,
        detail: item.detail,
        state,
        ...(item.action ? { action: item.action } : {}),
    };
}

/** These labels describe the detail the reader will see, not an automatic run. */
export function boardCardActionLabel(state: BoardCardState): string {
    switch (state) {
        case "needs_decision":
            return t("去决定");
        case "waiting_material":
            return t("去处理");
        case "in_progress":
            return t("查看进度");
        case "done":
            return t("查看成果");
        case "todo":
            return t("查看下一步");
    }
}

export type BoardBlock =
    | {
          readonly type: "focus";
          readonly size: BoardBlockSize;
          readonly id?: string;
          readonly state?: BoardCardState;
          readonly eyebrow: string;
          readonly title: string;
          readonly detail: string;
          readonly action?: BoardAction;
          readonly chips: readonly { readonly title: string; readonly icon: string }[];
      }
    | {
          readonly type: "stats";
          readonly size: BoardBlockSize;
          readonly title: string;
          readonly items: readonly {
              readonly label: string;
              readonly value: string;
              readonly delta: string;
              readonly trend: "up" | "down" | "flat";
          }[];
      }
    | {
          readonly type: "milestones";
          readonly size: BoardBlockSize;
          readonly title: string;
          readonly note: string;
          readonly items: readonly {
              readonly title: string;
              readonly detail: string;
              readonly state: "done" | "current" | "todo";
              readonly icon: string;
          }[];
      }
    | {
          readonly type: "list";
          readonly size: BoardBlockSize;
          readonly title: string;
          readonly badge: string;
          readonly items: readonly {
              readonly id?: string;
              readonly state?: BoardCardState;
              readonly title: string;
              readonly detail: string;
              readonly tone: "accent" | "warn" | "good" | "quiet";
              readonly action?: BoardAction;
          }[];
      }
    | {
          readonly type: "progress";
          readonly size: BoardBlockSize;
          readonly title: string;
          readonly items: readonly {
              readonly label: string;
              readonly percent: number;
              readonly detail: string;
          }[];
      }
    | {
          readonly type: "chart";
          readonly size: BoardBlockSize;
          readonly title: string;
          readonly note: string;
          readonly kind: "line" | "bar";
          readonly unit: string;
          readonly labels: readonly string[];
          readonly series: readonly { readonly name: string; readonly values: readonly number[] }[];
      }
    | {
          readonly type: "table";
          readonly size: BoardBlockSize;
          readonly title: string;
          readonly columns: readonly string[];
          readonly rows: readonly (readonly string[])[];
      }
    | {
          readonly type: "text";
          readonly size: BoardBlockSize;
          readonly title: string;
          readonly body: string;
      }
    | {
          readonly type: "files";
          readonly size: BoardBlockSize;
          readonly title: string;
          readonly items: readonly {
              readonly name: string;
              readonly path: string;
              readonly detail: string;
          }[];
      }
    | {
          readonly type: "note";
          readonly size: BoardBlockSize;
          readonly title: string;
          readonly body: string;
      };

export type BoardBlockHandlers = {
    /**
     * Asks the project's assistant what a board button says. `prompt` is what
     * the assistant reads; `label` is all a person sees of it in the
     * conversation — the button and what it is about, never the prompt.
     */
    readonly onAsk: (prompt: string, label: string) => void;
    /**
     * Opens a card's own conversation. Where it is given, a card with an
     * action or a state other than not started opens through it instead of
     * asking its prompt.
     */
    readonly onCard?: (card: BoardCard) => void;
    /** Opens a file of the project by its path inside the project. */
    readonly onFileOpen?: (path: string) => void;
    readonly unavailable?: boolean;
};

const ICONS: Record<string, IoniconName> = {
    box: "cube-outline",
    doc: "document-text-outline",
    chart: "bar-chart-outline",
    check: "checkmark-circle-outline",
    rocket: "rocket-outline",
    calendar: "calendar-outline",
    people: "people-outline",
    flag: "flag-outline",
    mail: "mail-outline",
    money: "cash-outline",
    image: "image-outline",
    cart: "cart-outline",
    globe: "globe-outline",
    star: "star-outline",
};

export const boardIconOf = (name: string): IoniconName => ICONS[name] ?? "document-text-outline";

export function BoardBlockView(props: { block: BoardBlock } & BoardBlockHandlers) {
    const block = props.block;
    return (
        <section
            className="kissopen-board__card kissopen-board__block"
            data-kind={block.type}
            data-size={block.size}
        >
            {block.type !== "focus" && block.type !== "note" && block.title && (
                <div className="kissopen-board__card-head">
                    <h2 className="kissopen-board__card-title">{block.title}</h2>
                    {block.type === "milestones" && block.note && (
                        <span className="kissopen-board__card-note">{block.note}</span>
                    )}
                    {block.type === "chart" && block.note && (
                        <span className="kissopen-board__card-note">{block.note}</span>
                    )}
                    {block.type === "list" && block.badge && (
                        <span className="kissopen-board__count">{block.badge}</span>
                    )}
                </div>
            )}
            <BlockBody {...props} />
        </section>
    );
}

function BlockBody(props: { block: BoardBlock } & BoardBlockHandlers) {
    const block = props.block;
    switch (block.type) {
        case "focus": {
            const card = props.onCard ? boardCardOf(block) : undefined;
            return (
                <div className="kissopen-board__focus">
                    {(block.eyebrow || boardCardStateLabel(block.state)) && (
                        <span className="kissopen-board__focus-head">
                            {block.eyebrow && (
                                <span className="kissopen-board__eyebrow">{block.eyebrow}</span>
                            )}
                            <BoardCardStateBadge state={block.state} />
                        </span>
                    )}
                    <h2 className="kissopen-board__next-title">{block.title}</h2>
                    {block.detail && <p className="kissopen-board__quiet">{block.detail}</p>}
                    {card ? (
                        <button
                            className="kissopen-board__primary"
                            onClick={() => props.onCard!(card)}
                            type="button"
                        >
                            {boardCardActionLabel(card.state)}
                            <Ionicon name="arrow-forward" size={16} />
                        </button>
                    ) : (
                        block.action && (
                            <button
                                className="kissopen-board__primary"
                                disabled={props.unavailable}
                                onClick={() =>
                                    props.onAsk(
                                        block.action!.prompt,
                                        boardAskLabel(block.action!.label, block.title),
                                    )
                                }
                                type="button"
                            >
                                {block.action.label}
                                <Ionicon name="arrow-forward" size={16} />
                            </button>
                        )
                    )}
                    {block.chips.length > 0 && (
                        <span className="kissopen-board__chips">
                            {block.chips.map((chip) => (
                                <span className="kissopen-board__chip" key={chip.title}>
                                    <Ionicon name={boardIconOf(chip.icon)} size={18} />
                                    {chip.title}
                                </span>
                            ))}
                        </span>
                    )}
                </div>
            );
        }
        case "stats":
            return (
                <div className="kissopen-board__stats">
                    {block.items.map((item) => (
                        <div className="kissopen-board__stat" key={item.label}>
                            <span className="kissopen-board__stat-label">{item.label}</span>
                            <span className="kissopen-board__stat-value">{item.value}</span>
                            {item.delta && (
                                <span
                                    className="kissopen-board__stat-delta"
                                    data-trend={item.trend}
                                >
                                    {item.delta}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            );
        case "milestones":
            return (
                <ol className="kissopen-board__milestones">
                    {block.items.map((item) => (
                        <li
                            className="kissopen-board__milestone"
                            data-state={item.state}
                            key={item.title}
                        >
                            <span className="kissopen-board__milestone-icon">
                                <Ionicon
                                    name={
                                        item.state === "done"
                                            ? "checkmark-circle"
                                            : boardIconOf(item.icon)
                                    }
                                    size={22}
                                />
                            </span>
                            <span className="kissopen-board__milestone-title">{item.title}</span>
                            <span className="kissopen-board__milestone-detail">{item.detail}</span>
                        </li>
                    ))}
                </ol>
            );
        case "list":
            return (
                <div className="kissopen-board__decision-list">
                    {block.items.map((item) => {
                        const content = (
                            <>
                                <span
                                    className="kissopen-board__dot"
                                    data-tone={item.tone}
                                    aria-hidden="true"
                                />
                                <span className="kissopen-board__decision-copy">
                                    <span className="kissopen-board__decision-title">
                                        {item.title}
                                        <BoardCardStateBadge state={item.state} />
                                    </span>
                                    {item.detail && (
                                        <span className="kissopen-board__decision-detail">
                                            {item.detail}
                                        </span>
                                    )}
                                </span>
                            </>
                        );
                        const card = props.onCard ? boardCardOf(item) : undefined;
                        const key = item.id ?? item.title;
                        return card ? (
                            <button
                                className="kissopen-board__decision"
                                data-state={card.state}
                                key={key}
                                onClick={() => props.onCard!(card)}
                                title={boardCardActionLabel(card.state)}
                                type="button"
                            >
                                {content}
                                <span className="kissopen-board__decision-action">
                                    {boardCardActionLabel(card.state)}
                                </span>
                                <Ionicon name="arrow-forward" size={16} />
                            </button>
                        ) : item.action ? (
                            <button
                                className="kissopen-board__decision"
                                disabled={props.unavailable}
                                key={key}
                                onClick={() =>
                                    props.onAsk(
                                        item.action!.prompt,
                                        boardAskLabel(item.action!.label, item.title),
                                    )
                                }
                                title={item.action.label}
                                type="button"
                            >
                                {content}
                                <Ionicon name="arrow-forward" size={16} />
                            </button>
                        ) : (
                            <div
                                className="kissopen-board__decision"
                                data-state={item.state}
                                data-static=""
                                key={key}
                            >
                                {content}
                            </div>
                        );
                    })}
                </div>
            );
        case "progress":
            return (
                <div className="kissopen-board__bars">
                    {block.items.map((item) => (
                        <div className="kissopen-board__bar-row" key={item.label}>
                            <span className="kissopen-board__bar-head">
                                <span className="kissopen-board__bar-label">{item.label}</span>
                                <span className="kissopen-board__bar-percent">{item.percent}%</span>
                            </span>
                            <span className="kissopen-board__bar">
                                <span
                                    className="kissopen-board__bar-fill"
                                    style={{ width: `${item.percent}%` }}
                                />
                            </span>
                            {item.detail && (
                                <span className="kissopen-board__bar-detail">{item.detail}</span>
                            )}
                        </div>
                    ))}
                </div>
            );
        case "chart":
            return <BoardChart block={block} />;
        case "table":
            return (
                <div className="kissopen-board__table-wrap">
                    <table className="kissopen-board__table">
                        <thead>
                            <tr>
                                {block.columns.map((column) => (
                                    <th key={column}>{column}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, index) => (
                                // Rows carry no identity of their own; their order is the content.
                                <tr key={index}>
                                    {block.columns.map((column, cell) => (
                                        <td key={column}>{row[cell] ?? ""}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        case "text":
            return <p className="kissopen-board__body">{block.body}</p>;
        case "files":
            return (
                <div className="kissopen-board__file-list">
                    {block.items.map((item) => (
                        <button
                            className="kissopen-board__file"
                            disabled={!props.onFileOpen}
                            key={item.path}
                            onClick={() => props.onFileOpen?.(item.path)}
                            type="button"
                        >
                            <span className="kissopen-board__tile">
                                <Ionicon name="document-text-outline" size={20} />
                            </span>
                            <span className="kissopen-board__decision-copy">
                                <span className="kissopen-board__decision-title">{item.name}</span>
                                <span className="kissopen-board__decision-detail">
                                    {item.detail || item.path}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            );
        case "note":
            return (
                <div className="kissopen-board__note">
                    <span className="kissopen-board__reminder-mark" aria-hidden="true">
                        <Ionicon name="sparkles" size={28} />
                    </span>
                    <span className="kissopen-board__reminder-copy">
                        <h2 className="kissopen-board__card-title">
                            {block.title || t("AI 的提醒")}
                        </h2>
                        <span className="kissopen-board__reminder-text">{block.body}</span>
                    </span>
                </div>
            );
    }
}

const SERIES_COLORS = ["var(--home-accent)", "var(--home-green)", "var(--home-peach)"];

/* A small line or bar chart; its axis starts near the lowest value so a trend reads as a slope. */
function BoardChart(props: { block: Extract<BoardBlock, { type: "chart" }> }) {
    const block = props.block;
    const width = 420;
    const height = 170;
    const left = 40;
    const bottom = 22;
    const values = block.series.flatMap((series) => series.values);
    const low = Math.min(0, ...values);
    const high = Math.max(1, ...values);
    const points = Math.max(1, block.labels.length);
    // A line runs edge to edge; bars sit in the middle of equal slots.
    const x = (index: number) =>
        block.kind === "bar"
            ? left + ((index + 0.5) * (width - left - 10)) / points
            : left + (index * (width - left - 10)) / Math.max(1, points - 1);
    const y = (value: number) =>
        8 + (1 - (value - low) / (high - low || 1)) * (height - bottom - 8);
    const ticks = [low, low + (high - low) / 2, high];
    const barWidth = Math.max(4, (width - left - 10) / points / (block.series.length + 1));
    return (
        <div className="kissopen-board__chart">
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={block.title}>
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            className="kissopen-board__chart-grid"
                            x1={left}
                            x2={width - 4}
                            y1={y(tick)}
                            y2={y(tick)}
                        />
                        <text
                            className="kissopen-board__chart-axis"
                            x={left - 6}
                            y={y(tick) + 4}
                            textAnchor="end"
                        >
                            {`${block.unit === "$" || block.unit === "¥" ? block.unit : ""}${high - low >= 10 ? Math.round(tick) : Math.round(tick * 10) / 10}`}
                        </text>
                    </g>
                ))}
                {block.series.map((series, index) =>
                    block.kind === "line" ? (
                        <polyline
                            className="kissopen-board__chart-line"
                            key={series.name}
                            points={series.values
                                .map((value, point) => `${x(point)},${y(value)}`)
                                .join(" ")}
                            style={{ stroke: SERIES_COLORS[index % SERIES_COLORS.length] }}
                        />
                    ) : (
                        <g
                            key={series.name}
                            style={{ fill: SERIES_COLORS[index % SERIES_COLORS.length] }}
                        >
                            {series.values.map((value, point) => (
                                <rect
                                    // Points are positions on the axis, not entities.
                                    key={point}
                                    x={
                                        x(point) -
                                        (barWidth * block.series.length) / 2 +
                                        index * barWidth
                                    }
                                    y={y(value)}
                                    width={barWidth - 2}
                                    height={Math.max(0, y(low) - y(value))}
                                    rx={3}
                                />
                            ))}
                        </g>
                    ),
                )}
                {block.labels.map((label, index) => (
                    <text
                        className="kissopen-board__chart-axis"
                        // Labels are positions on the axis, not entities.
                        key={index}
                        x={x(index)}
                        y={height - 4}
                        textAnchor="middle"
                    >
                        {label}
                    </text>
                ))}
            </svg>
            {block.series.length > 1 && (
                <span className="kissopen-board__legend">
                    {block.series.map((series, index) => (
                        <span key={series.name}>
                            <i
                                style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
                            />
                            {series.name}
                        </span>
                    ))}
                </span>
            )}
        </div>
    );
}

/** What a board button's ask is shown as in the conversation: the button and its subject. */
function boardAskLabel(action: string, subject: string): string {
    return subject.trim().length > 0 ? `${action}：${subject}` : action;
}
