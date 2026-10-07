import { renderMermaidSVG } from "beautiful-mermaid";
import { safeSvgAssert } from "./safeSvg";

const MAX_SOURCE_BYTES = 131_072;
const MAX_SVG_BYTES = 4_194_304;
const MAX_DIMENSION = 100_000;

export const MERMAID_DIAGRAM_BORDER = 2;

export type MermaidDiagramDimensions = {
    readonly height: number;
    readonly width: number;
};

export type MermaidDiagramRender = MermaidDiagramDimensions & {
    readonly svg: string;
};

const renderOptions = {
    font: "kissopen Figtree",
    layerSpacing: 40,
    nodeSpacing: 24,
    padding: 24,
} as const;

function byteLength(value: string): number {
    return new TextEncoder().encode(value).byteLength;
}

function dimensionsRead(svg: string): MermaidDiagramDimensions {
    const match = svg.match(
        /^<svg\b[^>]*\bviewBox="0 0 ([0-9]+(?:\.[0-9]+)?) ([0-9]+(?:\.[0-9]+)?)"/u,
    );
    const width = Number(match?.[1]);
    const height = Number(match?.[2]);
    if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0 ||
        width > MAX_DIMENSION ||
        height > MAX_DIMENSION
    )
        throw new Error("Beautiful Mermaid produced invalid diagram dimensions.");
    return { height, width };
}

function sourceAssert(source: string): void {
    if (byteLength(source) > MAX_SOURCE_BYTES)
        throw new Error("Mermaid source exceeds the rendering limit.");
}

function svgPrepare(svg: string): MermaidDiagramRender {
    // Beautiful Mermaid currently emits Google Fonts imports even for an
    // explicitly supplied local font. A diagram preview must never fetch them.
    const prepared = svg.replace(/@import\s+url\([^)]*\);?/giu, "");
    if (byteLength(prepared) > MAX_SVG_BYTES)
        throw new Error("Rendered Mermaid SVG exceeds the diagram limit.");
    return { ...dimensionsRead(prepared), svg: prepared };
}

/** Synchronously renders one diagram against live Kissopen Shadow-DOM bridges. */
export function mermaidDiagramRender(source: string): MermaidDiagramRender {
    sourceAssert(source);
    return svgPrepare(
        renderMermaidSVG(source, {
            ...renderOptions,
            accent: "var(--kissopen-mermaid-accent)",
            bg: "var(--kissopen-mermaid-background)",
            border: "var(--kissopen-mermaid-border)",
            fg: "var(--kissopen-mermaid-text)",
            line: "var(--kissopen-mermaid-line)",
            muted: "var(--kissopen-mermaid-muted)",
            surface: "var(--kissopen-mermaid-surface)",
        }),
    );
}

/**
 * Resolves intrinsic geometry without a DOM. Colors do not participate in
 * Beautiful Mermaid's layout, so the library defaults are sufficient here.
 */
export function mermaidDiagramMeasure(source: string): MermaidDiagramDimensions {
    sourceAssert(source);
    const { height, svg, width } = svgPrepare(renderMermaidSVG(source, renderOptions));
    // The row model must choose the same fallback as the visible component;
    // otherwise a rejected SVG would leave the virtualized geometry incorrect.
    safeSvgAssert(svg);
    return { height, width };
}

/** Natural SVG height: intrinsic size until constrained, then proportional. */
export function mermaidDiagramNaturalHeight(
    dimensions: MermaidDiagramDimensions,
    availableWidth: number,
): number {
    const contentWidth = Math.max(0, availableWidth - MERMAID_DIAGRAM_BORDER);
    const paintedWidth = Math.min(dimensions.width, contentWidth);
    return MERMAID_DIAGRAM_BORDER + (paintedWidth * dimensions.height) / dimensions.width;
}
