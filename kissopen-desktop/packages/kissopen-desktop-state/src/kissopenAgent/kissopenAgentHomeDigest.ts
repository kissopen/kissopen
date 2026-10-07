import {
    kissopenAgentBoardCardOf,
    type KissopenAgentBoardBlock,
    type KissopenAgentBoardCard,
    type KissopenAgentBoardState,
} from "./kissopenAgentBoard.js";
import type { KissopenAgentProjectDocument } from "./kissopenAgentProjectState.js";

/*
The home page made of the person's own work: what each project's board says,
gathered in one place, from every computer on the account. Every board is written by the AI from its project's
conversations and files; the home only collects and orders what they already
say, so it changes the moment a board does and costs no model call of its own.
*/

/**
 * One project the home can show, from this computer or another one on the
 * account. `id` is the caller's own handle for opening it again.
 */
export interface KissopenHomeDigestSource {
    readonly id: string;
    readonly name: string;
    /** The computer it is on, for projects that are not on this one; empty here. */
    readonly place: string;
    readonly updatedAt: number;
    /** Absent while the board has not been read. */
    readonly board: KissopenAgentBoardState | undefined;
}

/** Something to decide or do today, from one project's board. */
export interface KissopenHomeDigestFocus {
    readonly projectId: string;
    readonly projectName: string;
    readonly title: string;
    readonly detail: string;
    /** What asking about it says, when the board offered an action. */
    readonly prompt?: string;
    readonly tone: "accent" | "warn" | "good" | "quiet";
    /** A board icon word, e.g. `flag`, `doc`. */
    readonly icon: string;
    /** The board card it is, whose own conversation opening it goes to. */
    readonly card: KissopenAgentBoardCard;
}

/** A card that waits on the person: a decision to make or material to hand over. */
export interface KissopenHomeDigestDecision {
    readonly projectId: string;
    readonly projectName: string;
    readonly card: KissopenAgentBoardCard;
    readonly state: "needs_decision" | "waiting_material";
    /** What is asked: the card's question, else what the card says. */
    readonly question: string;
}

/** One project as the home lists it. */
export interface KissopenHomeDigestProject {
    readonly id: string;
    readonly name: string;
    /** The computer it is on when that is not this one. */
    readonly place: string;
    /** The board's title, or the project's most important step. */
    readonly summary: string;
    /** 0–100 from its milestones or progress block; absent when the board has neither. */
    readonly progress?: number;
    readonly due: string;
    readonly icon: string;
    readonly updatedAt: number;
    readonly hasBoard: boolean;
}

/** The next milestone a project has not reached. */
export interface KissopenHomeDigestMilestone {
    readonly projectId: string;
    readonly projectName: string;
    readonly title: string;
    readonly detail: string;
    readonly state: "current" | "todo";
    readonly icon: string;
}

/** One figure a board reported. */
export interface KissopenHomeDigestStat {
    readonly projectName: string;
    readonly label: string;
    readonly value: string;
    readonly delta: string;
    readonly trend: "up" | "down" | "flat";
}

export interface KissopenHomeDigest {
    /** How many projects have a board the home could read. */
    readonly boards: number;
    readonly focus: readonly KissopenHomeDigestFocus[];
    /** Cards waiting on the person, decisions first; none of them is also in `focus`. */
    readonly decisions: readonly KissopenHomeDigestDecision[];
    readonly projects: readonly KissopenHomeDigestProject[];
    readonly milestones: readonly KissopenHomeDigestMilestone[];
    readonly stats: readonly KissopenHomeDigestStat[];
}

const FOCUS_LIMIT = 4;
const DECISION_LIMIT = 5;
const MILESTONE_LIMIT = 5;
const STAT_LIMIT = 4;
const TONE_ORDER = { warn: 0, accent: 1, good: 2, quiet: 3 } as const;

/**
 * Gathers the projects' boards into the home page. Projects are newest first;
 * today's focus leads with each board's most important step, then what its
 * lists say needs deciding, the most pressing tone first.
 */
