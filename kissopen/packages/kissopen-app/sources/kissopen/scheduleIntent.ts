/**
 * Somewhere in the schedules surface a person asked to be taken.
 *
 * Two things send someone there from outside it: a notification about a run,
 * and a task an assistant proposed in a conversation. Neither has a screen to
 * route to — the schedules surface is a section of the home rather than a route
 * of its own — so the intent is recorded here and the home takes it when it
 * mounts or when it is already mounted. Taken rather than read: an intent acted
 * on twice would reopen a task the person had just left, or start a second
 * draft of one they had already confirmed.
 */
export type ScheduleIntent =
    /** Show one task, at the run a notification was about. */
    | { readonly kind: 'run'; readonly scheduleId: string; readonly runId: string }
    /** Start a new task, with what the assistant proposed already said. */
    | { readonly kind: 'draft'; readonly request: string };

let pending: ScheduleIntent | undefined;
const listeners = new Set<() => void>();

function scheduleIntentPut(intent: ScheduleIntent) {
    pending = intent;
    for (const listener of [...listeners]) listener();
}

export function scheduleIntentSet(scheduleId: string, runId: string) {
    if (!scheduleId) return;
    scheduleIntentPut({ kind: 'run', scheduleId, runId });
}

export function scheduleDraftIntentSet(request: string) {
    const said = request.trim();
    if (!said) return;
    scheduleIntentPut({ kind: 'draft', request: said });
}

export function scheduleIntentTake(): ScheduleIntent | undefined {
    const held = pending;
    pending = undefined;
    return held;
}

export function scheduleIntentSubscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
