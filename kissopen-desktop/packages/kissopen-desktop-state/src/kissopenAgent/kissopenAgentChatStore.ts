import { t } from "../i18n/locale.js";
import { createStore } from "zustand/vanilla";
import { entriesMerge } from "../conversation/conversationEntries.js";
import type { Loadable } from "../conversation/loadable.js";
import {
    type ConversationAttachment,
    type ConversationEntry,
    type ConversationRequestSubmission,
} from "../conversation/conversationEntry.js";
import {
    chatElementRequest,
    type ChatElement,
    type MutationRejectedDelta,
    type KissopenAgentConnection,
    type SessionState,
    type SessionUsage,
} from "../kissopenAgentConnection/index.js";
import type { ConversationAuthor } from "../conversation/conversationAuthor.js";
import { UserError } from "../types.js";
import {
    agentAuthor,
    kissopenAgentAgentAuthor,
    type KissopenAgentAssistantIdentity,
} from "./kissopenAgentConversationAuthors.js";
import {
    kissopenAgentConversationCacheCreate,
    kissopenAgentConversationProject,
} from "./kissopenAgentConversationProject.js";
import { kissopenAgentMenusDerive } from "./kissopenAgentMenusStore.js";
import {
    kissopenAgentSelectionEffortUpdate,
    kissopenAgentSelectionModelUpdate,
    kissopenAgentSelectionServiceTierUpdate,
} from "./kissopenAgentSessionDraftStore.js";
import { deepEqual, kissopenAgentUserError } from "./kissopenAgentSupport.js";
import type {
    KissopenAgentAnsweredUserInput,
    KissopenAgentBackgroundProcess,
    KissopenAgentGoal,
    KissopenAgentImageInput,
    KissopenAgentMenusSnapshot,
    KissopenAgentContextGauge,
    KissopenAgentModel,
    KissopenAgentModelCatalog,
    KissopenAgentModelSelection,
    KissopenAgentPermissionMode,
    KissopenAgentQueuedMessage,
    KissopenAgentSelection,
    KissopenAgentServiceTier,
    KissopenAgentSession,
    KissopenAgentSessionId,
    KissopenAgentSessionStatus,
    KissopenAgentSessionUsage,
    KissopenAgentSlashCommand,
    SubagentSummary,
    KissopenAgentTask,
    KissopenAgentThinkingLevel,
    KissopenAgentUserInputAnswers,
    KissopenAgentUserInputRequest,
    KissopenAgentWorkingPhase,
    KissopenAgentProjectId,
    KissopenAgentWorktreeId,
} from "./kissopenAgentTypes.js";

const WORKING_LABEL_MAX = 64;
const SENT_IMAGE_BUDGET_BYTES = 32 * 1024 * 1024;
const PENDING_MUTATION_LIMIT = 2_048;
/** Keep a released store alive long enough to surface a slow mutation refusal. */
const PENDING_MUTATION_RETENTION_MS = 2 * 60_000;

function transcriptSessionBusy(session: SessionState): boolean {
    return session.activeTurn !== undefined;
}

function waitingForModelProject(
    session: SessionState | undefined,
    elements: readonly ChatElement[] | undefined,
    runStatus: KissopenAgentChatSnapshot["runStatus"],
): boolean {
    if (runStatus !== "running" || session === undefined || elements === undefined) return false;
    const activeGroup = session.activeGroup;
    if (activeGroup !== undefined) {
        const activeElement = elements.find(
            (element) => element.groupId === activeGroup.groupId && !chatElementRequest(element),
        );
        return activeElement?.kind === "inference";
    }
    const activeTurn = session.activeTurn;
    if (activeTurn === undefined) return false;
    const produced = elements.some(
        (element) =>
            element.runId === activeTurn.runId &&
            !chatElementRequest(element) &&
            element.kind !== "inference" &&
            element.kind !== "group_end",
    );
    if (produced) return false;
    return (
        session.activity.kind === "idle" ||
        session.activity.kind === "queued" ||
        session.activity.kind === "thinking"
    );
}

function workingPhaseProject(
    session: SessionState | undefined,
    waitingForModel: boolean,
): KissopenAgentWorkingPhase {
    if (waitingForModel) return "waiting";
    switch (session?.activity.kind) {
        case "thinking":
            return "thinking";
        case "generating_message":
            return "texting";
        case "generating_tool_call":
            return "generatingTools";
        case "executing_tool_call":
            return "callingTools";
        default:
            return "working";
    }
}

function workingLabelProject(
    session: SessionState | undefined,
    waitingForModel: boolean,
): string | undefined {
    if (waitingForModel) return undefined;
    const activity = session?.activity;
    if (activity === undefined || activity.kind === "idle") return undefined;
    const label = activity.label.split("\n")[0]?.trim() ?? "";
    if (label.length === 0) return undefined;
    return label.length > WORKING_LABEL_MAX
        ? `${label.slice(0, WORKING_LABEL_MAX - 1).trimEnd()}…`
        : label;
}

export interface KissopenAgentWorkingWait {
    readonly startedAt: number;
    readonly dueAt: number;
}

function workingWaitProject(
    session: SessionState | undefined,
): KissopenAgentWorkingWait | undefined {
    const wait = session?.activity.wait;
    if (wait === undefined || !Number.isFinite(wait.startedAt) || !Number.isFinite(wait.dueAt))
        return undefined;
    return { startedAt: wait.startedAt, dueAt: wait.dueAt };
}

