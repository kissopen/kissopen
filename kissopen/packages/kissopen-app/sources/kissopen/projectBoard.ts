import { t } from '@/text';
import type { ProjectDocument } from './projectState';

/*
 * A project's board: the file `.kissopen/board.json` in the project's folder,
 * written by the AI that builds the board on the person's computer. The phone
 * reads the same file through the computer and draws the same blocks the
 * desktop does. The desktop's reader (kissopen-desktop-state
 * `kissopenAgentBoardParse`) is the authority on the format; this is its twin
 * and must accept and refuse exactly what it does.
 */

export const PROJECT_BOARD_PATH = '.kissopen/board.json';

export type BoardAction = { readonly label: string; readonly prompt: string };

/** Where one card of the board stands; the card's conversation keeps it in project.json. */
export type BoardCardState = 'todo' | 'in_progress' | 'waiting_material' | 'needs_decision' | 'done';
export const BOARD_CARD_STATES: readonly BoardCardState[] = ['todo', 'in_progress', 'waiting_material', 'needs_decision', 'done'];

/** The shape every card id has, on the board and in project.json. */
export const BOARD_CARD_ID = /^[a-z0-9][a-z0-9-]{1,31}$/;

/**
 * One thing to do on a board — a focus block or a list item — with the id
 * its own conversation is found by.
 */
export interface BoardCard {
    readonly id: string;
    readonly title: string;
    readonly detail: string;
    readonly state: BoardCardState;
    readonly action?: BoardAction;
}

/** FNV-1a, 32 bits, over the UTF-8 bytes of the text; lowercase 8-digit hex. */
export function fnv1a32hex(value: string): string {
    let hash = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(value)) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

/**
 * A card's id: the one the board gives it when that is well formed, else one
 * derived from its trimmed title, the same way on every surface.
 */
export function boardCardId(id: unknown, title: string): string {
    return typeof id === 'string' && BOARD_CARD_ID.test(id) ? id : `t${fnv1a32hex(title.trim())}`;
}

export type BoardBlock =
    | { readonly type: 'focus'; readonly id: string; readonly state: BoardCardState; readonly eyebrow: string; readonly title: string; readonly detail: string; readonly action?: BoardAction; readonly chips: readonly { readonly title: string; readonly icon: string }[] }
    | { readonly type: 'stats'; readonly title: string; readonly items: readonly { readonly label: string; readonly value: string; readonly delta: string; readonly trend: 'up' | 'down' | 'flat' }[] }
    | { readonly type: 'milestones'; readonly title: string; readonly note: string; readonly items: readonly { readonly title: string; readonly detail: string; readonly state: 'done' | 'current' | 'todo'; readonly icon: string }[] }
    | { readonly type: 'list'; readonly title: string; readonly badge: string; readonly items: readonly { readonly id: string; readonly state: BoardCardState; readonly title: string; readonly detail: string; readonly tone: 'accent' | 'warn' | 'good' | 'quiet'; readonly action?: BoardAction }[] }
    | { readonly type: 'progress'; readonly title: string; readonly items: readonly { readonly label: string; readonly percent: number; readonly detail: string }[] }
    | { readonly type: 'chart'; readonly title: string; readonly note: string; readonly kind: 'line' | 'bar'; readonly unit: string; readonly labels: readonly string[]; readonly series: readonly { readonly name: string; readonly values: readonly number[] }[] }
    | { readonly type: 'table'; readonly title: string; readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] }
    | { readonly type: 'text'; readonly title: string; readonly body: string }
    | { readonly type: 'files'; readonly title: string; readonly items: readonly { readonly name: string; readonly path: string; readonly detail: string }[] }
    | { readonly type: 'note'; readonly title: string; readonly body: string };

export interface BoardDocument {
    readonly title: string;
    readonly subtitle: string;
    readonly icon: string;
    readonly due: string;
    readonly blocks: readonly BoardBlock[];
}

