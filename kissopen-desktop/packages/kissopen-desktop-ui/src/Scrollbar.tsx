import {
    useCallback,
    useMemo,
    type CSSProperties,
    type HTMLAttributes,
    type ReactNode,
    type Ref,
} from "react";

const SCROLLBAR_IDLE_DELAY_MS = 2000;
const SCROLLBAR_FADE_MS = 480;
const SCROLLBAR_KEYBOARD_GATE_MS = 250;
const SCROLLBAR_MIN_THUMB = 24;

export type ScrollbarAxis = "horizontal" | "vertical";
export type ScrollbarAxes = ScrollbarAxis | "both";
export type ScrollbarPlacement = "gutter" | "overlay" | "stable-gutter";

type AxisElements = {
    thumb: HTMLDivElement | null;
    track: HTMLDivElement | null;
};

type HoverController = {
    hostGet: () => HTMLElement | null;
    scrollable: () => boolean;
    surfaceSet: (active: boolean) => void;
};

const handledKeyboardEvents = new WeakSet<Event>();
const handledWheelEvents = new WeakSet<Event>();
const hoveredControllers = new Set<HoverController>();
let surfaceController: HoverController | null = null;

function surfaceUpdate() {
    let next: HoverController | null = null;
    for (const candidate of hoveredControllers) {
        const candidateHost = candidate.hostGet();
        if (!candidateHost || !candidate.scrollable()) continue;
        const nextHost = next?.hostGet();
        if (!nextHost || nextHost.contains(candidateHost)) next = candidate;
    }
    if (surfaceController === next) return;
    surfaceController?.surfaceSet(false);
    surfaceController = next;
    surfaceController?.surfaceSet(true);
}

function axesFrom(value: ScrollbarAxes): readonly ScrollbarAxis[] {
    return value === "both" ? ["vertical", "horizontal"] : [value];
}

function axisPosition(viewport: HTMLElement, axis: ScrollbarAxis): number {
    return axis === "vertical" ? viewport.scrollTop : viewport.scrollLeft;
}

function axisPositionSet(viewport: HTMLElement, axis: ScrollbarAxis, value: number) {
    if (axis === "vertical") viewport.scrollTop = value;
    else viewport.scrollLeft = value;
}

function axisViewport(viewport: HTMLElement, axis: ScrollbarAxis): number {
    return axis === "vertical" ? viewport.clientHeight : viewport.clientWidth;
}

function axisExtent(viewport: HTMLElement, axis: ScrollbarAxis): number {
    return axis === "vertical" ? viewport.scrollHeight : viewport.scrollWidth;
}

function axisMaximum(viewport: HTMLElement, axis: ScrollbarAxis): number {
    return axisExtent(viewport, axis) - axisViewport(viewport, axis);
}

function axisCanScroll(viewport: HTMLElement, axis: ScrollbarAxis, delta: number): boolean {
    if (delta === 0) return false;
    const maximum = axisMaximum(viewport, axis);
    if (maximum <= 0.5) return false;
    const position = axisPosition(viewport, axis);
    return delta < 0 ? position > 0.5 : position < maximum - 0.5;
}

function keyboardDirection(event: KeyboardEvent): { axis: ScrollbarAxis; delta: number } | null {
    if (event.key === "ArrowLeft") return { axis: "horizontal", delta: -1 };
    if (event.key === "ArrowRight") return { axis: "horizontal", delta: 1 };
    if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home")
        return { axis: "vertical", delta: -1 };
    if (
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        event.key === "End" ||
        event.key === " "
    )
        return { axis: "vertical", delta: 1 };
    return null;
}

function wheelDirections(event: WheelEvent): readonly { axis: ScrollbarAxis; delta: number }[] {
    const horizontal = {
        axis: "horizontal" as const,
        delta: event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX,
    };
    const vertical = { axis: "vertical" as const, delta: event.deltaY };
    return Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? [horizontal, vertical]
        : [vertical, horizontal];
}

function wheelPixels(event: WheelEvent, viewport: HTMLElement, axis: ScrollbarAxis): number {
    const delta =
        axis === "vertical"
            ? event.deltaY
            : event.shiftKey && event.deltaX === 0
              ? event.deltaY
              : event.deltaX;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * axisViewport(viewport, axis);
    return delta;
}

function refSet<T>(ref: Ref<T> | undefined, value: T | null) {
    if (typeof ref === "function") ref(value);
    else if (ref) (ref as { current: T | null }).current = value;
}

