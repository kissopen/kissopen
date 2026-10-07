/**
 * Closed, serialization-safe product projections for the Kissopen Agent chat surface. Every
 * type here is what application code and the UI actually render. Kissopen Agent
 * resources are projected explicitly at the state boundary, so application code
 * never receives wire shapes, tokens, URLs, or sockets.
 */

import type { ConversationSummary } from "../conversation/conversationSummary.js";
import type { KissopenAgentServiceTier } from "../kissopenAgentServiceTier.js";

export type { KissopenAgentServiceTier } from "../kissopenAgentServiceTier.js";

declare const kissopenAgentSessionIdBrand: unique symbol;
declare const kissopenAgentProjectIdBrand: unique symbol;
declare const kissopenAgentWorktreeIdBrand: unique symbol;
declare const kissopenAgentTerminalIdBrand: unique symbol;
declare const kissopenAgentBotIdBrand: unique symbol;

/** Branded session identifier (CUID2 on the wire) so ids are not interchangeable with plain strings. */
export type KissopenAgentSessionId = string & { readonly [kissopenAgentSessionIdBrand]: true };

/** Branded identifier of a project the daemon owns durably (CUID2 on the wire). */
export type KissopenAgentProjectId = string & { readonly [kissopenAgentProjectIdBrand]: true };

/** Branded identifier of one of a project's git worktrees (CUID2 on the wire). */
export type KissopenAgentWorktreeId = string & { readonly [kissopenAgentWorktreeIdBrand]: true };

/**
 * What the workspace lists sessions under: a project, or one of its worktrees.
 * Both ids come from the same daemon id space, so one value addresses either
 * kind of group and the URL needs a single segment for it.
 */
export type KissopenAgentGroupId = KissopenAgentProjectId | KissopenAgentWorktreeId;

/** Branded identifier of one interactive terminal the daemon runs for a session. */
export type KissopenAgentTerminalId = string & { readonly [kissopenAgentTerminalIdBrand]: true };

/** Branded identifier of a bot the daemon owns durably (CUID2 on the wire). */
export type KissopenAgentBotId = string & { readonly [kissopenAgentBotIdBrand]: true };

/**
 * A bot: one persistent assistant, one dedicated workspace, one conversation
 * that always exists and can never be joined by a second.
 *
 * It sits beside the projects in the catalog rather than inside them. The
 * conversation is carried outright instead of as a list, because "exactly one,
 * forever" is the whole of what a bot is, and a list of one invites code that
 * asks how many there are.
 *
 * The workspace is what the conversation is addressed through, so `workspaceId`
 * is the group id a route names — a bot is opened the way any workspace is.
 */
export interface KissopenAgentBot {
    readonly id: KissopenAgentBotId;
    /** The bot's dedicated workspace, and the group its conversation is opened as. */
    readonly workspaceId: KissopenAgentWorktreeId;
    /**
     * The bot's one conversation, which the daemon created with the bot, as the
     * same row every other conversation is listed as. It is the whole summary
     * rather than an id: the bot's row reports what that conversation is doing
     * and the open bot renders it as its one tab, and neither may work the state
     * out again from a narrower field.
     */
    readonly conversation: ConversationSummary;
    readonly name: string;
    /** Immutable local snake_case name, also the folder the bot works in. */
    readonly username: string;
    /** Daemon-provided built-in bot identity; null or absent for ordinary bots. */
    readonly systemKey?: string | null;
    /** Fractional index the host sorts the bot catalog by. */
    readonly orderKey: string;
    readonly path: string;
    readonly displayPath: string;
    /**
     * The bot's picture. Unlike a project avatar it has no intrinsic size: the
     * daemon serves the bytes and a thumbhash to stand in until they arrive,
     * and the row draws it at whatever size the row is.
     */
    readonly avatar?: { readonly url: string; readonly thumbhash: string };
}

/** The one application collection containing a visible primary chat. */
export type KissopenAgentSessionScope =
    | { readonly kind: "project"; readonly projectId: KissopenAgentProjectId }
    | {
          readonly kind: "workspace";
          readonly projectId: KissopenAgentProjectId;
          readonly worktreeId: KissopenAgentWorktreeId;
      };

