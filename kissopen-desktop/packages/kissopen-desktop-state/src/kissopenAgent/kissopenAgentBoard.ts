/*
A project's board: the file the project's agent writes on its schedule, at
`.kissopen/board.json` in the project, and the desktop draws.

The file is written by a model, so everything in it is read here against the
same format and limits the build instruction states (see the desktop's
`boardBuildText`), and what does not fit is left out: a block that is out of
shape is dropped rather than drawn wrong, and a board with no usable block is
no board. Nothing is guessed back into place.
*/

import { t } from "../i18n/locale.js";
import {
    kissopenAgentProjectParse,
    type KissopenAgentProjectDocument,
} from "./kissopenAgentProjectState.js";

/** Where a project keeps its board, relative to the project folder. */
export const KISSOPEN_AGENT_BOARD_PATH = ".kissopen/board.json";
/** Where a project keeps what its card conversations report, next to the board. */
export const KISSOPEN_AGENT_PROJECT_PATH = ".kissopen/project.json";

export type KissopenAgentBoardSize = "full" | "wide" | "half" | "third";
export type KissopenAgentBoardAction = { readonly label: string; readonly prompt: string };

/** Where one card of the board stands; the card's conversation keeps it in project.json. */
export type KissopenAgentBoardCardState =
    | "todo"
    | "in_progress"
    | "waiting_material"
    | "needs_decision"
    | "done";
export const KISSOPEN_AGENT_BOARD_CARD_STATES: readonly KissopenAgentBoardCardState[] = [
    "todo",
    "in_progress",
    "waiting_material",
    "needs_decision",
    "done",
];

/**
 * One thing to do on a board — a focus block or a list item — with the id
 * its own conversation is found by.
 */
export interface KissopenAgentBoardCard {
    readonly id: string;
    readonly title: string;
    readonly detail: string;
    readonly state: KissopenAgentBoardCardState;
    readonly action?: KissopenAgentBoardAction;
}

/**
 * The card a project's setup conversation is started under: 初始化项目 on an
 * empty board. No board holds it; the agent knows its conversation by the id
 * derived from it, and interviews the person before building the first board.
 */
export const KISSOPEN_PROJECT_SETUP_CARD_ID = "project-setup";

/** The card 初始化项目 starts; what it asks is the setup conversation's first message. */
export function kissopenProjectSetupCard(): KissopenAgentBoardCard {
    return {
        id: KISSOPEN_PROJECT_SETUP_CARD_ID,
        title: t("初始化项目"),
        detail: t("帮我初始化这个项目：先问我几个问题把它弄清楚，然后生成看板。"),
        state: "todo",
    };
}

/** The shape every card id has, on the board and in project.json. */
export const KISSOPEN_AGENT_BOARD_CARD_ID = /^[a-z0-9][a-z0-9-]{1,31}$/u;

/** FNV-1a, 32 bits, over the UTF-8 bytes of the text; lowercase 8-digit hex. */
function fnv1a32hex(value: string): string {
    let hash = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(value)) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
}

/**
 * A card's id: the one the board gives it when that is well formed, else one
 * derived from its trimmed title, the same way on every surface.
 */
export function kissopenAgentBoardCardId(id: unknown, title: string): string {
    return typeof id === "string" && KISSOPEN_AGENT_BOARD_CARD_ID.test(id)
        ? id
        : `t${fnv1a32hex(title.trim())}`;
}

export type KissopenAgentBoardBlock =
    | {
          readonly type: "focus";
          readonly size: KissopenAgentBoardSize;
          readonly id: string;
          readonly state: KissopenAgentBoardCardState;
          readonly eyebrow: string;
          readonly title: string;
          readonly detail: string;
          readonly action?: KissopenAgentBoardAction;
          readonly chips: readonly { readonly title: string; readonly icon: string }[];
      }
    | {
          readonly type: "stats";
          readonly size: KissopenAgentBoardSize;
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
          readonly size: KissopenAgentBoardSize;
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
          readonly size: KissopenAgentBoardSize;
          readonly title: string;
          readonly badge: string;
          readonly items: readonly {
              readonly id: string;
              readonly state: KissopenAgentBoardCardState;
              readonly title: string;
              readonly detail: string;
              readonly tone: "accent" | "warn" | "good" | "quiet";
              readonly action?: KissopenAgentBoardAction;
          }[];
      }
    | {
          readonly type: "progress";
          readonly size: KissopenAgentBoardSize;
          readonly title: string;
          readonly items: readonly {
              readonly label: string;
              readonly percent: number;
              readonly detail: string;
          }[];
      }
    | {
          readonly type: "chart";
          readonly size: KissopenAgentBoardSize;
          readonly title: string;
          readonly note: string;
          readonly kind: "line" | "bar";
          readonly unit: string;
          readonly labels: readonly string[];
          readonly series: readonly { readonly name: string; readonly values: readonly number[] }[];
      }
    | {
          readonly type: "table";
          readonly size: KissopenAgentBoardSize;
          readonly title: string;
          readonly columns: readonly string[];
          readonly rows: readonly (readonly string[])[];
      }
    | {
          readonly type: "text";
          readonly size: KissopenAgentBoardSize;
          readonly title: string;
          readonly body: string;
      }
    | {
          readonly type: "files";
          readonly size: KissopenAgentBoardSize;
          readonly title: string;
          readonly items: readonly {
              readonly name: string;
              readonly path: string;
              readonly detail: string;
          }[];
      }
    | {
          readonly type: "note";
          readonly size: KissopenAgentBoardSize;
          readonly title: string;
          readonly body: string;
      };