function transcriptUsageProject(usage: SessionUsage): KissopenAgentSessionUsage {
    return {
        currentProviderId: usage.currentProviderId,
        groups: usage.groups.map((group) => ({
            modelId: group.modelId,
            providerId: group.providerId,
            inputTokens: group.usage.input,
            outputTokens: group.usage.output,
            cacheReadTokens: group.usage.cacheRead,
            cacheWriteTokens: group.usage.cacheWrite,
            totalTokens: group.usage.totalTokens,
            ...(group.usage.reasoning === undefined
                ? {}
                : { reasoningTokens: group.usage.reasoning }),
            cost: group.usage.cost.total,
        })),
        totalTokens: usage.totalTokens,
        totalCost: usage.totalCost,
        ...(usage.context
            ? {
                  context: {
                      ...(usage.context.modelId === undefined
                          ? {}
                          : { modelId: usage.context.modelId }),
                      providerId: usage.context.providerId,
                      totalTokens: usage.context.totalTokens,
                      contextWindow: usage.context.contextWindow,
                      approximate: usage.context.approximate,
                  },
              }
            : {}),
        quotas: usage.quotas.map((quota) => ({
            providerId: quota.providerId,
            windows: (
                [
                    ["fiveHour", quota.quota.windows.fiveHour],
                    ["weekly", quota.quota.windows.weekly],
                ] as const
            ).flatMap(([kind, window]) =>
                window?.status === "available"
                    ? [{ kind, usedPercent: window.usedPercent, resetsAt: window.resetsAt }]
                    : [],
            ),
        })),
    };
}

function transcriptPendingUserInputsProject(
    session: SessionState,
): readonly KissopenAgentUserInputRequest[] {
    return session.pendingUserInputs.map((request) => ({
        requestId: request.requestId,
        questions: request.questions.map((question) => ({
            id: question.id,
            header: question.header,
            question: question.question,
            multiSelect: question.multiSelect,
            required: question.required ?? false,
            options: question.options,
        })),
    }));
}

function transcriptQueuedMessagesProject(
    session: SessionState,
): readonly KissopenAgentQueuedMessage[] {
    return session.pendingSteeringMessages.map((pending) => ({
        id: pending.message.id,
        text: pending.message.blocks
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n"),
    }));
}

function transcriptTasksProject(session: SessionState): readonly KissopenAgentTask[] {
    return session.tasks.map((task) => ({
        id: task.id,
        subject: task.subject,
        description: task.description,
        status: task.status,
        ...(task.activeForm === undefined ? {} : { activeForm: task.activeForm }),
        ...(task.owner === undefined ? {} : { owner: task.owner }),
        blockedBy: task.blockedBy,
        blocks: task.blocks,
    }));
}

function transcriptGoalProject(session: SessionState): KissopenAgentGoal | undefined {
    const goal = session.goal;
    return goal === undefined
        ? undefined
        : {
              objective: goal.objective,
              status: goal.status,
              createdAt: goal.createdAt,
              updatedAt: goal.updatedAt,
          };
}

function transcriptSubagentsProject(session: SessionState): readonly SubagentSummary[] {
    return session.subagents.map((subagent) => ({
        id: subagent.id as KissopenAgentSessionId,
        parentSessionId: subagent.parentSessionId as KissopenAgentSessionId,
        ...(subagent.parentToolCallId === undefined
            ? {}
            : { parentToolCallId: subagent.parentToolCallId }),
        description: subagent.description,
        ...(subagent.taskName === undefined ? {} : { taskName: subagent.taskName }),
        modelId: subagent.modelId,
        status: subagent.status,
        depth: subagent.depth,
        createdAt: subagent.createdAt,
        updatedAt: subagent.updatedAt,
        ...(subagent.activeSince === undefined ? {} : { activeSince: subagent.activeSince }),
        ...(subagent.elapsedMs === undefined ? {} : { elapsedMs: subagent.elapsedMs }),
        ...(subagent.latestText === undefined ? {} : { latestText: subagent.latestText }),
        ...(subagent.totalTokens === undefined ? {} : { totalTokens: subagent.totalTokens }),
    }));
}

function transcriptBackgroundProcessesProject(
    session: SessionState,
): readonly KissopenAgentBackgroundProcess[] {
    return session.backgroundProcesses.map((process) => ({
        id: process.sessionId,
        command: process.command,
        cwd: process.cwd,
        status: process.status,
    }));
}

function detachedProcessIdsFromElements(elements: readonly ChatElement[]): ReadonlySet<number> {
    const ids = new Set<number>();
    for (const element of elements) {
        if (element.kind !== "tool_call") continue;
        const presentation = element.presentation;
        if (presentation?.kind === "command" && presentation.terminalId !== undefined)
            ids.add(presentation.terminalId);
        if (presentation?.kind === "terminal_input") ids.add(presentation.terminalId);
    }
    return ids;
}

/** @internal Purely classifies the current process snapshot for activity UI. */
export function detachedProcessIdsUpdate(
    previous: ReadonlySet<number>,
    elements: readonly ChatElement[],
    processes: readonly SessionState["backgroundProcesses"][number][],
    activeTurn: SessionState["activeTurn"] = undefined,
): ReadonlySet<number> {
    const detachedIds = new Set(detachedProcessIdsFromElements(elements));
    const activeIds = new Set(processes.map((process) => process.sessionId));
    const next = new Set<number>();
    for (const id of previous) if (activeIds.has(id)) next.add(id);
    for (const id of detachedIds) if (activeIds.has(id)) next.add(id);
    if (activeTurn === undefined) for (const id of activeIds) next.add(id);
    if (next.size === previous.size && [...next].every((id) => previous.has(id))) return previous;
    return next;
}

