import { SetupChoice } from "../../src/SetupChoice";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-251";

const noop = () => undefined;

const setupOptions = [
    {
        actionLabel: "Stay in the app",
        description:
            "Everything happens in this window. Nothing is added to your machine, and you can install the tools whenever you want them.",
        id: "app",
        scene: "sparkles",
        title: "Just the app",
    },
    {
        actionLabel: "Install the CLI",
        actionVariant: "primary",
        description:
            "KISSOPEN Agent is a coding agent you run from a terminal, always in sync with this app — start work in one and pick it up in the other, or on your phone. Uses the Node v22.11.0 already here.",
        id: "kissopen-agent",
        scene: "robot",
        title: "Install CLI tools",
    },
] as const;

export function SetupChoicePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A fork in setup drawn as its two answers: equal side-by-side columns of animation, words, and then the button that takes that way. Unequal copy cannot make one side the bigger offer, and both buttons land on the same line."
            title="Setup choice"
        >
            <Specimen
                detail="Two equal columns · 88px scene · words · the button that picks it"
                label="The fork"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ width: "720px" }}>
                        <SetupChoice onSelect={noop} options={setupOptions} />
                    </div>
                    <DimensionRule label="720 measure · 16 gap · columns 1 1 0" />
                </div>
            </Specimen>

            <Specimen
                detail="Lopsided copy: the description absorbs the difference, so both buttons stay on one line"
                label="Unequal copy"
                number="02"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ width: "720px" }}>
                        <SetupChoice
                            onSelect={noop}
                            options={[
                                {
                                    actionLabel: "Stay in the app",
                                    description: "Start now.",
                                    id: "short",
                                    scene: "sparkles",
                                    title: "Just the app",
                                },
                                {
                                    actionLabel: "Install the CLI",
                                    description:
                                        "Installs a command line tool and a background service on this machine, so agents keep running once the window is closed, survive a restart, and can be reached from a terminal or another machine you have paired.",
                                    id: "long",
                                    scene: "robot",
                                    title: "Install CLI tools",
                                },
                            ]}
                        />
                    </div>
                    <DimensionRule label="Equal heights · description flexes · buttons aligned" />
                </div>
            </Specimen>

            <Specimen
                detail="A narrow window keeps both columns on one line and wraps their words instead"
                label="Narrow"
                number="03"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ width: "460px" }}>
                        <SetupChoice onSelect={noop} options={setupOptions} />
                    </div>
                    <DimensionRule label="460 measure · min-width 0 keeps them equal" />
                </div>
            </Specimen>
            <Specimen
                detail="The available path stays usable while another choice is being prepared"
                label="One available choice"
                number="04"
                stage="surface"
            >
                <div style={{ width: "460px" }}>
                    <SetupChoice onSelect={noop} options={[setupOptions[0]]} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