export function kissopenHomeDigest(
    projects: readonly KissopenHomeDigestSource[],
): KissopenHomeDigest {
    const ordered = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
    const steps: KissopenHomeDigestFocus[] = [];
    const decisions: KissopenHomeDigestFocus[] = [];
    const waits: KissopenHomeDigestDecision[] = [];
    const waitOf = (
        project: KissopenHomeDigestSource,
        label: string,
        card: KissopenAgentBoardCard,
        file: KissopenAgentProjectDocument | undefined,
    ): void => {
        if (card.state !== "needs_decision" && card.state !== "waiting_material") return;
        if (waits.some((wait) => wait.projectId === project.id && wait.card.id === card.id)) return;
        waits.push({
            projectId: project.id,
            projectName: label,
            card,
            state: card.state,
            question: file?.cards[card.id]?.question?.text || card.detail || card.title,
        });
    };
    const milestones: KissopenHomeDigestMilestone[] = [];
    const stats: KissopenHomeDigestStat[] = [];
    const listed: KissopenHomeDigestProject[] = [];
    let readable = 0;
    for (const project of ordered) {
        const document = project.board?.status === "ready" ? project.board.document : undefined;
        const file =
            project.board?.status === "ready" || project.board?.status === "missing"
                ? project.board.project
                : undefined;
        if (!document) {
            // A project with no board yet can still have cards waiting on the person.
            const label = project.place ? `${project.name} · ${project.place}` : project.name;
            for (const [id, card] of Object.entries(file?.cards ?? {}))
                if (card.state)
                    waitOf(
                        project,
                        label,
                        { id, title: card.title || id, detail: card.note, state: card.state },
                        file,
                    );
            listed.push({
                id: project.id,
                name: project.name,
                place: project.place,
                summary: "",
                due: "",
                icon: "rocket",
                updatedAt: project.updatedAt,
                hasBoard: false,
            });
            continue;
        }
        readable += 1;
        const blocks = document.blocks;
        // Where a thing to do came from, and on which computer when that is not this one.
        const label = project.place ? `${project.name} · ${project.place}` : project.name;
        const focus = blocks.find(
            (block): block is Extract<KissopenAgentBoardBlock, { type: "focus" }> =>
                block.type === "focus",
        );
        for (const block of blocks) {
            if (block.type === "focus")
                waitOf(project, label, kissopenAgentBoardCardOf(block), file);
            if (block.type === "list")
                for (const item of block.items)
                    waitOf(project, label, kissopenAgentBoardCardOf(item), file);
        }
        if (focus && focus.state !== "done")
            steps.push({
                projectId: project.id,
                projectName: label,
                title: focus.title,
                detail: focus.detail,
                ...(focus.action ? { prompt: focus.action.prompt } : {}),
                tone: "accent",
                icon: document.icon,
                card: kissopenAgentBoardCardOf(focus),
            });
        for (const block of blocks) {
            if (block.type === "list")
                for (const item of block.items) {
                    if (item.tone === "good" || item.tone === "quiet" || item.state === "done")
                        continue;
                    decisions.push({
                        projectId: project.id,
                        projectName: label,
                        title: item.title,
                        detail: item.detail,
                        ...(item.action ? { prompt: item.action.prompt } : {}),
                        tone: item.tone,
                        icon: "flag",
                        card: kissopenAgentBoardCardOf(item),
                    });
                }
            if (block.type === "milestones") {
                const next = block.items.find((item) => item.state !== "done");
                if (next)
                    milestones.push({
                        projectId: project.id,
                        projectName: label,
                        title: next.title,
                        detail: next.detail,
                        state: next.state === "current" ? "current" : "todo",
                        icon: next.icon,
                    });
            }
            if (block.type === "stats")
                for (const item of block.items) stats.push({ projectName: label, ...item });
        }
        const progress = progressOf(blocks);
        listed.push({
            id: project.id,
            name: project.name,
            place: project.place,
            summary: document.title || focus?.title || document.subtitle,
            ...(progress === undefined ? {} : { progress }),
            due: document.due,
            icon: document.icon,
            updatedAt: project.updatedAt,
            hasBoard: true,
        });
    }
    decisions.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
    const waiting = waits
        .map((wait, index) => ({ wait, index }))
        .sort(
            (a, b) =>
                (a.wait.state === "needs_decision" ? 0 : 1) -
                    (b.wait.state === "needs_decision" ? 0 : 1) || a.index - b.index,
        )
        .map(({ wait }) => wait)
        .slice(0, DECISION_LIMIT);
    const asked = (item: KissopenHomeDigestFocus) =>
        waiting.some((wait) => wait.projectId === item.projectId && wait.card.id === item.card.id);
    return {
        boards: readable,
        focus: [...steps, ...decisions].filter((item) => !asked(item)).slice(0, FOCUS_LIMIT),
        decisions: waiting,
        projects: listed,
        milestones: milestones.slice(0, MILESTONE_LIMIT),
        stats: stats.slice(0, STAT_LIMIT),
    };
}

/** How far along a board says its project is: milestones reached, else its progress bars. */
function progressOf(blocks: readonly KissopenAgentBoardBlock[]): number | undefined {
    for (const block of blocks)
        if (block.type === "milestones" && block.items.length > 0) {
            const done = block.items.filter((item) => item.state === "done").length;
            return Math.round((done / block.items.length) * 100);
        }
    for (const block of blocks)
        if (block.type === "progress" && block.items.length > 0)
            return Math.round(
                block.items.reduce((sum, item) => sum + item.percent, 0) / block.items.length,
            );
    return undefined;
}
