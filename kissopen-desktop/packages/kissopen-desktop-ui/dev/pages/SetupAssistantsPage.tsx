import { SetupAssistants } from "../../src/SetupAssistants";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-270";

const inventory = [
    {
        detail: "/opt/homebrew/bin/claude",
        detailKind: "path",
        id: "claude",
        mark: "claude",
        name: "Claude Code",
        status: "found",
    },
    {
        detail: "/Users/steve/.local/bin/codex",
        detailKind: "path",
        id: "codex",
        mark: "openai",
        name: "Codex",
        status: "found",
    },
    {
        detail: "Not installed",
        id: "grok",
        mark: "grok",
        name: "Grok",
        status: "missing",
    },
] as const;

const signIn = [
    {
        detail: "Run claude to sign in",
        id: "claude",
        mark: "claude",
        name: "Claude Code",
        status: "signed-out",
    },
    {
        detail: "Not installed",
        id: "codex",
        mark: "openai",
        name: "Codex",
        status: "missing",
    },
    {
        detail: "Not installed",
        id: "grok",
        mark: "grok",
        name: "Grok",
        status: "missing",
    },
] as const;

export function SetupAssistantsPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="What setup found on this machine, as three columns and nothing around them: the product's own mark, its name, and where it is — or that it is not here. No cards, no tiles, no badges; status is carried by emphasis, and only the case that asks for an action says so in words."
            title="Setup assistants"
        >
            <Specimen
                detail="After an install: two found with the path the login shell gave, one absent and dimmed"
                label="The inventory"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ width: "480px" }}>
                        <SetupAssistants assistants={inventory} />
                    </div>
                    <DimensionRule label="480 measure · 16 gap · columns 1 1 0 · 22 mark" />
                </div>
            </Specimen>

            <Specimen
                detail="Under KISSOPEN Agent's refusal: a found command becomes the one instruction on the screen"
                label="Nothing signed in"
                number="02"
                stage="surface"
            >
                <div style={{ width: "480px" }}>
                    <SetupAssistants assistants={signIn} />
                </div>
            </Specimen>

            <Specimen
                detail="A machine with none of them: three dimmed columns, and no badge claiming otherwise"
                label="Empty machine"
                number="03"
                stage="surface"
            >
                <div style={{ width: "480px" }}>
                    <SetupAssistants
                        assistants={inventory.map((assistant) => ({
                            detail: "Not installed",
                            id: assistant.id,
                            mark: assistant.mark,
                            name: assistant.name,
                            status: "missing" as const,
                        }))}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="Columns are equal thirds of whatever they are given, and a path breaks at its separators"
                label="Narrow"
                number="04"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ width: "360px" }}>
                        <SetupAssistants assistants={inventory} />
                    </div>
                    <DimensionRule label="360 measure · path wraps after a slash · marks stay on one line" />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