const ICONS = new Set(['box', 'doc', 'chart', 'check', 'rocket', 'calendar', 'people', 'flag', 'mail', 'money', 'image', 'cart', 'globe', 'star']);

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | undefined =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : undefined;
const list = (value: unknown, max: number): Raw[] =>
    Array.isArray(value) ? value.map(record).filter((item): item is Raw => !!item).slice(0, max) : [];
const text = (value: unknown, max: number): string =>
    typeof value === 'string' ? [...value.trim()].slice(0, max).join('') : '';
const icon = (value: unknown, fallback: string): string =>
    typeof value === 'string' && ICONS.has(value) ? value : fallback;
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
const action = (value: unknown): BoardAction | undefined => {
    const raw = record(value);
    const label = text(raw?.label, 12);
    const prompt = text(raw?.prompt, 400);
    return label && prompt ? { label, prompt } : undefined;
};
const withAction = <T extends object>(item: T, value: unknown): T => {
    const parsed = action(value);
    return parsed ? { ...item, action: parsed } : item;
};
const cardState = (value: unknown): BoardCardState => oneOf(value, BOARD_CARD_STATES, 'todo');
const cardIdOf = (raw: Raw): string => boardCardId(raw.id, typeof raw.title === 'string' ? raw.title : '');

function blockOf(raw: Raw): BoardBlock | undefined {
    const title = text(raw.title, 40);
    switch (raw.type) {
        case 'focus': {
            if (!title) return undefined;
            return withAction({
                type: 'focus' as const,
                id: cardIdOf(raw),
                state: cardState(raw.state),
                eyebrow: text(raw.eyebrow, 20),
                title,
                detail: text(raw.detail, 160),
                chips: list(raw.chips, 4).map(chip => ({ title: text(chip.title, 10), icon: icon(chip.icon, 'doc') })).filter(chip => chip.title),
            }, raw.action);
        }
        case 'stats': {
            const items = list(raw.items, 4).map(item => ({
                label: text(item.label, 16),
                value: text(item.value, 20),
                delta: text(item.delta, 12),
                trend: oneOf(item.trend, ['up', 'down', 'flat'] as const, 'flat'),
            })).filter(item => item.label && item.value);
            return items.length ? { type: 'stats', title, items } : undefined;
        }
        case 'milestones': {
            const items = list(raw.items, 6).map(item => ({
                title: text(item.title, 12),
                detail: text(item.detail, 24),
                state: oneOf(item.state, ['done', 'current', 'todo'] as const, 'todo'),
                icon: icon(item.icon, 'flag'),
            })).filter(item => item.title);
            return items.length >= 2 ? { type: 'milestones', title, note: text(raw.note, 40), items } : undefined;
        }
        case 'list': {
            const items = list(raw.items, 6).map(item => withAction({
                id: cardIdOf(item),
                state: cardState(item.state),
                title: text(item.title, 40),
                detail: text(item.detail, 80),
                tone: oneOf(item.tone, ['accent', 'warn', 'good', 'quiet'] as const, 'accent'),
            }, item.action)).filter(item => item.title);
            return items.length ? { type: 'list', title, badge: text(raw.badge, 12), items } : undefined;
        }
        case 'progress': {
            const items = list(raw.items, 6).map(item => ({
                label: text(item.label, 20),
                percent: typeof item.percent === 'number' && Number.isFinite(item.percent) ? Math.round(Math.min(100, Math.max(0, item.percent))) : -1,
                detail: text(item.detail, 40),
            })).filter(item => item.label && item.percent >= 0);
            return items.length ? { type: 'progress', title, items } : undefined;
        }
        case 'chart': {
            const labels = (Array.isArray(raw.labels) ? raw.labels : []).slice(0, 12).map(label => text(label, 10));
            const series = list(raw.series, 3).map(entry => ({
                name: text(entry.name, 16),
                values: Array.isArray(entry.values) ? entry.values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)) : [],
            })).filter(entry => entry.values.length === labels.length);
            return labels.length >= 2 && series.length
                ? { type: 'chart', title, note: text(raw.note, 40), kind: oneOf(raw.kind, ['line', 'bar'] as const, 'line'), unit: text(raw.unit, 4), labels, series }
                : undefined;
        }
        case 'table': {
            const columns = (Array.isArray(raw.columns) ? raw.columns : []).slice(0, 6).map(column => text(column, 20)).filter(Boolean);
            const rows = (Array.isArray(raw.rows) ? raw.rows : []).slice(0, 8).filter(Array.isArray)
                .map(row => columns.map((_, index) => text(String((row as unknown[])[index] ?? ''), 40)));
            return columns.length && rows.length ? { type: 'table', title, columns, rows } : undefined;
        }
        case 'text': {
            const body = text(raw.body, 600);
            return body ? { type: 'text', title, body } : undefined;
        }
        case 'files': {
            const items = list(raw.items, 6).map(item => ({
                name: text(item.name, 60),
                path: text(item.path, 300),
                detail: text(item.detail, 60),
            })).filter(item => item.name && item.path && !item.path.startsWith('/') && !item.path.includes('..'));
            return items.length ? { type: 'files', title, items } : undefined;
        }
        case 'note': {
            const body = text(raw.body, 160);
            return body ? { type: 'note', title, body } : undefined;
        }
        default:
            return undefined;
    }
}