function contextGaugeDerive(
    catalog: KissopenAgentModelCatalog,
    context: KissopenAgentSessionUsage["context"],
    selection?: { readonly modelId: string; readonly providerId: string },
): KissopenAgentContextGauge | undefined {
    const catalogModel = (providerId: string, modelId: string) =>
        catalog.providers
            .find((provider) => provider.id === providerId)
            ?.models.find((model) => model.id === modelId);
    // The daemon compacts at the model's published threshold, so that point, not a share of
    // the window, is where the meter marks compaction; a limit at or past the window is no
    // threshold at all.
    const compactTokensOf = (
        model: KissopenAgentModel | undefined,
        total: number,
    ): { readonly compactTokens: number } | Record<never, never> =>
        model?.autoCompactWindow !== undefined &&
        model.autoCompactWindow > 0 &&
        model.autoCompactWindow < total
            ? { compactTokens: model.autoCompactWindow }
            : {};
    if (!context) {
        if (selection === undefined) return undefined;
        const model = catalogModel(selection.providerId, selection.modelId);
        const total = model?.contextWindow;
        if (total === undefined || total <= 0) return undefined;
        return {
            usedTokens: 0,
            remainingTokens: total,
            totalTokens: total,
            remainingFraction: 1,
            ...compactTokensOf(model, total),
            approximate: false,
            measured: false,
        };
    }
    const model =
        context.modelId === undefined
            ? undefined
            : catalogModel(context.providerId, context.modelId);
    const total = context.contextWindow ?? model?.contextWindow;
    if (total == null || total <= 0) return undefined;
    const usedTokens = Math.max(0, Math.min(context.totalTokens, total));
    const remainingTokens = total - usedTokens;
    return {
        usedTokens,
        remainingTokens,
        totalTokens: total,
        remainingFraction: remainingTokens / total,
        ...compactTokensOf(model, total),
        approximate: context.approximate,
    };
}

interface KissopenAgentImageRef {
    readonly messageId: string;
    readonly attachmentId: string;
}

interface KissopenAgentGalleryImage extends KissopenAgentImageRef {
    readonly attachment: ConversationAttachment;
}

function imageSourceOf(
    attachment: ConversationAttachment,
): { readonly url: string; readonly alt: string } | undefined {
    if (attachment.kind === "inlineImage")
        return {
            url: `data:${attachment.mediaType};base64,${attachment.data}`,
            alt: t("Attached image"),
        };
    // A picture still on its way has nothing to open full size yet.
    if (attachment.kind === "pendingImage") return undefined;
    if (attachment.attachmentKind === "image" && attachment.openUrl)
        return { url: attachment.openUrl, alt: attachment.name };
    return undefined;
}

function imageGalleryOf(
    entries: readonly ConversationEntry[],
): readonly KissopenAgentGalleryImage[] {
    const gallery: KissopenAgentGalleryImage[] = [];
    for (const entry of entries) {
        if (entry.kind !== "message") continue;
        for (const attachment of entry.message.attachments)
            if (imageSourceOf(attachment))
                gallery.push({
                    messageId: entry.message.id,
                    attachmentId: attachment.id,
                    attachment,
                });
    }
    return gallery;
}

export interface KissopenAgentOpenImage {
    readonly id: string;
    readonly url: string;
    readonly alt: string;
    readonly index: number;
    readonly total: number;
}

function openImageProject(
    entries: readonly ConversationEntry[],
    ref: KissopenAgentImageRef | undefined,
): KissopenAgentOpenImage | undefined {
    if (!ref) return undefined;
    const gallery = imageGalleryOf(entries);
    const index = gallery.findIndex(
        (image) => image.messageId === ref.messageId && image.attachmentId === ref.attachmentId,
    );
    const found = gallery[index];
    if (!found) return undefined;
    const source = imageSourceOf(found.attachment);
    return source === undefined
        ? undefined
        : {
              id: found.attachmentId,
              url: source.url,
              alt: source.alt,
              index,
              total: gallery.length,
          };
}

function sessionStatusProject(session: SessionState): KissopenAgentSessionStatus {
    if (session.archived) return "archived";
    return session.status === "failed" ? "error" : session.status;
}

function sessionProject(session: SessionState): KissopenAgentSession {
    const projectId = (session.projectId ??
        session.workspaceId ??
        session.sessionId) as KissopenAgentProjectId;
    const scope =
        session.scope.kind === "workspace"
            ? {
                  kind: "workspace" as const,
                  projectId: session.scope.projectId as KissopenAgentProjectId,
                  worktreeId: session.scope.workspaceId as KissopenAgentWorktreeId,
              }
            : {
                  kind: "project" as const,
                  projectId:
                      session.scope.kind === "project"
                          ? (session.scope.projectId as KissopenAgentProjectId)
                          : projectId,
              };
    return {
        id: session.sessionId as KissopenAgentSessionId,
        scope,
        ...(session.orderKey === undefined ? {} : { orderKey: session.orderKey }),
        cwd: session.cwd,
        displayCwd: session.cwd,
        providerId: session.providerId,
        modelId: session.modelId,
        models: [],
        ...(session.effort === undefined
            ? {}
            : { effort: session.effort as KissopenAgentThinkingLevel }),
        ...(session.serviceTier === undefined
            ? {}
            : { serviceTier: session.serviceTier as KissopenAgentServiceTier }),
        permissionMode: session.permissionMode as KissopenAgentPermissionMode,
        modelLocked: session.modelLocked,
        status: sessionStatusProject(session),
        ...(session.title === undefined ? {} : { title: session.title }),
        ...(session.recap === undefined ? {} : { recap: session.recap }),
        ...(session.draft === undefined ? {} : { draft: session.draft }),
        ...(session.draftUpdatedAt === undefined ? {} : { draftUpdatedAt: session.draftUpdatedAt }),
        queuedMessages: transcriptQueuedMessagesProject(session),
        pendingUserInputs: transcriptPendingUserInputsProject(session),
        ...(transcriptGoalProject(session) === undefined
            ? {}
            : { goal: transcriptGoalProject(session)! }),
        tasks: transcriptTasksProject(session),
        subagents: transcriptSubagentsProject(session),
        backgroundProcesses: transcriptBackgroundProcessesProject(session),
        createdAt: session.activity.since,
        updatedAt: session.activity.since,
    };
}

