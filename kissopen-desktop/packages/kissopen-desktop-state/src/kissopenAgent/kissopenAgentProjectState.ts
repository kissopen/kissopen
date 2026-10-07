/*
A project's shared state: `.kissopen/project.json`, next to the board.

The board builder writes the board; this file is where the project's goal and
direction live, what the person decided, and where each card stands, written
by the conversation that owns the card. Every surface reads it with the same
tolerance: what is out of shape is left out, never guessed back into place.

Each card has one conversation, found again by the same id on every surface:
`kissopenCardAgentId` derives it from the project folder and the card id, and
`kissopenCardFirstMessage` is what that conversation is told first.
*/

import { t } from "../i18n/locale.js";
import {
    KISSOPEN_AGENT_BOARD_CARD_ID,
    KISSOPEN_AGENT_BOARD_CARD_STATES,
    type KissopenAgentBoardCardState,
} from "./kissopenAgentBoard.js";

export interface KissopenAgentProjectDecision {
    readonly at: string;
    readonly card: string;
    readonly question: string;
    readonly choice: string;
}

export interface KissopenAgentProjectCard {
    readonly title: string;
    /** The conversation that owns the card, when it has said so. */
    readonly agent?: string;
    /** Absent when the card's conversation has not said; the board's own state stands then. */
    readonly state?: KissopenAgentBoardCardState;
    readonly note: string;
    /** What the card waits on the person to decide. */
    readonly question?: { readonly text: string; readonly options: readonly string[] };
    /** Paths relative to the project folder. */
    readonly files: readonly string[];
    readonly verified: boolean;
    /** ISO time of the last change, as written. */
    readonly updated: string;
}

export interface KissopenAgentProjectDocument {
    readonly goal: string;
    readonly direction: string;
    readonly decisions: readonly KissopenAgentProjectDecision[];
    readonly cards: Readonly<Record<string, KissopenAgentProjectCard>>;
}

const DECISION_LIMIT = 50;
const FILE_LIMIT = 6;
const CARD_LIMIT = 100;
const AGENT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/u;

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | undefined =>
    value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Raw)
        : undefined;
const text = (value: unknown, max: number): string =>
    typeof value === "string" ? [...value.trim()].slice(0, max).join("") : "";
const relative = (path: string): boolean =>
    !!path && !path.startsWith("/") && !/^[A-Za-z]:[\\/]/u.test(path) && !path.includes("..");

function cardOf(raw: Raw): KissopenAgentProjectCard {
    const question = record(raw.question);
    const questionText = text(question?.text, 200);
    const options = (Array.isArray(question?.options) ? question.options : [])
        .map((option) => text(option, 40))
        .filter(Boolean)
        .slice(0, 4);
    const agent = text(raw.agent, 64);
    const state = KISSOPEN_AGENT_BOARD_CARD_STATES.find((candidate) => candidate === raw.state);
    return {
        title: text(raw.title, 40),
        ...(AGENT_ID.test(agent) ? { agent } : {}),
        ...(state ? { state } : {}),
        note: text(raw.note, 200),
        ...(questionText ? { question: { text: questionText, options } } : {}),
        files: (Array.isArray(raw.files) ? raw.files : [])
            .map((file) => text(file, 300))
            .filter(relative)
            .slice(0, FILE_LIMIT),
        verified: raw.verified === true,
        updated: text(raw.updated, 40),
    };
}

/** Reads project.json's text; undefined when it is not a JSON object at all. */
export function kissopenAgentProjectParse(
    content: string,
): KissopenAgentProjectDocument | undefined {
    let raw: Raw | undefined;
    try {
        raw = record(JSON.parse(content));
    } catch {
        return undefined;
    }
    if (!raw) return undefined;
    const decisions = (Array.isArray(raw.decisions) ? raw.decisions : [])
        .map(record)
        .filter((decision): decision is Raw => !!decision)
        .map((decision) => ({
            at: text(decision.at, 40),
            card: text(decision.card, 32),
            question: text(decision.question, 200),
            choice: text(decision.choice, 200),
        }))
        .filter((decision) => decision.question || decision.choice)
        .slice(-DECISION_LIMIT);
    const cards: Record<string, KissopenAgentProjectCard> = {};
    for (const [id, value] of Object.entries(record(raw.cards) ?? {}).slice(0, CARD_LIMIT)) {
        const card = record(value);
        if (card && KISSOPEN_AGENT_BOARD_CARD_ID.test(id)) cards[id] = cardOf(card);
    }
    return {
        goal: text(raw.goal, 200),
        direction: text(raw.direction, 400),
        decisions,
        cards,
    };
}

/** The cards that wait on the person: a decision or material. */
export function kissopenAgentProjectWaits(
    project: KissopenAgentProjectDocument | undefined,
): { readonly id: string; readonly card: KissopenAgentProjectCard }[] {
    return Object.entries(project?.cards ?? {})
        .filter(([, card]) => card.state === "needs_decision" || card.state === "waiting_material")
        .map(([id, card]) => ({ id, card }));
}

/**
 * The conversation a card of the project in `path` gets when project.json does
 * not name one: the same on every surface, so a card opened anywhere comes back
 * to one conversation. 24 characters, a letter first, like every agent id.
 */
export async function kissopenCardAgentId(path: string, cardId: string): Promise<string> {
    const input = new TextEncoder().encode(
        `kissopen-card\0${path.replace(/\/+$/u, "")}\0${cardId}`,
    );
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", input));
    const hex = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `k${hex.slice(0, 23)}`;
}

/** The card's conversation: the one project.json names, else the derived one. */
export async function kissopenCardAgentResolve(
    path: string,
    cardId: string,
    project: KissopenAgentProjectDocument | undefined,
): Promise<string> {
    return project?.cards[cardId]?.agent ?? (await kissopenCardAgentId(path, cardId));
}

/**
 * What a card's conversation is told first: only what the card asks for, in words the person
 * would use. The rules of working on a card are the agent's own, given as instructions by its
 * kissopen-cards module, so the person never reads them here. The server says it the same way.
 */
/**
 * What the person sees of that first message: which card it is. The scheduled
 * card runs on this computer and in the cloud label theirs the same way.
 */
export function kissopenCardLabel(title: string): string {
    return title.trim().length > 0
        ? t("处理看板卡片：{name}", { name: title.trim() })
        : t("处理看板卡片");
}

export function kissopenCardFirstMessage(title: string, prompt: string): string {
    const ask = prompt.trim();
    return !ask || ask === title.trim()
        ? `请处理看板上的「${title}」。`
        : `请处理看板上的「${title}」：${ask}`;
}

/** What a card's conversation is asked to do: its action, else what the card says. */
export function kissopenCardPrompt(card: {
    readonly title: string;
    readonly detail: string;
    readonly action?: { readonly prompt: string };
}): string {
    return card.action?.prompt || card.detail || card.title;
}