/**
 * One interactive terminal the daemon has started, as its create/stop actions
 * report it. It is the terminal's identity and size only: the live screen never
 * comes through here, it arrives on the terminal's own byte channel, so this
 * shape stays small and cheap to re-read.
 */
export interface KissopenAgentTerminal {
    readonly id: KissopenAgentTerminalId;
    readonly cols: number;
    readonly rows: number;
    readonly status: "running" | "exited";
    readonly exitCode: number | null;
}

export type KissopenAgentPermissionMode = "auto" | "workspace_write" | "read_only" | "full_access";

export type KissopenAgentSessionStatus =
    | "idle"
    | "queued"
    | "running"
    | "completed"
    | "aborted"
    | "suspended"
    | "error"
    | "archived";

/** Reader-facing phase of the active turn's current work. */
export type KissopenAgentWorkingPhase =
    | "waiting"
    | "working"
    | "thinking"
    | "generatingTools"
    | "callingTools"
    | "texting";

/** Reasoning/effort levels a model may expose, ordered from least to most reasoning. */
export type KissopenAgentThinkingLevel =
    | "off"
    | "on"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max"
    | "ultra";

/** Kissopen's default reasoning level when the selected model offers it. */
export const KISSOPEN_AGENT_DEFAULT_THINKING_LEVEL: KissopenAgentThinkingLevel = "medium";

/**
 * Both ends of the scheduled wait a session's agent is sitting inside, in epoch
 * milliseconds. Both travel together because either alone measures nothing:
 * a surface counts the interval down against its own clock.
 */
export interface KissopenAgentSessionWait {
    readonly startedAt: number;
    readonly dueAt: number;
}

export type KissopenAgentTaskStatus = "pending" | "in_progress" | "completed";

export type KissopenAgentGoalStatus = "active" | "blocked" | "complete" | "paused";

// ---------------------------------------------------------------------------
// Model catalog
// ---------------------------------------------------------------------------

export type KissopenAgentCustomReasoningEffort =
    | "off"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max";
/** Sanitized local model capability, independent of SDK wire types. */
export type KissopenAgentCustomReasoning =
    | {
          mode: "openai";
          efforts: KissopenAgentCustomReasoningEffort[];
          defaultEffort: KissopenAgentCustomReasoningEffort;
      }
    | {
          mode: "deepseek";
          efforts: ("off" | "low" | "high" | "max")[];
          defaultEffort: "off" | "low" | "high" | "max";
      };
export interface KissopenAgentModel {
    /** Null explicitly means the custom endpoint's default, not thinking disabled. */
    readonly customReasoning?: KissopenAgentCustomReasoning | null;
    readonly id: string;
    readonly name: string;
    readonly thinkingLevels: readonly KissopenAgentThinkingLevel[];
    readonly defaultThinkingLevel: KissopenAgentThinkingLevel;
    /** The hard window in tokens; absent for a custom model whose limit is unknown. */
    readonly contextWindow?: number;
    /**
     * The measured conversation size at which the daemon compacts automatically, below the
     * window. Absent when the daemon predates the field or the model has no curated threshold.
     */
    readonly autoCompactWindow?: number;
}

export interface KissopenAgentModelProvider {
    readonly name?: string;
    readonly custom?: boolean;
    readonly id: string;
    readonly models: readonly KissopenAgentModel[];
    readonly serviceTiers: readonly KissopenAgentServiceTier[];
    /**
     * Whether the machine will use this provider at all, as its own
     * configuration states it. Stated rather than read back out of
     * `disabledReason`, which also covers a provider that is switched on and
     * simply offers nothing.
     */
    readonly enabled: boolean;
    readonly disabledReason?: "not_authenticated" | "not_enabled" | "no_models";
}

export interface KissopenAgentModelCatalog {
    readonly defaultModelId: string;
    readonly defaultProviderId: string;
    readonly models: readonly KissopenAgentModel[];
    readonly providers: readonly KissopenAgentModelProvider[];
}

/**
 * One image sent with a local user turn. A local session has no upload step, so
 * the bytes travel with the message; `data` is base64 without a data-URL prefix.
 */
