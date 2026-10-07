import type { Event, WebContents } from "electron";

export type DesktopCdpMessageListener = (
    method: string,
    params: Record<string, unknown>,
    sessionId?: string,
) => void;

export class DesktopCdpExclusiveError extends Error {
    readonly code = "exclusive-cdp-domain";

    constructor(domain: string, owner: string) {
        super(`The ${domain} CDP domain is already owned by ${owner}.`);
        this.name = "DesktopCdpExclusiveError";
    }
}

export interface DesktopCdpLease {
    sendCommand(
        method: string,
        params?: Record<string, unknown>,
        sessionId?: string,
    ): Promise<unknown>;
    onMessage(listener: DesktopCdpMessageListener): () => void;
    onDetached(listener: (reason: string) => void): () => void;
    /** Ends Tracing only when this lease owns it; never interrupts another lease. */
    endOwnedTracing(): Promise<void>;
    release(): Promise<void>;
}

interface LeaseState {
    readonly label: string;
    readonly messages: Set<DesktopCdpMessageListener>;
    readonly detached: Set<(reason: string) => void>;
    released: boolean;
}

interface SharedState {
    readonly contents: WebContents;
    readonly ownedAttachment: boolean;
    readonly leases: Set<LeaseState>;
    readonly exclusive: Map<string, LeaseState>;
    readonly tracingStreams: Map<string, LeaseState>;
    tracingComplete: boolean;
    onMessage: (
        event: Event,
        method: string,
        params: Record<string, unknown>,
        sessionId?: string,
    ) => void;
    onDetached: (event: Event, reason: string) => void;
    closed: boolean;
    intentionalDetach: boolean;
}

const sharedStates = new WeakMap<WebContents, SharedState>();

export async function desktopCdpSharedAcquire(
    contents: WebContents,
    label: string,
): Promise<DesktopCdpLease> {
    if (contents.isDestroyed()) throw new Error("The KissOpen renderer is not available.");

    let state = sharedStates.get(contents);
    if (state === undefined || state.closed) {
        const ownedAttachment = !contents.debugger.isAttached();
        if (ownedAttachment) contents.debugger.attach("1.3");

        const nextState: SharedState = {
            contents,
            ownedAttachment,
            leases: new Set(),
            exclusive: new Map(),
            tracingStreams: new Map(),
            tracingComplete: false,
            onMessage: () => undefined,
            onDetached: () => undefined,
            closed: false,
            intentionalDetach: false,
        };
        nextState.onMessage = (_event, method, params, sessionId) => {
            if (nextState.closed) return;
            const tracingOwner = nextState.exclusive.get("tracing");
            if (method.startsWith("Tracing.")) {
                // Tracing events contain the owner's raw timeline and, in
                // ReturnAsStream mode, an IO handle. They are never broadcast
                // to an unrelated debugger lease.
                if (tracingOwner === undefined) return;
                const stream = streamHandle(params);
                if (method === "Tracing.tracingComplete") {
                    nextState.tracingComplete = true;
                    if (stream !== undefined) nextState.tracingStreams.set(stream, tracingOwner);
                }
                if (!tracingOwner.released)
                    for (const listener of tracingOwner.messages)
                        listener(method, params, sessionId);
                if (method === "Tracing.tracingComplete" && stream === undefined)
                    desktopCdpSharedClearTracing(nextState, tracingOwner);
                return;
            }
            for (const lease of nextState.leases) {
                if (lease.released) continue;
                for (const listener of lease.messages) listener(method, params, sessionId);
            }
        };
        nextState.onDetached = (_event, reason) => {
            if (nextState.closed || nextState.intentionalDetach) return;
            nextState.closed = true;
            sharedStates.delete(contents);
            contents.debugger.removeListener("message", nextState.onMessage);
            for (const lease of nextState.leases) {
                for (const listener of lease.detached) listener(reason);
            }
        };
        contents.debugger.on("message", nextState.onMessage);
        contents.debugger.once("detach", nextState.onDetached);
        state = nextState;
        sharedStates.set(contents, state);
    }

    const lease: LeaseState = {
        label,
        messages: new Set(),
        detached: new Set(),
        released: false,
    };
    state.leases.add(lease);

    return {
        sendCommand: (method, params, sessionId) =>
            desktopCdpSharedSend(state!, lease, method, params, sessionId),
        onMessage(listener) {
            lease.messages.add(listener);
            return () => lease.messages.delete(listener);
        },
        onDetached(listener) {
            lease.detached.add(listener);
            return () => lease.detached.delete(listener);
        },
        endOwnedTracing: () => desktopCdpSharedEndOwnedTracing(state!, lease),
        release: () => desktopCdpSharedRelease(state!, lease),
    };
}