/** Reads a board file's text; a reason when it is not a board the phone can draw. */
export function boardParse(content: string): { readonly document: BoardDocument } | { readonly reason: string } {
    let raw: Raw | undefined;
    try {
        raw = record(JSON.parse(content));
    } catch {
        return { reason: t('kissopen.board.invalidJson') };
    }
    if (!raw) return { reason: t('kissopen.board.invalidShape') };
    if (raw.version !== 1) return { reason: t('kissopen.board.invalidVersion') };
    const blocks = list(raw.blocks, 12).map(blockOf).filter((block): block is BoardBlock => !!block);
    if (!blocks.length) return { reason: t('kissopen.board.invalidEmpty') };
    return {
        document: {
            title: text(raw.title, 30),
            subtitle: text(raw.subtitle, 80),
            icon: icon(raw.icon, 'rocket'),
            due: text(raw.due, 20),
            blocks,
        },
    };
}

/** The cards a board draws, in its order: focus blocks and list items. */
export function boardCards(document: BoardDocument): BoardCard[] {
    const cards: BoardCard[] = [];
    for (const block of document.blocks) {
        if (block.type === 'focus') cards.push(boardCardOf(block));
        if (block.type === 'list') for (const item of block.items) cards.push(boardCardOf(item));
    }
    return cards;
}

/** A focus block or list item as the card it is. */
export function boardCardOf(item: { readonly id: string; readonly title: string; readonly detail: string; readonly state: BoardCardState; readonly action?: BoardAction }): BoardCard {
    return { id: item.id, title: item.title, detail: item.detail, state: item.state, ...(item.action ? { action: item.action } : {}) };
}

/** A card state's short label; empty for a card nobody has started. */
export function boardCardStateLabel(state: BoardCardState): string {
    switch (state) {
        case 'in_progress': return t('kissopen.board.cardStateInProgress');
        case 'waiting_material': return t('kissopen.board.cardStateWaitingMaterial');
        case 'needs_decision': return t('kissopen.board.cardStateNeedsDecision');
        case 'done': return t('kissopen.board.cardStateDone');
        default: return '';
    }
}

/** Whether tapping a card does something: it offers an action, or its conversation has begun. */
export function boardCardOpens(card: { readonly state: BoardCardState; readonly action?: BoardAction }): boolean {
    return !!card.action || card.state !== 'todo';
}

