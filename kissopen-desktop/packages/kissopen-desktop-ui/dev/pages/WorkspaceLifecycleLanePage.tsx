import { type ReactNode } from "react";
import { WorkspaceLifecycleLane } from "../../src/WorkspaceLifecycleLane";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-242";
/*
 * The lane's whole contract is that it is there in every phase, so the specimens
 * show it in a column with the work it sits above: the ready one is the proof
 * that the row occupies nothing and shows nothing while still being in the
 * document, which is what keeps that work from being rebuilt when the phase
 * changes.
 */
const FETCH_FAILURE = [
    "fatal: could not read from remote repository 'origin'",
    "Please make sure you have the correct access rights and the repository exists.",
].join("\n");
const PATH = "/Users/steve/KISSOPEN/Workspaces/kissopen/fix-login-redirect";
/** A stand-in for the tab strip and transcript the lane is mounted above. */
function column(children: ReactNode) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                width: "620px",
                border: "1px solid var(--divider)",
                borderRadius: "var(--kissopen-radius-md)",
                background: "var(--surface)",
            }}
        >
            {children}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    height: "96px",
                    padding: "0 12px",
                    borderTop: "1px solid var(--divider)",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--kissopen-font-ui)",
                    fontSize: "13px",
                }}
            >
                The work this lane sits above
            </div>
        </div>
    );
}
export function WorkspaceLifecycleLanePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The fixed row a workspace's phase is stated in, above the work it is about. Rendered in every phase — empty and occupying nothing while the workspace is ready — so a phase change never moves, replaces, or rebuilds the tab strip, transcript, or composer below it."
            title="Workspace lifecycle lane"
        >
            <Specimen
                detail="no phase · the row is in the document and takes no space"
                label="Ready"
                number="01"
                stage="surface"
            >
                {column(<WorkspaceLifecycleLane name="Fix login redirect" />)}
            </Specimen>

            <Specimen
                detail='phase="creating" · spinner parked on one frame'
                label="Creating"
                number="02"
                stage="surface"
            >
                {column(
                    <WorkspaceLifecycleLane
                        name="Fix login redirect"
                        path={PATH}
                        phase="creating"
                        spinnerFrame={2}
                    />,
                )}
            </Specimen>

            <Specimen
                detail='phase="failed" · two-line host reason kept verbatim'
                label="Failed"
                number="03"
                stage="surface"
            >
                {column(
                    <WorkspaceLifecycleLane
                        detail={FETCH_FAILURE}
                        name="Fix login redirect"
                        path={PATH}
                        phase="failed"
                    />,
                )}
            </Specimen>

            <Specimen
                detail='phase="missing" · the directory that is no longer there'
                label="Missing"
                number="04"
                stage="surface"
            >
                {column(
                    <WorkspaceLifecycleLane
                        name="Fix login redirect"
                        path={PATH}
                        phase="missing"
                    />,
                )}
            </Specimen>

            <Specimen
                detail='phase="refused" · nothing was started, so no path is shown'
                label="Refused"
                number="05"
                stage="surface"
            >
                {column(
                    <WorkspaceLifecycleLane
                        detail="A workspace named “Fix login redirect” already exists in this project."
                        name="Fix login redirect"
                        phase="refused"
                    />,
                )}
            </Specimen>
        </ComponentPage>
    );
}
