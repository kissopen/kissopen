/**
 * The correction Pierre Diffs' shadow-DOM stylesheet needs wherever KISSOPEN owns
 * the scrollport around it — the working-tree diff and the file viewer's source
 * face. Both hand the renderer a whole pane and scroll it from outside, so both
 * need the same things, written once here rather than drifting apart.
 *
 * Pierre reserves a classic scrollbar gutter inside every code column. On a pane
 * whose vertical scrollport belongs to Kissopen, that gutter is only an unpainted
 * lane down the right of every row: an addition's green and a deletion's red
 * stop short of the edge, and the lane comes and goes with the file's length, so
 * the same code sits at different coordinates depending on how much of it there
 * is. Releasing it lets each row reach the pane edge and continue underneath the
 * overlay bar drawn above it, which costs no layout at all.
 *
 * The horizontal scrollport inside each code column is Pierre's own, and a
 * shadow root does not inherit the page's rules, so it remains the sole native
 * third-party bar. Custom properties cross the boundary and the small local
 * activity bridge below handles trusted input without a document observer.
 */
export const PIERRE_PANE_CSS = `
    [data-code] {
        --kissopen-scrollbar-color: var(--kissopen-scrollbar-rest-color, transparent);
        padding-bottom: var(--diffs-gap-block, var(--diffs-gap-fallback));
        scrollbar-gutter: auto;
    }
    [data-code]:last-of-type [data-line],
    [data-code]:last-of-type [data-no-newline] {
        padding-inline-end: var(--kissopen-code-trailing-clearance, 1ch);
    }
    [data-code]:hover {
        --kissopen-scrollbar-color: var(--kissopen-scrollbar-surface-color, transparent);
    }
    [data-code][data-scrollbar-active=""] {
        --kissopen-scrollbar-color: var(--kissopen-scrollbar-active-color);
        transition: none;
    }
    [data-code][data-scrollbar-active="idle"] {
        --kissopen-scrollbar-color: var(--kissopen-scrollbar-rest-color, transparent);
        transition: --kissopen-scrollbar-color 480ms linear;
    }
    [data-code][data-scrollbar-hover],
    [data-code][data-scrollbar-dragging] {
        --kissopen-scrollbar-color: var(--kissopen-scrollbar-interaction-color);
    }
    @supports selector(::-webkit-scrollbar) {
        [data-code]::-webkit-scrollbar {
            width: var(--kissopen-scrollbar-track);
            height: var(--kissopen-scrollbar-track);
        }
        [data-code]::-webkit-scrollbar-track,
        [data-code]::-webkit-scrollbar-corner {
            background: transparent;
        }
        [data-code]::-webkit-scrollbar-thumb {
            background: var(--kissopen-scrollbar-color);
            background-clip: padding-box;
            transition: background-color 480ms linear;
        }
        [data-code]::-webkit-scrollbar-thumb:hover,
        [data-code]::-webkit-scrollbar-thumb:active {
            background: var(--kissopen-scrollbar-interaction-color);
        }
        [data-code]::-webkit-scrollbar-thumb:vertical {
            border-right: var(--kissopen-scrollbar-edge-inset) solid transparent;
            border-radius: calc(var(--kissopen-scrollbar-ink) / 2);
        }
        [data-code]::-webkit-scrollbar-thumb:horizontal {
            border-bottom: var(--kissopen-scrollbar-edge-inset) solid transparent;
            border-radius: calc(var(--kissopen-scrollbar-ink) / 2);
        }
    }
    @supports not selector(::-webkit-scrollbar) {
        [data-code] {
            scrollbar-color: var(--kissopen-scrollbar-color) transparent;
            scrollbar-width: thin;
        }
    }
`;

type PierrePhase = "mount" | "update" | "unmount";
type Timers = { clear?: number; idle?: number };

const connections = new WeakMap<HTMLElement, () => void>();

function codeFrom(event: Event): HTMLElement | null {
    for (const node of event.composedPath())
        if (node instanceof HTMLElement && node.matches("[data-code]")) return node;
    return null;
}

function connect(host: HTMLElement): () => void {
    const root = host.shadowRoot;
    const window = host.ownerDocument.defaultView;
    if (!root || !window) return () => {};
    const timers = new Map<HTMLElement, Timers>();
    let pointerTarget: HTMLElement | null = null;

    const activate = (target: HTMLElement | null) => {
        if (!target || target.scrollWidth - target.clientWidth <= 0.5) return;
        const record = timers.get(target) ?? {};
        timers.set(target, record);
        if (record.idle !== undefined) window.clearTimeout(record.idle);
        if (record.clear !== undefined) window.clearTimeout(record.clear);
        record.clear = undefined;
        target.setAttribute("data-scrollbar-active", "");
        record.idle = window.setTimeout(() => {
            record.idle = undefined;
            target.setAttribute("data-scrollbar-active", "idle");
            record.clear = window.setTimeout(() => {
                record.clear = undefined;
                target.removeAttribute("data-scrollbar-active");
                if (record.idle === undefined) timers.delete(target);
            }, 480);
        }, 2000);
    };
    const wheel = (rawEvent: Event) => {
        const event = rawEvent as WheelEvent;
        if (event.isTrusted && (event.deltaX !== 0 || event.shiftKey)) activate(codeFrom(event));
    };
    const pointerDown = (rawEvent: Event) => {
        const event = rawEvent as PointerEvent;
        if (event.isTrusted) pointerTarget = codeFrom(event);
    };
    const pointerEnd = () => {
        pointerTarget = null;
    };
    const scroll = (event: Event) => {
        if (event.target === pointerTarget) activate(pointerTarget);
    };
    root.addEventListener("wheel", wheel);
    root.addEventListener("pointerdown", pointerDown);
    root.addEventListener("scroll", scroll, true);
    window.addEventListener("pointerup", pointerEnd);
    window.addEventListener("pointercancel", pointerEnd);
    window.addEventListener("blur", pointerEnd);
    return () => {
        root.removeEventListener("wheel", wheel);
        root.removeEventListener("pointerdown", pointerDown);
        root.removeEventListener("scroll", scroll, true);
        window.removeEventListener("pointerup", pointerEnd);
        window.removeEventListener("pointercancel", pointerEnd);
        window.removeEventListener("blur", pointerEnd);
        for (const [target, record] of timers) {
            if (record.idle !== undefined) window.clearTimeout(record.idle);
            if (record.clear !== undefined) window.clearTimeout(record.clear);
            target.removeAttribute("data-scrollbar-active");
        }
        timers.clear();
    };
}

/** Owns the one unavoidable native scrollbar entirely within its Pierre host. */
export function pierreCodeSurfacePhase(host: HTMLElement, phase: PierrePhase) {
    if (phase === "unmount") {
        connections.get(host)?.();
        connections.delete(host);
        return;
    }
    if (connections.has(host)) return;
    connections.set(host, connect(host));
}
