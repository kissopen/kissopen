/*
A task an assistant proposed, on its way to 计划任务.

The card that proposes it sits in a conversation, and a conversation is either
this computer's or another machine's — two different trees in this window,
neither of which owns 计划任务. That belongs to the relay workspace, which is
what draws the account's own destinations. So the card records its request
here and the workspace takes it: it opens 计划任务 and starts a new task with
the request already said.

Taken rather than read. A proposal acted on twice would start a second draft
of a task the reader had already confirmed.
*/

let pending: string | null = null;
const listeners = new Set<() => void>();

/** Asks for 计划任务, with this request said as the first line of a new task. */
export function scheduleDraftRequest(request: string): void {
    const said = request.trim();
    if (!said) return;
    pending = said;
    for (const listener of [...listeners]) listener();
}

/** The waiting request, if there is one, which is then no longer waiting. */
export function scheduleDraftTake(): string | null {
    const held = pending;
    pending = null;
    return held;
}

export function scheduleDraftSubscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/*
A task the agent already created, to be shown in 计划任务.

The created-task card in a conversation says what now runs; choosing it takes
the reader to that task among the rest. Same road as a proposal — the card
records the task's id here and the workspace takes it, opens 计划任务 and points
at the task — and taken for the same reason: asking once is showing it once,
not every later visit to 计划任务.
*/

let focusPending: string | null = null;
const focusListeners = new Set<() => void>();

/** Asks for 计划任务, showing the task with this id. */
export function scheduleFocusRequest(scheduleId: string): void {
    if (!scheduleId) return;
    focusPending = scheduleId;
    for (const listener of [...focusListeners]) listener();
}

/** The waiting task id, if there is one, which is then no longer waiting. */
export function scheduleFocusTake(): string | null {
    const held = focusPending;
    focusPending = null;
    return held;
}

export function scheduleFocusSubscribe(listener: () => void): () => void {
    focusListeners.add(listener);
    return () => {
        focusListeners.delete(listener);
    };
}