export type ScrollbarController = {
    hostSet: (element: HTMLElement | null) => void;
    thumbSet: (axis: ScrollbarAxis, element: HTMLDivElement | null) => void;
    trackSet: (axis: ScrollbarAxis, element: HTMLDivElement | null) => void;
    viewportSet: (element: HTMLElement | null) => void;
};

/**
 * Paints and drives a DOM thumb while leaving the browser scrollport in charge
 * of wheel, keyboard, momentum, selection, and scroll position.
 */
export function scrollbarControllerCreate(axesValue: ScrollbarAxes): ScrollbarController {
    const axes = axesFrom(axesValue);
    const elements: Record<ScrollbarAxis, AxisElements> = {
        horizontal: { thumb: null, track: null },
        vertical: { thumb: null, track: null },
    };
    let host: HTMLElement | null = null;
    let viewport: HTMLElement | null = null;
    let disconnect: (() => void) | undefined;

    const connect = () => {
        disconnect?.();
        disconnect = undefined;
        if (
            !host ||
            !viewport ||
            axes.some((axis) => !elements[axis].track || !elements[axis].thumb)
        )
            return;

        const connectedHost = host;
        const connectedViewport = viewport;
        const connectedElements = elements as Record<
            ScrollbarAxis,
            { thumb: HTMLDivElement; track: HTMLDivElement }
        >;
        const window = connectedViewport.ownerDocument.defaultView;
        let clearTimer: number | undefined;
        let idleTimer: number | undefined;
        let keyboardTimer: number | undefined;
        let keyboardPending = false;
        let pendingClear = false;
        let pendingIdle = false;
        let dragAxis: ScrollbarAxis | null = null;
        let dragOffset = 0;
        const hoveredTracks = new Set<HTMLElement>();
        const observedChildren = new Set<Element>();

        connectedViewport.setAttribute("data-scrollbar-viewport", "");

        const pinned = () => hoveredTracks.size > 0 || dragAxis !== null;
        const clearSchedule = () => {
            if (!window) return;
            if (clearTimer !== undefined) window.clearTimeout(clearTimer);
            clearTimer = window.setTimeout(() => {
                clearTimer = undefined;
                if (pinned()) pendingClear = true;
                else connectedHost.removeAttribute("data-scrollbar-active");
            }, SCROLLBAR_FADE_MS);
        };
        const idleBegin = () => {
            pendingIdle = false;
            pendingClear = false;
            connectedHost.setAttribute("data-scrollbar-active", "idle");
            clearSchedule();
        };
        const pinRelease = () => {
            if (pendingIdle) idleBegin();
            else if (pendingClear) {
                pendingClear = false;
                clearSchedule();
            }
        };
        const activate = () => {
            if (!window) return;
            if (idleTimer !== undefined) window.clearTimeout(idleTimer);
            if (clearTimer !== undefined) window.clearTimeout(clearTimer);
            clearTimer = undefined;
            pendingIdle = false;
            pendingClear = false;
            connectedHost.setAttribute("data-scrollbar-active", "");
            idleTimer = window.setTimeout(() => {
                idleTimer = undefined;
                if (pinned()) pendingIdle = true;
                else idleBegin();
            }, SCROLLBAR_IDLE_DELAY_MS);
        };
        const overflowSet = (axis: ScrollbarAxis, overflow: boolean) => {
            const attribute =
                axis === "vertical" ? "data-scrollbar-overflow-y" : "data-scrollbar-overflow-x";
            if (connectedHost.hasAttribute(attribute) === overflow) return;
            connectedHost.toggleAttribute(attribute, overflow);
        };
        const update = () => {
            for (const axis of axes) overflowSet(axis, axisMaximum(connectedViewport, axis) > 0.5);
            surfaceUpdate();
            for (const axis of axes) {
                const { thumb, track } = connectedElements[axis];
                const maximum = axisMaximum(connectedViewport, axis);
                const trackLength = axis === "vertical" ? track.clientHeight : track.clientWidth;
                if (maximum <= 0.5 || trackLength <= 0) {
                    thumb.style.removeProperty(axis === "vertical" ? "height" : "width");
                    thumb.style.removeProperty("transform");
                    continue;
                }
                const viewportLength = axisViewport(connectedViewport, axis);
                const thumbLength = Math.min(
                    trackLength,
                    Math.max(
                        SCROLLBAR_MIN_THUMB,
                        (trackLength * viewportLength) / axisExtent(connectedViewport, axis),
                    ),
                );
                const travel = trackLength - thumbLength;
                const offset = travel * (axisPosition(connectedViewport, axis) / maximum);
                const sizeProperty = axis === "vertical" ? "height" : "width";
                const size = `${String(thumbLength)}px`;
                const transform =
                    axis === "vertical"
                        ? `translateY(${String(offset)}px)`
                        : `translateX(${String(offset)}px)`;
                if (thumb.style.getPropertyValue(sizeProperty) !== size)
                    thumb.style.setProperty(sizeProperty, size);
                if (thumb.style.transform !== transform) thumb.style.transform = transform;
            }
        };
        const scrollToPointer = (axis: ScrollbarAxis, coordinate: number) => {
            const { thumb, track } = connectedElements[axis];
            const bounds = track.getBoundingClientRect();
            const start = axis === "vertical" ? bounds.top : bounds.left;
            const trackLength = axis === "vertical" ? track.clientHeight : track.clientWidth;
            const thumbLength = axis === "vertical" ? thumb.offsetHeight : thumb.offsetWidth;
            const travel = trackLength - thumbLength;
            const maximum = axisMaximum(connectedViewport, axis);
            if (travel <= 0 || maximum <= 0) return;
            const ratio = Math.max(0, Math.min(1, (coordinate - start - dragOffset) / travel));
            axisPositionSet(connectedViewport, axis, ratio * maximum);
        };
        const wheel = (event: WheelEvent) => {
            if (!event.isTrusted || handledWheelEvents.has(event)) return;
            for (const direction of wheelDirections(event)) {
                if (!axes.includes(direction.axis)) continue;
                if (!axisCanScroll(connectedViewport, direction.axis, direction.delta)) continue;
                handledWheelEvents.add(event);
                activate();
                return;
            }
        };
        const keyDown = (event: KeyboardEvent) => {
            if (!event.isTrusted || event.defaultPrevented || handledKeyboardEvents.has(event))
                return;
            const direction = keyboardDirection(event);
            if (
                !direction ||
                !axes.includes(direction.axis) ||
                !axisCanScroll(connectedViewport, direction.axis, direction.delta)
            )
                return;
            handledKeyboardEvents.add(event);
            keyboardPending = true;
            if (!window) return;
            if (keyboardTimer !== undefined) window.clearTimeout(keyboardTimer);
            keyboardTimer = window.setTimeout(() => {
                keyboardPending = false;
                keyboardTimer = undefined;
            }, SCROLLBAR_KEYBOARD_GATE_MS);
        };
        const scroll = () => {
            update();
            if (keyboardPending) activate();
        };
        const hostEnter = () => {
            hoveredControllers.add(hoverController);
            surfaceUpdate();
        };
        const hostLeave = () => {
            hoveredControllers.delete(hoverController);
            surfaceUpdate();
        };
        const trackEnter = (event: PointerEvent) => {
            hoveredTracks.add(event.currentTarget as HTMLElement);
            connectedHost.setAttribute("data-scrollbar-hover", "");
        };
        const trackLeave = (event: PointerEvent) => {
            hoveredTracks.delete(event.currentTarget as HTMLElement);
            if (hoveredTracks.size === 0) {
                connectedHost.removeAttribute("data-scrollbar-hover");
                pinRelease();
            }
        };
        const trackWheel = (axis: ScrollbarAxis, event: WheelEvent) => {
            if (!event.isTrusted || handledWheelEvents.has(event)) return;
            for (const direction of wheelDirections(event)) {
                if (!axes.includes(direction.axis)) continue;
                const delta = wheelPixels(event, connectedViewport, direction.axis);
                if (!axisCanScroll(connectedViewport, direction.axis, delta)) continue;
                handledWheelEvents.add(event);
                activate();
                axisPositionSet(
                    connectedViewport,
                    direction.axis,
                    axisPosition(connectedViewport, direction.axis) + delta,
                );
                event.preventDefault();
                return;
            }
            if (axisCanScroll(connectedViewport, axis, wheelPixels(event, connectedViewport, axis)))
                event.preventDefault();
        };
        const pointerDown = (axis: ScrollbarAxis, event: PointerEvent) => {
            if (event.button !== 0 || axisMaximum(connectedViewport, axis) <= 0.5) return;
            const { thumb, track } = connectedElements[axis];
            const bounds = thumb.getBoundingClientRect();
            const coordinate = axis === "vertical" ? event.clientY : event.clientX;
            const start = axis === "vertical" ? bounds.top : bounds.left;
            const end = axis === "vertical" ? bounds.bottom : bounds.right;
            const size = axis === "vertical" ? bounds.height : bounds.width;
            dragOffset = coordinate >= start && coordinate <= end ? coordinate - start : size / 2;
            dragAxis = axis;
            connectedHost.setAttribute("data-scrollbar-dragging", "");
            activate();
            track.setPointerCapture(event.pointerId);
            scrollToPointer(axis, coordinate);
            event.preventDefault();
        };
        const pointerMove = (axis: ScrollbarAxis, event: PointerEvent) => {
            const track = connectedElements[axis].track;
            if (dragAxis !== axis || !track.hasPointerCapture(event.pointerId)) return;
            activate();
            scrollToPointer(axis, axis === "vertical" ? event.clientY : event.clientX);
        };
        const pointerEnd = (axis: ScrollbarAxis, event: PointerEvent) => {
            const track = connectedElements[axis].track;
            if (track.hasPointerCapture(event.pointerId))
                track.releasePointerCapture(event.pointerId);
            if (dragAxis !== axis) return;
            dragAxis = null;
            connectedHost.removeAttribute("data-scrollbar-dragging");
            pinRelease();
        };
        const pointerCaptureLost = (axis: ScrollbarAxis) => {
            if (dragAxis !== axis) return;
            dragAxis = null;
            connectedHost.removeAttribute("data-scrollbar-dragging");
            pinRelease();
        };
        const childrenObserve = () => {
            for (const child of observedChildren) {
                if (child.parentElement === connectedViewport) continue;
                resize.unobserve(child);
                observedChildren.delete(child);
            }
            for (const child of connectedViewport.children) {
                if (observedChildren.has(child)) continue;
                observedChildren.add(child);
                resize.observe(child);
            }
        };
        const hoverController: HoverController = {
            hostGet: () => connectedHost,
            scrollable: () => axes.some((axis) => axisMaximum(connectedViewport, axis) > 0.5),
            surfaceSet(active) {
                connectedHost.toggleAttribute("data-scrollbar-surface", active);
            },
        };
        // Overflow attributes can change the viewport/track geometry. Apply
        // them outside ResizeObserver delivery so responsive reflow does not
        // trigger another measurement in the same delivery loop.
        let resizeFrame: number | undefined;
        const resize = new ResizeObserver(() => {
            if (resizeFrame !== undefined) return;
            resizeFrame = window?.requestAnimationFrame(() => {
                resizeFrame = undefined;
                update();
            });
        });
        const mutations = new MutationObserver(() => {
            childrenObserve();
            update();
        });

        resize.observe(connectedViewport);
        for (const axis of axes) resize.observe(connectedElements[axis].track);
        childrenObserve();
        mutations.observe(connectedViewport, { childList: true });
        connectedViewport.addEventListener("scroll", scroll);
        connectedViewport.addEventListener("input", update);
        connectedViewport.addEventListener("wheel", wheel);
        connectedViewport.addEventListener("keydown", keyDown);
        connectedHost.addEventListener("pointerenter", hostEnter);
        connectedHost.addEventListener("pointerleave", hostLeave);
        for (const axis of axes) {
            const track = connectedElements[axis].track;
            const enter = (event: PointerEvent) => trackEnter(event);
            const leave = (event: PointerEvent) => trackLeave(event);
            const wheelTrack = (event: WheelEvent) => trackWheel(axis, event);
            const down = (event: PointerEvent) => pointerDown(axis, event);
            const move = (event: PointerEvent) => pointerMove(axis, event);
            const end = (event: PointerEvent) => pointerEnd(axis, event);
            const lost = () => pointerCaptureLost(axis);
            track.addEventListener("pointerenter", enter);
            track.addEventListener("pointerleave", leave);
            track.addEventListener("wheel", wheelTrack, { passive: false });
            track.addEventListener("pointerdown", down);
            track.addEventListener("pointermove", move);
            track.addEventListener("pointerup", end);
            track.addEventListener("pointercancel", end);
            track.addEventListener("lostpointercapture", lost);
            trackCleanups.set(axis, () => {
                track.removeEventListener("pointerenter", enter);
                track.removeEventListener("pointerleave", leave);
                track.removeEventListener("wheel", wheelTrack);
                track.removeEventListener("pointerdown", down);
                track.removeEventListener("pointermove", move);
                track.removeEventListener("pointerup", end);
                track.removeEventListener("pointercancel", end);
                track.removeEventListener("lostpointercapture", lost);
            });
        }
        update();

        disconnect = () => {
            resize.disconnect();
            if (resizeFrame !== undefined) window?.cancelAnimationFrame(resizeFrame);
            mutations.disconnect();
            connectedViewport.removeEventListener("scroll", scroll);
            connectedViewport.removeEventListener("input", update);
            connectedViewport.removeEventListener("wheel", wheel);
            connectedViewport.removeEventListener("keydown", keyDown);
            connectedHost.removeEventListener("pointerenter", hostEnter);
            connectedHost.removeEventListener("pointerleave", hostLeave);
            for (const cleanup of trackCleanups.values()) cleanup();
            trackCleanups.clear();
            hoveredControllers.delete(hoverController);
            if (surfaceController === hoverController) surfaceController = null;
            surfaceUpdate();
            if (idleTimer !== undefined) window?.clearTimeout(idleTimer);
            if (clearTimer !== undefined) window?.clearTimeout(clearTimer);
            if (keyboardTimer !== undefined) window?.clearTimeout(keyboardTimer);
            connectedViewport.removeAttribute("data-scrollbar-viewport");
            for (const attribute of [
                "data-scrollbar-active",
                "data-scrollbar-dragging",
                "data-scrollbar-hover",
                "data-scrollbar-overflow-x",
                "data-scrollbar-overflow-y",
                "data-scrollbar-surface",
            ])
                connectedHost.removeAttribute(attribute);
        };
    };

    const trackCleanups = new Map<ScrollbarAxis, () => void>();
    return {
        hostSet(element) {
            host = element;
            connect();
        },
        thumbSet(axis, element) {
            elements[axis].thumb = element;
            connect();
        },
        trackSet(axis, element) {
            elements[axis].track = element;
            connect();
        },
        viewportSet(element) {
            viewport = element;
            connect();
        },
    };
}

