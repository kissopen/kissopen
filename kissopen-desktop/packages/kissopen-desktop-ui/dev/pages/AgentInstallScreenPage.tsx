import { AgentInstallScreen } from "../../src/AgentInstallScreen";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-268";

const noop = () => undefined;

/** The restart owns the window, so every specimen gets a window-shaped frame. */
const frame = {
    border: "1px solid var(--border)",
    borderRadius: "10px",
    height: "460px",
    overflow: "hidden",
    position: "relative" as const,
    width: "100%",
};

export function AgentInstallScreenPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Taking the machine's KISSOPEN Agent down and bringing it back, as the one thing the window is doing — for a new version or for the version already running. Every state is the same SetupPage frame, held still: the mark relaying for the whole restart, two lines reserved for the copy, a three-segment bar, two rows reserved for the drain chips, and a button row reserved whether or not a button is in it, so a step advancing rewrites the words and moves nothing. The bar names the three parts of a restart — work finishing, the agent going away, something coming back — and only the drain fills in proportion, against the most work it was holding, because it is the only step the daemon puts a number on. There is no success state — the restart finishing is this screen ending."
            title="Agent install screen"
        >
            <Specimen
                detail="Drain asked for, nothing reported back yet"
                label="Draining · opening"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <AgentInstallScreen
                            onDismiss={noop}
                            onKill={noop}
                            view={{
                                killable: false,
                                kind: "draining",
                                reason: "install",
                                version: "0.4.2",
                                waitingFor: [],
                                waitingPeak: 0,
                            }}
                        />
                    </div>
                    <DimensionRule label="No chips, and no share to fill: the drain segment sweeps" />
                </div>
            </Specimen>

            <Specimen
                detail="Three of the five operations the drain was holding are still open"
                label="Draining · agents"
                number="02"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <AgentInstallScreen
                            onDismiss={noop}
                            onKill={noop}
                            view={{
                                killable: false,
                                kind: "draining",
                                reason: "install",
                                version: "0.4.2",
                                waitingFor: [
                                    {
                                        agents: [
                                            { id: "a1", stage: "inference" },
                                            { id: "a2", stage: "tools" },
                                            { id: "a3", stage: "compaction" },
                                        ],
                                        count: 3,
                                        name: "agents",
                                    },
                                ],
                                waitingPeak: 5,
                            }}
                        />
                    </div>
                    <DimensionRule label="Chips wrap · 420 max · 6 gap · drain segment at 2/5" />
                </div>
            </Specimen>

            <Specimen
                detail="Ten seconds in · the wait is now worth offering a way out of"
                label="Draining · killable"
                number="03"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <AgentInstallScreen
                            onDismiss={noop}
                            onKill={noop}
                            view={{
                                killable: true,
                                kind: "draining",
                                reason: "install",
                                version: "0.4.2",
                                waitingFor: [
                                    {
                                        agents: [
                                            { id: "a1", stage: "inference" },
                                            { id: "a2", stage: "settlement" },
                                        ],
                                        count: 2,
                                        name: "agents",
                                        truncated: true,
                                    },
                                ],
                                waitingPeak: 9,
                            }}
                        />
                    </div>
                    <DimensionRule label="The way out appears only once the drain says it may" />
                </div>
            </Specimen>

            <Specimen
                detail="Open work the daemon does not attribute to an agent"
                label="Draining · operations"
                number="04"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <AgentInstallScreen
                            onDismiss={noop}
                            onKill={noop}
                            view={{
                                killable: false,
                                kind: "draining",
                                reason: "install",
                                version: "0.4.2",
                                waitingFor: [{ count: 4, name: "storage" }],
                                waitingPeak: 6,
                            }}
                        />
                    </div>
                    <DimensionRule label="Counts only · no chips without agents" />
                </div>
            </Specimen>

            <Specimen
                detail="Drained on its own, so the agent is being closed down"
                label="Stopping"
                number="05"
                stage="surface"
            >
                <div style={frame}>
                    <AgentInstallScreen
                        onDismiss={noop}
                        onKill={noop}
                        view={{
                            killed: false,
                            kind: "stopping",
                            reason: "install",
                            version: "0.4.2",
                        }}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="Killed · the copy says work was cut off rather than finished"
                label="Stopping · killed"
                number="06"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <AgentInstallScreen
                            onDismiss={noop}
                            onKill={noop}
                            view={{
                                killed: true,
                                kind: "stopping",
                                reason: "install",
                                version: "0.4.2",
                            }}
                        />
                    </div>
                    <DimensionRule label="Never claims the work finished" />
                </div>
            </Specimen>

            <Specimen
                detail="The new binary is coming up"
                label="Starting · install"
                number="07"
                stage="surface"
            >
                <div style={frame}>
                    <AgentInstallScreen
                        onDismiss={noop}
                        onKill={noop}
                        view={{ kind: "starting", reason: "install", version: "0.4.2" }}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="The agent answers; this window is catching up to it"
                label="Reconnecting"
                number="08"
                stage="surface"
            >
                <div style={frame}>
                    <AgentInstallScreen
                        onDismiss={noop}
                        onKill={noop}
                        view={{ kind: "reconnecting", reason: "install", version: "0.4.2" }}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="Failed · the reason verbatim, and the window handed back"
                label="Error · install"
                number="09"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <AgentInstallScreen
                            onDismiss={noop}
                            onKill={noop}
                            view={{
                                failedAt: "stopping",
                                kind: "error",
                                message: "KISSOPEN Agent accepted the shutdown but did not exit.",
                                reason: "install",
                                version: "0.4.2",
                            }}
                        />
                    </div>
                    <DimensionRule label="The old agent keeps running · nothing is lost" />
                </div>
            </Specimen>

            <Specimen
                detail="The same sequence for a plain restart · only the words differ"
                label="Restart · starting"
                number="10"
                stage="surface"
            >
                <div style={frame}>
                    <AgentInstallScreen
                        onDismiss={noop}
                        onKill={noop}
                        view={{ kind: "starting", reason: "restart", version: "0.4.2" }}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="A restart that failed says so in its own words"
                label="Restart · error"
                number="11"
                stage="surface"
            >
                <div style={frame}>
                    <AgentInstallScreen
                        onDismiss={noop}
                        onKill={noop}
                        view={{
                            failedAt: "starting",
                            kind: "error",
                            message: "The new KISSOPEN Agent did not answer after starting.",
                            reason: "restart",
                            version: "0.4.2",
                        }}
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
