import { type ReactNode } from "react";
import { ChangedFileDiff } from "../../src/ChangedFileDiff";
import { FilePreview } from "../../src/FilePreview";
import { TabbedPane } from "../../src/TabbedPane";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-237";

const oldContent = `# File viewer

Opening a file shows the file. A Markdown document renders as prose.

- Images and video play in place
- Anything else says so plainly
`;

const newContent = `# File viewer

Opening a file shows the file. A Markdown document renders as prose, in the
same type the rest of the product renders Markdown in.

- Images and video play in place
- Source and configuration read as code
- Anything else says so plainly

> A preview that crops has answered a different question than the one asked.
`;

const source = `/** How long a recording has run, as a reader says it. */
export function elapsed(seconds: number): string {
    const whole = Math.max(Math.floor(seconds), 0);
    const minutes = Math.floor(whole / 60);
    const rest = String(whole % 60).padStart(2, "0");
    return \`\${String(minutes)}:\${rest}\`;
}
`;

const sourceBefore = `/** How long a recording has run, as a reader says it. */
export function elapsed(seconds: number): string {
    return String(Math.floor(seconds));
}
`;

const wideBefore = `/** One sentence, kept on one line the way configuration prose often is. */
export const guidance = "Workspace writes stay inside the checkout.";
`;

const wide = `/** One sentence, kept on one line the way configuration prose often is. */
export const guidance = "Workspace writes stay inside the checkout, its Git control directory, and temporary directories; everything else on the host is readable but never writable, and outbound network access flows through the managed proxy alone.";
`;

/** The preview a host hands in: the product's own file surface, over one file. */
function preview(path: string, text: string) {
    return <FilePreview content={{ type: "text", text }} path={path} />;
}

/* The diff renderer is told which appearance to draw in, so each specimen pins
   the face it names rather than following the workbench and disagreeing with
   the surface underneath it. */
function frame(children: ReactNode, height = 420, appearance: "dark" | "light" = "light") {
    return (
        <div
            className={appearance === "dark" ? "kissopen-theme-dark" : "kissopen-theme-light"}
            style={{
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                height: `${height}px`,
                overflow: "hidden",
                width: "720px",
            }}
        >
            {children}
        </div>
    );
}

/** The real three-layer file surface, used twice so Preview and Pierre can be
 * compared without either specimen quietly changing the surrounding chrome. */
function tabbedDiff(mode: "preview" | "unified") {
    return (
        <TabbedPane
            activeId="master-plans/03-file-viewer.md"
            onSelect={() => undefined}
            tabs={[
                {
                    icon: "doc",
                    id: "master-plans/03-file-viewer.md",
                    label: "03-file-viewer.md",
                },
            ]}
        >
            <ChangedFileDiff
                appearance="light"
                mode={mode}
                newContent={newContent}
                oldContent={oldContent}
                path="master-plans/03-file-viewer.md"
                preview={preview("master-plans/03-file-viewer.md", newContent)}
            />
        </TabbedPane>
    );
}

