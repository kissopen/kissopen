import { t } from "kissopen-desktop-state";
import type { CSSProperties } from "react";
import { Avatar } from "./Avatar";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { CopyButton } from "./CopyButton";
import { Modal } from "./Modal";
import { ModalOverlay } from "./ModalOverlay";
import { SegmentedControl } from "./SegmentedControl";
import { Select } from "./Select";
import { Switch } from "./Switch";
import { TextField } from "./TextField";

/** The three things a project can say about where the sessions started in it run. */
export type KissopenAgentProjectComputeMode = "default" | "local" | "docker";

/** When the project's board is built on its own. */
export type KissopenAgentProjectBoardTiming = {
    readonly recurrence: "daily" | "weekdays" | "weekly";
    /** Minutes past local midnight. */
    readonly atMinute: number;
    /** 0-6, Sunday first; weekly only. */
    readonly weekday: number;
};

/** Building the project's board on a schedule, as the account holds it. */
export type KissopenAgentProjectBoardSection = {
    readonly enabled: boolean;
    /** What is set, or what turning it on will set. */
    readonly timing: KissopenAgentProjectBoardTiming;
    readonly saving: boolean;
    readonly error?: string;
    /** Why it cannot be set from here, e.g. this computer has not paired. */
    readonly unavailable?: string;
};

/** What the host holds for a project: the machine itself, or a container built from an image. */
export type KissopenAgentProjectComputeChoice =
    | { type: "local" }
    | { type: "docker"; image: string };

/**
 * Where sessions started in this project run, as the settings dialog shows it.
 *
 * The host's own answer (`current`) and the choice being made (`mode`, `image`)
 * are separate on purpose: until the two agree, the reader is looking at a
 * decision they have not committed, and the section says so rather than
 * presenting an edit as a fact.
 */
export type KissopenAgentProjectComputeSection = {
    /**
     * Whether the host's answer is in hand. Nothing states what the project is
     * set to until it is `ready`; `error` means it could not be read, and
     * `readError` says why.
     */
    status: "loading" | "ready" | "error";
    /** What the host holds. Absent means the project states nothing and the machine decides. */
    current?: KissopenAgentProjectComputeChoice;
    /** The choice being made. */
    mode: KissopenAgentProjectComputeMode;
    /** The Docker image being written, kept while another option is being looked at. */
    image: string;
    /** True while the host is being told; the whole dialog stays up and inert. */
    submitting?: boolean;
    /** Why the last attempt did not save, in the reader's words. */
    error?: string;
    /** Why the setting could not be read, when `status` is `error`. */
    readError?: string;
};

export type KissopenAgentProjectSettingsDialogProps = {
    /** What the project is called now — the name the host has, not the draft. */
    name: string;
    /** The name being edited. The caller owns it, so an in-flight edit survives the row list being republished underneath. */
    draft: string;
    /**
     * Presentation path of the project root, home-relative where the host said
     * so, with the canonical absolute path the clipboard gets. Absent when the
     * caller has lost sight of the project — the checkout was archived from
     * somewhere else while this was open — and the location block is then left
     * out rather than guessed at.
     */
    location?: {
        displayPath: string;
        path: string;
    };
    /** The picture the daemon derived from the repository, when it has one. */
    imageUrl?: string;
    /** How many worktrees the project holds, and how many sessions live under it, its worktrees' included. Absent with `location`. */
    contents?: {
        worktrees: number;
        sessions: number;
    };
    /** True while the host is being told; the dialog stays up and inert. */
    submitting?: boolean;
    /** Why the current local drafts cannot be committed to the Kissopen Agent. */
    submitDisabledReason?: string;
    /**
     * Where sessions started in this project run. Absent leaves the section out
     * entirely — a worktree has no compute of its own, and a caller that has lost
     * sight of the project has nothing truthful to put here.
     */
    compute?: KissopenAgentProjectComputeSection;
    /** The reader chose a different place for sessions to run. Nothing is saved here. */
    onComputeModeChange?: (mode: KissopenAgentProjectComputeMode) => void;
    /** The reader edited the Docker image. */
    onComputeImageChange?: (image: string) => void;
    /** The reader committed the choice. */
    onComputeSubmit?: () => void;
    /** Building the project's board on a schedule. Absent leaves the section out. */
    board?: KissopenAgentProjectBoardSection;
    /** Turns the scheduled build on with this timing, changes it, or off (undefined). */
    onBoardChange?: (timing: KissopenAgentProjectBoardTiming | undefined) => void;
    /**
     * Archiving this project, when the caller offers it. Absent leaves the
     * section out entirely — a project the caller has lost sight of has nothing
     * left to archive.
     */
    archive?: {
        /** True once the reader has asked, and the confirmation is what they are looking at. */
        confirming?: boolean;
        /** True while the host is being told; everything in the dialog goes inert. */
        submitting?: boolean;
        /** Why the last attempt did not archive it, in the reader's words. */
        error?: string;
    };
    /** The reader asked to archive; the caller answers by confirming. Nothing is archived here. */
    onArchiveRequest?: () => void;
    /** The reader went through with it. */
    onArchiveConfirm?: () => void;
    /** The reader kept the project. */
    onArchiveCancel?: () => void;
    onDraftChange: (draft: string) => void;
    onSubmit: () => void;
    onClose: () => void;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
};

