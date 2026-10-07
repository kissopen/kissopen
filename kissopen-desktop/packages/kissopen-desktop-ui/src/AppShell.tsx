import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import {
    useCallback,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type HTMLAttributes,
    type ReactNode,
} from "react";
import { KeyCap } from "./Badge";
import { Icon } from "./Icon";
import { commandShortcut, commandShortcutMatches, windowShortcutBlocked } from "./keyboardShortcut";
import { WindowOverlayHostContext } from "./WindowOverlay";
export type AppShellProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
    children: ReactNode;
    /**
     * Fills a region owned by another AppShell instead of imposing the desktop
     * window's minimum size. This lets a product surface own its workspace and
     * inspector while the outer window keeps navigation chrome mounted.
     */
    embedded?: boolean;
    panel?: ReactNode;
    panelWidth?: number;
    /** Optional 64px feature rail. When omitted the content spans the full body. */
    rail?: ReactNode;
    sidebar?: ReactNode;
    style?: CSSProperties;
    titleBar?: ReactNode;
    /** Enables native macOS traffic-light spacing and draggable desktop header chrome. */
    windowControls?: boolean;
    /**
     * The native caption buttons sit at the window's trailing edge (Windows),
     * so the leading corner holds no lane for them and the sidebar heading
     * starts at the rows' own inset, as it does in macOS full screen.
     */
    windowControlsAtEnd?: boolean;
    /**
     * The window is in macOS full screen, where the traffic lights are gone. The
     * chrome inset closes with them — the sidebar toggle returns to the window's
     * left edge and the headings beside it follow — while the drag lanes stay put.
     * No CSS media query reports this, so the desktop shell supplies it.
     */
    windowFullScreen?: boolean;
    /**
     * A connection rail stands between the window's left edge and this shell,
     * holding the traffic lights' lane itself. The chrome inset closes exactly
     * as in full screen, but the window is still a window: with the lights
     * beside it rather than gone, an empty sidebar heading folds away and the
     * toggle shares the first row's line.
     */
    connectionRail?: boolean;
    /**
     * Enables the left sidebar show/hide toggle and pointer/keyboard resize. When
     * omitted the sidebar keeps its 250–360px, 30%-of-shell width contract and
     * renders no interaction chrome, so existing callers are unaffected.
     */
    sidebarCollapsible?: boolean;
    /** Initial sidebar width (clamped) once `sidebarCollapsible` is set. */
    sidebarDefaultWidth?: number;
    sidebarMinWidth?: number;
    sidebarMaxWidth?: number;
    /** Start collapsed. The sidebar DOM stays mounted; only its box is hidden. */
    sidebarDefaultCollapsed?: boolean;
    /**
     * Controlled collapse: the caller owns whether the sidebar is folded away
     * and hears every request to change it — the toggle, the reveal control,
     * and Command-B all go through `onSidebarCollapsedChange`. Omit it and
     * AppShell keeps the fold itself, seeded by `sidebarDefaultCollapsed`.
     */
    sidebarCollapsed?: boolean;
    onSidebarCollapsedChange?: (collapsed: boolean) => void;
    sidebarCollapseLabel?: string;
    sidebarExpandLabel?: string;
    sidebarResizeLabel?: string;
    /**
     * Renders Command-key discovery for this window. `interactive` holds
     * Command for 500ms to reveal descendant hints and binds Command-B;
     * `display` renders the same caps for a deterministic fixture whose
     * ancestor supplies `data-shortcut-hints`.
     */
    shortcutHints?: "display" | "interactive";
    /**
     * A card shown in the middle of the window for as long as Command is held —
     * what the reader could do next, on the same gesture that reveals the caps.
     * It rides the existing hold: the same 500ms, the same boolean, the same
     * exits, and no listener or timer of its own.
     *
     * The layer is pointer-transparent and decorative. Anything modal here —
     * `role="dialog"`, `role="menu"`, a ModalOverlay — would read as a modal to
     * `windowShortcutBlocked()` and switch off the held-Command detection that
     * put it on screen. Pass `QuickActionsCard`, not a Modal.
     */
    shortcutHintsSurface?: ReactNode;
    /**
     * Enables pointer/keyboard resize of the right inspector panel. When omitted the
     * panel keeps its existing `panelWidth`/clamp contract and renders no handle.
     */
    panelResizable?: boolean;
    /** Initial panel width (clamped) once `panelResizable` is set; falls back to `panelWidth`. */
    panelDefaultWidth?: number;
    /**
     * Reports the settled width after a pointer drag or keyboard resize step.
     *
     * Supplying `panelWidth` alongside `panelResizable` hands the width to the
     * caller: the shell stops tracking it and only reports intent here. That is
     * what lets a
     * host keep a width per checkout, because a width the shell owned could only
     * ever be seeded once and would then follow the reader from project to
     * project. Without `panelWidth` the shell keeps owning it and this is simply
     * a notification.
     */
    onPanelWidthChange?: (width: number) => void;
    panelMinWidth?: number;
    panelMaxWidth?: number;
    /**
     * Optional content pinned to the bottom of the panel column, below the panel
     * body. Used to keep a composer/input usable while the panel body (e.g. a live
     * trace) fills the column. Rendering it does not affect the panel body's
     * identity, so the body stays mounted as the footer mounts/unmounts.
     */
    panelFooter?: ReactNode;
    /**
     * Lifts `panelFooter` out of the panel column's flow and floats it over the
     * bottom of the panel body. The body then keeps its full height as the footer
     * appears and disappears, so a scrolled position, a terminal's last lines, and
     * any measurement underneath survive it. The footer content owns its own
     * gradient and pointer-transparent regions.
     */
    panelFooterFloating?: boolean;
    panelResizeLabel?: string;
    /** Reports pointer or DOM-focus ownership for this exact shell instance. */
    onFocusedPaneChange?: (pane: AppShellFocusedPane) => void;
};
export type AppShellFocusedPane = "workspace" | "panel";
const SIDEBAR_DEFAULT_WIDTH = 288;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 480;
const PANEL_DEFAULT_WIDTH = 340;
/**
 * The panel's width where nobody has chosen one. Exported so a host that
 * remembers the width per checkout can offer this for a checkout that has never
 * been sized, instead of restating the number and drifting from it.
 */