export interface KissopenAgentBoardDocument {
    readonly title: string;
    readonly subtitle: string;
    readonly icon: string;
    readonly due: string;
    readonly blocks: readonly KissopenAgentBoardBlock[];
}

/** One project's board as this window knows it. */
export type KissopenAgentBoardState =
    | { readonly status: "loading" }
    /** No board has been built for the project yet. */
    | { readonly status: "missing"; readonly project?: KissopenAgentProjectDocument }
    | {
          readonly status: "ready";
          /** With the card states of `project` laid over it (see `kissopenAgentBoardOverlay`). */
          readonly document: KissopenAgentBoardDocument;
          /** The project's `.kissopen/project.json`, when it has a readable one. */
          readonly project?: KissopenAgentProjectDocument;
          /** When the file was last changed, epoch milliseconds, when the daemon says. */
          readonly changedAt?: number;
      }
    /** The file is there but is not a board this desktop can draw. */
    | { readonly status: "invalid"; readonly reason: string };

const ICONS = new Set([
    "box",
    "doc",
    "chart",
    "check",
    "rocket",
    "calendar",
    "people",
    "flag",
    "mail",
    "money",
    "image",
    "cart",
    "globe",
    "star",
]);
const SIZES = new Set(["full", "wide", "half", "third"]);

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | undefined =>
    value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Raw)
        : undefined;
const list = (value: unknown, max: number): Raw[] =>
    Array.isArray(value)
        ? value
              .map(record)
              .filter((item): item is Raw => !!item)
              .slice(0, max)
        : [];
const text = (value: unknown, max: number): string =>
    typeof value === "string" ? [...value.trim()].slice(0, max).join("") : "";
const icon = (value: unknown, fallback: string): string =>
    typeof value === "string" && ICONS.has(value) ? value : fallback;
const size = (value: unknown): KissopenAgentBoardSize =>
    typeof value === "string" && SIZES.has(value) ? (value as KissopenAgentBoardSize) : "half";
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
const action = (value: unknown): KissopenAgentBoardAction | undefined => {
    const raw = record(value);
    const label = text(raw?.label, 12);
    const prompt = text(raw?.prompt, 400);
    return label && prompt ? { label, prompt } : undefined;
};
const withAction = <T extends object>(item: T, value: unknown): T => {
    const parsed = action(value);
    return parsed ? { ...item, action: parsed } : item;
};

const cardState = (value: unknown): KissopenAgentBoardCardState =>
    oneOf(value, KISSOPEN_AGENT_BOARD_CARD_STATES, "todo");
const cardIdOf = (raw: Raw): string =>
    kissopenAgentBoardCardId(raw.id, typeof raw.title === "string" ? raw.title : "");

