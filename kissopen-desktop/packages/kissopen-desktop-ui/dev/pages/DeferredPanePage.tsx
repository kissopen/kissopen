import { DeferredPane } from "../../src/DeferredPane";
import { EmptyState } from "../../src/EmptyState";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

export const componentNumber = "C-266";

function Body(props: { title: string }) {
    return (
        <EmptyState
            description="The last complete body remains mounted until its replacement is ready."
            icon="doc"
            size="panel"
            title={props.title}
        />
    );
}

function Stage(props: { slow?: boolean }) {
    return (
        <div style={{ display: "flex", height: "280px", width: "560px" }}>
            <DeferredPane
                current={{ id: "current", content: <Body title="Complete file" /> }}
                fallback={
                    <EmptyState
                        animation="brand-loading"
                        description="The selected file is taking a moment."
                        icon="doc"
                        size="panel"
                        title="Opening file…"
                    />
                }
                minimumSlowMs={500}
                onReveal={() => {}}
                pending={
                    props.slow
                        ? { id: "pending", render: () => <Body title="Preparing file" /> }
                        : undefined
                }
                slowDelayMs={0}
            />
        </div>
    );
}

export function DeferredPanePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Keeps the complete pane visible during fast work and shows one patient fallback only when the replacement is genuinely slow."
            title="Deferred pane"
        >
            <div className="specimen-grid">
                <Specimen
                    detail="no pending body · committed content fills the pane"
                    label="Committed"
                    number="T-01"
                    stage="app"
                >
                    <div style={{ padding: "24px" }}>
                        <Stage />
                        <DimensionRule label="one complete keyed layer" />
                    </div>
                </Specimen>
                <Specimen
                    detail="slow threshold reached · one fallback covers the retained body"
                    label="Patient fallback"
                    number="T-02"
                    stage="app"
                >
                    <div style={{ padding: "24px" }}>
                        <Stage slow />
                        <DimensionRule label="quiet 800 · shown at least 500" />
                    </div>
                </Specimen>
            </div>
        </ComponentPage>
    );
}