export const APP_SHELL_PANEL_DEFAULT_WIDTH = PANEL_DEFAULT_WIDTH;
const PANEL_MIN_WIDTH = 280;
/**
 * How much of the window the panel may take, and the cap where the window's
 * width cannot be read.
 *
 * The panel holds a terminal, a file, and a composer, so on a wide display it
 * is often the side being worked in — a fixed few hundred pixels made that
 * impossible. A fraction rather than a number keeps the workspace column a real
 * column at every size: the remaining 30% is what stops a panel dragged to the
 * end from swallowing the transcript beside it.
 *
 * The shell's ResizeObserver supplies the width, including when a parent
 * sidebar changes the available space without resizing the window.
 */
const PANEL_MAX_FRACTION = 0.7;
const PANEL_MAX_WIDTH = 560;
function panelShareOf(viewport: number): number {
    if (!(viewport > 0)) return PANEL_MAX_WIDTH;
    return Math.max(PANEL_MIN_WIDTH, Math.round(viewport * PANEL_MAX_FRACTION));
}
const FIXED_SIDEBAR_MIN_WIDTH = 250;
const REVEAL_WIDTH = 48;
const RAIL_WIDTH = 64;
/**
 * A phone-sized reading column remains usable beside an expanded inspector.
 * Keep in sync with app-shell.css; narrower windows overlay the inspector.
 */
const WORKSPACE_MIN_WIDTH = 375;
/**
 * How wide one side lane may grow: never past the room left once the rail, the
 * lane opposite, and the workspace's own floor have taken theirs.
 *
 * Without this bound a lane's cap answered only to the window — the panel's was
 * a share of the viewport — and two lanes could each be within their own cap
 * while together asking for more than the window had. Flex then took the
 * difference out of whichever region would yield, and since the content region
 * clips, the far lane was simply cut off by the window edge instead of the
 * middle refusing to shrink. A lane cannot be sized against the window alone;
 * it has to be sized against what is left of it.
 */
function laneMaxWidthOf(cap: number, min: number, occupied: number, viewport: number): number {
    if (!(viewport > 0)) return cap;
    return Math.max(min, Math.min(cap, viewport - occupied - WORKSPACE_MIN_WIDTH));
}
const SHORTCUT_HINT_DELAY_MS = 500;
const SIDEBAR_SHORTCUT = commandShortcut("b");
export const APP_SHELL_RESIZE_LAYOUT_EVENT = "kissopen-app-shell-resize-layout";
function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
/**
 * A vertical drag divider. It is the ARIA `separator` that owns the adjacent
 * region's width: pointer drags use pointer capture (no window listeners), and
 * Arrow/Home/End keys nudge the boundary. `edge` names which side of the region
 * the handle sits on, so the same math grows the sidebar (handle on its right)
 * and the panel (handle on its left). All resize state is local UI state; the
 * caller receives only clamped width values through `onResize`.
 */
