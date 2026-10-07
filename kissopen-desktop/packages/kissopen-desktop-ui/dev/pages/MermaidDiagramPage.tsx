import { MermaidDiagram } from "../../src/MermaidDiagram";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

export const componentNumber = "C-270";

const flowchart = `flowchart LR
    Source[Untrusted Mermaid] --> Render[Beautiful Mermaid]
    Render --> Validate[Static SVG allowlist]
    Validate --> DOM[Themed Shadow DOM]
    Validate -. rejected .-> Source`;

const sequence = `sequenceDiagram
    participant UI as KISSOPEN
    participant R as Beautiful Mermaid
    UI->>R: Mermaid source + theme roles
    R-->>UI: SVG + intrinsic dimensions
    UI->>UI: mount validated SVG tree`;

export function MermaidDiagramPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A Mermaid fence rendered synchronously by Beautiful Mermaid, checked against a static SVG allowlist, and mounted at its intrinsic size in a themed Shadow DOM without interpreting its source as HTML."
            title="Mermaid diagram"
        >
            <Specimen
                detail="Complete fence · intrinsic aspect ratio · live KISSOPEN theme roles · no iframe or string HTML injection"
                label="Document diagram"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: 720 }}>
                    <MermaidDiagram source={flowchart} />
                    <DimensionRule label="Intrinsic size · proportionally constrained at 720 px" />
                </div>
            </Specimen>
            <Specimen
                detail="The synchronous viewBox also drives the virtualized message-row model"
                label="Message diagram"
                number="02"
                stage="app"
            >
                <div style={{ width: 640 }}>
                    <MermaidDiagram source={sequence} variant="message" />
                </div>
            </Specimen>
            <Specimen
                detail="Streaming and failures leave the authored source readable"
                label="Source fallback"
                number="03"
                stage="surface"
            >
                <div style={{ width: 640 }}>
                    <MermaidDiagram enabled={false} source={flowchart} variant="message" />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
