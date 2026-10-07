import { StatusPicker } from "../../src/StatusPicker";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-034";

export function StatusPickerPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Availability segmented control (automatic/online/away/dnd, each with a status-dot color) plus a custom status editor: emoji slot, text field, and expiry."
            title="Status picker"
        >
            <div className="specimen-grid">
                <Specimen
                    detail="380px card · 16px section rhythm · availability + custom status"
                    label="Default"
                    number="SP-01"
                    stage="app"
                >
                    <div style={{ display: "grid", gap: "8px" }}>
                        <div style={{ width: "380px" }}>
                            <DimensionRule label="width 380" />
                        </div>
                        <StatusPicker
                            availability="online"
                            expiresLabel="Clears in 1 hour"
                            onClearStatus={() => {}}
                            statusEmoji="🎧"
                            statusText="Focusing — heads-down"
                        />
                    </div>
                </Specimen>
            </div>

            <div className="specimen-grid">
                <Specimen
                    detail="dot colors — auto muted · online mint · away amber · dnd danger"
                    label="Availability states"
                    number="SP-02"
                    stage="surface"
                >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                        <StatusPicker availability="automatic" />
                        <StatusPicker availability="online" statusEmoji="💬" statusText="Around" />
                        <StatusPicker
                            availability="away"
                            expiresLabel="Clears when I'm back"
                            statusEmoji="🌴"
                            statusText="On a walk"
                        />
                        <StatusPicker
                            availability="dnd"
                            expiresLabel="Clears in 30 minutes"
                            onClearStatus={() => {}}
                            statusEmoji="🔕"
                            statusText="In deep work"
                        />
                    </div>
                </Specimen>
            </div>

            <div className="specimen-grid">
                <Specimen
                    detail="no emoji → smile placeholder · empty input · no clear · no expiry"
                    label="Empty status"
                    number="SP-03"
                    stage="surface"
                >
                    <StatusPicker availability="automatic" />
                </Specimen>
            </div>
        </ComponentPage>
    );
}
