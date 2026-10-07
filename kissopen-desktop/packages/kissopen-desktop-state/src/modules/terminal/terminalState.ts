import type { StoreApi } from "zustand/vanilla";
import type { TerminalConnection } from "../../transport.js";
import type { UserError } from "../../types.js";

/**
 * Normalized, immutable terminal render model. Both live VT emulation and
 * semantic grid recovery converge on this one shape so a view renders a
 * terminal purely from props, with colors already resolved to CSS strings and
 * no palette, style-table, or emulator knowledge left for the UI to interpret.
 */
export interface TerminalCellSnapshot {
    /** Column of the cell's left edge in the visible grid. */
    readonly x: number;
    /** The glyph(s) painted in this cell; empty string renders as blank. */
    readonly text: string;
    /** 1 for a normal cell, 2 for the left half of a wide (CJK/emoji) glyph. */
    readonly width: 1 | 2;
    readonly bold: boolean;
    readonly dim: boolean;
    readonly italic: boolean;
    readonly underline: boolean;
    readonly inverse: boolean;
    readonly strikethrough: boolean;
    /** An OSC 8 hyperlink attached by the terminal, when available. */
    readonly hyperlink?: string | null;
    readonly invisible?: boolean;
    readonly overline?: boolean;
    /** Resolved CSS foreground color, or null to use the default foreground. */
    readonly foreground: string | null;
    /** Resolved CSS background color, or null to use the default background. */
    readonly background: string | null;
}

export interface TerminalRowSnapshot {
    readonly cells: readonly TerminalCellSnapshot[];
}

export interface TerminalCursorSnapshot {
    readonly x: number;
    readonly y: number;
    readonly visible: boolean;
}

/** Input modes that change the byte sequence produced by browser key events. */
export interface TerminalInputModesSnapshot {
    readonly bracketedPaste: boolean;
    readonly cursorKeysApplication: boolean;
}

export interface TerminalGridSnapshot {
    /** Visible column count. */
    readonly cols: number;
    /** Visible row count. */
    readonly rows: number;
    /** The terminal-reported window title, or an empty string. */
    readonly title: string;
    /** Cursor position within the visible grid, or null when hidden. */
    readonly cursor: TerminalCursorSnapshot | null;
    /** Live VT input modes; omitted by a semantic recovery frame. */
    readonly inputModes?: TerminalInputModesSnapshot;
    /** The visible lines, top to bottom; each line lists its non-empty cells. */
    readonly lines: readonly TerminalRowSnapshot[];
    /**
     * Lines that have scrolled off the top of the visible grid, oldest first, so
     * history stays readable above the screen. It is bounded by the emulator's
     * retention limit, and is empty for a semantic recovery frame, which carries
     * only the current screen. Cursor coordinates stay relative to `lines`, so
     * arriving scrollback never moves what the cursor points at.
     */
    readonly scrollback: readonly TerminalRowSnapshot[];
}

/** The live connection state a driver reports to the store. */
export type TerminalDriverStatus = "connecting" | "connected" | "disconnected";

/**
 * The appearance a terminal is running in. It is settled when the terminal is
 * created and never changes afterwards: it seeds the emulator on both ends, and
 * the programs inside read it back through the terminal's own colour queries, so
 * a running shell cannot be moved to the other appearance. Switching the app's
 * theme therefore leaves every open terminal exactly as it was.
 */
export type TerminalColorScheme = "dark" | "light";

/**
 * The store-side sink a terminal driver pushes authoritative updates into. The
 * driver owns the wire protocol and terminal emulation; it never touches the
 * store directly, only this neutral callback surface, so product state stays
 * free of protocol and Node dependencies.
 */
export interface TerminalReplica {
    /** Reports a connection lifecycle transition. */
    statusUpdate(status: TerminalDriverStatus): void;
    /** Reports a newly rendered grid (from live VT or semantic recovery). */
    gridUpdate(grid: TerminalGridSnapshot): void;
    /** Reports that the underlying process exited with this code. */
    exit(exitCode: number | null): void;
    /** Reports a transient, displayable driver error. */
    error(message: string): void;
}

/**
 * One live terminal driver. It owns the binary protocol client, terminal
 * emulation, and reconnect loop; the store only issues these high-level intents
 * and observes results through the `TerminalReplica` it supplied.
 */
export interface TerminalDriver {
    /** Sends user input bytes to the terminal. */
    write(data: string): void;
    /** Requests a new visible size. */
    resize(cols: number, rows: number): void;
    /** Forces an immediate reconnect attempt. */
    reconnect(): void;
    /** Tears the driver down and releases its resources. */
    close(): void;
}

/**
 * Creates a driver for one terminal. The store supplies a `connect` factory that
 * opens a fresh authenticated byte channel (used for the initial attach and
 * every reconnect), the replica sink, and the initial size. The concrete
 * implementation lives in application code, keeping `kissopen-desktop-state` free of the
 * protocol library and Node stream types.
 */
export type TerminalDriverCreate = (options: {
    readonly connect: () => TerminalConnection;
    readonly replica: TerminalReplica;
    readonly cols: number;
    readonly rows: number;
    /** The appearance the terminal was created in; it seeds the emulator. */
    readonly colorScheme: TerminalColorScheme;
}) => TerminalDriver;

export interface TerminalSnapshot {
    readonly status: "connecting" | "connected" | "disconnected" | "exited" | "error";
    /** The current renderable grid, once any output or recovery has arrived. */
    readonly grid?: TerminalGridSnapshot;
    readonly title: string;
    readonly cols: number;
    readonly rows: number;
    readonly exitCode: number | null;
    readonly error?: UserError;
}

export interface TerminalState extends TerminalSnapshot {
    terminalWrite(data: string): void;
    terminalResize(cols: number, rows: number): void;
    terminalReconnect(): void;
    terminalClose(): void;
}

export type TerminalStore = StoreApi<TerminalState>;
