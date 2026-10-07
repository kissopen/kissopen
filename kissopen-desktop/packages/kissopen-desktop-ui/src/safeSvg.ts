import { t } from "kissopen-desktop-state";
const MAX_SVG_BYTES = 4_194_304;
const MAX_SVG_ELEMENTS = 40_000;

const ALLOWED_ELEMENTS = new Set([
    "circle",
    "defs",
    "ellipse",
    "g",
    "line",
    "marker",
    "path",
    "polygon",
    "polyline",
    "rect",
    "style",
    "svg",
    "text",
    "title",
    "tspan",
]);

const ALLOWED_ATTRIBUTES = new Set([
    "class",
    "cx",
    "cy",
    "d",
    "dy",
    "fill",
    "font-size",
    "font-style",
    "font-weight",
    "height",
    "id",
    "marker-end",
    "marker-start",
    "markerHeight",
    "markerWidth",
    "orient",
    "points",
    "r",
    "refX",
    "refY",
    "rx",
    "ry",
    "stroke",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-width",
    "style",
    "text-anchor",
    "text-decoration",
    "transform",
    "viewBox",
    "width",
    "x",
    "x1",
    "x2",
    "xmlns",
    "y",
    "y1",
    "y2",
]);

const UNSAFE_CSS = /@import|expression\s*\(|(?:javascript|vbscript|data|file|https?):/iu;
const LOCAL_MARKER = /^url\(\s*#[A-Za-z0-9_.:-]+\s*\)$/u;

/**
 * Admit only the static SVG vocabulary Beautiful Mermaid itself emits.
 *
 * Validation happens before a deep clone of this parsed document can enter the
 * component's scoped Shadow DOM. No source string is interpreted as HTML and
 * no element or attribute outside this capability allowlist survives.
 */
function safeSvgRoot(svg: string): SVGSVGElement {
    if (new TextEncoder().encode(svg).byteLength > MAX_SVG_BYTES)
        throw new Error("Rendered Mermaid SVG exceeds the diagram limit.");
    if (/<!DOCTYPE|<!ENTITY|<\?/iu.test(svg))
        throw new Error("Rendered Mermaid SVG contains an XML declaration capability.");
    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (parsed.querySelector("parsererror") !== null)
        throw new Error("Beautiful Mermaid produced invalid SVG.");
    const root = parsed.documentElement;
    if (root.localName !== "svg" || root.namespaceURI !== "http://www.w3.org/2000/svg")
        throw new Error("Beautiful Mermaid produced a non-SVG document.");
    const elements = [root, ...Array.from(root.querySelectorAll("*"))];
    if (elements.length > MAX_SVG_ELEMENTS)
        throw new Error("Rendered Mermaid SVG exceeds the element limit.");
    for (const element of elements) {
        if (element.namespaceURI !== "http://www.w3.org/2000/svg")
            throw new Error("Rendered Mermaid SVG contains a foreign namespace.");
        if (!ALLOWED_ELEMENTS.has(element.localName))
            throw new Error(`Rendered Mermaid SVG contains forbidden <${element.localName}>.`);
        for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name;
            if (!ALLOWED_ATTRIBUTES.has(name) && !name.startsWith("data-"))
                throw new Error(
                    t("Rendered Mermaid SVG contains forbidden attribute {name}.", { name }),
                );
            if (name.toLowerCase().startsWith("on") || /(?:^|:)href$/iu.test(name))
                throw new Error("Rendered Mermaid SVG contains an interactive capability.");
            if (name === "marker-start" || name === "marker-end") {
                if (!LOCAL_MARKER.test(attribute.value))
                    throw new Error("Rendered Mermaid SVG contains an external marker.");
                continue;
            }
            if (name === "fill" || name === "stroke" || name === "style" || name === "transform") {
                if (/url\s*\(/iu.test(attribute.value) || UNSAFE_CSS.test(attribute.value))
                    throw new Error("Rendered Mermaid SVG contains an external style capability.");
            }
        }
        if (element.localName === "style") {
            const css = element.textContent ?? "";
            if (/url\s*\(/iu.test(css) || UNSAFE_CSS.test(css))
                throw new Error("Rendered Mermaid SVG contains an external stylesheet capability.");
        }
    }
    return root as unknown as SVGSVGElement;
}

export function safeSvgAssert(svg: string): void {
    safeSvgRoot(svg);
}

/** Returns a newly adopted SVG tree; the source string is never mounted. */
export function safeSvgElementCreate(svg: string): SVGSVGElement {
    return document.importNode(safeSvgRoot(svg), true);
}