export interface KissopenAgentImageInput {
    readonly mediaType: string;
    readonly data: string;
}

// ---------------------------------------------------------------------------
// User-input requests (question prompts)
// ---------------------------------------------------------------------------

export interface KissopenAgentUserInputOption {
    readonly label: string;
    readonly description: string;
}

export interface KissopenAgentUserInputQuestion {
    readonly id: string;
    readonly header: string;
    readonly question: string;
    readonly multiSelect: boolean;
    readonly required: boolean;
    readonly options: readonly KissopenAgentUserInputOption[];
}

export interface KissopenAgentUserInputRequest {
    readonly requestId: string;
    readonly questions: readonly KissopenAgentUserInputQuestion[];
}

// ---------------------------------------------------------------------------
// Tasks, goals, subagents, background processes
// ---------------------------------------------------------------------------

export interface KissopenAgentTask {
    readonly id: string;
    readonly subject: string;
    readonly description: string;
    readonly status: KissopenAgentTaskStatus;
    readonly activeForm?: string;
    readonly owner?: string;
    readonly blockedBy: readonly string[];
    readonly blocks: readonly string[];
}

export interface KissopenAgentGoal {
    readonly objective: string;
    readonly status: KissopenAgentGoalStatus;
    readonly createdAt: number;
    readonly updatedAt: number;
}

export interface SubagentSummary {
    readonly id: KissopenAgentSessionId;
    readonly parentSessionId: KissopenAgentSessionId;
    /** Tool invocation in the parent transcript which created this child session. */
    readonly parentToolCallId?: string;
    readonly description: string;
    readonly taskName?: string;
    readonly modelId: string;
    readonly status: KissopenAgentSessionStatus;
    readonly depth: number;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly activeSince?: number;
    readonly elapsedMs?: number;
    readonly latestText?: string;
    readonly totalTokens?: number;
}

export interface KissopenAgentQueuedMessage {
    readonly id: string;
    /** Flattened text of the queued user turn, shown as a preview in the composer. */
    readonly text: string;
}

export interface KissopenAgentFileSearchResult {
    /** Basename shown as the primary label in the mention list. */
    readonly fileName: string;
    /** Workspace-relative path inserted into the composer as `@path`. */
    readonly path: string;
}

// ---------------------------------------------------------------------------
// Session usage (token/cost accounting, `/usage`)
// ---------------------------------------------------------------------------

/** Token + cost totals attributed to one model within a session. */
export interface KissopenAgentUsageGroup {
    readonly modelId: string;
    readonly providerId: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheWriteTokens: number;
    readonly totalTokens: number;
    /** Reasoning tokens when the provider reports an exact breakdown. */
    readonly reasoningTokens?: number;
    /** Total US-dollar cost for this group. */
    readonly cost: number;
}

/** Approximate context-window occupancy for the session's current model. */
export interface KissopenAgentUsageContext {
    readonly modelId?: string;
    readonly providerId: string;
    readonly totalTokens: number;
    readonly contextWindow?: number | null;
    /** True when the count is estimated rather than provider-reported. */
    readonly approximate: boolean;
}

/**
 * How much room is left in the model's context window. Phrased as remaining
 * rather than consumed because the question being asked is "how much longer can
 * this conversation go", and a total answers that only after arithmetic.
 *
 * Only exists when the model declares a window; a model that does not is not
 * reported as full, or as empty, but not reported at all.
 */
export interface KissopenAgentContextGauge {
    readonly usedTokens: number;
    readonly remainingTokens: number;
    readonly totalTokens: number;
    /** Remaining share of the window, 0–1. */
    readonly remainingFraction: number;
    /**
     * Tokens at which the daemon compacts the conversation on its own, when the model
     * publishes that point. The meter draws its notch and takes colour from this, not from a
     * fixed share of the window.
     */
    readonly compactTokens?: number;
    /** True when the underlying token count is estimated, not provider-reported. */
    readonly approximate: boolean;
    /** False until the provider reports the active conversation's token count. */
    readonly measured?: boolean;
}

/** One provider rate-limit window (five-hour or weekly) with reset timing. */
export interface KissopenAgentUsageQuotaWindow {
    readonly kind: "fiveHour" | "weekly";
    readonly usedPercent: number;
    /** Epoch millis when the window resets. */
    readonly resetsAt: number;
}

