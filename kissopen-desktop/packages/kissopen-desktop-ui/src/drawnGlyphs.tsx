import type { ReactNode } from "react";

/*
 * The one hand-drawn family in the house vocabulary.
 *
 * Every other `Icon` name is a font glyph from Ionicons or Octicons. The panel
 * affordance is the exception: neither family ships an arrow-free panel, and
 * Octicons' `sidebar-collapse` reads as a foreign object beside its Ionicons
 * neighbours — it is drawn on the full 16 box with a 1.5px stroke where an
 * Ionicons outline uses 1px inside a 14 x 12 ink box, so it lands a third
 * heavier and a notch larger than the workspace glyph directly above it.
 *
 * These shapes are therefore drawn to Ionicons' own metrics, measured off
 * `file-tray-outline` (the workspace glyph) at a 16px box:
 *
 *   - 1px stroke, round joins and caps;
 *   - a 14 x 12 ink box — outer edges at x 1..15, y 2..14;
 *   - a 2px outer corner radius.
 *
 * Coordinates are stroke centrelines on the 16 grid, so every edge lands on a
 * whole pixel at a 16px box and the shape stays crisp at 1x.
 *
 * Do not add a glyph here because a curated name is missing: pick the upstream
 * Ionicon or Octicon it maps to. This file exists for one shape the two
 * families do not contain.
 */
export type DrawnGlyphName = "panel-rail" | "panel-rail-collapsed" | "panel-rail-filled";

/** The divider's centreline: a column just under a third of the panel across. */
const DIVIDER_X = 5.5;

/**
 * The collapsed rail's gap — the same distance from the frame's inner left, top
 * and bottom edges, so the line sits square in its corner and mirrors exactly
 * for the panel at the other edge.
 *
 * 1, not a half step: a 1px stroke is only crisp on a half-pixel centreline, so
 * an even gap here (0.5, 1.5) would smear the line across two pixel columns at
 * a 16px box and read fatter than the frame around it.
 */
const COLLAPSED_GAP = 1;

/** The frame's inner ink edges, which the collapsed rail measures its gap from. */
const INNER_LEFT = 2;
const INNER_TOP = 3;
const INNER_BOTTOM = 13;

/*
 * Stroke centrelines from those inner edges. A 1px stroke puts ink half a unit
 * either side of its centreline, and a round cap adds the same half unit past
 * each end, so both axes take the same half-unit correction.
 */
const COLLAPSED_X = INNER_LEFT + COLLAPSED_GAP + 0.5;
const COLLAPSED_Y1 = INNER_TOP + COLLAPSED_GAP + 0.5;
const COLLAPSED_Y2 = INNER_BOTTOM - COLLAPSED_GAP - 0.5;

/**
 * The panel outline: the 14 x 12 rounded box every panel state shares.
 * `strokeWidth` is on the 16 grid, so it scales with the icon like a glyph.
 */
const outline = (
    <rect
        fill="none"
        height={11}
        rx={1.5}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1}
        width={13}
        x={1.5}
        y={2.5}
    />
);

/** The open panel: a divider meeting the frame, so the column reads as a room. */
const divider = (
    <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1}
        x1={DIVIDER_X}
        x2={DIVIDER_X}
        y1={2.5}
        y2={13.5}
    />
);

/** The closed panel: the column shrunk to a mark against the edge it hides at. */
const collapsedRail = (
    <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1}
        x1={COLLAPSED_X}
        x2={COLLAPSED_X}
        y1={COLLAPSED_Y1}
        y2={COLLAPSED_Y2}
    />
);

/**
 * The column as solid ink, drawn on outer geometry (x 1..5.5, y 2..14) so its
 * edge meets the outer edge of the outline stroke rather than showing a seam
 * inside it. Heavier than anything else in the set — kept because it is a good
 * shape for a surface that wants the panel state stated loudly, not because
 * the window chrome uses it.
 */
const columnFill = (
    <path
        d={`M ${DIVIDER_X} 2 H 3 A 2 2 0 0 0 1 4 V 12 A 2 2 0 0 0 3 14 H ${DIVIDER_X} Z`}
        fill="currentColor"
    />
);

/*
 * One silhouette, three readings of what is inside it: the column is open, the
 * column is put away, or the column is full. The frame never moves between
 * them, so a toggle changes what it is saying without jumping.
 */
export const drawnGlyphs: Record<DrawnGlyphName, ReactNode> = {
    "panel-rail": (
        <>
            {outline}
            {divider}
        </>
    ),
    "panel-rail-collapsed": (
        <>
            {outline}
            {collapsedRail}
        </>
    ),
    "panel-rail-filled": (
        <>
            {columnFill}
            {outline}
            {divider}
        </>
    ),
};
