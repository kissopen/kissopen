import * as React from 'react';
import { useRouter } from 'expo-router';
import { storage } from '@/sync/storage';
import { sync } from '@/sync/sync';
import type { Session } from '@/sync/storageTypes';
import { t } from '@/text';
import { api } from './api/client';
import type { Schedule, ScheduleRun } from './api/types';
import { boardCardPrompt, type BoardCard } from './projectBoard';

/** Where a card's project is: the cloud or one computer, and its folder there. */
export type CardProject = {
    readonly machineId: string;
    readonly cloud: boolean;
    readonly path: string;
    readonly name: string;
};

export type CardOpenStatus =
    | { readonly kind: 'idle' }
    /** Asked the server to start the card, or waiting for its conversation to reach this phone. */
    | { readonly kind: 'starting' }
    /** The card's computer is off; the server starts the card when it comes back. */
    | { readonly kind: 'offline' }
    | { readonly kind: 'failed' };

/** The server's answer to starting a card: 200 when it was already going, 201 when this started it. */
type CardStart = {
    readonly schedule: Schedule;
    readonly run?: ScheduleRun | null;
    /** The conversation that owns the card, as its relay session's metadata names it. */
    readonly agent_id: string;
    readonly started: boolean;
};

/** How long a new card conversation may take to reach the phone through the relay. */
const WAIT_MS = 60_000;
const LOOK_MS = 500;
const REFRESH_MS = 3_000;
/** How long "offline" or "could not start" stays on screen. */
const NOTICE_MS = 5_000;

/**
 * The relay session a conversation id stands for. Card and scheduled
 * conversations name their conversation in `metadata.agentId`; the phone never
 * works the id out itself, it only looks for the session that carries it. A
 * session whose own id is the one given is taken too, for a run that already
 * names its relay session.
 */
export function sessionOfAgent(sessions: Readonly<Record<string, Session>>, agentId: string): string | undefined {
    if (!agentId) return undefined;
    let found: Session | undefined;
    for (const session of Object.values(sessions)) {
        if ((session.metadata as { agentId?: unknown } | null)?.agentId !== agentId) continue;
        // The live one first, then the newest.
        if (!found || (session.active && !found.active) || (session.active === found.active && session.updatedAt > found.updatedAt)) found = session;
    }
    return found?.id ?? (sessions[agentId] ? agentId : undefined);
}

/**
 * Opening a board card's own conversation.
 *
 * A card keeps one conversation. When project.json names it and its session
 * is already on the phone, the card opens it. Otherwise the server is asked to
 * start the card — it works out the conversation and has the card's computer,
 * or the cloud, start it — and the phone waits for the relay to bring a
 * session carrying that conversation's id, then opens it. A computer that is
 * off gets the card when it is next on; the phone says so rather than wait.
 */
export function useCardOpen() {
    const router = useRouter();
    const [status, setStatus] = React.useState<CardOpenStatus>({ kind: 'idle' });
    const busy = React.useRef(false);
    const alive = React.useRef(true);
    const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    React.useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; if (noticeTimer.current) clearTimeout(noticeTimer.current); };
    }, []);

    const show = React.useCallback((next: CardOpenStatus) => {
        if (!alive.current) return;
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        setStatus(next);
        if (next.kind === 'offline' || next.kind === 'failed') {
            noticeTimer.current = setTimeout(() => { if (alive.current) setStatus({ kind: 'idle' }); }, NOTICE_MS);
        }
    }, []);

    const go = React.useCallback((sessionId: string) => {
        show({ kind: 'idle' });
        router.push(`/session/${sessionId}`);
    }, [router, show]);

    /** Waits for the conversation's session to arrive; its id, or undefined when it did not in time. */
    const arrival = React.useCallback(async (agentId: string): Promise<string | undefined> => {
        const deadline = Date.now() + WAIT_MS;
        let refreshed = 0;
        while (alive.current && Date.now() < deadline) {
            const found = sessionOfAgent(storage.getState().sessions, agentId);
            if (found) return found;
            if (Date.now() - refreshed >= REFRESH_MS) {
                refreshed = Date.now();
                void sync.refreshSessions().catch(() => undefined);
            }
            await new Promise(resolve => setTimeout(resolve, LOOK_MS));
        }
        return undefined;
    }, []);

    const machineOffline = (project: CardProject) =>
        !project.cloud && storage.getState().machines[project.machineId]?.active !== true;

    /**
     * Opens a card of `project`. `agent` is the conversation project.json
     * says owns the card, when it says one.
     */
    const open = React.useCallback(async (project: CardProject, card: BoardCard, agent?: string) => {
        if (busy.current) return;
        const known = agent ? sessionOfAgent(storage.getState().sessions, agent) : undefined;
        if (known) { go(known); return; }
        busy.current = true;
        show({ kind: 'starting' });
        try {
            const started = await api<CardStart>('/schedules', 'POST', {
                kind: 'card',
                target: project.cloud ? 'cloud' : `machine:${project.machineId}`,
                project_path: project.path,
                project_name: project.name,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
                card: { id: card.id, title: card.title, label: card.action?.label ?? '', prompt: boardCardPrompt(card) },
            });
            const agentId = started.agent_id;
            const ready = agentId ? sessionOfAgent(storage.getState().sessions, agentId) : undefined;
            if (ready) { go(ready); return; }
            if (!agentId) { show({ kind: 'failed' }); return; }
            if (started.run?.status === 'waiting_device' || machineOffline(project)) { show({ kind: 'offline' }); return; }
            const arrived = await arrival(agentId);
            if (arrived) go(arrived);
            else show(machineOffline(project) ? { kind: 'offline' } : { kind: 'failed' });
        } catch {
            show({ kind: 'failed' });
        } finally {
            busy.current = false;
        }
    }, [arrival, go, show]);

    /** Opens the conversation a scheduled run happened in, by the id the run names. */
    const openAgent = React.useCallback(async (agentId: string) => {
        if (busy.current || !agentId) return;
        const known = sessionOfAgent(storage.getState().sessions, agentId);
        if (known) { go(known); return; }
        busy.current = true;
        show({ kind: 'starting' });
        try {
            const arrived = await arrival(agentId);
            if (arrived) go(arrived);
            else show({ kind: 'failed' });
        } finally {
            busy.current = false;
        }
    }, [arrival, go, show]);

    return { status, open, openAgent };
}

/** What the phone says while a card opens; empty when there is nothing to say. */
export function cardOpenNotice(status: CardOpenStatus): string {
    switch (status.kind) {
        case 'starting': return t('kissopen.board.cardStarting');
        case 'offline': return t('kissopen.board.cardOffline');
        case 'failed': return t('kissopen.board.cardStartFailed');
        default: return '';
    }
}