/** Keeps one imperative controller per axis contract. */
export function useScrollbarController(axes: ScrollbarAxes): ScrollbarController {
    // The controller owns listeners for exactly these axes. Changing the axis
    // contract is therefore a real lifetime boundary, not render memoization.
    return useMemo(() => scrollbarControllerCreate(axes), [axes]);
}

export function ScrollbarTrack(props: { axis: ScrollbarAxis; controller: ScrollbarController }) {
    const trackRef = useCallback(
        (element: HTMLDivElement | null) => props.controller.trackSet(props.axis, element),
        [props.axis, props.controller],
    );
    const thumbRef = useCallback(
        (element: HTMLDivElement | null) => props.controller.thumbSet(props.axis, element),
        [props.axis, props.controller],
    );
    return (
        <div
            aria-hidden="true"
            className="kissopen-scrollbar__track"
            data-axis={props.axis}
            data-scrollbar-track=""
            ref={trackRef}
        >
            <div className="kissopen-scrollbar__thumb" ref={thumbRef} />
        </div>
    );
}

export function ScrollbarTracks(props: { axes?: ScrollbarAxes; controller: ScrollbarController }) {
    return axesFrom(props.axes ?? "vertical").map((axis) => (
        <ScrollbarTrack axis={axis} controller={props.controller} key={axis} />
    ));
}