function blockOf(raw: Raw): KissopenAgentBoardBlock | undefined {
    const sized = size(raw.size);
    const title = text(raw.title, 40);
    switch (raw.type) {
        case "focus": {
            if (!title) return undefined;
            return withAction(
                {
                    type: "focus" as const,
                    size: sized,
                    id: cardIdOf(raw),
                    state: cardState(raw.state),
                    eyebrow: text(raw.eyebrow, 20),
                    title,
                    detail: text(raw.detail, 160),
                    chips: list(raw.chips, 4)
                        .map((chip) => ({
                            title: text(chip.title, 10),
                            icon: icon(chip.icon, "doc"),
                        }))
                        .filter((chip) => chip.title),
                },
                raw.action,
            );
        }
        case "stats": {
            const items = list(raw.items, 4)
                .map((item) => ({
                    label: text(item.label, 16),
                    value: text(item.value, 20),
                    delta: text(item.delta, 12),
                    trend: oneOf(item.trend, ["up", "down", "flat"] as const, "flat"),
                }))
                .filter((item) => item.label && item.value);
            return items.length ? { type: "stats", size: sized, title, items } : undefined;
        }
        case "milestones": {
            const items = list(raw.items, 6)
                .map((item) => ({
                    title: text(item.title, 12),
                    detail: text(item.detail, 24),
                    state: oneOf(item.state, ["done", "current", "todo"] as const, "todo"),
                    icon: icon(item.icon, "flag"),
                }))
                .filter((item) => item.title);
            return items.length >= 2
                ? { type: "milestones", size: sized, title, note: text(raw.note, 40), items }
                : undefined;
        }
        case "list": {
            const items = list(raw.items, 6)
                .map((item) =>
                    withAction(
                        {
                            id: cardIdOf(item),
                            state: cardState(item.state),
                            title: text(item.title, 40),
                            detail: text(item.detail, 80),
                            tone: oneOf(
                                item.tone,
                                ["accent", "warn", "good", "quiet"] as const,
                                "accent",
                            ),
                        },
                        item.action,
                    ),
                )
                .filter((item) => item.title);
            return items.length
                ? { type: "list", size: sized, title, badge: text(raw.badge, 12), items }
                : undefined;
        }
        case "progress": {
            const items = list(raw.items, 6)
                .map((item) => ({
                    label: text(item.label, 20),
                    percent:
                        typeof item.percent === "number" && Number.isFinite(item.percent)
                            ? Math.round(Math.min(100, Math.max(0, item.percent)))
                            : -1,
                    detail: text(item.detail, 40),
                }))
                .filter((item) => item.label && item.percent >= 0);
            return items.length ? { type: "progress", size: sized, title, items } : undefined;
        }
        case "chart": {
            const labels = (Array.isArray(raw.labels) ? raw.labels : [])
                .slice(0, 12)
                .map((label) => text(label, 10));
            const series = list(raw.series, 3)
                .map((entry) => ({
                    name: text(entry.name, 16),
                    values: Array.isArray(entry.values)
                        ? entry.values.filter(
                              (value): value is number =>
                                  typeof value === "number" && Number.isFinite(value),
                          )
                        : [],
                }))
                .filter((entry) => entry.values.length === labels.length);
            return labels.length >= 2 && series.length
                ? {
                      type: "chart",
                      size: sized,
                      title,
                      note: text(raw.note, 40),
                      kind: oneOf(raw.kind, ["line", "bar"] as const, "line"),
                      unit: text(raw.unit, 4),
                      labels,
                      series,
                  }
                : undefined;
        }
        case "table": {
            const columns = (Array.isArray(raw.columns) ? raw.columns : [])
                .slice(0, 6)
                .map((column) => text(column, 20))
                .filter(Boolean);
            const rows = (Array.isArray(raw.rows) ? raw.rows : [])
                .slice(0, 8)
                .filter(Array.isArray)
                .map((row) =>
                    columns.map((_, index) => text(String((row as unknown[])[index] ?? ""), 40)),
                );
            return columns.length && rows.length
                ? { type: "table", size: sized, title, columns, rows }
                : undefined;
        }
        case "text": {
            const body = text(raw.body, 600);
            return body ? { type: "text", size: sized, title, body } : undefined;
        }
        case "files": {
            const items = list(raw.items, 6)
                .map((item) => ({
                    name: text(item.name, 60),
                    path: text(item.path, 300),
                    detail: text(item.detail, 60),
                }))
                .filter(
                    (item) =>
                        item.name &&
                        item.path &&
                        !item.path.startsWith("/") &&
                        !item.path.includes(".."),
                );
            return items.length ? { type: "files", size: sized, title, items } : undefined;
        }
        case "note": {
            const body = text(raw.body, 160);
            return body ? { type: "note", size: sized, title, body } : undefined;
        }
        default:
            return undefined;
    }
}

/** Reads a board file's text; a reason when it is not a board this desktop can draw. */
export function kissopenAgentBoardParse(
    content: string,
): { readonly document: KissopenAgentBoardDocument } | { readonly reason: string } {
    let raw: Raw | undefined;
    try {
        raw = record(JSON.parse(content));
    } catch {
        return { reason: t("看板文件不是有效的 JSON") };
    }
    if (!raw) return { reason: t("看板文件不是一个对象") };
    if (raw.version !== 1) return { reason: t("看板文件的版本不对") };
    const blocks = list(raw.blocks, 12)
        .map(blockOf)
        .filter((block): block is KissopenAgentBoardBlock => !!block);
    if (!blocks.length) return { reason: t("看板里没有能显示的区块") };
    return {
        document: {
            title: text(raw.title, 30),
            subtitle: text(raw.subtitle, 80),
            icon: icon(raw.icon, "rocket"),
            due: text(raw.due, 20),
            blocks,
        },
    };
}