export interface KissopenAgentChatSnapshot {
    readonly sessionId: KissopenAgentSessionId;
    readonly ready: boolean;
    readonly archived: boolean;
    readonly title?: string;
    readonly cwd?: string;
    readonly draft?: string;
    readonly draftUpdatedAt?: number;
    readonly session: Loadable<KissopenAgentSession>;
    readonly entries: readonly ConversationEntry[];
    /** Who the agent's messages are from: the conversation's assistant, or the product. */
    readonly agentAuthor: ConversationAuthor;
    readonly runStatus: "idle" | "running";
    readonly workingPhase: KissopenAgentWorkingPhase;
    readonly workingLabel?: string;
    readonly workingWait?: KissopenAgentWorkingWait;
    readonly activeTurnId?: string;
    readonly runId?: string;
    readonly runStartedAt?: number;
    readonly turnElapsedMs?: number;
    readonly transcriptComplete: boolean;
    readonly loadingMore: boolean;
    readonly loadMoreError?: string;
    readonly pendingUserInputs: readonly KissopenAgentUserInputRequest[];
    readonly requestSubmissions: readonly ConversationRequestSubmission[];
    readonly requestSelections: ReadonlyMap<string, Readonly<Record<string, readonly string[]>>>;
    readonly queuedMessages: readonly KissopenAgentQueuedMessage[];
    /** Complete ordered slash-command catalog projected from the focused agent. */
    readonly slashCommands: readonly KissopenAgentSlashCommand[];
    readonly tasks: readonly KissopenAgentTask[];
    readonly goal?: KissopenAgentGoal;
    readonly subagents: readonly SubagentSummary[];
    readonly backgroundProcesses: readonly KissopenAgentBackgroundProcess[];
    readonly detachedBackgroundProcessIds: ReadonlySet<number>;
    readonly modelLocked: boolean;
    readonly showReasoning: boolean;
    readonly expandedTurnIds: ReadonlySet<string>;
    readonly usage?: KissopenAgentSessionUsage;
    readonly usageLoading: boolean;
    readonly usageError?: string;
    readonly contextGauge?: KissopenAgentContextGauge;
    readonly activityPanelOpen: boolean;
    readonly openImage?: KissopenAgentOpenImage;
    readonly menus?: KissopenAgentMenusSnapshot;
}

export type KissopenAgentChatOutput =
    | {
          readonly type: "messageSent";
          readonly sessionId: KissopenAgentSessionId;
          readonly steered: boolean;
      }
    | { readonly type: "runAborted"; readonly sessionId: KissopenAgentSessionId }
    | {
          readonly type: "inputAnswered";
          readonly sessionId: KissopenAgentSessionId;
          readonly requestId: string;
      };

export interface KissopenAgentChatStore {
    get(): KissopenAgentChatSnapshot;
    /** True while an action still needs this store to surface a rejection. */
    hasPendingMutations(): boolean;
    subscribe(listener: () => void): () => void;
    sessionRetry(): void;
    historyLoadMore(): void;
    /**
     * Sends a message. `displayText`, for a message the product composed, is
     * the short label a person sees in its place; the text is the agent's.
     */
    messageSend(
        text: string,
        images?: readonly KissopenAgentImageInput[],
        displayText?: string,
    ): Promise<void>;
    slashCommandInvoke(name: string, argumentsValue?: string): Promise<void>;
    draftSet(draft: string, updatedAt: number, origin: string): Promise<void>;
    runAbort(): Promise<void>;
    /** Takes back a message still waiting for the agent. */
    messageWithdraw(messageId: string): Promise<void>;
    answerInput(input: KissopenAgentUserInputAnswers): Promise<void>;
    requestSelectionUpdate(
        requestId: string,
        answers: Readonly<Record<string, readonly string[]>>,
    ): void;
    modelUpdate(input: KissopenAgentModelSelection): void;
    effortUpdate(effort?: KissopenAgentThinkingLevel): void;
    permissionModeUpdate(permissionMode: KissopenAgentPermissionMode): void;
    serviceTierUpdate(serviceTier?: KissopenAgentServiceTier): void;
    compact(): Promise<void>;
    backgroundProcessStop(processId: number): Promise<void>;
    usageGet(): Promise<KissopenAgentSessionUsage>;
    activityPanelToggle(): void;
    activityPanelShow(): void;
    activityPanelClose(): void;
    imageOpen(messageId: string, attachmentId: string): void;
    imageNext(): void;
    imagePrevious(): void;
    imageClose(): void;
    reasoningToggle(): void;
    turnTraceToggle(turnId: string): void;
    [Symbol.dispose](): void;
}

export interface KissopenAgentChatDeps {
    readonly catalog: KissopenAgentModelCatalog;
    readonly catalogSubscribe?: (
        listener: (catalog: KissopenAgentModelCatalog) => void,
    ) => () => void;
    readonly transcriptConnect: KissopenAgentChatTranscriptConnect;
    readonly connectActions: Pick<
        KissopenAgentConnection,
        | "answerUserInput"
        | "compactSession"
        | "invokeSlashCommand"
        | "sendMessage"
        | "setDraft"
        | "setEffort"
        | "setPermissionMode"
        | "setServiceTier"
        | "stopBackgroundProcess"
        | "stopRun"
        | "switchModel"
        | "withdrawMessage"
    >;
    readonly connectMutationSubscribe: (
        listener: (rejection: MutationRejectedDelta) => void,
    ) => () => void;
    readonly selectionUsed?: (selection: KissopenAgentSelection) => void;
    readonly modelSelect?: (
        current: KissopenAgentSelection,
        input: KissopenAgentModelSelection,
    ) => KissopenAgentSelection;
    readonly output?: (event: KissopenAgentChatOutput) => void;
}