/** What a card's conversation is asked to do: its action, else what the card says. */
export function boardCardPrompt(card: BoardCard): string {
    return card.action?.prompt || card.detail || card.title;
}

const EXTRA_ORDER: Partial<Record<BoardCardState, number>> = { needs_decision: 0, waiting_material: 1 };

/**
 * The board as its cards stand now. The board is rebuilt on a schedule, but
 * each card's conversation writes where it stands to project.json as it
 * goes, so that file has the last word on a card's state. A card the board
 * has not caught up with yet and that waits on the person — a decision or
 * material — is still shown, in a list of its own after the focus. The
 * desktop's `kissopenAgentBoardOverlay` is the twin.
 */
export function boardOverlay(document: BoardDocument, project: ProjectDocument | undefined): BoardDocument {
    if (!project) return document;
    const shown = new Set<string>();
    const stateOf = (id: string, fallback: BoardCardState) => {
        shown.add(id);
        return project.cards[id]?.state ?? fallback;
    };
    const blocks: BoardBlock[] = document.blocks.map(block => {
        if (block.type === 'focus') return { ...block, state: stateOf(block.id, block.state) };
        if (block.type === 'list') return { ...block, items: block.items.map(item => ({ ...item, state: stateOf(item.id, item.state) })) };
        return block;
    });
    const extra = Object.entries(project.cards)
        .filter(([id, card]) => !shown.has(id) && card.state && EXTRA_ORDER[card.state] !== undefined)
        .sort(([, a], [, b]) => EXTRA_ORDER[a.state!]! - EXTRA_ORDER[b.state!]!)
        .slice(0, 6)
        .map(([id, card]) => ({
            id,
            state: card.state!,
            title: card.title || id,
            detail: [...(card.question?.text || card.note)].slice(0, 80).join(''),
            tone: card.state === 'needs_decision' ? ('warn' as const) : ('accent' as const),
        }));
    if (!extra.length) return { ...document, blocks };
    const at = blocks.findIndex(block => block.type !== 'focus');
    const waiting: BoardBlock = { type: 'list', title: t('kissopen.homePage.decideTitle'), badge: String(extra.length), items: extra };
    return { ...document, blocks: at < 0 ? [...blocks, waiting] : [...blocks.slice(0, at), waiting, ...blocks.slice(at)] };
}

/** One project's board from its two files, either of which may be absent. */
export type BoardFilesState =
    | { readonly status: 'missing'; readonly project?: ProjectDocument }
    /** With the card states of `project` laid over it. */
    | { readonly status: 'ready'; readonly document: BoardDocument; readonly project?: ProjectDocument }
    | { readonly status: 'invalid'; readonly reason: string };

/** The board state from the board's text and project.json's, as read. */
export function boardStateOf(board: string | undefined, project: ProjectDocument | undefined): BoardFilesState {
    if (board === undefined) return project ? { status: 'missing', project } : { status: 'missing' };
    const parsed = boardParse(board);
    if (!('document' in parsed)) return { status: 'invalid', reason: parsed.reason };
    return { status: 'ready', document: boardOverlay(parsed.document, project), ...(project ? { project } : {}) };
}

/** The Ionicons a board may name, by the board's own icon words. */
export const BOARD_ICONS = {
    box: 'cube-outline',
    doc: 'document-text-outline',
    chart: 'bar-chart-outline',
    check: 'checkmark-circle-outline',
    rocket: 'rocket-outline',
    calendar: 'calendar-outline',
    people: 'people-outline',
    flag: 'flag-outline',
    mail: 'mail-outline',
    money: 'cash-outline',
    image: 'image-outline',
    cart: 'cart-outline',
    globe: 'globe-outline',
    star: 'star-outline',
} as const;

export function boardIconOf(name: string): (typeof BOARD_ICONS)[keyof typeof BOARD_ICONS] {
    return BOARD_ICONS[name as keyof typeof BOARD_ICONS] ?? BOARD_ICONS.doc;
}