/** Provider-level quota for a session, with any reported rate-limit windows. */
export interface KissopenAgentUsageQuota {
    readonly providerId: string;
    readonly windows: readonly KissopenAgentUsageQuotaWindow[];
}

/**
 * Aggregate usage snapshot for a session (`/usage`). Read on demand and polled
 * while its panel is visible: there is no realtime usage event, so this is the
 * secondary-surface polling case, never durable snapshot state.
 */
export interface KissopenAgentSessionUsage {
    readonly currentProviderId: string;
    readonly groups: readonly KissopenAgentUsageGroup[];
    readonly totalTokens: number;
    readonly totalCost: number;
    readonly context?: KissopenAgentUsageContext;
    readonly quotas: readonly KissopenAgentUsageQuota[];
}

export interface KissopenAgentBackgroundProcess {
    readonly id: number;
    readonly command: string;
    readonly cwd: string;
    readonly status: "running";
}

// ---------------------------------------------------------------------------
// Projects and worktrees
// ---------------------------------------------------------------------------

/**
 * The picture that stands for a project in a list. The daemon derives it from the
 * repository or its hosting provider, so `url` is already a fetchable image the
 * renderer can put straight into an `<img>`; `width`/`height` are the intrinsic
 * pixel size so a row can reserve its box before the bytes arrive.
 */
export interface KissopenAgentProjectAvatar {
    readonly url: string;
    readonly width: number;
    readonly height: number;
}

/** Repository KISSOPEN Agent manages for a project it cloned rather than adopted from disk. */
export type KissopenAgentProjectRemoteSource =
    | { readonly kind: "github"; readonly repository: string }
    | { readonly kind: "git"; readonly url: string };

/**
 * One directory the daemon has adopted as a durable project. This — not the raw
 * working directory — is what the workspace lists: it carries a name the daemon
 * derived from the git remote (or the user renamed) and a picture, and it keeps
 * a stable id across restarts, so a project is addressable without hashing a path.
 */
export interface KissopenAgentProject {
    readonly id: KissopenAgentProjectId;
    readonly name: string;
    /**
     * Fractional index the host sorts projects by, ascending then by id. It is
     * opaque: compare it, never parse it, and only the host mints new values.
     */
    readonly orderKey: string;
    /** Canonical absolute path of the project root. */
    readonly path: string;
    /** Presentation path (home-relative when the daemon's host supplied one). */
    readonly displayPath: string;
    /** `home` is the catch-all project for sessions started outside any repository. */
    readonly kind: "regular" | "home";
    /** Whether the daemon has finished deriving the project's name and picture. */
    readonly status: "initializing" | "ready" | "failed";
    /** Whether the project directory still exists once initialization has completed. */
    readonly presence: "present" | "missing";
    /** The daemon's bounded reason when a managed project could not be prepared. */
    readonly error?: string;
    /** Repository source for a project whose checkout Kissopen Agent owns. */
    readonly remoteSource?: KissopenAgentProjectRemoteSource;
    /** Native credential Kissopen Agent needs refreshed for Git operations on this managed project. */
    readonly requiredSecretKind?: "github";
    readonly avatar?: KissopenAgentProjectAvatar;
    /** Current changed-file total for this checkout, omitted until Git state is available. */
    /** Explicit scan state; unavailable totals must not look like a clean checkout. */
    readonly changesStatus?: "loading" | "ready" | "stale" | "unavailable";
    readonly changedFiles?: number;
    /** Aggregate textual diff against HEAD, omitted until Git state is available. */
    readonly addedLines?: number;
    readonly deletedLines?: number;
    readonly changes?: readonly KissopenAgentGitChangedFile[];
}

/**
 * Where the host runs a session started in a project, when the project itself
 * decides. `local` is the machine the host is on; `docker` is a container built
 * from `image` with the checkout mounted inside it.
 *
 * A project that states neither is represented by the absence of this value
 * rather than by a third member: "nothing stated" is not a place work runs, it
 * is the host's own configuration deciding, and giving it a name here would let
 * a surface claim the machine when the host may well have said a container.
 */
