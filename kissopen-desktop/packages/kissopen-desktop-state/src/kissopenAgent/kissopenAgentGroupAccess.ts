import { t } from "../i18n/locale.js";
import type { KissopenAgentProject, KissopenAgentWorktree } from "./kissopenAgentTypes.js";

/**
 * What may be done in one project or worktree right now.
 *
 * Conversing, writing, and stopping are separate permissions on purpose.
 *
 * A checkout the host is still preparing has no directory to save a file into
 * or open a shell in. Kissopen may accept the intent to start a conversation, but
 * holds it locally until the checkout is ready; everything that reaches for the
 * directory itself must wait too.
 *
 * Stopping is separate again: a checkout that has gone away still has whatever
 * was already running in it, and the reader must be able to end that. Tying the
 * three together would leave work the reader can see, cannot write to, and
 * cannot stop either.
 */
export interface KissopenAgentGroupAccess {
    /**
     * Whether the checkout itself may be written into: files, shells, forks,
     * and everything else whose effect is a change on disk here and now.
     */
    readonly canWrite: boolean;
    /**
     * Whether work already running here may be stopped. Always true: stopping
     * acts on a process the host is running, not on the directory, so it does
     * not need the directory to be there.
     */
    readonly canAbort: boolean;
    /** Why writing is refused, in the host's terms. Absent exactly when `canWrite`. */
    readonly writeRefusal?: string;
    /**
     * Whether a conversation may be requested here or sent to. Broader than
     * `canWrite`: KISSOPEN can retain a request while the workspace is prepared,
     * then create the session once the checkout is ready.
     */
    readonly canConverse: boolean;
    /** Why conversing is refused. Absent exactly when `canConverse`. */
    readonly conversationRefusal?: string;
}

/** Everything is allowed; the shared value for the ordinary case. */
export const KISSOPEN_AGENT_GROUP_ACCESS_OPEN: KissopenAgentGroupAccess = {
    canWrite: true,
    canAbort: true,
    canConverse: true,
};

/**
 * Why an id the catalog does not describe is refused.
 *
 * Not finding a group is never permission to write into it. There are exactly
 * two ways an id can be absent and they are not the same situation, so they are
 * not the same sentence: the catalog has not been read yet and nothing is known,
 * or it has been read and this id is not in it, which means the host has
 * withdrawn it. Both refuse; only the second is a removal.
 */
export const KISSOPEN_AGENT_GROUP_UNREAD_REFUSAL =
    "KissOpen is still reading this KissOpen Agent's workspaces.";
export const KISSOPEN_AGENT_GROUP_UNLISTED_REFUSAL =
    "That project or workspace is no longer listed.";

/**
 * Why work cannot be written into this worktree's checkout, read from the host's
 * raw record, or `undefined` when it can.
 *
 * This is deliberately the raw `status`/`presence` pair rather than the reduced
 * lifecycle the rows are drawn from. The lifecycle answers "what should the
 * reader be told", and it folds several states into `ready` because they look
 * alike on screen — a worktree being archived is still a present directory. That
 * reduction must never decide whether a session may be started: an archiving
 * checkout is about to be deleted, and starting work in it would race the
 * removal. Only the exact pair `status === "ready" && presence === "present"`
 * means a directory that is there and is going to stay there.
 */
export function kissopenAgentWorktreeWriteRefusal(
    worktree: KissopenAgentWorktree,
): string | undefined {
    if (worktree.status === "initializing") return "This workspace is still being created.";
    if (worktree.status === "failed") {
        return worktree.error === undefined
            ? "This workspace could not be created."
            : t("This workspace could not be created. {error}", { error: worktree.error });
    }
    if (worktree.status === "archiving") return "This workspace is being removed.";
    if (worktree.status === "archived") return "This workspace has been removed.";
    if (worktree.presence === "missing") return "This workspace's folder is no longer on disk.";
    // Everything that is left is `ready` and `present`. The check is written
    // this way round so a status added upstream is refused until it is
    // understood, rather than silently treated as usable.
    return worktree.status === "ready" ? undefined : "This workspace is not ready.";
}

/** Whether this worktree's checkout can take work, from the host's raw record. */
export function kissopenAgentWorktreeWritable(worktree: KissopenAgentWorktree): boolean {
    return kissopenAgentWorktreeWriteRefusal(worktree) === undefined;
}

/**
 * Why a conversation cannot be started in this worktree or sent to, or
 * `undefined` when it can.
 *
 * A workspace the host is still preparing is deliberately not refused. KISSOPEN
 * can retain the reader's request locally until the checkout becomes ready.
 * What is refused here is only what will never work: a workspace that failed,
 * one on its way out, and one whose folder is gone.
 */
export function kissopenAgentWorktreeConversationRefusal(
    worktree: KissopenAgentWorktree,
): string | undefined {
    if (worktree.status === "initializing") return undefined;
    return kissopenAgentWorktreeWriteRefusal(worktree);
}

/**
 * Why work cannot be written into this project's directory, or `undefined` when
 * it can. A local project may be a folder KISSOPEN pointed at; a managed project
 * may still be cloning or may have failed before its checkout existed.
 */
export function kissopenAgentProjectWriteRefusal(
    project: KissopenAgentProject,
): string | undefined {
    if (project.status === "initializing") return "This project is still being cloned.";
    if (project.status === "failed")
        return project.error === undefined
            ? "This project could not be cloned."
            : t("This project could not be cloned. {error}", { error: project.error });
    if (project.presence === "missing") return "This project's folder is no longer on disk.";
    return project.status === "ready" ? undefined : "This project is not ready.";
}

/**
 * The access one sentence describes, when that one sentence answers both
 * questions. An id the catalog does not describe at all is the case that
 * matters: nothing is known about the place, so nothing may be done there, and
 * saying it once is how it cannot say two different things by accident.
 */
export function kissopenAgentGroupAccessRefused(refusal: string): KissopenAgentGroupAccess {
    return kissopenAgentGroupAccessOf(refusal, refusal);
}

/**
 * The access these two refusals describe. Stopping is allowed either way.
 *
 * Both answers are always given, and neither is derived from the other. The one
 * situation this whole distinction exists for — a workspace whose checkout Kissopen Agent
 * is still preparing — is exactly the situation where writing is refused and
 * conversing is not, so a conversation answer that fell back to the write one
 * would close the composer there with the directory's own reason and defeat the
 * split at the only moment it matters. A caller holding a single sentence for
 * the whole group says so through `kissopenAgentGroupAccessRefused`.
 */
export function kissopenAgentGroupAccessOf(
    writeRefusal: string | undefined,
    conversationRefusal: string | undefined,
): KissopenAgentGroupAccess {
    if (writeRefusal === undefined && conversationRefusal === undefined)
        return KISSOPEN_AGENT_GROUP_ACCESS_OPEN;
    return {
        canWrite: writeRefusal === undefined,
        canAbort: true,
        ...(writeRefusal === undefined ? {} : { writeRefusal }),
        canConverse: conversationRefusal === undefined,
        ...(conversationRefusal === undefined ? {} : { conversationRefusal }),
    };
}
