import { boardCardOf, type BoardBlock, type BoardCard } from './projectBoard';
import type { ProjectBoardState } from './useProjectBoard';
import type { WorkProject } from './ProjectPage';

/*
 * The home page made of the person's own work: what each project's board says,
 * gathered in one place, from the cloud and every computer on the account.
 * The desktop's home reads the same boards the same way
 * (kissopen-desktop-state kissopenAgentHomeDigest); this is its twin.
 */

export interface HomeDigestFocus {
    readonly projectId: string;
    readonly projectName: string;
    readonly title: string;
    readonly detail: string;
    /** The board card it is, which a tap opens the conversation of. */
    readonly card: BoardCard;
    readonly tone: 'accent' | 'warn' | 'good' | 'quiet';
    readonly icon: string;
}

/** A card that waits on the person: a decision to make, or material to add. */
export interface HomeDigestDecision {
    readonly projectId: string;
    readonly projectName: string;
    /** What is asked: the card's question, else its note, else what the card says. */
    readonly text: string;
    readonly card: BoardCard;
}

export interface HomeDigestProject {
    readonly id: string;
    readonly name: string;
    readonly place: string;
    readonly summary: string;
    readonly progress?: number;
    readonly due: string;
    readonly icon: string;
    readonly updatedAt: number;
    readonly hasBoard: boolean;
}

export interface HomeDigestMilestone {
    readonly projectId: string;
    readonly projectName: string;
    readonly title: string;
    readonly detail: string;
    readonly state: 'current' | 'todo';
    readonly icon: string;
}

export interface HomeDigestStat {
    readonly projectName: string;
    readonly label: string;
    readonly value: string;
    readonly delta: string;
    readonly trend: 'up' | 'down' | 'flat';
}

export interface HomeDigest {
    /** How many projects have a board the home could read. */
    readonly boards: number;
    readonly focus: readonly HomeDigestFocus[];
    /** What waits on the person, decisions first; none of these is repeated in `focus`. */
    readonly decisions: readonly HomeDigestDecision[];
    readonly projects: readonly HomeDigestProject[];
    readonly milestones: readonly HomeDigestMilestone[];
    readonly stats: readonly HomeDigestStat[];
}

const FOCUS_LIMIT = 4;
const DECISION_LIMIT = 5;
const WAIT_ORDER = { needs_decision: 0, waiting_material: 1 } as const;
const MILESTONE_LIMIT = 5;
const STAT_LIMIT = 4;
const TONE_ORDER = { warn: 0, accent: 1, good: 2, quiet: 3 } as const;

/** Gathers the projects' boards into the home page; projects newest first. */
export function homeDigest(projects: readonly WorkProject[], boards: ReadonlyMap<string, ProjectBoardState>): HomeDigest {
    const ordered = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
    const steps: HomeDigestFocus[] = [];
    const pressing: HomeDigestFocus[] = [];
    const waits: { readonly decision: HomeDigestDecision; readonly order: number }[] = [];
    const milestones: HomeDigestMilestone[] = [];
    const stats: HomeDigestStat[] = [];
    const listed: HomeDigestProject[] = [];
    let readable = 0;
    for (const project of ordered) {
        const board = boards.get(project.id);
        const document = board?.status === 'ready' ? board.document : undefined;
        if (!document) {
            listed.push({ id: project.id, name: project.name, place: project.place, summary: '', due: '', icon: 'rocket', updatedAt: project.updatedAt, hasBoard: false });
            continue;
        }
        readable += 1;
        const label = project.place ? `${project.name} · ${project.place}` : project.name;
        const blocks = document.blocks;
        const cardsOf = board?.status === 'ready' ? board.project?.cards : undefined;
        // Every card that waits on the person, wherever the board put it.
        const seen = new Set<string>();
        const wait = (card: BoardCard) => {
            if (seen.has(card.id)) return;
            seen.add(card.id);
            if (card.state !== 'needs_decision' && card.state !== 'waiting_material') return;
            const known = cardsOf?.[card.id];
            const text = known?.question?.text || known?.note || card.detail || card.title;
            waits.push({ decision: { projectId: project.id, projectName: label, text, card }, order: WAIT_ORDER[card.state] });
        };
        const focus = blocks.find((block): block is Extract<BoardBlock, { type: 'focus' }> => block.type === 'focus');
        if (focus && focus.state !== 'done') {
            steps.push({ projectId: project.id, projectName: label, title: focus.title, detail: focus.detail, card: boardCardOf(focus), tone: 'accent', icon: document.icon });
        }
        for (const block of blocks) {
            if (block.type === 'focus') wait(boardCardOf(block));
            if (block.type === 'list') {
                for (const item of block.items) {
                    wait(boardCardOf(item));
                    if (item.state === 'done' || item.tone === 'good' || item.tone === 'quiet') continue;
                    pressing.push({ projectId: project.id, projectName: label, title: item.title, detail: item.detail, card: boardCardOf(item), tone: item.tone, icon: 'flag' });
                }
            }
            if (block.type === 'milestones') {
                const next = block.items.find(item => item.state !== 'done');
                if (next) milestones.push({ projectId: project.id, projectName: label, title: next.title, detail: next.detail, state: next.state === 'current' ? 'current' : 'todo', icon: next.icon });
            }
            if (block.type === 'stats') for (const item of block.items) stats.push({ projectName: label, ...item });
        }
        const progress = progressOf(blocks);
        listed.push({
            id: project.id, name: project.name, place: project.place,
            summary: document.title || focus?.title || document.subtitle,
            ...(progress === undefined ? {} : { progress }),
            due: document.due, icon: document.icon, updatedAt: project.updatedAt, hasBoard: true,
        });
    }
    pressing.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
    // Stable: projects stay newest first within each kind of wait.
    const decisions = waits.sort((a, b) => a.order - b.order).slice(0, DECISION_LIMIT).map(wait => wait.decision);
    const asked = new Set(decisions.map(decision => `${decision.projectId}\t${decision.card.id}`));
    const today = [...steps, ...pressing].filter(item => !asked.has(`${item.projectId}\t${item.card.id}`)).slice(0, FOCUS_LIMIT);
    return { boards: readable, focus: today, decisions, projects: listed, milestones: milestones.slice(0, MILESTONE_LIMIT), stats: stats.slice(0, STAT_LIMIT) };
}

/** How far along a board says its project is: milestones reached, else its progress bars. */
function progressOf(blocks: readonly BoardBlock[]): number | undefined {
    for (const block of blocks) {
        if (block.type === 'milestones' && block.items.length > 0) {
            return Math.round((block.items.filter(item => item.state === 'done').length / block.items.length) * 100);
        }
    }
    for (const block of blocks) {
        if (block.type === 'progress' && block.items.length > 0) {
            return Math.round(block.items.reduce((sum, item) => sum + item.percent, 0) / block.items.length);
        }
    }
    return undefined;
}