export type KissopenAgentProjectCompute =
    | { readonly type: "local" }
    | { readonly type: "docker"; readonly image: string };

/**
 * One project's durable compute configuration, exactly as the host holds it.
 *
 * It is read on its own rather than carried on the project row because the live
 * catalog the workspace list is built from does not describe it at all: a row
 * that carried it would have it only on the reads that happen to come from the
 * host's own project read, and lose it again on the next live publish.
 */
export interface KissopenAgentProjectComputeState {
    readonly projectId: KissopenAgentProjectId;
    /** Absent when the project states nothing and the host's configuration decides. */
    readonly compute?: KissopenAgentProjectCompute;
    /**
     * How many times this project's choice has changed. The host builds a
     * container's name out of it, so a change is what retires the container the
     * previous choice built instead of reusing it.
     */
    readonly generation: number;
}

/**
 * One git worktree the daemon created inside a project. Sessions started in it
 * belong to the project but list under the worktree, so parallel work on separate
 * branches reads as separate groups rather than as unrelated directories.
 */
export interface KissopenAgentWorktree {
    readonly id: KissopenAgentWorktreeId;
    readonly projectId: KissopenAgentProjectId;
    readonly name: string;
    /** Fractional index the host sorts a project's worktrees by. */
    readonly orderKey: string;
    readonly path: string;
    readonly displayPath: string;
    readonly status: "initializing" | "ready" | "failed" | "archiving" | "archived";
    /**
     * Whether the checkout this worktree names is still on disk. The host
     * watches for it, so a directory removed outside KISSOPEN turns a listed
     * worktree `missing` without anything being asked of it.
     */
    readonly presence: "present" | "missing";
    /**
     * Why the host could not prepare or remove this checkout, when it says. The
     * reason is part of the worktree's durable record rather than of the request
     * that produced it, so it outlives the window that asked for the checkout.
     */
    readonly error?: string;
    /** Current changed-file total for this checkout, omitted until Git state is available. */
    /** Explicit scan state; unavailable totals must not look like a clean checkout. */
    readonly changesStatus?: "loading" | "ready" | "stale" | "unavailable";
    readonly changedFiles?: number;
    /** Aggregate textual diff against HEAD, omitted until Git state is available. */
    readonly addedLines?: number;
    readonly deletedLines?: number;
    readonly changes?: readonly KissopenAgentGitChangedFile[];
}

/** One current working-tree change, reconciled from Git after each watcher hint. */
export interface KissopenAgentGitChangedFile {
    readonly path: string;
    /** Original repository path when Git reports a rename or copy. */
    readonly previousPath?: string;
    /** Comparison revision retained by the live Git watcher. */
    readonly baseRevision?: string;
    readonly status: "added" | "deleted" | "modified" | "renamed" | "untracked";
    /** Lightweight disk identity used to reload an open file after a Git watcher hint. */
    readonly revision: string;
    /** Lines this file gained and lost against HEAD; absent when it is binary. */
    readonly addedLines?: number;
    readonly deletedLines?: number;
}

/** Current working-tree text loaded for an ordinary workspace-file tab. */
export interface KissopenAgentWorkspaceFileDocument {
    readonly path: string;
    readonly content: string;
    /** SHA-256 identity returned by Kissopen Agent and required for a conflict-safe save. */
    readonly hash: string;
}

/**
 * One workspace file's bytes, loaded to be shown rather than edited. `content`
 * is base64 so the transport stays JSON; the surface turns it into an object URL
 * of `contentType` and hands that to an `<img>`, `<video>`, or `<audio>`.
 */
export interface KissopenAgentWorkspaceFileBytes {
    readonly path: string;
    /** Media type implied by the file's extension, or `application/octet-stream`. */
    readonly contentType: string;
    /**
     * Where the bytes are, rather than the bytes themselves. A picture element
     * wants a source it can fetch: handing it the file inline makes the whole
     * file resident in the document, decoded from base64 before anything is
     * shown, and denies a video the range requests it seeks with.
     */
    readonly url: string;
    readonly size: number;
    readonly hash: string;
}

