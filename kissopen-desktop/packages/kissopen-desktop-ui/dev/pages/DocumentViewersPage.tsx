import { useState, type ReactNode } from "react";
import { FilePreview } from "../../src/FilePreview";
import { Button } from "../../src/Button";
import { resizePdf, resizeWord, resizeSlides } from "./documentResizeFixtures";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-296";

/**
 * Inline documents exercise resizing offline; missing addresses and a converted
 * format exercise the error and waiting states without any account or server.
 */
function frame(children: ReactNode) {
    return (
        <div style={{ display: "flex", flexDirection: "column", height: "320px", width: "640px" }}>
            {children}
        </div>
    );
}

export function DocumentViewersPage() {
    const [width, setWidth] = useState(640);
    const [format, setFormat] = useState<"pdf" | "docx" | "pptx">("pdf");
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="PDF, Word, Excel and PowerPoint drawn inside the file preview, and the converted formats."
            title="Document viewers"
        >
            <Specimen
                number="00"
                label="Resize a loaded document"
                detail="Narrow and widen without reopening; PDF sharpens after dragging stops."
                stage="app"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                        {([280, 420, 640] as const).map((value) => (
                            <Button key={value} onClick={() => setWidth(value)}>
                                {value} px
                            </Button>
                        ))}
                        {(["pdf", "docx", "pptx"] as const).map((value) => (
                            <Button key={value} onClick={() => setFormat(value)}>
                                {value}
                            </Button>
                        ))}
                    </div>
                    <div style={{ display: "flex", width, height: 480, minWidth: 0 }}>
                        <FilePreview
                            key={format}
                            path={`resize.${format}`}
                            content={{
                                type: "url",
                                url: { pdf: resizePdf, docx: resizeWord, pptx: resizeSlides }[
                                    format
                                ],
                            }}
                        />
                    </div>
                </div>
            </Specimen>
            {(
                [
                    ["01", "report.pdf", "PDF · missing file"],
                    ["02", "plan.docx", "Word · missing file"],
                    ["03", "budget.xlsx", "Excel · missing file"],
                    ["04", "deck.pptx", "PowerPoint · missing file"],
                ] as const
            ).map(([number, name, detail]) => (
                <Specimen detail={detail} key={name} label={name} number={number} stage="app">
                    {frame(
                        <FilePreview
                            content={{ type: "url", url: `/__missing__/${name}` }}
                            path={name}
                        />,
                    )}
                </Specimen>
            ))}
            <Specimen
                detail="WPS · waiting for its converted PDF"
                label="notes.wps"
                number="05"
                stage="app"
            >
                {frame(
                    <FilePreview
                        content={{ type: "unavailable" }}
                        onOpenDefault={() => {}}
                        path="notes.wps"
                    />,
                )}
            </Specimen>
        </ComponentPage>
    );
}
