import { partitionComponentProps } from "./componentProps";
import { type CSSProperties } from "react";
import { WorkspaceLifecycleNotice, type WorkspaceLifecyclePhase } from "./WorkspaceLifecycleNotice";

export type WorkspaceLifecycleLaneProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    /** The workspace this lane is about, quoted in the notice it shows. */
    name: string;
    /**
     * The phase to announce, or absent while the workspace is ready and has
     * nothing to say. The lane itself is rendered either way; only its contents
     * come and go.
     */
    phase?: WorkspaceLifecyclePhase;
    /** The host's own sentence about what happened, when it gives one. */
    detail?: string;
    /** Where the checkout is or was going to be. */
    path?: string;
    /** Freezes the `creating` spinner on one frame, for a screenshot fixture. */
    spinnerFrame?: number;
};

/**
 * C-242 WorkspaceLifecycleLane — the fixed place a workspace's phase is stated
 * above the work it is about, and the reason that work survives the statement.
 *
 * The lane is always rendered, whether or not there is anything to say. That is
 * its whole purpose: a notice that appeared and disappeared as a sibling of the
 * tab strip would move every element after it, and the strip, the transcript,
 * the composer, the reader's focus, their selection, their scroll position, and
 * any menu they had open would be rebuilt each time the workspace changed phase
 * — while the phase change is precisely the moment they most need to stay put.
 * Occupying the row unconditionally and hiding only its contents keeps every one
 * of those alive across `ready`, `creating`, `failed`, and `missing`.
 *
 * It is the layout half of `WorkspaceLifecycleNotice` and owns that layout here,
 * so an application supplies the phase and nothing about how the row is spaced.
 */
export function WorkspaceLifecycleLane(props: WorkspaceLifecycleLaneProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "detail",
        "name",
        "path",
        "phase",
        "spinnerFrame",
        "style",
    ]);
    const phase = () => local.phase;
    return (
        <div
            className={["kissopen-workspace-lifecycle-lane", local.className]
                .filter(Boolean)
                .join(" ")}
            data-kissopen-desktop-ui="workspace-lifecycle-lane"
            data-empty={phase() === undefined ? "" : undefined}
            data-testid={local["data-testid"]}
            style={local.style}
        >
            {phase() === undefined ? null : (
                <WorkspaceLifecycleNotice
                    {...(local.detail === undefined ? {} : { detail: local.detail })}
                    name={local.name}
                    {...(local.path === undefined ? {} : { path: local.path })}
                    phase={phase()!}
                    size="compact"
                    {...(local.spinnerFrame === undefined
                        ? {}
                        : { spinnerFrame: local.spinnerFrame })}
                />
            )}
        </div>
    );
}
