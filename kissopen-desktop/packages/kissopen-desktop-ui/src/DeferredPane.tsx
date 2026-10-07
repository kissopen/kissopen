import {
    useCallback,
    useMemo,
    useSyncExternalStore,
    type CSSProperties,
    type ReactNode,
} from "react";

export type DeferredPaneCurrent = {
    readonly id: string;
    readonly content: ReactNode;
};

export type DeferredPanePending = {
    readonly id: string;
    /** Ordinary React content may reveal after it commits. Defaults to true. */
    readonly ready?: boolean;
    /**
     * Draws the pending body at its real size. The body calls `ready` only once
     * its final pixels exist — after syntax highlighting, not merely after its
     * bytes arrived.
     */
    readonly render: (ready: () => void) => ReactNode;
    /** A worker-backed body calls `ready` itself instead of revealing on commit. */
    readonly waitForReady?: boolean;
};

export type DeferredPaneProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    /** The complete body currently visible. Absent leaves `persistent` visible. */
    current?: DeferredPaneCurrent;
    /** A selected body being prepared without replacing `current`. */
    pending?: DeferredPanePending;
    /** Content that must stay mounted across swaps, such as browser guests. */
    persistent?: ReactNode;
    /** The patient loading face, shown only after the quiet delay. */
    fallback: ReactNode;
    /** Commits a pending body after it is ready and the fallback minimum elapsed. */
    onReveal: (id: string) => void;
    /** Quiet period before the fallback appears. Default: 800ms. */
    slowDelayMs?: number;
    /** Minimum time an appeared fallback remains visible. Default: 500ms. */
    minimumSlowMs?: number;
};

const DEFAULT_SLOW_DELAY_MS = 800;
const DEFAULT_MINIMUM_SLOW_MS = 500;

type DeferredPaneLayerProps = {
    content?: ReactNode;
    fallback: ReactNode;
    id: string;
    minimumSlowMs: number;
    onReveal: (id: string) => void;
    pending?: DeferredPanePending;
    slowDelayMs: number;
};

type DeferredPaneGateSnapshot = "pending" | "slow";

class DeferredPaneGate {
    private readonly listeners = new Set<() => void>();
    private readyRequested = false;
    private revealed = false;
    private revealTimer: ReturnType<typeof setTimeout> | undefined;
    private slowAt: number | undefined;
    private slowTimer: ReturnType<typeof setTimeout> | undefined;
    private snapshot: DeferredPaneGateSnapshot = "pending";

    constructor(
        private readonly enabled: boolean,
        private readonly id: string,
        private readonly slowDelayMs: number,
        private readonly minimumSlowMs: number,
        private readonly reveal: (id: string) => void,
    ) {}

    readonly getSnapshot = (): DeferredPaneGateSnapshot => this.snapshot;
    readonly getServerSnapshot = (): DeferredPaneGateSnapshot => "pending";
    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        if (this.enabled && this.listeners.size === 1) this.start();
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) this.stop();
        };
    };
    readonly ready = (): void => {
        if (this.readyRequested || this.revealed) return;
        this.readyRequested = true;
        this.settle();
    };

    private start(): void {
        if (this.revealed) return;
        if (this.readyRequested) {
            this.settle();
            return;
        }
        this.slowTimer = setTimeout(() => {
            this.slowTimer = undefined;
            this.slowAt = Date.now();
            this.snapshot = "slow";
            for (const listener of this.listeners) listener();
        }, this.slowDelayMs);
    }

    private settle(): void {
        if (this.revealed) return;
        if (this.slowTimer !== undefined) clearTimeout(this.slowTimer);
        this.slowTimer = undefined;
        const appearedAt = this.slowAt;
        if (appearedAt === undefined) {
            this.revealed = true;
            this.reveal(this.id);
            return;
        }
        const remaining = Math.max(0, this.minimumSlowMs - (Date.now() - appearedAt));
        this.revealTimer = setTimeout(() => {
            this.revealTimer = undefined;
            if (this.revealed) return;
            this.revealed = true;
            this.reveal(this.id);
        }, remaining);
    }

    private stop(): void {
        if (this.slowTimer !== undefined) clearTimeout(this.slowTimer);
        if (this.revealTimer !== undefined) clearTimeout(this.revealTimer);
        this.slowTimer = undefined;
        this.revealTimer = undefined;
    }
}

function DeferredPaneLayer(props: DeferredPaneLayerProps) {
    const { id, minimumSlowMs, onReveal, pending, slowDelayMs } = props;
    const isPending = pending !== undefined;
    const gate = useMemo(
        () => new DeferredPaneGate(isPending, id, slowDelayMs, minimumSlowMs, onReveal),
        [id, isPending, minimumSlowMs, onReveal, slowDelayMs],
    );
    const snapshot = useSyncExternalStore(gate.subscribe, gate.getSnapshot, gate.getServerSnapshot);
    const slow = isPending && snapshot === "slow";
    const revealOnCommit = pending?.ready !== false && pending?.waitForReady !== true;
    const contentRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (node && isPending && revealOnCommit) gate.ready();
        },
        [gate, isPending, revealOnCommit],
    );
    return (
        <div
            className="kissopen-deferred-pane__layer"
            data-state={isPending ? (slow ? "slow" : "pending") : "current"}
        >
            <div
                aria-hidden={isPending ? "true" : undefined}
                className="kissopen-deferred-pane__content"
                ref={contentRef}
            >
                {pending ? pending.render(gate.ready) : props.content}
            </div>
            {isPending && slow ? (
                <div
                    aria-live="polite"
                    className="kissopen-deferred-pane__fallback"
                    data-kissopen-desktop-ui="deferred-pane-fallback"
                >
                    {props.fallback}
                </div>
            ) : null}
        </div>
    );
}

/**
 * C-266 DeferredPane — prepares a selected body without replacing the complete
 * body already on screen.
 *
 * Fast work swaps directly. Slow work stays quiet for 800ms, then shows one
 * patient fallback for at least 500ms. Pending content is mounted at full size,
 * so a renderer can measure and finish before it is revealed; the keyed layer
 * becomes current in place rather than remounting the finished renderer.
 */
export function DeferredPane(props: DeferredPaneProps) {
    const layers: Array<{
        readonly id: string;
        readonly content?: ReactNode;
        readonly pending?: DeferredPanePending;
    }> = [];
    if (props.current) layers.push(props.current);
    if (props.pending && props.pending.id !== props.current?.id)
        layers.push({ id: props.pending.id, pending: props.pending });
    return (
        <div
            className={["kissopen-deferred-pane", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="deferred-pane"
            data-pending={props.pending === undefined ? undefined : ""}
            data-testid={props["data-testid"]}
            style={props.style}
        >
            {props.persistent}
            {layers.map((layer) => (
                <DeferredPaneLayer
                    {...(layer.content === undefined ? {} : { content: layer.content })}
                    fallback={props.fallback}
                    id={layer.id}
                    key={layer.id}
                    minimumSlowMs={props.minimumSlowMs ?? DEFAULT_MINIMUM_SLOW_MS}
                    onReveal={props.onReveal}
                    {...(layer.pending === undefined ? {} : { pending: layer.pending })}
                    slowDelayMs={props.slowDelayMs ?? DEFAULT_SLOW_DELAY_MS}
                />
            ))}
        </div>
    );
}