/** "2 workspaces · 7 sessions", with the singular where it belongs and nothing where there is nothing. */
function contentsSummary(contents: { worktrees: number; sessions: number }): string {
    const parts = [
        contents.worktrees > 0
            ? contents.worktrees === 1
                ? t("1 workspace")
                : t("{count} workspaces", { count: contents.worktrees })
            : undefined,
        contents.sessions > 0
            ? contents.sessions === 1
                ? t("1 session")
                : t("{count} sessions", { count: contents.sessions })
            : undefined,
    ].filter((part) => part !== undefined);
    return parts.length > 0 ? parts.join(" · ") : t("No sessions yet");
}

/** The choice the controls currently express, as a value that can be compared. */
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function computeKeyOf(compute: KissopenAgentProjectComputeChoice | undefined): string {
    return compute === undefined
        ? "default"
        : compute.type === "local"
          ? "local"
          : `docker:${compute.image}`;
}

function computeDraftKeyOf(compute: KissopenAgentProjectComputeSection): string {
    return compute.mode === "default"
        ? "default"
        : compute.mode === "local"
          ? "local"
          : `docker:${compute.image.trim()}`;
}

/**
 * What each choice actually does, in the terms the reader is deciding in. The
 * default is not "runs on this machine": it is the project declining to say,
 * which leaves whatever the machine is set up to do in charge — and that may
 * well be a container.
 */
const computeEffect: Record<KissopenAgentProjectComputeMode, string> = {
    default:
        "The project says nothing, so this machine decides. If it is set up to run agents in a container, new sessions here run in one; otherwise they run on the machine itself.",
    local: "New sessions run directly on this machine, with the checkout in place — even when this machine is set up to use a container.",
    docker: "New sessions run inside a container built from this image, with the project's checkout mounted in it. The image must already be available to this machine.",
};

/** What the host holds now, said plainly. */
function computeCurrentLabel(compute: KissopenAgentProjectComputeChoice | undefined): string {
    if (compute === undefined) return "This machine's own setting";
    return compute.type === "local" ? "This machine, directly" : compute.image;
}

/**
 * C-178 KissopenAgentProjectSettingsDialog — what one project of the local workspace is,
 * and the one thing about it the reader sets.
 *
 * The identity strip answers "which project is this" before anything is
 * editable: the picture the daemon derived, the name the host has, and what is
 * filed under it. Below that is the name — the only project field the daemon
 * accepts a new value for — and then the location, read-only because the
 * checkout is where it is, with a copy for the terminal the reader is about to
 * open there. Last is archiving, which is where a project ends: it is the one
 * act here that removes something, so it sits below everything the reader came
 * to look at, and it asks before it does anything. The question names the
 * project and says what leaves with it, because "Archive" alone does not tell
 * anyone whether their code is about to be deleted.
 *
 * Props only. The draft lives with the caller so the dialog is a pure function
 * of what it is given, and `submitting` is the host being told — the field and
 * the commit go inert together rather than one of them lying about it.
 */