export interface KissopenAgentChatTranscriptConnection {
    close(): void;
    loadMore(token: string): void;
}

export type KissopenAgentChatTranscriptConnect = (options: {
    readonly sessionId: KissopenAgentSessionId;
    readonly onChange: (
        elements: readonly ChatElement[],
        session: SessionState,
        answeredUserInputs: readonly KissopenAgentAnsweredUserInput[],
    ) => void;
    readonly onError: (error: unknown) => void;
}) => KissopenAgentChatTranscriptConnection;

function transcriptSelectionOf(session: SessionState): KissopenAgentSelection {
    return {
        providerId: session.providerId,
        modelId: session.modelId,
        effort: session.effort as KissopenAgentThinkingLevel | undefined,
        permissionMode: session.permissionMode as KissopenAgentPermissionMode,
        serviceTier: session.serviceTier as KissopenAgentServiceTier | undefined,
    };
}

export function kissopenAgentChatStoreCreate(
    sessionId: KissopenAgentSessionId,
    deps: KissopenAgentChatDeps,
): KissopenAgentChatStore {
    const output = deps.output ?? (() => undefined);
    const store = createStore<KissopenAgentChatSnapshot>()(() => ({
        sessionId,
        session: { type: "loading" },
        modelLocked: false,
        ready: false,
        archived: false,
        entries: [],
        agentAuthor,
        runStatus: "idle",
        workingPhase: "working",
        transcriptComplete: true,
        loadingMore: false,
        pendingUserInputs: [],
        requestSubmissions: [],
        requestSelections: new Map(),
        queuedMessages: [],
        slashCommands: [],
        tasks: [],
        subagents: [],
        backgroundProcesses: [],
        detachedBackgroundProcessIds: new Set<number>(),
        showReasoning: false,
        expandedTurnIds: new Set<string>(),
        usageLoading: false,
        activityPanelOpen: false,
    }));

    const listeners = new Set<() => void>();
    let catalog = deps.catalog;
    let disposed = false;
    let active = false;
    let status: "loading" | "ready" | "error" = "loading";
    let error: UserError | undefined;
    let transcriptElements: readonly ChatElement[] | undefined;
    let transcriptSession: SessionState | undefined;
    let slashCommandSource: SessionState["slashCommands"] | undefined;
    let slashCommands: readonly KissopenAgentSlashCommand[] = [];
    let transcriptAnsweredUserInputs: readonly KissopenAgentAnsweredUserInput[] = [];
    let transcriptConnection: KissopenAgentChatTranscriptConnection | undefined;
    let detachedBackgroundProcessIds: ReadonlySet<number> = new Set();
    let mutationRejection: MutationRejectedDelta | undefined;
    const pendingMutationIds = new Set<string>();
    const pendingMutationOrder: { readonly id: string; readonly trackedAt: number }[] = [];
    /* Replaced rather than edited, so the transcript projection can settle
       "were these the images the last projection saw?" by identity. */
    let sentImages: ReadonlyMap<string, readonly KissopenAgentImageInput[]> = new Map();
    let sentImageBytes = 0;
    const conversationCache = kissopenAgentConversationCacheCreate();
    /* The session reports its assistant afresh on every publish; the identity
       is kept while its name, handle and picture stay the same, so the author
       is one object and the projection's cached turns stand. */
    let assistantIdentity: KissopenAgentAssistantIdentity | undefined;
    const agentAuthorOf = (assistant: SessionState["assistant"]): ConversationAuthor => {
        if (assistant === undefined) {
            assistantIdentity = undefined;
            return agentAuthor;
        }
        if (
            assistantIdentity === undefined ||
            assistantIdentity.name !== assistant.name ||
            assistantIdentity.username !== assistant.username ||
            assistantIdentity.avatarUrl !== assistant.avatarUrl
        )
            assistantIdentity = assistant;
        return kissopenAgentAgentAuthor(assistantIdentity);
    };
    /* Nothing is projected into this conversation from outside it, and the
       projection compares what it was given last time, so the empty list is one
       object rather than a new one per commit. */
    const NO_EPHEMERAL: readonly ConversationEntry[] = [];
    let runStatus: "idle" | "running" = "idle";
    let runId: string | undefined;
    let runStartedAt: number | undefined;
    let turnElapsedMs: number | undefined;
    let showReasoning = false;
    let expandedTurnIds: ReadonlySet<string> = new Set();
    let activityPanelOpen = false;
    let openImageRef: KissopenAgentImageRef | undefined;
    const requestSubmissions = new Map<string, ConversationRequestSubmission>();
    const requestSelections = new Map<string, Readonly<Record<string, readonly string[]>>>();

    const sessionLoadable = (): Loadable<KissopenAgentSession> =>
        status === "ready" && transcriptSession !== undefined
            ? { type: "ready", value: sessionProject(transcriptSession) }
            : status === "error" && error !== undefined
              ? { type: "error", error }
              : { type: "loading" };

    const commit = (): void => {
        const previous = store.getState();
        const connected = transcriptSession;
        const elements = transcriptElements ?? [];
        const pendingUserInputs =
            connected === undefined ? [] : transcriptPendingUserInputsProject(connected);
        if (connected?.slashCommands !== slashCommandSource) {
            slashCommandSource = connected?.slashCommands;
            slashCommands = (connected?.slashCommands ?? []).map((command) => ({
                name: command.name,
                description: command.description,
                hasArguments: command.hasArguments,
                ...(command.kind === undefined ? {} : { kind: command.kind }),
            }));
        }
        const subagents = connected === undefined ? [] : transcriptSubagentsProject(connected);
        const tasks = connected === undefined ? [] : transcriptTasksProject(connected);
        const goal = connected === undefined ? undefined : transcriptGoalProject(connected);
        const backgroundProcesses =
            connected === undefined ? [] : transcriptBackgroundProcessesProject(connected);
        const author = agentAuthorOf(connected?.assistant);
        const built =
            connected === undefined
                ? []
                : kissopenAgentConversationProject({
                      cache: conversationCache,
                      elements,
                      sentImages,
                      sessionId,
                      showReasoning,
                      ephemeral: NO_EPHEMERAL,
                      pendingUserInputs,
                      answeredUserInputs: transcriptAnsweredUserInputs,
                      expandedGroupIds: expandedTurnIds,
                      subagents,
                      agentAuthor: author,
                  });
        const withHistory: readonly ConversationEntry[] =
            connected?.loadingMore === true
                ? [
                      {
                          kind: "notice",
                          id: "kissopen-agent:loading-more",
                          variant: "notice",
                          level: "info",
                          text: t("Loading earlier messages…"),
                          sequence: "",
                      },
                      ...built,
                  ]
                : connected?.loadMoreError
                  ? [
                        {
                            kind: "notice",
                            id: "kissopen-agent:load-more-error",
                            variant: "notice",
                            level: "error",
                            title: t("Earlier messages unavailable"),
                            text: connected.loadMoreError,
                            sequence: "",
                        },
                        ...built,
                    ]
                  : built;
        const withMutation: readonly ConversationEntry[] =
            mutationRejection === undefined
                ? withHistory
                : [
                      {
                          kind: "notice",
                          id: `kissopen-agent:mutation-rejected:${mutationRejection.mutationId}`,
                          variant: "notice",
                          level: "error",
                          title: t("Action not applied"),
                          text: mutationRejection.message,
                          sequence: "",
                      },
                      ...withHistory,
                  ];
        const entries = entriesMerge(previous.entries, withMutation);
        const waitingForModel = waitingForModelProject(connected, transcriptElements, runStatus);
        const usage =
            connected?.usage === undefined ? undefined : transcriptUsageProject(connected.usage);
        const workingLabel = workingLabelProject(connected, waitingForModel);
        const workingWait = workingWaitProject(connected);
        const openImage = openImageProject(entries, openImageRef);
        const next: KissopenAgentChatSnapshot = {
            sessionId,
            ready: connected !== undefined && connected.historyLoading !== true,
            archived: connected?.archived ?? false,
            ...(connected?.title === undefined ? {} : { title: connected.title }),
            ...(connected?.cwd === undefined ? {} : { cwd: connected.cwd }),
            ...(connected?.draft === undefined ? {} : { draft: connected.draft }),
            ...(connected?.draftUpdatedAt === undefined
                ? {}
                : { draftUpdatedAt: connected.draftUpdatedAt }),
            session: sessionLoadable(),
            entries,
            agentAuthor: author,
            runStatus,
            workingPhase: workingPhaseProject(connected, waitingForModel),
            ...(workingLabel === undefined ? {} : { workingLabel }),
            ...(workingWait === undefined ? {} : { workingWait }),
            ...(runId === undefined ? {} : { runId }),
            ...(runStartedAt === undefined ? {} : { runStartedAt }),
            ...(turnElapsedMs === undefined ? {} : { turnElapsedMs }),
            transcriptComplete: connected?.transcriptComplete ?? true,
            loadingMore: connected?.loadingMore ?? false,
            ...(connected?.loadMoreError === undefined
                ? {}
                : { loadMoreError: connected.loadMoreError }),
            pendingUserInputs,
            requestSubmissions: [...requestSubmissions.values()],
            requestSelections: new Map(requestSelections),
            queuedMessages:
                connected === undefined ? [] : transcriptQueuedMessagesProject(connected),
            slashCommands,
            tasks,
            ...(goal === undefined ? {} : { goal }),
            subagents,
            backgroundProcesses,
            detachedBackgroundProcessIds,
            modelLocked: connected?.modelLocked ?? false,
            showReasoning,
            expandedTurnIds,
            ...(usage === undefined ? {} : { usage }),
            usageLoading: false,
            contextGauge: contextGaugeDerive(
                catalog,
                usage?.context,
                connected === undefined
                    ? undefined
                    : {
                          modelId: connected.modelId,
                          providerId: connected.providerId,
                      },
            ),
            activityPanelOpen,
            ...(openImage === undefined ? {} : { openImage }),
            ...(connected === undefined
                ? {}
                : {
                      menus: kissopenAgentMenusDerive(catalog, transcriptSelectionOf(connected)),
                  }),
        };
        /* The transcript answers for itself: `entriesMerge` returns the very
           list it was given when nothing moved, so a new one is a change and
           needs no further inspection. Only when the transcript stood still is
           the rest of the snapshot worth comparing — and then the comparison
           settles the transcript on one reference rather than walking it. */
        if (entries !== previous.entries || !deepEqual(previous, next)) store.setState(next, true);
    };

    const start = (): void => {
        if (active || disposed) return;
        active = true;
        transcriptConnection = deps.transcriptConnect({
            sessionId,
            onChange: (elements, connected, answeredUserInputs) => {
                if (!active || disposed) return;
                transcriptElements = elements;
                transcriptSession = connected;
                transcriptAnsweredUserInputs = answeredUserInputs;
                detachedBackgroundProcessIds = detachedProcessIdsUpdate(
                    detachedBackgroundProcessIds,
                    elements,
                    connected.backgroundProcesses,
                    connected.activeTurn,
                );
                runStatus = transcriptSessionBusy(connected) ? "running" : "idle";
                runId = connected.activeTurn?.runId;
                runStartedAt = connected.activeTurn?.startedAt;
                turnElapsedMs = undefined;
                if (connected.activeTurn === undefined)
                    for (let index = elements.length - 1; index >= 0; index -= 1) {
                        const element = elements[index];
                        if (element?.kind !== "group_end") continue;
                        turnElapsedMs = element.turnElapsedMs;
                        break;
                    }
                status = "ready";
                error = undefined;
                commit();
            },
            onError: (caught) => {
                if (!active || disposed) return;
                if (transcriptSession === undefined) {
                    status = "error";
                    error = kissopenAgentUserError(caught);
                } else {
                    transcriptSession = { ...transcriptSession, connection: "closed" };
                }
                commit();
            },
        });
    };

    const stop = (): void => {
        active = false;
        transcriptConnection?.close();
        transcriptConnection = undefined;
    };

    const notify = (): void => {
        for (const listener of listeners) listener();
    };
    const storeUnsubscribe = store.subscribe(notify);
    const unsubscribeCatalog = deps.catalogSubscribe?.((next) => {
        if (disposed || catalog === next) return;
        catalog = next;
        commit();
    });

    const connectMutationTrack = (mutationId: string): void => {
        const rejectionWasVisible = mutationRejection !== undefined;
        mutationRejection = undefined;
        pendingMutationIds.add(mutationId);
        pendingMutationOrder.push({ id: mutationId, trackedAt: Date.now() });
        while (pendingMutationOrder.length > PENDING_MUTATION_LIMIT) {
            const expired = pendingMutationOrder.shift();
            if (expired !== undefined) pendingMutationIds.delete(expired.id);
        }
        if (rejectionWasVisible) commit();
    };

    const pendingMutationActive = (): boolean => {
        const cutoff = Date.now() - PENDING_MUTATION_RETENTION_MS;
        while (pendingMutationOrder[0]?.trackedAt < cutoff) {
            const expired = pendingMutationOrder.shift();
            if (expired !== undefined) pendingMutationIds.delete(expired.id);
        }
        return pendingMutationIds.size > 0;
    };

    const unsubscribeMutationRejections = deps.connectMutationSubscribe((rejection) => {
        if (!pendingMutationIds.delete(rejection.mutationId)) return;
        mutationRejection = rejection;
        commit();
    });

    const rejecting = async (run: () => void | Promise<void>): Promise<void> => {
        try {
            await run();
        } catch (caught) {
            throw kissopenAgentUserError(caught);
        }
    };

    const sentImagesRemember = (
        messageId: string,
        images: readonly KissopenAgentImageInput[],
    ): void => {
        const bytes = images.reduce((total, image) => total + image.data.length, 0);
        const next = new Map(sentImages);
        next.set(messageId, images);
        sentImageBytes += bytes;
        for (const [oldest, held] of next) {
            if (sentImageBytes <= SENT_IMAGE_BUDGET_BYTES || oldest === messageId) break;
            next.delete(oldest);
            sentImageBytes -= held.reduce((total, image) => total + image.data.length, 0);
        }
        sentImages = next;
    };

    const answerInputRun = (input: KissopenAgentUserInputAnswers): Promise<void> =>
        rejecting(() => {
            connectMutationTrack(
                deps.connectActions.answerUserInput(sessionId, input.requestId, {
                    answers: input.answers,
                }),
            );
            output({ type: "inputAnswered", sessionId, requestId: input.requestId });
        });

    const pendingQuestionAnswer = async (text: string): Promise<{ textUsed: boolean }> => {
        const request = store.getState().pendingUserInputs[0];
        const message = text.trim();
        if (request === undefined || message.length === 0) return { textUsed: false };
        const ticked = requestSelections.get(request.requestId) ?? {};
        const answers: Record<string, readonly string[]> = {};
        let textUsed = false;
        for (const question of request.questions) {
            const chosen = ticked[question.id] ?? [];
            if (chosen.length > 0) answers[question.id] = [...chosen];
            else {
                answers[question.id] = [message];
                textUsed = true;
            }
        }
        await answerInputRun({ requestId: request.requestId, answers });
        requestSelections.delete(request.requestId);
        return { textUsed };
    };

    const imageStep = (direction: 1 | -1): void => {
        if (openImageRef === undefined) return;
        const gallery = imageGalleryOf(store.getState().entries);
        if (gallery.length < 2) return;
        const at = gallery.findIndex(
            (image) =>
                image.messageId === openImageRef?.messageId &&
                image.attachmentId === openImageRef.attachmentId,
        );
        if (at < 0) return;
        const next = gallery[(at + direction + gallery.length) % gallery.length];
        if (next === undefined) return;
        openImageRef = { messageId: next.messageId, attachmentId: next.attachmentId };
        commit();
    };

    return {
        get: () => store.getState(),
        hasPendingMutations: pendingMutationActive,
        subscribe(listener) {
            listeners.add(listener);
            if (listeners.size === 1) start();
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0) stop();
            };
        },
        sessionRetry() {
            if (!active || status !== "error") return;
            stop();
            status = "loading";
            error = undefined;
            start();
            commit();
        },
        historyLoadMore() {
            const token = transcriptSession?.loadMoreToken;
            if (token === undefined || transcriptSession?.loadingMore === true) return;
            transcriptConnection?.loadMore(token);
        },
        messageSend: (text, images, displayText) =>
            rejecting(async () => {
                if (displayText === undefined && (await pendingQuestionAnswer(text)).textUsed)
                    return;
                const steered = runStatus === "running";
                const mutationId = deps.connectActions.sendMessage(
                    sessionId,
                    images && images.length > 0
                        ? {
                              text,
                              content: [
                                  { type: "text", text },
                                  ...images.map((image) => ({
                                      type: "image" as const,
                                      mediaType: image.mediaType,
                                      data: image.data,
                                  })),
                              ],
                              ...(displayText === undefined ? {} : { displayText }),
                          }
                        : displayText === undefined
                          ? text
                          : { text, displayText },
                );
                if (images && images.length > 0) sentImagesRemember(mutationId, images);
                connectMutationTrack(mutationId);
                output({ type: "messageSent", sessionId, steered });
            }),
        slashCommandInvoke: (name, argumentsValue) =>
            rejecting(() => {
                // A skill is not a command the daemon runs on its own: it is a
                // document the model has to read before it acts. So invoking one
                // sends an ordinary user message that carries an explicit request
                // for the `read_skill` tool. Kissopen Agent runs that tool before
                // inference, records the call and its result in the transcript, and
                // the model continues with the instructions loaded. The message text
                // is the command as the reader typed it, so the transcript shows the
                // invocation and the model reads the ask beside the loaded document.
                const command = slashCommands.find((one) => one.name === name);
                if (command?.kind === "skill") {
                    const steered = runStatus === "running";
                    const text =
                        argumentsValue === undefined || argumentsValue.trim().length === 0
                            ? `/${name}`
                            : `/${name} ${argumentsValue}`;
                    connectMutationTrack(
                        deps.connectActions.sendMessage(sessionId, {
                            text,
                            content: [
                                { type: "text", text },
                                {
                                    type: "tool_call_request",
                                    name: "read_skill",
                                    arguments: { name },
                                },
                            ],
                        }),
                    );
                    output({ type: "messageSent", sessionId, steered });
                    return;
                }
                connectMutationTrack(
                    deps.connectActions.invokeSlashCommand(sessionId, name, argumentsValue),
                );
            }),
        draftSet: (draft, updatedAt, origin) =>
            rejecting(() => {
                connectMutationTrack(
                    deps.connectActions.setDraft(sessionId, { draft, updatedAt, origin }),
                );
            }),
        runAbort: () =>
            rejecting(() => {
                connectMutationTrack(deps.connectActions.stopRun(sessionId));
                output({ type: "runAborted", sessionId });
            }),
        messageWithdraw: (messageId) =>
            rejecting(() => {
                connectMutationTrack(deps.connectActions.withdrawMessage(sessionId, messageId));
            }),
        answerInput: answerInputRun,
        requestSelectionUpdate(requestId, answers) {
            requestSelections.set(requestId, answers);
            commit();
        },
        modelUpdate(input) {
            const connected = transcriptSession;
            if (connected === undefined) return;
            const current = transcriptSelectionOf(connected);
            const next =
                deps.modelSelect?.(current, input) ??
                kissopenAgentSelectionModelUpdate(catalog, current, input);
            deps.selectionUsed?.(next);
            connectMutationTrack(
                deps.connectActions.switchModel(sessionId, {
                    providerId: next.providerId,
                    modelId: next.modelId,
                }),
            );
            if (next.effort !== current.effort)
                connectMutationTrack(deps.connectActions.setEffort(sessionId, next.effort));
            if (next.serviceTier !== current.serviceTier)
                connectMutationTrack(
                    deps.connectActions.setServiceTier(sessionId, next.serviceTier),
                );
        },
        effortUpdate(effort) {
            if (transcriptSession !== undefined)
                deps.selectionUsed?.(
                    kissopenAgentSelectionEffortUpdate(
                        transcriptSelectionOf(transcriptSession),
                        effort,
                    ),
                );
            connectMutationTrack(deps.connectActions.setEffort(sessionId, effort));
        },
        permissionModeUpdate(permissionMode) {
            connectMutationTrack(deps.connectActions.setPermissionMode(sessionId, permissionMode));
        },
        serviceTierUpdate(serviceTier) {
            if (transcriptSession !== undefined)
                deps.selectionUsed?.(
                    kissopenAgentSelectionServiceTierUpdate(
                        transcriptSelectionOf(transcriptSession),
                        serviceTier,
                    ),
                );
            connectMutationTrack(deps.connectActions.setServiceTier(sessionId, serviceTier));
        },
        compact: () =>
            rejecting(() => {
                connectMutationTrack(deps.connectActions.compactSession(sessionId));
            }),
        backgroundProcessStop: (processId) =>
            rejecting(() => {
                connectMutationTrack(
                    deps.connectActions.stopBackgroundProcess(sessionId, processId),
                );
            }),
        usageGet() {
            const usage = transcriptSession?.usage;
            return usage === undefined
                ? Promise.reject(new UserError("Usage is not available yet."))
                : Promise.resolve(transcriptUsageProject(usage));
        },
        activityPanelToggle() {
            activityPanelOpen = !activityPanelOpen;
            commit();
        },
        activityPanelShow() {
            if (activityPanelOpen) return;
            activityPanelOpen = true;
            commit();
        },
        activityPanelClose() {
            if (!activityPanelOpen) return;
            activityPanelOpen = false;
            commit();
        },
        imageOpen(messageId, attachmentId) {
            const ref = { messageId, attachmentId };
            if (openImageProject(store.getState().entries, ref) === undefined) return;
            openImageRef = ref;
            commit();
        },
        imageNext() {
            imageStep(1);
        },
        imagePrevious() {
            imageStep(-1);
        },
        imageClose() {
            if (openImageRef === undefined) return;
            openImageRef = undefined;
            commit();
        },
        reasoningToggle() {
            showReasoning = !showReasoning;
            commit();
        },
        turnTraceToggle(turnId) {
            const next = new Set(expandedTurnIds);
            if (!next.delete(turnId)) next.add(turnId);
            expandedTurnIds = next;
            commit();
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            stop();
            unsubscribeMutationRejections();
            unsubscribeCatalog?.();
            storeUnsubscribe();
            listeners.clear();
            pendingMutationIds.clear();
            pendingMutationOrder.length = 0;
            sentImages = new Map();
            sentImageBytes = 0;
            conversationCache.context = undefined;
            conversationCache.elements = undefined;
            conversationCache.entries = undefined;
            conversationCache.groups = new Map();
            requestSubmissions.clear();
            requestSelections.clear();
        },
    };
}
