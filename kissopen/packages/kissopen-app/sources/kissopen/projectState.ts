import { BOARD_CARD_ID, BOARD_CARD_STATES, type BoardCardState } from './projectBoard';

/*
 * A project's shared state: `.kissopen/project.json`, next to the board.
 *
 * The board builder writes the board; this file is where the project's goal
 * and direction live, what the person decided, and where each card stands,
 * written by the conversation that owns the card. Every surface reads it with
 * the same tolerance: what is out of shape is left out, never guessed back
 * into place. The desktop's `kissopenAgentProjectParse` is the twin.
 *
 * The phone never works out a card's conversation itself: it uses the one a
 * card names here, or asks the server to start the card.
 */

export const PROJECT_STATE_PATH = '.kissopen/project.json';

export interface ProjectDecision {
    readonly at: string;
    readonly card: string;
    readonly question: string;
    readonly choice: string;
}

export interface ProjectCard {
    readonly title: string;
    /** The conversation that owns the card, when it has said so. */
    readonly agent?: string;
    /** Absent when the card's conversation has not said; the board's own state stands then. */
    readonly state?: BoardCardState;
    readonly note: string;
    /** What the card waits on the person to decide. */
    readonly question?: { readonly text: string; readonly options: readonly string[] };
    /** Paths relative to the project folder. */
    readonly files: readonly string[];
    readonly verified: boolean;
    /** ISO time of the last change, as written. */
    readonly updated: string;
}

export interface ProjectDocument {
    readonly goal: string;
    readonly direction: string;
    readonly decisions: readonly ProjectDecision[];
    readonly cards: Readonly<Record<string, ProjectCard>>;
}

const DECISION_LIMIT = 50;
const FILE_LIMIT = 6;
const CARD_LIMIT = 100;
const AGENT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | undefined =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : undefined;
const text = (value: unknown, max: number): string =>
    typeof value === 'string' ? [...value.trim()].slice(0, max).join('') : '';
const relative = (path: string): boolean =>
    !!path && !path.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(path) && !path.includes('..');

function cardOf(raw: Raw): ProjectCard {
    const question = record(raw.question);
    const questionText = text(question?.text, 200);
    const options = (Array.isArray(question?.options) ? question.options : [])
        .map(option => text(option, 40))
        .filter(Boolean)
        .slice(0, 4);
    const agent = text(raw.agent, 64);
    const state = BOARD_CARD_STATES.find(candidate => candidate === raw.state);
    return {
        title: text(raw.title, 40),
        ...(AGENT_ID.test(agent) ? { agent } : {}),
        ...(state ? { state } : {}),
        note: text(raw.note, 200),
        ...(questionText ? { question: { text: questionText, options } } : {}),
        files: (Array.isArray(raw.files) ? raw.files : [])
            .map(file => text(file, 300))
            .filter(relative)
            .slice(0, FILE_LIMIT),
        verified: raw.verified === true,
        updated: text(raw.updated, 40),
    };
}

/** Reads project.json's text; undefined when it is not a JSON object at all. */
export function projectStateParse(content: string): ProjectDocument | undefined {
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
        .map(decision => ({
            at: text(decision.at, 40),
            card: text(decision.card, 32),
            question: text(decision.question, 200),
            choice: text(decision.choice, 200),
        }))
        .filter(decision => decision.question || decision.choice)
        .slice(-DECISION_LIMIT);
    const cards: Record<string, ProjectCard> = {};
    for (const [id, value] of Object.entries(record(raw.cards) ?? {}).slice(0, CARD_LIMIT)) {
        const card = record(value);
        if (card && BOARD_CARD_ID.test(id)) cards[id] = cardOf(card);
    }
    return { goal: text(raw.goal, 200), direction: text(raw.direction, 400), decisions, cards };
}
