import type {
    TerminalCellSnapshot,
    TerminalGridSnapshot,
    TerminalRowSnapshot,
} from "kissopen-desktop-state";

const DEFAULT_FOREGROUND = "var(--text)";
const DEFAULT_BACKGROUND = "var(--surface)";

/*
 * WTerm keeps the terminal grid outside React and updates its DOM rows in place.
 * Terminal output can arrive many times per second and history can contain a
 * thousand rows, so rebuilding that transcript as React children on every frame
 * makes cursor updates needlessly reconcile the entire scrollback. This renderer
 * applies the same ownership model to Kissopen's normalized terminal snapshots:
 * retained history rows keep their nodes, while visible rows repaint only when
 * their cells actually changed.
 */
export class TerminalPanelRenderer {
    private history: TerminalRowEntry[] = [];
    private screen: TerminalRowEntry[] = [];

    constructor(private readonly container: HTMLElement) {}

    render(grid: TerminalGridSnapshot | undefined): void {
        if (!grid) {
            this.clear();
            return;
        }
        this.history = this.historyUpdate(grid.scrollback);
        this.screen = this.screenUpdate(grid.lines);
        this.rowsOrder([...this.history, ...this.screen]);
    }

    destroy(): void {
        this.clear();
    }

    private clear(): void {
        this.container.replaceChildren();
        this.history = [];
        this.screen = [];
    }

    /**
     * Scrollback snapshots preserve row references while output appends. Reuse
     * those exact row nodes, including when the bounded history drops rows from
     * its front, and create DOM only for genuinely new history.
     */
    private historyUpdate(rows: readonly TerminalRowSnapshot[]): TerminalRowEntry[] {
        const available = new Map<TerminalRowSnapshot, TerminalRowEntry[]>();
        for (const entry of this.history) {
            const entries = available.get(entry.row) ?? [];
            entries.push(entry);
            available.set(entry.row, entries);
        }
        const next = rows.map((row) => {
            const entries = available.get(row);
            const retained = entries?.shift();
            return retained ?? rowEntryCreate(row);
        });
        const retainedElements = new Set(next.map(({ element }) => element));
        for (const entry of this.history) {
            if (!retainedElements.has(entry.element)) entry.element.remove();
        }
        return next;
    }

    /** Visible screen rows keep their node by terminal row index. */
    private screenUpdate(rows: readonly TerminalRowSnapshot[]): TerminalRowEntry[] {
        const next = rows.map((row, index) => {
            const retained = this.screen[index];
            if (!retained) return rowEntryCreate(row);
            if (!rowEqual(retained.row, row)) rowElementRender(retained.element, row);
            return { element: retained.element, row };
        });
        for (const entry of this.screen.slice(rows.length)) entry.element.remove();
        return next;
    }

    /** Moves only nodes whose order actually changed, preserving selection. */
    private rowsOrder(rows: readonly TerminalRowEntry[]): void {
        let nextNode = this.container.firstChild;
        for (const { element } of rows) {
            if (element !== nextNode) this.container.insertBefore(element, nextNode);
            nextNode = element.nextSibling;
        }
    }
}

interface TerminalRowEntry {
    readonly element: HTMLDivElement;
    readonly row: TerminalRowSnapshot;
}

function rowEntryCreate(row: TerminalRowSnapshot): TerminalRowEntry {
    const element = document.createElement("div");
    element.className = "kissopen-terminal-panel__row";
    rowElementRender(element, row);
    return { element, row };
}

function rowElementRender(element: HTMLDivElement, row: TerminalRowSnapshot): void {
    const fragment = document.createDocumentFragment();
    let previousEnd = 0;
    for (const cell of row.cells) {
        const span = document.createElement("span");
        span.className = "kissopen-terminal-panel__cell";
        span.dataset.column = String(cell.x);
        span.dataset.width = String(cell.width);
        if (cell.inverse) span.dataset.inverse = "";
        if (cell.hyperlink) span.dataset.hyperlink = cell.hyperlink;
        span.textContent = cell.text || " ";
        const gap = Math.max(0, cell.x - previousEnd);
        previousEnd = cell.x + cell.width;
        if (gap > 0) span.style.marginLeft = `${gap}ch`;
        span.style.width = `${cell.width}ch`;
        const foreground = cell.inverse ? (cell.background ?? DEFAULT_BACKGROUND) : cell.foreground;
        const background = cell.inverse ? (cell.foreground ?? DEFAULT_FOREGROUND) : cell.background;
        if (foreground) span.style.color = foreground;
        if (background) span.style.background = background;
        if (cell.bold) span.style.fontWeight = "600";
        if (cell.italic) span.style.fontStyle = "italic";
        if (cell.dim) span.style.opacity = "0.6";
        if (cell.invisible) span.style.visibility = "hidden";
        const decoration = cellDecoration(cell);
        if (decoration) span.style.textDecorationLine = decoration;
        fragment.appendChild(span);
    }
    element.replaceChildren(fragment);
}

function cellDecoration(cell: TerminalCellSnapshot): string {
    return [
        cell.underline ? "underline" : "",
        cell.overline ? "overline" : "",
        cell.strikethrough ? "line-through" : "",
    ]
        .filter(Boolean)
        .join(" ");
}

function rowEqual(left: TerminalRowSnapshot, right: TerminalRowSnapshot): boolean {
    if (left === right) return true;
    if (left.cells.length !== right.cells.length) return false;
    return left.cells.every((cell, index) => cellEqual(cell, right.cells[index]));
}

function cellEqual(left: TerminalCellSnapshot, right: TerminalCellSnapshot | undefined): boolean {
    return (
        right !== undefined &&
        left.x === right.x &&
        left.text === right.text &&
        left.width === right.width &&
        left.bold === right.bold &&
        left.dim === right.dim &&
        left.italic === right.italic &&
        left.underline === right.underline &&
        left.inverse === right.inverse &&
        left.strikethrough === right.strikethrough &&
        left.foreground === right.foreground &&
        left.background === right.background &&
        left.hyperlink === right.hyperlink &&
        left.invisible === right.invisible &&
        left.overline === right.overline
    );
}