function ResizeHandle(props: {
    edge: "left" | "right";
    label: string;
    max: number;
    min: number;
    onResize: (next: number) => void;
    onResizeEnd?: (next: number) => void;
    step?: number;
    value: number;
}) {
    const drag = useRef<{ latestWidth: number; pointerX: number; width: number } | null>(null);
    const sign = props.edge === "right" ? 1 : -1;
    const step = props.step ?? 16;
    function nextWidth(width: number) {
        return clamp(Math.round(width), props.min, props.max);
    }
    function apply(width: number, settled: boolean) {
        const next = nextWidth(width);
        props.onResize(next);
        if (settled) props.onResizeEnd?.(next);
    }
    function finishDrag() {
        const current = drag.current;
        if (!current) return;
        drag.current = null;
        props.onResizeEnd?.(current.latestWidth);
    }
    return (
        <div
            aria-label={props.label}
            aria-orientation="vertical"
            aria-valuemax={props.max}
            aria-valuemin={props.min}
            aria-valuenow={Math.round(props.value)}
            className="kissopen-desktop-app-shell__resize-handle"
            data-edge={props.edge}
            data-kissopen-desktop-ui="app-shell-resize-handle"
            onKeyDown={(event) => {
                const keyDelta =
                    event.key === "ArrowRight"
                        ? step
                        : event.key === "ArrowLeft"
                          ? -step
                          : undefined;
                if (keyDelta !== undefined) {
                    event.preventDefault();
                    apply(props.value + sign * keyDelta, true);
                } else if (event.key === "Home") {
                    event.preventDefault();
                    apply(props.edge === "right" ? props.min : props.max, true);
                } else if (event.key === "End") {
                    event.preventDefault();
                    apply(props.edge === "right" ? props.max : props.min, true);
                }
            }}
            onLostPointerCapture={() => {
                finishDrag();
            }}
            onPointerCancel={() => {
                finishDrag();
            }}
            onPointerDown={(event) => {
                event.preventDefault();
                drag.current = {
                    latestWidth: props.value,
                    pointerX: event.clientX,
                    width: props.value,
                };
                try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                } catch {
                    // Synthetic or already-released pointers cannot be captured; the
                    // move handler still works when events target this element.
                }
            }}
            onPointerMove={(event) => {
                const start = drag.current;
                if (!start) return;
                const next = nextWidth(start.width + sign * (event.clientX - start.pointerX));
                start.latestWidth = next;
                props.onResize(next);
            }}
            onPointerUp={(event) => {
                finishDrag();
                try {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                } catch {
                    // Capture may already be lost; clearing drag state above is enough.
                }
            }}
            role="separator"
            // A focusable window splitter is an intentionally interactive separator
            // (WAI-ARIA window-splitter pattern): it must take keyboard focus so the
            // Arrow/Home/End resize keys above are reachable without a pointer.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable resize separator
            tabIndex={0}
        >
            <span
                className="kissopen-desktop-app-shell__resize-line"
                data-kissopen-desktop-ui="app-shell-resize-line"
            />
        </div>
    );
}
/*
 * Window composition for the KISSOPEN desktop app. An optional title bar row,
 * then rail | navigation | workspace and an optional right inspector. Every
 * region meets on a hairline so the desktop feels like one native surface.
 *
 * The sidebar collapse/resize and the panel resize are narrowly scoped local UI
 * interactions owned here so application code stays props-only. Every region
 * stays mounted across them so focus, scroll, and any in-flight content survive.
 */
