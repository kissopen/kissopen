import { type ReactNode } from "react";
import { CodeEditor } from "../../src/CodeEditor";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-175";

const typescript = `import { CodeEditor } from "kissopen-desktop-ui";

/** The file tab's body: one file, edited where it is read. */
export function Editor(props: { path: string; text: string }) {
    const dirty = props.text !== saved;
    return (
        <CodeEditor
            name={props.path}
            onValueChange={(value) => draft.update(value)}
            value={props.text}
        />
    );
}
`;

const python = `from dataclasses import dataclass


@dataclass
class Session:
    """One agent session, as the daemon reports it."""

    id: str
    waiting: bool = False

    def label(self) -> str:
        return f"{self.id}{' (waiting)' if self.waiting else ''}"
`;

function frame(children: ReactNode, height = 280, width = 720) {
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

export function CodeEditorPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A real code editor for one file: CodeMirror parses incrementally, so highlighting keeps up with typing at any file size. Undo history, bracket matching, and a line-number gutter come with it; Cmd/Ctrl+S reports intent to save."
            title="CodeEditor"
        >
            <Specimen
                detail="Language from the file name · 13 px / 20 px"
                label="Editing"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(<CodeEditor name="Editor.tsx" value={typescript} />)}
                    <DimensionRule label="720 × 280 px region · 40 px gutter" />
                </div>
            </Specimen>

            <Specimen
                detail="Another grammar, the same palette"
                label="Python"
                number="02"
                stage="surface"
            >
                {frame(<CodeEditor name="session.py" value={python} />)}
            </Specimen>

            <Specimen
                detail="A file being read rather than written goes quiet"
                label="Read-only"
                number="03"
                stage="surface"
            >
                {frame(<CodeEditor name="Editor.tsx" readOnly value={typescript} />, 200)}
            </Specimen>

            <Specimen
                detail="The same editor on the dark face — one palette, no appearance prop"
                label="Dark"
                number="04"
                stage="surface"
            >
                <div className="kissopen-theme-dark" style={{ display: "flex" }}>
                    {frame(<CodeEditor name="Editor.tsx" value={typescript} />)}
                </div>
            </Specimen>
        </ComponentPage>
    );
}
