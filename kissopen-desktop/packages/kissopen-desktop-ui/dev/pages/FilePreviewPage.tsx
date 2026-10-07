import { type ReactNode } from "react";
import { Button } from "../../src/Button";
import { FilePreview } from "../../src/FilePreview";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-169";
/* A deterministic, offline specimen image: an inline SVG, so the workbench never
   waits on a network fetch to take a screenshot. */
const sampleImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
        <rect width="640" height="400" fill="#1f2a44"/>
        <circle cx="200" cy="150" r="90" fill="#2baccc"/>
        <rect x="300" y="200" width="260" height="140" rx="12" fill="#e0a458"/>
        <path d="M0 400 L200 240 L360 400 Z" fill="#3fb950"/>
    </svg>`,
)}`;
const markdown = `# File viewer

Opening a file shows the file. A Markdown document renders as prose, in the same
type the rest of the product renders Markdown in.

## What it covers

- Images, video, and audio play in place
- Source and configuration read as code
- Anything else says so plainly

> A preview that crops has answered a different question than the one asked.

\`\`\`ts
export function filePreviewKind(path: string): FilePreviewKind {
    return EXTENSION_KIND[extensionOf(path)] ?? "binary";
}
\`\`\`
`;
const source = `import { FilePreview } from "kissopen-desktop-ui";

/** One file, shown rather than downloaded. */
export function Preview(props: { path: string; bytes: ArrayBuffer }) {
    const url = URL.createObjectURL(new Blob([props.bytes]));
    return <FilePreview content={{ type: "url", url }} path={props.path} />;
}
`;
function frame(children: ReactNode, height = 420, width = 720) {
    return (
        <div
            style={{
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: "10px",
                height: `${height}px`,
                overflow: "hidden",
                width: `${width}px`,
            }}
        >
            {children}
        </div>
    );
}
export function FilePreviewPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="One file, shown rather than downloaded: a compact 32px diff-style icon-and-path header and a body that fills its region. Images and video are contained on the inset stage; Markdown and source scroll in a full-bleed scrollport."
            title="FilePreview"
        >
            <Specimen
                detail="32px icon-and-path header · contained artwork on the inset stage"
                label="Image"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(
                        <FilePreview
                            actions={
                                <Button icon="copy" size="small" variant="ghost">
                                    Download
                                </Button>
                            }
                            content={{ type: "url", url: sampleImage }}
                            dimensions="640 × 400"
                            onClose={() => {}}
                            path="packages/kissopen-desktop-ui/src/assets/backgrounds/relay-field.svg"
                            size="18 KB"
                            updating
                        />,
                    )}
                    <DimensionRule label="720 × 420 px region · 32 px path header" />
                </div>
            </Specimen>

            <Specimen
                detail="The same prose the product renders in a message"
                label="Markdown"
                number="02"
                stage="surface"
            >
                {frame(
                    <FilePreview
                        content={{ type: "text", text: markdown }}
                        onClose={() => {}}
                        path="master-plans/03-file-viewer.md"
                        size="1.4 KB"
                    />,
                    520,
                )}
            </Specimen>

            <Specimen detail="Monospace, unwrapped" label="Source" number="03" stage="surface">
                {frame(
                    <FilePreview
                        content={{ type: "text", text: source }}
                        path="packages/kissopen-desktop-app/sources/views/FilesView.tsx"
                        size="312 B"
                    />,
                    300,
                )}
            </Specimen>

            <Specimen
                detail="Loading, unviewable, and failed — one shape of answer"
                label="States"
                number="04"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(
                        <FilePreview
                            content={{ type: "loading" }}
                            path="media/intro.mp4"
                            size="42 MB"
                        />,
                        200,
                    )}
                    {frame(
                        <FilePreview
                            content={{ type: "unavailable" }}
                            path="vendor/toolchain.tar.gz"
                            size="180 MB"
                        />,
                        220,
                    )}
                    {frame(
                        <FilePreview
                            content={{
                                type: "error",
                                message: "The file is no longer in the workspace.",
                            }}
                            path="packages/kissopen-desktop-ui/src/removed.png"
                        />,
                        220,
                    )}
                </div>
            </Specimen>
        </ComponentPage>
    );
}