/** HEAD and working-tree text loaded for one changed-file diff tab. */
export interface KissopenAgentChangedFileDocument {
    readonly path: string;
    readonly oldPath: string;
    readonly oldContent: string;
    readonly newContent: string;
    /** Working-tree identity, absent only when the file is deleted. */
    readonly hash?: string;
    /**
     * Compact identity of the base content used by the diff. When the revision
     * response supplies only bytes, the state layer derives it locally.
     */
    readonly oldHash?: string;
}

/** Everything the workspace list needs to group sessions: the projects and their worktrees. */
export interface KissopenAgentProjectCatalog {
    readonly projects: readonly KissopenAgentProject[];
    readonly worktrees: readonly KissopenAgentWorktree[];
    /** Every active bot, in the order the host keeps them. */
    readonly bots: readonly KissopenAgentBot[];
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface KissopenAgentSessionSummary {
    readonly id: KissopenAgentSessionId;
    /** Epoch milliseconds when the host archived it; absent while active. */
    readonly archivedAt?: number;
    /** The project containing this code chat. */
    readonly projectId: KissopenAgentProjectId;
    /** Set when the chat belongs to one of the project's workspaces. */
    readonly worktreeId?: KissopenAgentWorktreeId;
    /**
     * Fractional index the host sorts sessions by within their own group.
     *
     * Absent for a session the host has not placed in an order yet, which is an
     * ordinary state for one that has just been created. It says nothing about
     * whose chat this is; `parentSessionId` answers that.
     */
    readonly orderKey?: string;
    /**
     * The chat that started this one, for a subagent. Absent for a top-level
     * chat.
     *
     * This is the whole of what makes a chat someone else's: it syncs and can be
     * opened by id, but its runner owns its input and it never takes a row of
     * its own. The host states it from the moment the agent exists, so nothing
     * has to infer it from a missing order or a missing row.
     */
    readonly parentSessionId?: KissopenAgentSessionId;
    /** Canonical absolute working directory. */
    readonly cwd: string;
    /** Original Kissopen Agent path retained for presentation when it differs from `cwd`. */
    readonly displayCwd: string;
    readonly providerId: string;
    readonly modelId: string;
    readonly permissionMode: KissopenAgentPermissionMode;
    readonly effort?: KissopenAgentThinkingLevel;
    readonly serviceTier?: KissopenAgentServiceTier;
    readonly status: KissopenAgentSessionStatus;
    /**
     * How many agents this session delegated to are running right now. Work it
     * handed to a child is still this session's work, so a row, tab, or group
     * counts it as live even after the session's own turn has ended.
     */
    readonly activeSubagentCount: number;
    /** Present while the agent is inside a scheduled `wait`/`wait_until`. */
    readonly wait?: KissopenAgentSessionWait;
    /**
     * The agent is parked on a question of its own. Unlike an unread reason,
     * reading the chat does not clear it: only an answer does.
     */
    readonly awaitingAnswer?: true;
    /** Why this chat is waiting for the person, as durably tracked by Kissopen Agent. */
    readonly unreadReason?: "attention_needed" | "turn_finished";
    readonly title?: string;
    readonly recap?: string;
    /** Chronological sort key: when the session was first created. */
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly lastMessageAt?: number;
    readonly draft?: string;
    readonly draftUpdatedAt?: number;
}

export interface KissopenAgentSession {
    readonly id: KissopenAgentSessionId;
    readonly scope: KissopenAgentSessionScope;
    /** Fractional index this session sorts by; absent for a subagent (see `KissopenAgentSessionSummary`). */
    readonly orderKey?: string;
    readonly cwd: string;
    readonly displayCwd: string;
    readonly providerId: string;
    readonly modelId: string;
    readonly models: readonly KissopenAgentModel[];
    readonly effort?: KissopenAgentThinkingLevel;
    readonly serviceTier?: KissopenAgentServiceTier;
    readonly permissionMode: KissopenAgentPermissionMode;
    readonly modelLocked: boolean;
    readonly status: KissopenAgentSessionStatus;
    readonly title?: string;
    readonly recap?: string;
    readonly draft?: string;
    readonly draftUpdatedAt?: number;
    /**
     * Steering messages queued to submit after the current tool call. Non-internal
     * user turns the runner has accepted but not yet started; the composer previews
     * them so a person sees what will be sent next (and can flush early with esc).
     */
    readonly queuedMessages: readonly KissopenAgentQueuedMessage[];
    readonly pendingUserInputs: readonly KissopenAgentUserInputRequest[];
    readonly goal?: KissopenAgentGoal;
    readonly tasks: readonly KissopenAgentTask[];
    readonly subagents: readonly SubagentSummary[];
    readonly backgroundProcesses: readonly KissopenAgentBackgroundProcess[];
    readonly createdAt: number;
    readonly updatedAt: number;
}

/** One slash command the selected Kissopen Agent currently offers for this session. */
export interface KissopenAgentSlashCommand {
    /** The command without its leading slash. */
    readonly name: string;
    readonly description: string;
    readonly hasArguments: boolean;
    /** Presentation category supplied by the owning agent module. */
    readonly kind?: string;
}

// ---------------------------------------------------------------------------
// Menus (pickers derived from catalog + current session selection)
// ---------------------------------------------------------------------------

export interface KissopenAgentModelOption {
    readonly providerId: string;
    readonly providerName?: string;
    readonly modelId: string;
    readonly name: string;
    readonly disabled: boolean;
    readonly current: boolean;
}

export interface KissopenAgentEffortOption {
    readonly level: KissopenAgentThinkingLevel;
    readonly label: string;
    readonly current: boolean;
    readonly isDefault: boolean;
}

export interface KissopenAgentPermissionModeOption {
    readonly mode: KissopenAgentPermissionMode;
    readonly label: string;
    readonly current: boolean;
}

export interface KissopenAgentServiceTierOption {
    readonly tier: KissopenAgentServiceTier | null;
    readonly label: string;
    readonly current: boolean;
}

export interface KissopenAgentMenusSnapshot {
    readonly currentCustomReasoning?: KissopenAgentCustomReasoning | null;
    readonly modelOptions: readonly KissopenAgentModelOption[];
    readonly effortOptions: readonly KissopenAgentEffortOption[];
    readonly permissionModeOptions: readonly KissopenAgentPermissionModeOption[];
    readonly serviceTierOptions: readonly KissopenAgentServiceTierOption[];
    readonly currentProviderId: string;
    readonly currentModelId: string;
    readonly currentEffort?: KissopenAgentThinkingLevel;
    readonly currentPermissionMode: KissopenAgentPermissionMode;
    readonly currentServiceTier?: KissopenAgentServiceTier;
}

/**
 * Where a conversation is being read. `following` distinguishes a reader parked
 * at the newest message — who should stay there as more arrives — from one who
 * has scrolled up to a fixed point and expects to find it again.
 */
export interface KissopenAgentScrollPosition {
    readonly scrollTop: number;
    readonly following: boolean;
    /** Effective centered row width associated with `scrollTop`. */
    readonly rowWidth?: number;
}

/** One physical child of a checkout directory. Symlinks are file-like leaves. */
export interface KissopenAgentWorkspaceFileTreeEntry {
    readonly kind: "directory" | "file";
    readonly name: string;
    readonly path: string;
    /** Bytes. */
    readonly size?: number;
    /** When it last changed, epoch milliseconds. */
    readonly modified?: number;
}

/** One bounded page read from a checkout directory. */
export interface KissopenAgentWorkspaceFileTreePage {
    readonly entries: readonly KissopenAgentWorkspaceFileTreeEntry[];
    readonly nextCursor?: string;
}

/**
 * The materialized part of one checkout directory. A directory enters this map
 * when the root opens or pointer, keyboard, or disclosure intent warms it;
 * untouched descendants remain names in their parent and cost no transport work.
 */
export interface KissopenAgentWorkspaceFileTreeDirectory {
    readonly entries: readonly KissopenAgentWorkspaceFileTreeEntry[];
    /** The last page failed; closing and reopening the directory retries it. */
    readonly error?: boolean;
    readonly loading: boolean;
    readonly nextCursor?: string;
}

/** The lazily materialized all-files tree, keyed by directory path; `""` is the root. */
export interface KissopenAgentWorkspaceFiles {
    readonly directories: ReadonlyMap<string, KissopenAgentWorkspaceFileTreeDirectory>;
}

/** One application a project directory can be opened in. */
export interface KissopenAgentOpenInTarget {
    readonly id: string;
    readonly label: string;
    /**
     * The application's own icon as an image URL supplied by the host — the
     * picture of the thing being launched, not a glyph from our vocabulary.
     * Absent when the host has no artwork for it.
     */
    readonly iconUrl?: string;
}

/**
 * The applications a host offers, with the one opened most recently. The recent
 * application belongs to the same answer because a control that wears the
 * last-used one has to know it before it can draw itself.
 *
 * It arrives whole rather than as an id into `targets`, and is not required to
 * appear there: the host remembers what the reader chose, while `targets` is a
 * fresh prediction that costs a process launch per application and is therefore
 * still empty for the first moments after a reload. Carrying the label and the
 * icon means the control is correct from the first frame instead of blank until
 * detection finishes.
 */
export interface KissopenAgentOpenInTargets {
    readonly targets: readonly KissopenAgentOpenInTarget[];
    readonly recent?: KissopenAgentOpenInTarget;
}

/** Current model/effort/permission/tier selection used to derive menu options. */
export interface KissopenAgentSelection {
    readonly providerId: string;
    readonly modelId: string;
    readonly effort?: KissopenAgentThinkingLevel;
    readonly permissionMode: KissopenAgentPermissionMode;
    readonly serviceTier?: KissopenAgentServiceTier;
}

// ---------------------------------------------------------------------------
// Action inputs
// ---------------------------------------------------------------------------

export interface KissopenAgentSessionCreateInput {
    readonly cwd: string;
    /** The session's id when the caller settles it, e.g. a board card's own conversation. */
    readonly id?: string;
    /** A title the session keeps. */
    readonly title?: string;
    /** Files the session under one of the project's worktrees rather than its root. */
    readonly worktreeId?: KissopenAgentWorktreeId;
    readonly providerId?: string;
    readonly modelId?: string;
    readonly effort?: KissopenAgentThinkingLevel;
    readonly serviceTier?: KissopenAgentServiceTier;
    readonly permissionMode?: KissopenAgentPermissionMode;
}

export interface KissopenAgentModelSelection {
    readonly providerId?: string;
    readonly modelId: string;
    readonly effort?: KissopenAgentThinkingLevel;
}

export interface KissopenAgentUserInputAnswers {
    readonly requestId: string;
    readonly answers: Readonly<Record<string, readonly string[]>>;
}

/**
 * A question the daemon has authoritatively recorded as answered.
 *
 * Pending questions live on the session. Resolved questions leave that list,
 * so the inbox is the durable source that lets their original transcript row
 * remain visible after resolution.
 */
export interface KissopenAgentAnsweredUserInput {
    readonly requestId: string;
    readonly questions: readonly KissopenAgentUserInputQuestion[];
    readonly answers: Readonly<Record<string, readonly string[]>>;
    readonly createdAt: number;
    readonly resolvedAt: number;
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

declare const kissopenAgentInboxItemIdBrand: unique symbol;

/**
 * Branded identity of one question an agent asked. It is the session and the
 * request together, because a request id is only unique inside its session.
 */
export type KissopenAgentInboxItemId = string & { readonly [kissopenAgentInboxItemIdBrand]: true };

export type KissopenAgentInboxItemStatus = "pending" | "answered";

/** One agent question waiting on the person, or the answer they already gave. */
export interface KissopenAgentInboxItem {
    readonly id: KissopenAgentInboxItemId;
    readonly sessionId: KissopenAgentSessionId;
    readonly requestId: string;
    /** Absent only while the inbox has not yet resolved the asking session's catalog entry. */
    readonly scope?: KissopenAgentSessionScope;
    /** The asking session's title, when it has earned one. */
    readonly sessionTitle?: string;
    readonly questions: readonly KissopenAgentUserInputQuestion[];
    readonly status: KissopenAgentInboxItemStatus;
    /** Chosen option labels by question id; present once answered. */
    readonly answers?: Readonly<Record<string, readonly string[]>>;
    readonly createdAt: number;
    readonly resolvedAt?: number;
}
