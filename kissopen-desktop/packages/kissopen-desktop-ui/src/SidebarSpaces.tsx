import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import {
    useLayoutEffect,
    useRef,
    type CSSProperties,
    type HTMLAttributes,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
    type UIEvent as ReactUIEvent,
} from "react";
import { haptic } from "./haptics";
import { Icon, type IconName } from "./Icon";

/**
 * One space: a separate list of work the reader keeps apart from the others,
 * with its own mark in the switcher and its own body in the column.
 */
export type SidebarSpace = {
    /** The space's body, kept mounted while another space is showing. */
    content?: ReactNode;
    /**
     * A single emoji as the space's mark instead of a house glyph, for a space
     * whose mark the reader chose themselves. It is content rather than an icon,
     * so it is stated apart from `icon`, and a space carrying both shows the
     * emoji — the mark the reader picked outranks the fallback.
     */
    emoji?: string;
    /** The space's mark in the switcher. Defaults to a plain dot. */
    icon?: IconName;
    id: string;
    /** What the space is called, read by its control and by assistive software. */
    label: string;
};

/** Height of the switcher strip pinned under the spaces. */
export const SIDEBAR_SPACES_BAR_HEIGHT = 40;
/** Edge length of one space control in the switcher strip. */
export const SIDEBAR_SPACES_DOT_SIZE = 28;

export type SidebarSpacesProps = Omit<HTMLAttributes<HTMLDivElement>, "style" | "onSelect"> & {
    activeSpaceId: string;
    className?: string;
    /**
     * A control at the leading edge of the switcher strip, opposite the add
     * control, for an act that belongs to the column rather than to any one
     * space. The strip keeps the marks centred whether or not it is there.
     */
    leading?: ReactNode;
    /**
     * Makes a new space, from the trailing control in the strip. Without it the
     * set of spaces is fixed and no control is offered, rather than one wired to
     * nothing.
     */
    onSpaceCreate?: () => void;
    onSpaceSelect: (id: string) => void;
    spaces: readonly SidebarSpace[];
    style?: CSSProperties;
};

function SpaceMark(props: { space: SidebarSpace }) {
    if (props.space.emoji !== undefined)
        return (
            /* A fixed square the size of the glyph lane beside it, so a wide or
               tall emoji still occupies exactly one lane and the strip never
               shifts around it. */
            <span
                aria-hidden="true"
                className="kissopen-sidebar-spaces__emoji"
                data-kissopen-desktop-ui="sidebar-space-emoji"
            >
                {props.space.emoji}
            </span>
        );
    return <Icon name={props.space.icon ?? "dot"} size={16} />;
}

/**
 * C-261 SidebarSpaces — the spaces a navigation column is divided into, one
 * showing at a time, with the switcher strip pinned beneath them.
 *
 * The spaces sit side by side in a horizontal scrollport that snaps to one
 * space at a time, so a two-finger swipe is carried by the platform's own
 * scrolling rather than by anything reimplemented here. That is what makes it
 * feel native: the rubber-band at the ends, the momentum, the way a space
 * follows the fingers and then anchors, and the way a swipe can be caught
 * mid-flight all belong to the compositor, and none of them survive being
 * approximated with a transform driven from wheel deltas.
 *
 * Every space stays mounted while another is showing, so scroll position,
 * selection, focus, and any open panel inside a space survive being switched
 * away from and back.
 *
 * Which space is current still belongs to the caller. The scrollport reports
 * the space it has settled nearest as the gesture crosses into it, and the
 * caller says it back through `activeSpaceId`; pressing a mark scrolls the
 * scrollport to that space, so both routes end in the same place.
 */
