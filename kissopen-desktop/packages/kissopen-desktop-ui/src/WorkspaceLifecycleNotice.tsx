import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { type CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";
/**
 * The phases a workspace can be in that are worth interrupting the reader for.
 *
 * `ready` is deliberately absent: a workspace that is prepared and present has
 * nothing to announce, and a component that could render "everything is fine"
 * would end up doing so on every screen that holds a workspace.
 *
 * - `creating` — the checkout is being prepared and cannot be worked in yet.
 * - `failed` — the host tried to prepare it and could not. Terminal.
 * - `refused` — the host declined the request outright, so the workspace was
 *   never made at all. Distinct from `failed`: nothing was started, and there is
 *   no checkout anywhere in any state.
 * - `missing` — the checkout was prepared and its directory is no longer there.
 */
export type WorkspaceLifecyclePhase = "creating" | "failed" | "refused" | "missing";
export type WorkspaceLifecycleNoticeSize = "panel" | "compact";
export type WorkspaceLifecycleNoticeProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    /** The workspace this is about, quoted in the notice so several read apart. */
    name: string;
    phase: WorkspaceLifecyclePhase;
    /**
     * The host's own sentence about what happened, when it gives one. A failure
     * the host reports without a reason still reads completely without it, so
     * this is never filled in with a guess.
     */
    detail?: string;
    /**
     * Where the checkout is or was going to be. Shown while it is being made —
     * so the reader can see the request landed somewhere real — and once it is
     * missing, since that is the directory that is no longer there.
     */
    path?: string;
    size?: WorkspaceLifecycleNoticeSize;
    /**
     * Freezes the `creating` spinner on one discrete frame, for a fixture or a
     * screenshot that has to photograph identically every time. Live surfaces
     * leave it out and the spinner runs.
     */
    spinnerFrame?: number;
};
type PhasePresentation = {
    /** The glyph, or a spinner when the phase is something still happening. */
    icon?: IconName;
    tone: "progress" | "danger" | "warning";
    title: (name: string) => string;
    body: string;
};
const presentations: Record<WorkspaceLifecyclePhase, PhasePresentation> = {
    creating: {
        tone: "progress",
        title: (name) => `Creating “${name}”`,
        body: t(
            "KissOpen Agent is preparing this workspace's checkout. Chats can be started and written into now; KissOpen Agent runs their work as soon as the checkout is there.",
        ),
    },
    failed: {
        icon: "alert",
        tone: "danger",
        title: (name) => t("“{name}” could not be created", { name }),
        body: t(
            "KissOpen Agent started preparing this workspace's checkout and stopped. Nothing further will happen to it.",
        ),
    },
    refused: {
        icon: "alert",
        tone: "danger",
        title: (name) => t("“{name}” was not created", { name }),
        body: t(
            "KissOpen Agent declined the request, so no checkout was started and there is nothing left of this workspace on the machine.",
        ),
    },
    missing: {
        icon: "unlink",
        tone: "warning",
        title: (name) => t("“{name}” is no longer on disk", { name }),
        body: t(
            "KissOpen Agent prepared this workspace's checkout and its directory is not there any more. It was removed outside KissOpen.",
        ),
    },
};
/**
 * C-241 WorkspaceLifecycleNotice — what one workspace's own phase is, said in
 * full: being prepared, failed, refused outright, or prepared and since gone.
 *
 * It is the one place that vocabulary is written down, so the screen a
 * workspace was opened at, the screen it was created from, and any detail view
 * of it all say the same thing in the same words. It states a fact and offers no
 * control: none of these phases is something the reader can act on from here —
 * a checkout being prepared finishes on its own, and a failed or refused one is
 * terminal — and a re-check control would only ask for what already arrives.
 *
 * `panel` fills and centers inside a content region; `compact` is a single
 * content-sized row for sitting above a composer or beside a title. Props only,
 * desktop-only: no timers, no store, no elapsed time.
 */
export function WorkspaceLifecycleNotice(props: WorkspaceLifecycleNoticeProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "detail",
        "name",
        "path",
        "phase",
        "size",
        "spinnerFrame",
        "style",
    ]);
    const size = () => local.size ?? "panel";
    const presentation = () => presentations[local.phase];
    // Danger interrupts assistive tech; a checkout being prepared and a
    // directory that has gone away are both announced politely.
    const role = () => (presentation().tone === "danger" ? "alert" : "status");
    const glyphSize = () => (size() === "panel" ? 20 : 14);
    return (
        <div
            className={["kissopen-workspace-lifecycle", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="workspace-lifecycle"
            data-phase={local.phase}
            data-size={size()}
            data-testid={local["data-testid"]}
            data-tone={presentation().tone}
            role={role()}
            style={local.style}
        >
            {/* The words below already say the phase, and this whole notice is
                one live region: a labelled spinner and a labelled glyph inside
                it would have assistive tech read the same news twice. */}
            <span
                aria-hidden="true"
                className="kissopen-workspace-lifecycle__media"
                data-kissopen-desktop-ui="workspace-lifecycle-media"
            >
                {presentation().icon === undefined ? (
                    <Spinner
                        {...(local.spinnerFrame === undefined ? {} : { frame: local.spinnerFrame })}
                        size={glyphSize()}
                    />
                ) : (
                    <Icon name={presentation().icon!} size={glyphSize()} />
                )}
            </span>
            <div
                className="kissopen-workspace-lifecycle__content"
                data-kissopen-desktop-ui="workspace-lifecycle-content"
            >
                <span
                    className="kissopen-workspace-lifecycle__title"
                    data-kissopen-desktop-ui="workspace-lifecycle-title"
                >
                    {presentation().title(local.name)}
                </span>
                <span
                    className="kissopen-workspace-lifecycle__body"
                    data-kissopen-desktop-ui="workspace-lifecycle-body"
                >
                    {presentation().body}
                </span>
                {local.detail === undefined ? null : (
                    <span
                        className="kissopen-workspace-lifecycle__detail"
                        data-kissopen-desktop-ui="workspace-lifecycle-detail"
                    >
                        {local.detail}
                    </span>
                )}
                {local.path === undefined ? null : (
                    <span
                        className="kissopen-workspace-lifecycle__path"
                        data-kissopen-desktop-ui="workspace-lifecycle-path"
                    >
                        {local.path}
                    </span>
                )}
            </div>
        </div>
    );
}
