/**
 * Where a tab can be carried to when it leaves the strip it is in.
 *
 * A strip and the regions its tabs can be dropped into are usually far apart in
 * the tree — one is the side panel's header, the other is the main content —
 * and the drag itself lives for a few hundred milliseconds inside one pointer
 * capture. Rather than lifting that into product state or a context every
 * surface has to thread, a drop zone marks itself in the DOM and the drag finds
 * it there: the strip arms the zones it can reach, marks the one under the
 * pointer, and clears both when the pointer lifts. Nothing re-renders, so a
 * drag cannot disturb the focus, selection, or scroll of what it is dragged
 * over.
 */
export interface TabTransferTarget {
    /** The `TransferZone` this target names. */
    readonly zone: string;
    /** How the destination is spoken of: "the main content", "the side panel". */
    readonly label: string;
    /**
     * Which side of the window the destination is on. It is what makes a
     * keyboard move directional — the arrow that points at the destination is
     * the one that sends a tab there.
     */
    readonly side: "leading" | "trailing";
}

/** Marks an element as a region tabs may be dropped into, by zone id. */
export const TRANSFER_ZONE_ATTRIBUTE = "data-kissopen-transfer-zone";

/**
 * How a zone is being addressed right now, written straight onto the element by
 * a drag in flight.
 *
 * It is deliberately not the `data-transfer-state` attribute the `state` prop
 * renders: React holds a virtual copy of everything it renders, so an
 * imperative write to an attribute React also sets is invisible to it and is
 * never repaired. Two attributes leave each writer alone with what it owns, and
 * the stylesheet answers to either.
 */
export const TRANSFER_DRAG_ATTRIBUTE = "data-transfer-drag";

export type TransferZoneState = "armed" | "over";

function zoneElements(): HTMLElement[] {
    if (typeof document === "undefined") return [];
    return [...document.querySelectorAll<HTMLElement>(`[${TRANSFER_ZONE_ATTRIBUTE}]`)];
}

/**
 * Lights up every zone a tab could be dropped into, so the reader can see where
 * the drag is allowed to end before they have taken it anywhere.
 */
export function transferZonesArm(zones: readonly string[]): void {
    const wanted = new Set(zones);
    for (const element of zoneElements()) {
        const id = element.getAttribute(TRANSFER_ZONE_ATTRIBUTE);
        if (id !== null && wanted.has(id)) element.setAttribute(TRANSFER_DRAG_ATTRIBUTE, "armed");
        else element.removeAttribute(TRANSFER_DRAG_ATTRIBUTE);
    }
}

/**
 * The zone under the pointer, marked as the one a release would drop into.
 * Answers undefined over anything else, which is what makes dropping outside a
 * cancellation rather than a mistake.
 */
export function transferZoneAt(x: number, y: number, zones: readonly string[]): string | undefined {
    if (typeof document === "undefined") return undefined;
    const wanted = new Set(zones);
    const under = document.elementFromPoint(x, y);
    const zone = under?.closest(`[${TRANSFER_ZONE_ATTRIBUTE}]`);
    const id = zone?.getAttribute(TRANSFER_ZONE_ATTRIBUTE) ?? undefined;
    const hit = id !== undefined && wanted.has(id) ? id : undefined;
    for (const element of zoneElements()) {
        const candidate = element.getAttribute(TRANSFER_ZONE_ATTRIBUTE);
        if (candidate === null || !wanted.has(candidate)) continue;
        element.setAttribute(TRANSFER_DRAG_ATTRIBUTE, candidate === hit ? "over" : "armed");
    }
    return hit;
}

/** Puts every zone back to rest, however the drag ended. */
export function transferZonesDisarm(): void {
    for (const element of zoneElements()) element.removeAttribute(TRANSFER_DRAG_ATTRIBUTE);
}

/**
 * The tab a move by keyboard or menu should leave the reader on.
 *
 * A transfer takes a tab out of one strip and puts it in another, and the two
 * strips are different components: the one losing the tab cannot focus it, and
 * the one gaining it does not know it has just arrived. So the mover writes the
 * id down here and every strip, once it has drawn, claims the tab if it is now
 * the one holding it. A pointer drag deliberately does not ask for this — the
 * reader's hand is already where they want it, and pulling focus onto the tab
 * could take it from something they were typing in.
 */
let wantedFocusId: string | undefined;

/** Asks for the moved tab to take focus wherever it has landed. */
export function transferFocusRequest(tabId: string): void {
    wantedFocusId = tabId;
}

/**
 * Claims a pending focus request for one of the tabs this strip now draws.
 * Answers the id to focus, and forgets it, so only the strip that ended up with
 * the tab acts on it and only once.
 */
export function transferFocusClaim(tabIds: readonly string[]): string | undefined {
    if (wantedFocusId === undefined || !tabIds.includes(wantedFocusId)) return undefined;
    const claimed = wantedFocusId;
    wantedFocusId = undefined;
    return claimed;
}