export function ChangedFileDiffPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="One changed file, in the four ways there are to look at one. Preview is the product's own file preview over the working-tree copy, so a changed document reads as the document and changed source reads as numbered, highlighted source; Unified and Split are the diff; Edit is the text. A mode with nothing behind it is not offered."
            title="ChangedFileDiff"
        >
            <Specimen
                detail="Preview and Pierre share the same three 32px layers and path origin"
                label="Chrome and path alignment"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(tabbedDiff("preview"), 280)}
                    {frame(tabbedDiff("unified"), 280)}
                    <DimensionRule label="Preview ↔ Unified · consecutive 32 px bands · 16 px icon at x16 · path at x42 · diff stats right" />
                </div>
            </Specimen>

            <Specimen
                detail="Source is the same numbered, highlighted read a file tab gives it — not the diff renderer with nothing to compare against"
                label="Source"
                number="02"
                stage="surface"
            >
                {frame(
                    <ChangedFileDiff
                        appearance="light"
                        mode="preview"
                        newContent={source}
                        oldContent={sourceBefore}
                        path="packages/kissopen-desktop-ui/src/elapsed.ts"
                        preview={preview("packages/kissopen-desktop-ui/src/elapsed.ts", source)}
                    />,
                    300,
                )}
            </Specimen>

            <Specimen
                detail="Additions and deletions in one column"
                label="Unified"
                number="03"
                stage="surface"
            >
                {frame(
                    <ChangedFileDiff
                        appearance="light"
                        mode="unified"
                        newContent={newContent}
                        oldContent={oldContent}
                        path="master-plans/03-file-viewer.md"
                        preview={preview("master-plans/03-file-viewer.md", newContent)}
                    />,
                    360,
                )}
            </Specimen>

            <Specimen detail="Old and new side by side" label="Split" number="04" stage="surface">
                {frame(
                    <ChangedFileDiff
                        appearance="light"
                        mode="split"
                        newContent={newContent}
                        oldContent={oldContent}
                        path="master-plans/03-file-viewer.md"
                        preview={preview("master-plans/03-file-viewer.md", newContent)}
                    />,
                    360,
                )}
            </Specimen>

            <Specimen
                detail="Offered only with somewhere to hand an edit; Command-S saves without adding another button to the mode bar"
                label="Edit"
                number="05"
                stage="surface"
            >
                {frame(
                    <ChangedFileDiff
                        appearance="light"
                        mode="edit"
                        newContent={source}
                        oldContent={sourceBefore}
                        onContentChange={() => {}}
                        onSave={() => {}}
                        path="packages/kissopen-desktop-ui/src/elapsed.ts"
                        preview={preview("packages/kissopen-desktop-ui/src/elapsed.ts", source)}
                    />,
                    300,
                )}
            </Specimen>

            <Specimen
                detail="What a change did to the file it names: created from nothing, moved from another path, or emptied without being removed"
                label="Change kinds"
                number="06"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(
                        <ChangedFileDiff
                            appearance="light"
                            mode="preview"
                            newContent={source}
                            oldContent=""
                            path="packages/kissopen-desktop-ui/src/elapsed.ts"
                            preview={preview("packages/kissopen-desktop-ui/src/elapsed.ts", source)}
                        />,
                        260,
                    )}
                    {frame(
                        <ChangedFileDiff
                            appearance="light"
                            mode="unified"
                            newContent={source}
                            oldContent={sourceBefore}
                            oldPath="packages/kissopen-desktop-ui/src/duration.ts"
                            path="packages/kissopen-desktop-ui/src/elapsed.ts"
                            preview={preview("packages/kissopen-desktop-ui/src/elapsed.ts", source)}
                        />,
                        260,
                    )}
                    {/* Emptied rather than removed: there is still a file, so its
                        preview is still offered — over nothing, which is what the
                        file now holds. */}
                    {frame(
                        <ChangedFileDiff
                            appearance="light"
                            mode="preview"
                            newContent=""
                            oldContent={source}
                            path="packages/kissopen-desktop-ui/src/elapsed.ts"
                            preview={preview("packages/kissopen-desktop-ui/src/elapsed.ts", "")}
                        />,
                        220,
                    )}
                </div>
            </Specimen>

            <Specimen
                detail="A deleted file has no copy left to read, so Preview is absent and the switch falls back to the diff"
                label="Deleted"
                number="07"
                stage="surface"
            >
                {frame(
                    <ChangedFileDiff
                        appearance="light"
                        mode="preview"
                        newContent=""
                        oldContent={oldContent}
                        path="master-plans/03-file-viewer.md"
                    />,
                    300,
                )}
            </Specimen>

            <Specimen
                detail="A read still in flight says so without taking the file away"
                label="Updating"
                number="08"
                stage="surface"
            >
                {frame(
                    <ChangedFileDiff
                        appearance="light"
                        loading
                        mode="preview"
                        newContent={newContent}
                        oldContent={oldContent}
                        path="master-plans/03-file-viewer.md"
                        preview={preview("master-plans/03-file-viewer.md", newContent)}
                    />,
                    300,
                )}
            </Specimen>

            <Specimen
                detail="The same pane on the dark face — the preview and the diff draw in one appearance"
                label="Dark"
                number="09"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(
                        <ChangedFileDiff
                            appearance="dark"
                            mode="preview"
                            newContent={newContent}
                            oldContent={oldContent}
                            path="master-plans/03-file-viewer.md"
                            preview={preview("master-plans/03-file-viewer.md", newContent)}
                        />,
                        360,
                        "dark",
                    )}
                    {frame(
                        <ChangedFileDiff
                            appearance="dark"
                            mode="unified"
                            newContent={newContent}
                            oldContent={oldContent}
                            path="master-plans/03-file-viewer.md"
                            preview={preview("master-plans/03-file-viewer.md", newContent)}
                        />,
                        300,
                        "dark",
                    )}
                </div>
            </Specimen>
            <Specimen
                detail="known Kissopen Agent offline · the edit draft and diff remain · Command-S waits for reconnect"
                label="Kissopen Agent offline"
                number="10"
                stage="surface"
            >
                {frame(
                    <ChangedFileDiff
                        appearance="light"
                        mode="edit"
                        newContent={source}
                        oldContent={sourceBefore}
                        onContentChange={() => {}}
                        onSave={() => {}}
                        path="packages/kissopen-desktop-ui/src/elapsed.ts"
                        preview={preview("packages/kissopen-desktop-ui/src/elapsed.ts", source)}
                        saveDisabled
                    />,
                    300,
                )}
            </Specimen>

            <Specimen
                detail="The choice sits at the right end of the mode bar and leaves only for Preview; wrapped lines fold at the pane instead of scrolling out of it, in the diff and in Edit alike"
                label="Wrap"
                number="11"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(
                        <ChangedFileDiff
                            appearance="light"
                            mode="unified"
                            newContent={wide}
                            oldContent={wideBefore}
                            onWrapChange={() => {}}
                            path="packages/kissopen-desktop-ui/src/guidance.ts"
                        />,
                        240,
                    )}
                    {frame(
                        <ChangedFileDiff
                            appearance="light"
                            mode="unified"
                            newContent={wide}
                            oldContent={wideBefore}
                            onWrapChange={() => {}}
                            path="packages/kissopen-desktop-ui/src/guidance.ts"
                            wrap
                        />,
                        240,
                    )}
                </div>
            </Specimen>
        </ComponentPage>
    );
}
