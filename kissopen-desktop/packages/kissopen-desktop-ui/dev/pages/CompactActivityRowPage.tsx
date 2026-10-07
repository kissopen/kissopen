import { CompactActivityRow } from "../../src/CompactActivityRow";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

export const componentNumber = "C-265";

const noop = () => undefined;

export function CompactActivityRowPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The shared two-line activity grammar used by goals, tasks, and terminals in the KISSOPEN Agent activity panel."
            title="CompactActivityRow"
        >
            <Specimen
                detail="read-only activity facts keep the transcript Agent row's glyph, title, and metadata alignment"
                label="Read-only"
                number="01"
                stage="surface"
            >
                <div style={{ width: "520px" }}>
                    <CompactActivityRow
                        accessibleLabel="Task Ship the usage panel, done"
                        arguments={["Ship the usage panel"]}
                        icon="tasks"
                        meta={["Done"]}
                        placement="panel"
                        verb="Task"
                    />
                </div>
            </Specimen>

            <Specimen
                detail="preparing work uses the same compact spinner slot without changing row geometry"
                label="Preparing"
                number="02"
                stage="surface"
            >
                <div style={{ width: "520px" }}>
                    <CompactActivityRow
                        accessibleLabel="Goal is preparing"
                        arguments={["Reconcile live activity"]}
                        icon="tasks"
                        meta={["preparing"]}
                        placement="panel"
                        preparing
                        spinnerFrame={2}
                        verb="Goal"
                    />
                </div>
            </Specimen>

            <Specimen
                detail="a row can carry a focused action while keeping the trailing control outside the text measure"
                label="Action"
                number="03"
                stage="surface"
            >
                <div style={{ width: "520px" }}>
                    <CompactActivityRow
                        accessibleLabel="Terminal sleep 120, running"
                        arguments={["sleep 120"]}
                        icon="terminal"
                        meta={["running", "/workspace"]}
                        onClick={noop}
                        placement="panel"
                        verb="Terminal"
                    />
                    <DimensionRule label="44 px row · 8 px panel inset · 14 px glyph lane" />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