export type ScrollAreaProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    axes?: ScrollbarAxes;
    children: ReactNode;
    placement?: ScrollbarPlacement;
    viewportClassName?: string;
    viewportProps?: Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "style">;
    viewportRef?: Ref<HTMLDivElement>;
    viewportStyle?: CSSProperties;
};

/** A native scrollport with Kissopen's fixed custom-painted track and thumb. */
export function ScrollArea(props: ScrollAreaProps) {
    const {
        axes = "vertical",
        children,
        className,
        placement = "gutter",
        viewportClassName,
        viewportProps,
        viewportRef: externalViewportRef,
        viewportStyle,
        ...hostProps
    } = props;
    const controller = useScrollbarController(axes);
    const hostRef = useCallback(
        (element: HTMLDivElement | null) => controller.hostSet(element),
        [controller],
    );
    const viewportRef = useCallback(
        (element: HTMLDivElement | null) => {
            controller.viewportSet(element);
            refSet(externalViewportRef, element);
        },
        [controller, externalViewportRef],
    );
    return (
        <div
            {...hostProps}
            className={["kissopen-scroll-area", className].filter(Boolean).join(" ")}
            data-scrollbar-axes={axes}
            data-scrollbar-host=""
            data-scrollbar-placement={placement}
            ref={hostRef}
        >
            <div
                {...viewportProps}
                className={["kissopen-scroll-area__viewport", viewportClassName]
                    .filter(Boolean)
                    .join(" ")}
                ref={viewportRef}
                style={viewportStyle}
            >
                {children}
            </div>
            <ScrollbarTracks axes={axes} controller={controller} />
        </div>
    );
}
