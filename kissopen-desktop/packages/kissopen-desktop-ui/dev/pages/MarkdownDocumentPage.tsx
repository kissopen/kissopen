import { type ReactNode } from "react";
import { MarkdownDocument } from "../../src/MarkdownDocument";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-171";

const readme = `# KISSOPEN file viewer

Opening a file shows the file. A Markdown document reads as a document — on a
reading measure, in the document type ramp — rather than as a wall of source.

## What renders

- **Headings** open a section and take air above them
- Lists, nested lists, and task lists
- Tables, block quotes, and fenced code
- Links: the web opens outside, [a file](master-plans/03-file-viewer.md) opens here

### Task list

- [x] Read the file
- [ ] Write it back

> A preview that crops has answered a different question than the one asked.

| Kind     | Opens as        | Scrolls |
| -------- | --------------- | ------- |
| Markdown | Rendered prose  | Yes     |
| Image    | Contained stage | No      |
| Source   | Monospace text  | Yes     |

\`\`\`ts
export function filePreviewKind(path: string): FilePreviewKind {
    return EXTENSION_KIND[extensionOf(path)] ?? "binary";
}
\`\`\`

\`\`\`mermaid
flowchart LR
    Markdown --> Render[Beautiful Mermaid]
    Render --> SVG[Validated themed SVG]
\`\`\`

Inline \`code\` keeps the mono face, and a rule closes the document.

---

Last read from the workspace, not the browser.
`;

const short = `## Release notes

Two paragraphs and a list is the ordinary case, and it should look composed at
any width the panel is dragged to.

1. Files open inside KISSOPEN
2. Markdown renders
3. Chat links reuse the same viewer
`;

function frame(children: ReactNode, height: number, width: number) {
    return (
        <div
            style={{
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: "10px",
                display: "flex",
                height: `${height}px`,
                overflow: "hidden",
                width: `${width}px`,
            }}
        >
            {children}
        </div>
    );
}

export function MarkdownDocumentPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A Markdown file read as a document: a full-bleed scrollport with the document set on a 768px reading measure inside it. Headings, tables, task lists, quotes, fenced code, and securely isolated Mermaid diagrams render in the document type ramp; a link to another file is a click the caller handles."
            title="Markdown document"
        >
            <Specimen
                detail="768 px measure · 24/32 gutters · 15/24 body"
                label="Document"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(<MarkdownDocument onFileOpen={() => {}} text={readme} />, 620, 880)}
                    <DimensionRule label="880 × 620 px region · 768 px measure" />
                </div>
            </Specimen>

            <Specimen
                detail="The panel width a document opens at beside a conversation"
                label="Narrow"
                number="02"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(<MarkdownDocument text={short} />, 320, 360)}
                    <DimensionRule label="360 px wide · gutters hold at panel width" />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