export function AppShell(props: AppShellProps) {
    const shell = useRef<HTMLDivElement>(null);
    const [shellWidth, setShellWidth] = useState(0);
    // Measure this shell, not the window: cloud workspaces can be nested inside
    // the navigation shell. Resizing never replaces the mounted content tree.
    const shellMount = useCallback((node: HTMLDivElement | null) => {
        shell.current = node;
        if (node === null) return undefined;
        const measure = () => setShellWidth(node.clientWidth);
        measure();
        // Nested shells can resize one another. Commit on the next frame so
        // React's geometry update cannot re-enter the observer delivery loop.
        let frame = 0;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        });
        observer.observe(node);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            shell.current = null;
        };
    }, []);
    const [panelNode, setPanelNode] = useState<HTMLElement | null>(null);
    const [focusedPaneOwner, setFocusedPaneOwner] = useState<HTMLElement | null>(null);
    // The overlay lane below, held as state rather than in a ref because the
    // surfaces that portal into it render from this shell's own subtree and
    // must be told once the node they hang from exists.
    const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
    // A surface that covers the window belongs to the window. An embedded shell
    // owns only a workspace inside another one, so it hands the lane it was
    // given straight on rather than opening one of its own.
    const outerOverlayHost = useContext(WindowOverlayHostContext);
    const [local, rest] = partitionComponentProps(props, [
        "children",
        "className",
        "embedded",
        "panel",
        "panelWidth",
        "rail",
        "sidebar",
        "style",
        "titleBar",
        "windowControls",
        "windowControlsAtEnd",
        "windowFullScreen",
        "connectionRail",
        "sidebarCollapsible",
        "sidebarDefaultWidth",
        "sidebarMinWidth",
        "sidebarMaxWidth",
        "sidebarDefaultCollapsed",
        "sidebarCollapsed",
        "onSidebarCollapsedChange",
        "sidebarCollapseLabel",
        "sidebarExpandLabel",
        "sidebarResizeLabel",
        "shortcutHints",
        "shortcutHintsSurface",
        "panelResizable",
        "onPanelWidthChange",
        "panelDefaultWidth",
        "panelMinWidth",
        "panelMaxWidth",
        "panelFooter",
        "panelFooterFloating",
        "panelResizeLabel",
        "onFocusedPaneChange",
    ]);
    const onFocusedPaneChange = local.onFocusedPaneChange;
    // Ref identity is a measured lifetime contract: a changed callback ref is
    // cleared on every render, while this reset must mean the panel itself left.
    const panelRef = useCallback(
        (node: HTMLElement | null): void => {
            setPanelNode(node);
            if (node === null) onFocusedPaneChange?.("workspace");
        },
        [onFocusedPaneChange],
    );
    const sidebarMin = local.sidebarMinWidth ?? SIDEBAR_MIN_WIDTH;
    const panelMin = local.panelMinWidth ?? PANEL_MIN_WIDTH;
    // The caps a lane answers to on its own. What is actually left for it is
    // worked out below, once the lane opposite has a width to be measured by.
    const sidebarCap = local.sidebarMaxWidth ?? SIDEBAR_MAX_WIDTH;
    const availableWidth = shellWidth || (typeof window === "undefined" ? 0 : window.innerWidth);
    const panelCap = local.panelMaxWidth ?? panelShareOf(availableWidth);
    const [sidebarCollapsedLocal, setSidebarCollapsedLocal] = useState(
        local.sidebarDefaultCollapsed ?? false,
    );
    const sidebarCollapsedControlled = local.sidebarCollapsed !== undefined;
    const sidebarCollapsed = local.sidebarCollapsed ?? sidebarCollapsedLocal;
    const onSidebarCollapsedChange = local.onSidebarCollapsedChange;
    const setSidebarCollapsed = (collapsed: boolean) => {
        if (!sidebarCollapsedControlled) setSidebarCollapsedLocal(collapsed);
        onSidebarCollapsedChange?.(collapsed);
    };
    const [sidebarWidth, setSidebarWidth] = useState(() =>
        clamp(local.sidebarDefaultWidth ?? SIDEBAR_DEFAULT_WIDTH, sidebarMin, sidebarCap),
    );
    const [panelWidthState, setPanelWidthState] = useState(() =>
        clamp(
            local.panelDefaultWidth ?? local.panelWidth ?? PANEL_DEFAULT_WIDTH,
            panelMin,
            panelCap,
        ),
    );
    const [panelDragWidth, setPanelDragWidth] = useState<number>();
    /*
     * What each lane may grow to, given the other. A lane's own cap is only half
     * the answer: the two share one window with the rail and the workspace, so
     * each is measured against the room the rest of them leave.
     *
     * A caller who named a maximum meant it and keeps it. A collapsed sidebar
     * occupies its reveal lane rather than its width, and an absent lane
     * occupies nothing, so folding one away really does hand its room to the
     * other instead of merely appearing to.
     */
    const railFootprint = local.rail ? RAIL_WIDTH : 0;
    const sidebarOccupied = !local.sidebar
        ? 0
        : local.sidebarCollapsible === true && sidebarCollapsed
          ? local.windowControls
              ? 0
              : REVEAL_WIDTH
          : local.sidebarCollapsible
            ? Math.min(
                  sidebarWidth,
                  laneMaxWidthOf(sidebarCap, sidebarMin, railFootprint, availableWidth),
              )
            : Math.min(360, Math.max(FIXED_SIDEBAR_MIN_WIDTH, availableWidth * 0.3));
    const panelPresent = local.panel !== undefined && local.panel !== null;
    const panelOverlay =
        panelPresent &&
        availableWidth > 0 &&
        availableWidth - railFootprint - sidebarOccupied < WORKSPACE_MIN_WIDTH + panelMin;
    const panelOccupied = !panelPresent || panelOverlay ? 0 : panelMin;
    const sidebarMax = laneMaxWidthOf(
        sidebarCap,
        sidebarMin,
        railFootprint + panelOccupied,
        availableWidth,
    );
    const panelMax = panelOverlay
        ? Math.max(panelMin, Math.min(panelCap, availableWidth - railFootprint - sidebarOccupied))
        : laneMaxWidthOf(panelCap, panelMin, railFootprint + sidebarOccupied, availableWidth);
    const [shortcutHintsHeld, setShortcutHintsHeld] = useState(false);
    const sidebarInteractive = local.sidebarCollapsible === true;
    const shortcutHintsEnabled = local.shortcutHints !== undefined;
    const shortcutHintsInteractive = local.shortcutHints === "interactive";
    const shortcutHintsVisible = shortcutHintsInteractive && shortcutHintsHeld;
    // eslint-disable-next-line kissopen-react/no-layout-effect -- modifier discovery and a window-wide sidebar chord must work regardless of which descendant control owns focus
    useLayoutEffect(() => {
        if (!shortcutHintsInteractive) return;
        let shortcutTimer: number | undefined;
        const pressedCommandKeys = new Set<string>();
        const timerClear = () => {
            if (shortcutTimer !== undefined) window.clearTimeout(shortcutTimer);
            shortcutTimer = undefined;
        };
        const hintsHide = () => {
            timerClear();
            pressedCommandKeys.clear();
            setShortcutHintsHeld(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Meta") {
                if (
                    windowShortcutBlocked() ||
                    event.defaultPrevented ||
                    event.isComposing ||
                    event.keyCode === 229 ||
                    event.altKey ||
                    event.ctrlKey ||
                    event.shiftKey
                )
                    return;
                const code = event.code || "Meta";
                if (pressedCommandKeys.has(code)) return;
                pressedCommandKeys.add(code);
                if (shortcutTimer !== undefined) return;
                shortcutTimer = window.setTimeout(() => {
                    shortcutTimer = undefined;
                    if (pressedCommandKeys.size > 0 && !windowShortcutBlocked())
                        setShortcutHintsHeld(true);
                }, SHORTCUT_HINT_DELAY_MS);
                return;
            }
            // Once a Command chord is chosen, discovery has done its job. Hide
            // immediately and cancel a nearly-finished timer so hints cannot
            // flash up just after the action runs.
            if (event.metaKey) hintsHide();
            if (
                !sidebarInteractive ||
                !commandShortcutMatches(event, SIDEBAR_SHORTCUT) ||
                windowShortcutBlocked()
            )
                return;
            event.preventDefault();
            if (!sidebarCollapsedControlled) setSidebarCollapsedLocal(!sidebarCollapsed);
            onSidebarCollapsedChange?.(!sidebarCollapsed);
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key !== "Meta") return;
            pressedCommandKeys.delete(event.code || "Meta");
            if (pressedCommandKeys.size === 0) hintsHide();
        };
        const onVisibilityChange = () => {
            if (document.visibilityState !== "visible") hintsHide();
        };
        const onPointerDown = () => {
            if (pressedCommandKeys.size > 0) hintsHide();
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", hintsHide);
        window.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            timerClear();
            pressedCommandKeys.clear();
            setShortcutHintsHeld(false);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", hintsHide);
            window.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [
        onSidebarCollapsedChange,
        shortcutHintsInteractive,
        sidebarCollapsed,
        sidebarCollapsedControlled,
        sidebarInteractive,
    ]);
    const panelResizable = local.panelResizable === true;
    // Controlled when a resizable panel is given a width; otherwise AppShell owns it.
    const panelWidthControlled = panelResizable && local.panelWidth !== undefined;
    const panelWidthBase = panelWidthControlled
        ? clamp(local.panelWidth!, panelMin, panelMax)
        : panelWidthState;
    const panelWidth = clamp(
        panelWidthControlled ? (panelDragWidth ?? panelWidthBase) : panelWidthState,
        panelMin,
        panelMax,
    );
    const focusedPane: AppShellFocusedPane =
        panelPresent && panelNode !== null && focusedPaneOwner === panelNode
            ? "panel"
            : "workspace";
    const paneFocusRead = (current: HTMLElement, target: EventTarget | null): void => {
        if (!(target instanceof Element)) return;
        // Resizing the boundary changes geometry, not keyboard ownership.
        if (target.closest('[data-kissopen-desktop-ui="app-shell-resize-handle"]')) return;
        const pane = target.closest<HTMLElement>("[data-app-shell-pane]");
        if (pane?.closest('[data-kissopen-desktop-ui="app-shell"]') !== current) return;
        if (pane.dataset.appShellPane === "panel") {
            setFocusedPaneOwner(pane);
            onFocusedPaneChange?.("panel");
        } else if (pane.dataset.appShellPane === "workspace") {
            setFocusedPaneOwner(null);
            onFocusedPaneChange?.("workspace");
        }
    };
    // eslint-disable-next-line kissopen-react/no-layout-effect -- live splitter geometry commits before paint; descendants use this scoped event to keep their own visual anchors in the same frame
    useLayoutEffect(() => {
        shell.current?.dispatchEvent(new Event(APP_SHELL_RESIZE_LAYOUT_EVENT, { bubbles: true }));
    }, [panelPresent, panelWidth, panelOverlay, shellWidth, sidebarCollapsed, sidebarWidth]);
    function previewPanelWidth(next: number) {
        if (panelWidthControlled) setPanelDragWidth(next);
        else setPanelWidthState(next);
    }
    function settlePanelWidth(next: number) {
        local.onPanelWidthChange?.(next);
        setPanelDragWidth(undefined);
    }
    const showSidebarHandle = sidebarInteractive && !sidebarCollapsed;
    const sidebarStyle: CSSProperties | undefined = sidebarInteractive
        ? {
              width: `${sidebarWidth}px`,
              minWidth: `${sidebarMin}px`,
              maxWidth: `${sidebarMax}px`,
          }
        : local.sidebar
          ? { width: `${sidebarOccupied}px` }
          : undefined;
    const panelStyle: CSSProperties | undefined = panelResizable
        ? {
              width: `${panelWidth}px`,
              minWidth: `${panelMin}px`,
              maxWidth: `${panelMax}px`,
          }
        : {
              ...(local.panelWidth === undefined ? {} : { width: `${local.panelWidth}px` }),
              maxWidth: `${panelMax}px`,
          };
    const sidebarHidden = sidebarInteractive && sidebarCollapsed;
    // Under native window controls a collapsed sidebar leaves no lane behind: the
    // reveal control floats beside the traffic lights, exactly where the collapse
    // control sat, and the workspace takes the whole width.
    const revealFloating = sidebarHidden && local.windowControls === true;
    const sidebarLayoutMin = !local.sidebar
        ? 0
        : revealFloating
          ? 0
          : sidebarHidden
            ? REVEAL_WIDTH
            : sidebarInteractive
              ? sidebarMin
              : FIXED_SIDEBAR_MIN_WIDTH;
    const revealButton = sidebarHidden ? (
        <button
            aria-label={local.sidebarExpandLabel ?? t("Show sidebar")}
            aria-keyshortcuts={shortcutHintsInteractive ? SIDEBAR_SHORTCUT.aria : undefined}
            className="kissopen-desktop-app-shell__reveal-button"
            data-floating={revealFloating ? "" : undefined}
            data-kissopen-desktop-ui="app-shell-reveal-button"
            data-shortcut-hint={shortcutHintsEnabled ? "" : undefined}
            onClick={() => setSidebarCollapsed(false)}
            type="button"
        >
            {/* 16, not the 14 of a bare affordance: this glyph answers the
                sidebar's own 16px row icons across the divider, and an outline
                fills only 14 of its 16 box, so a 14 box would set 12.25px of
                ink beside 14px of ink. */}
            <Icon name="sidebar-expand" size={16} />
            {shortcutHintsEnabled ? (
                <KeyCap
                    className="kissopen-shortcut-hint--floating"
                    decorative
                    keys={SIDEBAR_SHORTCUT.caps}
                />
            ) : null}
        </button>
    ) : null;
    // Floating, the control is the bare button rather than a lane wrapping it:
    // a wrapper around a control docked over native window chrome is what stops
    // the pointer reaching it, so the collapsed toggle is structurally the same
    // element as the expanded one and only its position differs.
    const reveal = revealFloating ? (
        revealButton
    ) : sidebarHidden ? (
        <div
            className="kissopen-desktop-app-shell__reveal"
            data-kissopen-desktop-ui="app-shell-reveal"
            data-window-controls={local.windowControls ? "" : undefined}
        >
            {revealButton}
        </div>
    ) : null;
    const mainStyle: CSSProperties = {
        minWidth: `${sidebarLayoutMin + WORKSPACE_MIN_WIDTH}px`,
    };
    return (
        <WindowOverlayHostContext.Provider value={local.embedded ? outerOverlayHost : overlayHost}>
            <div
                {...rest}
                className={["kissopen-desktop-app-shell", local.className]
                    .filter(Boolean)
                    .join(" ")}
                data-embedded={local.embedded ? "" : undefined}
                data-panel-overlay={panelOverlay ? "" : undefined}
                data-focused-pane={focusedPane}
                data-kissopen-desktop-ui="app-shell"
                data-shortcut-hints={shortcutHintsVisible ? "" : undefined}
                data-sidebar-collapsed={sidebarHidden ? "" : undefined}
                data-window-controls={local.windowControls ? "" : undefined}
                data-window-controls-end={
                    local.windowControls && local.windowControlsAtEnd ? "" : undefined
                }
                data-window-full-screen={local.windowFullScreen ? "" : undefined}
                data-connection-rail={local.connectionRail ? "" : undefined}
                onFocusCapture={(event) => {
                    rest.onFocusCapture?.(event);
                    paneFocusRead(event.currentTarget, event.target);
                }}
                onPointerDownCapture={(event) => {
                    rest.onPointerDownCapture?.(event);
                    paneFocusRead(event.currentTarget, event.target);
                }}
                ref={shellMount}
                style={local.style}
            >
                {local.windowControls ? (
                    <div
                        aria-hidden="true"
                        className="kissopen-desktop-app-shell__window-controls"
                        data-kissopen-desktop-ui="app-shell-window-controls"
                    >
                        <span
                            className="kissopen-desktop-app-shell__traffic-light-reservation"
                            data-kissopen-desktop-ui="title-bar-controls"
                        />
                    </div>
                ) : null}
                {local.windowControls && !local.sidebar && !local.titleBar ? (
                    <div
                        aria-hidden="true"
                        className="kissopen-desktop-app-shell__standalone-title-bar"
                        data-kissopen-desktop-ui="app-shell-standalone-title-bar"
                    />
                ) : null}
                {local.titleBar ? (
                    <div
                        className="kissopen-desktop-app-shell__title-bar"
                        data-kissopen-desktop-ui="app-shell-title-bar"
                    >
                        {local.titleBar}
                    </div>
                ) : null}
                <div
                    className="kissopen-desktop-app-shell__body"
                    data-kissopen-desktop-ui="app-shell-body"
                >
                    {local.rail ? (
                        <div
                            className="kissopen-desktop-app-shell__rail"
                            data-kissopen-desktop-ui="app-shell-rail"
                        >
                            {local.rail}
                        </div>
                    ) : null}
                    <div
                        className="kissopen-desktop-app-shell__content"
                        data-kissopen-desktop-ui="app-shell-content"
                    >
                        <main
                            className="kissopen-desktop-app-shell__main"
                            data-kissopen-desktop-ui="app-shell-main"
                            style={mainStyle}
                        >
                            {revealFloating ? null : reveal}
                            {local.sidebar ? (
                                <div
                                    className="kissopen-desktop-app-shell__sidebar"
                                    data-collapsed={
                                        sidebarInteractive && sidebarCollapsed ? "" : undefined
                                    }
                                    data-kissopen-desktop-ui="app-shell-sidebar"
                                    data-resizable={sidebarInteractive ? "" : undefined}
                                    style={sidebarStyle}
                                >
                                    {local.sidebar}
                                    {sidebarInteractive ? (
                                        <button
                                            aria-label={
                                                local.sidebarCollapseLabel ?? t("Hide sidebar")
                                            }
                                            aria-keyshortcuts={
                                                shortcutHintsInteractive
                                                    ? SIDEBAR_SHORTCUT.aria
                                                    : undefined
                                            }
                                            className="kissopen-desktop-app-shell__sidebar-collapse"
                                            data-kissopen-desktop-ui="app-shell-sidebar-collapse"
                                            data-shortcut-hint={
                                                shortcutHintsEnabled ? "" : undefined
                                            }
                                            onClick={() => setSidebarCollapsed(true)}
                                            type="button"
                                        >
                                            {/* Matches the reveal control above; see
                                            the note there for why 16. */}
                                            <Icon name="sidebar-collapse" size={16} />
                                            {shortcutHintsEnabled ? (
                                                <KeyCap
                                                    className="kissopen-shortcut-hint--floating"
                                                    decorative
                                                    keys={SIDEBAR_SHORTCUT.caps}
                                                />
                                            ) : null}
                                        </button>
                                    ) : null}
                                    {showSidebarHandle ? (
                                        <ResizeHandle
                                            edge="right"
                                            label={local.sidebarResizeLabel ?? t("Resize sidebar")}
                                            max={sidebarMax}
                                            min={sidebarMin}
                                            onResize={setSidebarWidth}
                                            value={sidebarWidth}
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                            <div
                                className="kissopen-desktop-app-shell__workspace"
                                data-app-shell-pane="workspace"
                                data-kissopen-desktop-ui="app-shell-workspace"
                            >
                                {local.children}
                            </div>
                        </main>
                        {local.panel ? (
                            <aside
                                className="kissopen-desktop-app-shell__panel"
                                data-app-shell-pane="panel"
                                data-kissopen-desktop-ui="app-shell-panel"
                                data-resizable={panelResizable ? "" : undefined}
                                ref={panelRef}
                                style={panelStyle}
                            >
                                {panelResizable ? (
                                    <ResizeHandle
                                        edge="left"
                                        label={local.panelResizeLabel ?? t("Resize panel")}
                                        max={panelMax}
                                        min={panelMin}
                                        onResize={previewPanelWidth}
                                        onResizeEnd={settlePanelWidth}
                                        value={panelWidth}
                                    />
                                ) : null}
                                <div
                                    className="kissopen-desktop-app-shell__panel-content"
                                    data-kissopen-desktop-ui="app-shell-panel-content"
                                >
                                    {local.panel}
                                </div>
                                {local.panelFooter ? (
                                    <div
                                        className="kissopen-desktop-app-shell__panel-footer"
                                        data-floating={local.panelFooterFloating ? "" : undefined}
                                        data-kissopen-desktop-ui="app-shell-panel-footer"
                                    >
                                        {local.panelFooter}
                                    </div>
                                ) : null}
                            </aside>
                        ) : null}
                    </div>
                </div>
                {/* Last, after every drag surface in the body. Native draggable
                regions are collected in tree order and later rectangles win, so
                a control that punches a hole in one has to come after it — the
                same order the sidebar's own toggle already sits in. */}
                {revealFloating ? reveal : null}
                {/* The held-Command read-out. It hangs on the window rather than
                in the layout because it covers the window, and it is mounted
                only while the hold lasts — every way out of the gesture above
                (chord, keyup, blur, pointerdown, tab hidden) takes it away with
                it. It draws nothing and takes no room otherwise. */}
                {shortcutHintsVisible && local.shortcutHintsSurface ? (
                    <div
                        className="kissopen-desktop-app-shell__shortcut-hints"
                        data-kissopen-desktop-ui="app-shell-shortcut-hints"
                    >
                        <div
                            className="kissopen-desktop-app-shell__shortcut-hints-layout"
                            data-kissopen-desktop-ui="app-shell-shortcut-hints-layout"
                        >
                            {local.shortcutHintsSurface}
                        </div>
                    </div>
                ) : null}
                {/* The window's overlay lane. A modal-class surface written
                deep in the product hangs here instead, so its z-index is
                resolved against the window rather than against whatever
                positioned layer it happened to be opened from — see
                `WindowOverlay`. The node draws nothing and takes no room. */}
                {local.embedded ? null : (
                    <div
                        className="kissopen-desktop-app-shell__overlays"
                        data-kissopen-desktop-ui="app-shell-overlays"
                        ref={setOverlayHost}
                    />
                )}
            </div>
        </WindowOverlayHostContext.Provider>
    );
}