export function KissopenAgentProjectSettingsDialog(props: KissopenAgentProjectSettingsDialogProps) {
    const archiving = props.archive?.submitting === true;
    const confirming = props.archive?.confirming === true;
    const computing = props.compute?.submitting === true;
    // One request is in flight and there is nothing to type into or commit while
    // it lands: the whole dialog answers for it rather than one block alone.
    const submitting = props.submitting === true || archiving || computing;
    // A blank name is not a name; anything else commits, and a draft equal to
    // the current name simply closes, which is what the host is told to do with it.
    const committable = props.draft.trim().length > 0;
    return (
        // Dismissal stops only while the project is being archived: that request
        // cannot be recalled, and a dialog that vanished off a stray backdrop
        // click mid-archive would leave the reader guessing.
        <ModalOverlay
            onDismiss={() => {
                if (!archiving) props.onClose();
            }}
        >
            <Modal
                className={props.className}
                data-testid={props["data-testid"]}
                footer={
                    <>
                        {/* Not disabled while saving: the close in the header and
                            the backdrop both still dismiss, and a Cancel that
                            went inert beside them would be the odd one out. */}
                        <Button
                            disabled={archiving}
                            onClick={() => props.onClose()}
                            variant="ghost"
                        >
                            {t("Cancel")}
                        </Button>
                        <Button
                            disabled={
                                submitting ||
                                !committable ||
                                props.submitDisabledReason !== undefined
                            }
                            onClick={() => props.onSubmit()}
                            title={props.submitDisabledReason}
                            variant="primary"
                        >
                            {props.submitting === true ? "Saving…" : "Save"}
                        </Button>
                    </>
                }
                icon="settings"
                onClose={archiving ? undefined : () => props.onClose()}
                size="medium"
                style={props.style}
                title={t("Project settings")}
            >
                <div
                    className="kissopen-agent-project-settings"
                    data-kissopen-desktop-ui="kissopen-agent-project-settings"
                >
                    {props.submitDisabledReason ? (
                        <Banner tone="neutral" title={t("KissOpen Agent reconnecting")}>
                            {props.submitDisabledReason}
                        </Banner>
                    ) : null}
                    <div
                        className="kissopen-agent-project-settings__identity"
                        data-kissopen-desktop-ui="kissopen-agent-project-settings-identity"
                    >
                        <Avatar
                            imageUrl={props.imageUrl}
                            initials={props.name.slice(0, 1).toUpperCase()}
                            size="md"
                            type="agent"
                        />
                        <div className="kissopen-agent-project-settings__identity-text">
                            <span className="kissopen-agent-project-settings__identity-name">
                                {props.name}
                            </span>
                            {props.contents ? (
                                <span className="kissopen-agent-project-settings__identity-meta">
                                    {contentsSummary(props.contents)}
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <TextField
                        disabled={submitting}
                        fullWidth
                        hint={t("What this project is called in the sidebar and the tab strip.")}
                        label={t("Name")}
                        onSubmit={() => {
                            if (committable) props.onSubmit();
                        }}
                        onValueChange={(value) => props.onDraftChange(value)}
                        value={props.draft}
                    />
                    {props.location
                        ? ((location) => (
                              <div
                                  className="kissopen-agent-project-settings__field"
                                  data-kissopen-desktop-ui="kissopen-agent-project-settings-location"
                              >
                                  <span className="kissopen-agent-project-settings__label">
                                      {t("Location")}
                                  </span>
                                  <div className="kissopen-agent-project-settings__path">
                                      <span
                                          className="kissopen-agent-project-settings__path-text"
                                          title={location.path}
                                      >
                                          {location.displayPath}
                                      </span>
                                      <CopyButton
                                          label={t("Copy project path")}
                                          text={location.path}
                                      />
                                  </div>
                                  <span className="kissopen-agent-project-settings__hint">
                                      {t(
                                          "The checkout this project runs in. The daemon owns it, so it is shown here rather than set.",
                                      )}
                                  </span>
                              </div>
                          ))(props.location)
                        : null}
                    {props.compute
                        ? ((compute) => {
                              const ready = compute.status === "ready";
                              // Everything here waits on the host's own answer.
                              // Offering a choice before it arrives would let the
                              // reader pick against a selection that is only a
                              // placeholder, and commit it without ever having
                              // seen what the project is actually set to.
                              const inert = submitting || !ready;
                              const changed =
                                  ready &&
                                  computeDraftKeyOf(compute) !== computeKeyOf(compute.current);
                              return (
                                  <div
                                      className="kissopen-agent-project-settings__compute"
                                      data-kissopen-desktop-ui="kissopen-agent-project-settings-compute"
                                  >
                                      <span className="kissopen-agent-project-settings__label">
                                          {t("Where sessions run")}
                                      </span>
                                      {compute.status === "error" ? (
                                          <Banner
                                              data-testid="kissopen-agent-project-compute-read-error"
                                              tone="danger"
                                              title={t("Not read")}
                                          >
                                              {compute.readError ??
                                                  t(
                                                      "This project's compute setting could not be read.",
                                                  )}
                                          </Banner>
                                      ) : null}
                                      {compute.error ? (
                                          <Banner
                                              data-testid="kissopen-agent-project-compute-error"
                                              tone="danger"
                                              title={t("Not saved")}
                                          >
                                              {compute.error}
                                          </Banner>
                                      ) : null}
                                      <SegmentedControl
                                          aria-label={t(
                                              "Where sessions started in this project run",
                                          )}
                                          data-testid="kissopen-agent-project-compute-mode"
                                          disabled={inert}
                                          fullWidth
                                          onChange={(value) =>
                                              props.onComputeModeChange?.(
                                                  value as KissopenAgentProjectComputeMode,
                                              )
                                          }
                                          segments={[
                                              {
                                                  value: "default",
                                                  label: t("Machine default"),
                                                  icon: "settings",
                                              },
                                              {
                                                  value: "local",
                                                  label: t("This machine"),
                                                  icon: "terminal",
                                              },
                                              {
                                                  value: "docker",
                                                  label: t("Container"),
                                                  icon: "package",
                                              },
                                          ]}
                                          value={compute.mode}
                                      />
                                      {compute.mode === "docker" ? (
                                          <TextField
                                              data-testid="kissopen-agent-project-compute-image"
                                              disabled={inert}
                                              fullWidth
                                              label={t("Image")}
                                              onSubmit={() => {
                                                  if (changed) props.onComputeSubmit?.();
                                              }}
                                              onValueChange={(value) =>
                                                  props.onComputeImageChange?.(value)
                                              }
                                              placeholder="node:22-bookworm"
                                              value={compute.image}
                                          />
                                      ) : null}
                                      <span className="kissopen-agent-project-settings__hint">
                                          {compute.status === "loading"
                                              ? "Reading what this project is set to…"
                                              : computeEffect[compute.mode]}
                                      </span>
                                      <span className="kissopen-agent-project-settings__hint">
                                          {t(
                                              "Applies to sessions started after it is saved. Anything already running stays where it is, and a container in use now is left behind rather than reused.",
                                          )}
                                      </span>
                                      {/* Only what has not been settled is
                                          stated. While the choice and the host
                                          agree, the control already says what
                                          the project is set to, and repeating it
                                          underneath would read as a second
                                          setting. */}
                                      {changed ? (
                                          <div
                                              className="kissopen-agent-project-settings__compute-pending"
                                              data-kissopen-desktop-ui="kissopen-agent-project-settings-compute-pending"
                                          >
                                              <span
                                                  className="kissopen-agent-project-settings__compute-current"
                                                  data-kissopen-desktop-ui="kissopen-agent-project-settings-compute-current"
                                                  title={computeCurrentLabel(compute.current)}
                                              >
                                                  {t("Set to: {computeCurrentLabel}", {
                                                      computeCurrentLabel: computeCurrentLabel(
                                                          compute.current,
                                                      ),
                                                  })}
                                              </span>
                                              <Button
                                                  data-testid="kissopen-agent-project-compute-apply"
                                                  disabled={
                                                      submitting ||
                                                      props.submitDisabledReason !== undefined
                                                  }
                                                  onClick={() => props.onComputeSubmit?.()}
                                                  size="small"
                                                  variant="primary"
                                              >
                                                  {computing ? "Applying…" : "Apply"}
                                              </Button>
                                          </div>
                                      ) : null}
                                  </div>
                              );
                          })(props.compute)
                        : null}
                    {props.board
                        ? ((board) => {
                              const inert = board.saving || board.unavailable !== undefined;
                              const change = (next: Partial<KissopenAgentProjectBoardTiming>) =>
                                  props.onBoardChange?.({ ...board.timing, ...next });
                              return (
                                  <div
                                      className="kissopen-agent-project-settings__compute"
                                      data-kissopen-desktop-ui="kissopen-agent-project-settings-board"
                                  >
                                      <span className="kissopen-agent-project-settings__label">
                                          {t("定时构建看板")}
                                      </span>
                                      {board.error ? (
                                          <Banner tone="danger">{board.error}</Banner>
                                      ) : null}
                                      <Switch
                                          checked={board.enabled}
                                          disabled={inert}
                                          label={t("按时让 AI 更新项目看板")}
                                          onChange={(checked) =>
                                              props.onBoardChange?.(
                                                  checked ? board.timing : undefined,
                                              )
                                          }
                                      />
                                      {board.enabled ? (
                                          <div className="kissopen-agent-project-settings__board-timing">
                                              <Select
                                                  aria-label={t("多久一次")}
                                                  disabled={inert}
                                                  onValueChange={(value) =>
                                                      change({
                                                          recurrence:
                                                              value as KissopenAgentProjectBoardTiming["recurrence"],
                                                      })
                                                  }
                                                  options={[
                                                      { value: "daily", label: t("每天") },
                                                      { value: "weekdays", label: t("工作日") },
                                                      { value: "weekly", label: t("每周") },
                                                  ]}
                                                  value={board.timing.recurrence}
                                              />
                                              {board.timing.recurrence === "weekly" ? (
                                                  <Select
                                                      aria-label={t("星期几")}
                                                      disabled={inert}
                                                      onValueChange={(value) =>
                                                          change({ weekday: Number(value) })
                                                      }
                                                      options={WEEKDAYS.map((label, index) => ({
                                                          value: String(index),
                                                          label: t(label),
                                                      }))}
                                                      value={String(board.timing.weekday)}
                                                  />
                                              ) : null}
                                              <Select
                                                  aria-label={t("几点")}
                                                  disabled={inert}
                                                  onValueChange={(value) =>
                                                      change({ atMinute: Number(value) })
                                                  }
                                                  options={HOURS.map((hour) => ({
                                                      value: String(hour * 60),
                                                      label: `${String(hour).padStart(2, "0")}:00`,
                                                  }))}
                                                  value={String(board.timing.atMinute)}
                                              />
                                          </div>
                                      ) : null}
                                      <span className="kissopen-agent-project-settings__hint">
                                          {board.unavailable ??
                                              t(
                                                  "到点后 AI 会读项目里的对话、uploads 里的资料和 outputs 里的成果，重新构建项目看板。构建在这台电脑上进行，到点时它需要开着。",
                                              )}
                                      </span>
                                  </div>
                              );
                          })(props.board)
                        : null}
                    {props.archive ? (
                        <div
                            className="kissopen-agent-project-settings__archive"
                            data-kissopen-desktop-ui="kissopen-agent-project-settings-archive"
                        >
                            <span className="kissopen-agent-project-settings__label">
                                {t("Archive")}
                            </span>
                            {props.archive.error ? (
                                <Banner
                                    data-testid="kissopen-agent-project-archive-error"
                                    tone="danger"
                                    title={t("Not archived")}
                                >
                                    {props.archive.error}
                                </Banner>
                            ) : null}
                            {/* The question and the answer occupy the same block,
                                so asking does not move the dialog's other rows
                                or take the reader somewhere else to answer it. */}
                            <span className="kissopen-agent-project-settings__hint">
                                {confirming
                                    ? t(
                                          "Archive {name}? It leaves the sidebar with its sessions, and every workspace under it is archived and its worktree folder removed. The project's own checkout stays exactly where it is.",
                                          { name: props.name },
                                      )
                                    : "Takes the project out of the sidebar with its sessions, archives every workspace under it, and removes those workspaces' worktree folders. The project's own checkout is left alone."}
                            </span>
                            <div className="kissopen-agent-project-settings__archive-actions">
                                {confirming ? (
                                    <>
                                        <Button
                                            disabled={archiving}
                                            onClick={() => props.onArchiveCancel?.()}
                                            size="small"
                                            variant="ghost"
                                        >
                                            {t("Keep project")}
                                        </Button>
                                        <Button
                                            data-testid="kissopen-agent-project-archive-confirm"
                                            disabled={
                                                archiving ||
                                                props.submitDisabledReason !== undefined
                                            }
                                            icon="archive"
                                            onClick={() => props.onArchiveConfirm?.()}
                                            size="small"
                                            variant="danger"
                                        >
                                            {archiving
                                                ? t("Archiving…")
                                                : t("Archive {name}", { name: props.name })}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        data-testid="kissopen-agent-project-archive"
                                        disabled={submitting}
                                        icon="archive"
                                        onClick={() => props.onArchiveRequest?.()}
                                        size="small"
                                        variant="danger"
                                    >
                                        {t("Archive project")}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Modal>
        </ModalOverlay>
    );
}
