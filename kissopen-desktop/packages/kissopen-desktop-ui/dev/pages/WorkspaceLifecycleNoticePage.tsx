import { type ReactNode } from "react";
import { WorkspaceLifecycleNotice } from "../../src/WorkspaceLifecycleNotice";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-241";
/*
 * Every reason string here is a real shape of git failure, written out rather
 * than summarised, so the specimens show what the block does when the host's
 * own sentence runs to several lines. Nothing here is time-dependent: the
 * `creating` spinner is parked on one frame so the page photographs identically.
 */
const FETCH_FAILURE = [
    "fatal: could not read from remote repository 'origin'",
    "Please make sure you have the correct access rights and the repository exists.",
].join("\n");
const REFUSAL = "A workspace named “Fix login redirect” already exists in this project.";
/** The panel size fills its host, so a specimen gives it a real content region. */
function region(children: ReactNode) {
    return (
        <div
            style={{
                display: "flex",
                width: "720px",
                height: "300px",
                border: "1px solid var(--divider)",
                borderRadius: "var(--kissopen-radius-md)",
                background: "var(--surface)",
            }}
        >
            {children}
        </div>
    );
}
function strip(children: ReactNode) {
    return (
        <div style={{ display: "flex", flexDirection: "column", width: "520px" }}>{children}</div>
    );
}
export function WorkspaceLifecycleNoticePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="One workspace's own phase, said in full: being prepared, failed, refused outright, or prepared and since gone. Panel fills a content region; compact is a strip for above a composer. Props only — no timers, no elapsed time, no re-check control."
            title="Workspace lifecycle notice"
        >
            <Specimen
                detail='phase="creating" · panel · 720×300 region · spinner parked on one frame'
                label="Creating"
                number="01"
                stage="app"
            >
                {region(
                    <WorkspaceLifecycleNotice
                        name="Fix login redirect"
                        path="/Users/steve/Kissopen/Workspaces/kissopen/fix-login-redirect"
                        phase="creating"
                        spinnerFrame={2}
                    />,
                )}
            </Specimen>

            <Specimen
                detail='phase="creating" · panel · no path yet, which is what the first moments after the request look like'
                label="Creating, before the checkout has a place"
                number="02"
                stage="app"
            >
                {region(
                    <WorkspaceLifecycleNotice name="Workspace" phase="creating" spinnerFrame={5} />,
                )}
            </Specimen>

            <Specimen
                detail='phase="failed" · panel · two-line host reason kept verbatim'
                label="Failed, with the host's reason"
                number="03"
                stage="app"
            >
                {region(
                    <WorkspaceLifecycleNotice
                        detail={FETCH_FAILURE}
                        name="Fix login redirect"
                        path="/Users/steve/KISSOPEN/Workspaces/kissopen/fix-login-redirect"
                        phase="failed"
                    />,
                )}
            </Specimen>

            <Specimen
                detail='phase="failed" · panel · the host reported a failure without a sentence about it'
                label="Failed, with no reason given"
                number="04"
                stage="app"
            >
                {region(<WorkspaceLifecycleNotice name="Fix login redirect" phase="failed" />)}
            </Specimen>

            <Specimen
                detail='phase="refused" · panel · nothing was started, so no path is shown'
                label="Refused"
                number="05"
                stage="app"
            >
                {region(
                    <WorkspaceLifecycleNotice
                        detail={REFUSAL}
                        name="Fix login redirect"
                        phase="refused"
                    />,
                )}
            </Specimen>

            <Specimen
                detail='phase="missing" · panel · the directory that is no longer there'
                label="Missing"
                number="06"
                stage="app"
            >
                {region(
                    <WorkspaceLifecycleNotice
                        name="Fix login redirect"
                        path="/Users/steve/KISSOPEN/Workspaces/kissopen/fix-login-redirect"
                        phase="missing"
                    />,
                )}
            </Specimen>

            <Specimen
                detail='size="compact" · 520px lane · every phase, stacked, as they sit above a composer'
                label="Compact strip, every phase"
                number="07"
                stage="surface"
            >
                {strip(
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <WorkspaceLifecycleNotice
                            name="Fix login redirect"
                            phase="creating"
                            size="compact"
                            spinnerFrame={2}
                        />
                        <WorkspaceLifecycleNotice
                            detail={FETCH_FAILURE}
                            name="Fix login redirect"
                            phase="failed"
                            size="compact"
                        />
                        <WorkspaceLifecycleNotice
                            detail={REFUSAL}
                            name="Fix login redirect"
                            phase="refused"
                            size="compact"
                        />
                        <WorkspaceLifecycleNotice
                            name="Fix login redirect"
                            path="/Users/steve/KISSOPEN/Workspaces/kissopen/fix-login-redirect"
                            phase="missing"
                            size="compact"
                        />
                    </div>,
                )}
            </Specimen>

            <Specimen
                detail='size="compact" · a name long enough to wrap, beside a reason long enough to wrap'
                label="Compact, long content"
                number="08"
                stage="surface"
            >
                {strip(
                    <WorkspaceLifecycleNotice
                        detail={FETCH_FAILURE}
                        name="Rewrite the session catalogue so worktrees reconcile from the stream"
                        path="/Users/steve/KISSOPEN/Workspaces/kissopen/rewrite-the-session-catalogue-so-worktrees-reconcile"
                        phase="failed"
                        size="compact"
                    />,
                )}
            </Specimen>
        </ComponentPage>
    );
}