/** The cards a board draws, in its order: focus blocks and list items. */
export function kissopenAgentBoardCards(
    document: KissopenAgentBoardDocument,
): KissopenAgentBoardCard[] {
    const cards: KissopenAgentBoardCard[] = [];
    for (const block of document.blocks) {
        if (block.type === "focus") cards.push(kissopenAgentBoardCardOf(block));
        if (block.type === "list")
            for (const item of block.items) cards.push(kissopenAgentBoardCardOf(item));
    }
    return cards;
}

/** A focus block or list item as the card it is. */
export function kissopenAgentBoardCardOf(item: {
    readonly id: string;
    readonly title: string;
    readonly detail: string;
    readonly state: KissopenAgentBoardCardState;
    readonly action?: KissopenAgentBoardAction;
}): KissopenAgentBoardCard {
    return {
        id: item.id,
        title: item.title,
        detail: item.detail,
        state: item.state,
        ...(item.action ? { action: item.action } : {}),
    };
}

const EXTRA_ORDER: Partial<Record<KissopenAgentBoardCardState, number>> = {
    needs_decision: 0,
    waiting_material: 1,
};

/**
 * The board as its cards stand now. The board is rebuilt on a schedule, but
 * each card's conversation writes where it stands to project.json as it
 * goes, so that file has the last word on a card's state. A card the board
 * has not caught up with yet and that waits on the person — a decision or
 * material — is still shown, in a list of its own after the focus.
 */
export function kissopenAgentBoardOverlay(
    document: KissopenAgentBoardDocument,
    project: KissopenAgentProjectDocument | undefined,
): KissopenAgentBoardDocument {
    if (!project) return document;
    const shown = new Set<string>();
    const stateOf = (id: string, fallback: KissopenAgentBoardCardState) => {
        shown.add(id);
        return project.cards[id]?.state ?? fallback;
    };
    const blocks: KissopenAgentBoardBlock[] = document.blocks.map((block) => {
        if (block.type === "focus") return { ...block, state: stateOf(block.id, block.state) };
        if (block.type === "list")
            return {
                ...block,
                items: block.items.map((item) => ({
                    ...item,
                    state: stateOf(item.id, item.state),
                })),
            };
        return block;
    });
    const extra = Object.entries(project.cards)
        .filter(
            ([id, card]) => !shown.has(id) && card.state && EXTRA_ORDER[card.state] !== undefined,
        )
        .sort(([, a], [, b]) => EXTRA_ORDER[a.state!]! - EXTRA_ORDER[b.state!]!)
        .slice(0, 6)
        .map(([id, card]) => ({
            id,
            state: card.state!,
            title: card.title || id,
            detail: [...(card.question?.text || card.note)].slice(0, 80).join(""),
            tone: card.state === "needs_decision" ? ("warn" as const) : ("accent" as const),
        }));
    if (!extra.length) return { ...document, blocks };
    const at = blocks.findIndex((block) => block.type !== "focus");
    const waiting: KissopenAgentBoardBlock = {
        type: "list",
        size: "full",
        title: t("等你决定"),
        badge: t("{count} 项", { count: extra.length }),
        items: extra,
    };
    return {
        ...document,
        blocks:
            at < 0 ? [...blocks, waiting] : [...blocks.slice(0, at), waiting, ...blocks.slice(at)],
    };
}

/**
 * One project's board state from its two files, either of which may be
 * absent: the board, and the project.json its card conversations keep.
 */
export function kissopenAgentBoardStateOf(
    board: string | undefined,
    project: string | undefined,
): KissopenAgentBoardState {
    const parsedProject = project === undefined ? undefined : kissopenAgentProjectParse(project);
    if (board === undefined)
        return parsedProject
            ? { status: "missing", project: parsedProject }
            : { status: "missing" };
    const parsed = kissopenAgentBoardParse(board);
    if (!("document" in parsed)) return { status: "invalid", reason: parsed.reason };
    return {
        status: "ready",
        document: kissopenAgentBoardOverlay(parsed.document, parsedProject),
        ...(parsedProject ? { project: parsedProject } : {}),
    };
}
