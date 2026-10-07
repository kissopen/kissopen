import type { TerminalCellSnapshot, TerminalGridSnapshot } from "kissopen-desktop-state";
import { TerminalPanel } from "../../src/TerminalPanel";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-078";

function cell(
    x: number,
    text: string,
    overrides: Partial<TerminalCellSnapshot> = {},
): TerminalCellSnapshot {
    return {
        x,
        text,
        width: 1,
        bold: false,
        dim: false,
        italic: false,
        underline: false,
        inverse: false,
        strikethrough: false,
        foreground: null,
        background: null,
        ...overrides,
    };
}

/** Real grid cells are one glyph each; build a run as consecutive single cells. */
function run(
    startX: number,
    text: string,
    overrides: Partial<TerminalCellSnapshot> = {},
): TerminalCellSnapshot[] {
    return [...text].map((glyph, index) => cell(startX + index, glyph, overrides));
}

const grid: TerminalGridSnapshot = {
    cols: 80,
    rows: 24,
    title: "workspace",
    cursor: { x: 2, y: 3, visible: true },
    lines: [
        { cells: run(0, "kissopen@agent:/workspace$ pnpm test") },
        {
            cells: [
                ...run(0, "Tests", { bold: true }),
                ...run(7, "127 passed", { foreground: "#34d399" }),
            ],
        },
        { cells: run(0, "warning: 2 skipped", { foreground: "#fbbf24", italic: true }) },
        {
            cells: [cell(0, "選", { width: 2 }), ...run(3, "wide", { inverse: true })],
        },
        { cells: run(0, "$ ") },
    ],
    // Enough history that the specimen actually scrolls. Without it the
    // blueprint only ever shows a screen that fits, which is exactly the case
    // where the transcript's scrolling cannot be seen.
    scrollback: Array.from({ length: 60 }, (_, index) => ({
        cells: run(0, `kissopen@agent:/workspace$ echo line ${String(index + 1)}`),
    })),
};

function noop(): void {
    // Blueprint fixtures are inert; handlers do nothing.
}

const handlers = {
    onHeightChange: noop,
    onInput: noop,
    onReconnect: noop,
    onResize: noop,
};

export function TerminalPanelPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Resizable interactive terminal dock rendering the KISSOPEN Agent binary-protocol grid."
            title="Terminal panel"
        >
            <Specimen
                detail="connected · 80 × 24 · styled KISSOPEN Agent grid cells with cursor · no chrome above the grid"
                label="Connected"
                number="01"
                stage="app"
            >
                <div style={frame}>
                    <TerminalPanel grid={grid} height={280} status="connected" {...handlers} />
                </div>
            </Specimen>
            <Specimen
                detail="KISSOPEN Agent reconnecting · PTY status retained · grid mounted read-only"
                label="KISSOPEN Agent reconnecting"
                number="02"
                stage="app"
            >
                <div style={frame}>
                    <TerminalPanel
                        grid={grid}
                        height={280}
                        kissopenAgentAvailability="reconnecting"
                        kissopenAgentAvailabilityReason="Waiting for the peer route"
                        status="connected"
                        {...handlers}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="KISSOPEN Agent unavailable · reason in context · selection, copy, scroll, and links retained"
                label="KISSOPEN Agent unavailable"
                number="03"
                stage="app"
            >
                <div style={frame}>
                    <TerminalPanel
                        grid={grid}
                        height={280}
                        kissopenAgentAvailability="unavailable"
                        kissopenAgentAvailabilityReason="The remote machine is offline"
                        status="disconnected"
                        {...handlers}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="exited · frameless session collapses to its notice line"
                label="Exited (collapsed)"
                number="04"
                stage="app"
            >
                <div style={{ ...frame, height: "120px" }}>
                    <TerminalPanel exitCode={0} height={280} status="exited" {...handlers} />
                </div>
            </Specimen>
            <Specimen
                detail="started in dark · keeps that appearance whatever the surrounding theme is"
                label="Pinned dark"
                number="05"
                stage="app"
            >
                <div style={frame}>
                    <TerminalPanel
                        colorScheme="dark"
                        grid={grid}
                        height={280}
                        status="connected"
                        {...handlers}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="started in light · keeps that appearance whatever the surrounding theme is"
                label="Pinned light"
                number="06"
                stage="app"
            >
                <div style={frame}>
                    <TerminalPanel
                        colorScheme="light"
                        grid={grid}
                        height={280}
                        status="connected"
                        {...handlers}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="no height · fills a 320 × 360 panel column · no divider"
                label="Filling a panel column"
                number="07"
                stage="app"
            >
                <div style={{ ...frame, width: "320px" }}>
                    <TerminalPanel
                        grid={grid}
                        onInput={noop}
                        onReconnect={noop}
                        onResize={noop}
                        status="connected"
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}

const frame = {
    display: "flex",
    flexDirection: "column" as const,
    height: "360px",
    width: "760px",
};