async function desktopCdpSharedSend(
    state: SharedState,
    lease: LeaseState,
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
): Promise<unknown> {
    if (
        lease.released ||
        state.closed ||
        state.contents.isDestroyed() ||
        !state.contents.debugger.isAttached()
    )
        throw new Error("The renderer debugger is detached.");

    const stream = streamHandle(params);
    const streamOwner = stream === undefined ? undefined : state.tracingStreams.get(stream);
    if (streamOwner !== undefined && streamOwner !== lease)
        throw new DesktopCdpExclusiveError("tracing stream", streamOwner.label);

    const domain = exclusiveDomain(method);
    const current = domain === undefined ? undefined : state.exclusive.get(domain);
    if (domain !== undefined) {
        if (method === "Tracing.start") {
            if (current !== undefined) throw new DesktopCdpExclusiveError(domain, current.label);
            state.exclusive.set(domain, lease);
        } else if (current !== lease) {
            throw new DesktopCdpExclusiveError(domain, current?.label ?? "no active tracing owner");
        }
    }

    try {
        const result = await state.contents.debugger.sendCommand(method, params, sessionId);
        if (method === "IO.close" && stream !== undefined && streamOwner === lease) {
            state.tracingStreams.delete(stream);
            if (state.tracingComplete && state.tracingStreams.size === 0)
                desktopCdpSharedClearTracing(state, lease);
        }
        return result;
    } catch (error) {
        if (
            (method === "Tracing.start" || method === "Tracing.end") &&
            state.exclusive.get("tracing") === lease
        )
            desktopCdpSharedClearTracing(state, lease);
        throw error;
    }
}

async function desktopCdpSharedRelease(state: SharedState, lease: LeaseState): Promise<void> {
    if (lease.released) return;
    await desktopCdpSharedEndOwnedTracing(state, lease);
    lease.released = true;
    lease.messages.clear();
    lease.detached.clear();
    state.leases.delete(lease);

    if (
        state.leases.size > 0 ||
        state.exclusive.size > 0 ||
        !state.ownedAttachment ||
        state.closed ||
        state.contents.isDestroyed() ||
        !state.contents.debugger.isAttached()
    )
        return;

    state.closed = true;
    state.intentionalDetach = true;
    sharedStates.delete(state.contents);
    state.contents.debugger.removeListener("message", state.onMessage);
    state.contents.debugger.removeListener("detach", state.onDetached);
    state.contents.debugger.detach();
}

async function desktopCdpSharedEndOwnedTracing(
    state: SharedState,
    lease: LeaseState,
): Promise<void> {
    if (state.exclusive.get("tracing") !== lease) return;
    try {
        if (!state.closed && !state.contents.isDestroyed() && state.contents.debugger.isAttached())
            await state.contents.debugger.sendCommand("Tracing.end");
    } catch {
        // A renderer detach owns the terminal outcome; do not end another
        // client's trace when this lease is already gone.
    } finally {
        desktopCdpSharedClearTracing(state, lease);
    }
}

function exclusiveDomain(method: string): string | undefined {
    return method === "Tracing.start" || method === "Tracing.end" ? "tracing" : undefined;
}

function streamHandle(params: Record<string, unknown> | undefined): string | undefined {
    return typeof params?.handle === "string" ? params.handle : undefined;
}

function desktopCdpSharedClearTracing(state: SharedState, lease: LeaseState): void {
    if (state.exclusive.get("tracing") !== lease) return;
    state.exclusive.delete("tracing");
    for (const [handle, owner] of state.tracingStreams)
        if (owner === lease) state.tracingStreams.delete(handle);
    state.tracingComplete = false;
}