export function SidebarSpaces(props: SidebarSpacesProps) {
    const [local, rest] = partitionComponentProps(props, [
        "activeSpaceId",
        "className",
        "leading",
        "onSpaceCreate",
        "onSpaceSelect",
        "spaces",
        "style",
    ]);
    const viewport = useRef<HTMLDivElement>(null);
    /*
     * The space a scroll of our own is travelling to, while it is travelling.
     *
     * Pressing a mark two spaces away scrolls across the space in between, and
     * that space is momentarily the nearest one. Reporting it would change the
     * current space mid-flight, and the effect below — seeing the scrollport
     * already holding the space it had just been asked for — would let the
     * journey end there. So a scroll we started reports nothing until it
     * arrives; a gesture, which sets nothing here, reports as it goes.
     */
    const settling = useRef<number | undefined>(undefined);
    const hasBodies = () => local.spaces.some((space) => space.content !== undefined);
    const select = (id: string) => {
        if (id === local.activeSpaceId) return;
        haptic("selection");
        local.onSpaceSelect(id);
    };
    /** The space a given scroll offset is nearest, which is the one it will snap to. */
    const nearest = (node: HTMLDivElement) =>
        node.clientWidth === 0 ? 0 : Math.round(node.scrollLeft / node.clientWidth);
    /*
     * Keeping the scrollport on the space the caller says is current. This is
     * the one genuinely imperative edge of the component: scroll offset lives in
     * the DOM rather than in the render tree, so an `activeSpaceId` that changed
     * for a reason other than the gesture — a mark pressed, a space opened from
     * elsewhere — can only be applied by scrolling.
     *
     * It is deliberately inert while the scrollport already holds that space,
     * which is exactly the case during a swipe: the gesture reports the space it
     * is crossing into and the prop comes back matching, so this never
     * interrupts the platform's own momentum with a scroll of its own.
     */
    const activeSpaceId = local.activeSpaceId;
    const spaceIds = local.spaces.map((space) => space.id).join("\u0000");
    // eslint-disable-next-line kissopen-react/no-layout-effect -- scroll offset is DOM state, so a controlled active space can only be applied imperatively; the guard above keeps it from interrupting a live gesture
    useLayoutEffect(() => {
        const node = viewport.current;
        if (node === null || node.clientWidth === 0) return;
        const found = spaceIds.split("\u0000").indexOf(activeSpaceId);
        const target = found < 0 ? 0 : found;
        if (Math.round(node.scrollLeft / node.clientWidth) === target) return;
        settling.current = target;
        node.scrollTo({
            behavior: node.scrollLeft === 0 && target === 0 ? "auto" : "smooth",
            left: target * node.clientWidth,
        });
    }, [activeSpaceId, spaceIds]);
    return (
        <div
            {...rest}
            className={["kissopen-sidebar-spaces", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="sidebar-spaces"
            style={local.style}
        >
            {hasBodies() ? (
                <div
                    className="kissopen-sidebar-spaces__viewport"
                    data-kissopen-desktop-ui="sidebar-spaces-viewport"
                    /* The space being crossed into is reported as it is crossed,
                       rather than once the scrolling stops, so the marks below
                       keep up with the fingers the way a native pager's do. */
                    onScroll={(event: ReactUIEvent<HTMLDivElement>) => {
                        const at = nearest(event.currentTarget);
                        if (settling.current !== undefined) {
                            if (settling.current !== at) return;
                            settling.current = undefined;
                            return;
                        }
                        const space = local.spaces[at];
                        if (space) select(space.id);
                    }}
                    ref={viewport}
                >
                    {local.spaces.map((space) => (
                        <div
                            className="kissopen-sidebar-spaces__pane"
                            data-active={space.id === local.activeSpaceId ? "" : undefined}
                            data-kissopen-desktop-ui="sidebar-spaces-pane"
                            data-space-id={space.id}
                            key={space.id}
                        >
                            {space.content}
                        </div>
                    ))}
                </div>
            ) : null}
            <div
                className="kissopen-sidebar-spaces__bar"
                data-kissopen-desktop-ui="sidebar-spaces-bar"
            >
                <div className="kissopen-sidebar-spaces__lane">{local.leading}</div>
                <div
                    aria-label={t("Spaces")}
                    className="kissopen-sidebar-spaces__dots"
                    data-kissopen-desktop-ui="sidebar-spaces-dots"
                    role="tablist"
                >
                    {local.spaces.map((space) => (
                        <button
                            aria-label={space.label}
                            aria-selected={space.id === local.activeSpaceId}
                            className="kissopen-sidebar-spaces__dot"
                            data-active={space.id === local.activeSpaceId ? "" : undefined}
                            data-kissopen-desktop-ui="sidebar-space-dot"
                            data-space-id={space.id}
                            key={space.id}
                            onClick={() => select(space.id)}
                            onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                                const step =
                                    event.key === "ArrowRight"
                                        ? 1
                                        : event.key === "ArrowLeft"
                                          ? -1
                                          : 0;
                                if (step === 0) return;
                                event.preventDefault();
                                const sibling =
                                    step === 1
                                        ? event.currentTarget.nextElementSibling
                                        : event.currentTarget.previousElementSibling;
                                if (!(sibling instanceof HTMLButtonElement)) return;
                                sibling.focus();
                                const id = sibling.dataset.spaceId;
                                if (id !== undefined) select(id);
                            }}
                            role="tab"
                            tabIndex={space.id === local.activeSpaceId ? 0 : -1}
                            type="button"
                        >
                            <SpaceMark space={space} />
                        </button>
                    ))}
                </div>
                <div className="kissopen-sidebar-spaces__lane kissopen-sidebar-spaces__lane--trailing">
                    {local.onSpaceCreate ? (
                        <button
                            aria-label={t("New space")}
                            className="kissopen-sidebar-spaces__add"
                            data-kissopen-desktop-ui="sidebar-spaces-add"
                            onClick={local.onSpaceCreate}
                            type="button"
                        >
                            <Icon name="plus" size={16} />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
