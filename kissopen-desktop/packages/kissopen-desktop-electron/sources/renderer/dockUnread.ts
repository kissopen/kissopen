import type {
    KissopenAgentDirectorySnapshot,
    KissopenAgentDirectoryStore,
} from "./kissopenAgentDirectoryStore";

/**
 * How many conversations are waiting for the person across every Kissopen Agent in this
 * window.
 *
 * This counts exactly the fact the sidebar already draws a dot for: a
 * conversation summary's `unread`, which a KISSOPEN Agent sets durably when a turn finishes
 * or an agent needs an answer. Reading the same projection rather than deriving
 * a second one is the point — the Dock and the sidebar cannot disagree about
 * what is waiting, and opening a conversation clears both at once because
 * `sessionRead` is what changes the underlying summary.
 *
 * Sessions in a project's worktrees are counted with the project's own, and a
 * bot's one conversation is counted beside them, because the Dock speaks for
 * the whole window: a reader told nothing is waiting has been told about their
 * bots too, and a worktree is not a place they would think to look separately.
 */
export function kissopenAgentDirectoryUnreadCount(
    snapshot: KissopenAgentDirectorySnapshot,
): number {
    let count = 0;
    for (const kissopenAgent of snapshot.kissopenAgents) {
        for (const bot of kissopenAgent.bots) if (bot.conversation.unread) count += 1;
        for (const project of kissopenAgent.projects) {
            for (const conversation of project.conversations) if (conversation.unread) count += 1;
            for (const worktree of project.worktrees)
                for (const conversation of worktree.conversations)
                    if (conversation.unread) count += 1;
        }
    }
    return count;
}

/**
 * Keeps the Dock's count following the KISSOPEN Agent directory for as long as the window
 * lives, and returns the way to stop.
 *
 * The directory store is the one subscribed to rather than any KISSOPEN Agent's workspace,
 * and that is what makes the count survive a connection: reconnecting replaces a
 * Kissopen Agent's product stores, and the directory is what re-subscribes to the
 * replacement and republishes. A Kissopen Agent that goes down empties its projects through
 * the same path, so a teardown reports zero rather than leaving the last number
 * it happened to have.
 *
 * The first count is reported immediately, so a window that opens with nothing
 * waiting states that instead of inheriting whatever was on the icon.
 */
export function dockUnreadPublish(
    directory: KissopenAgentDirectoryStore,
    report: (count: number) => void,
): () => void {
    let published: number | undefined;
    const publish = () => {
        const count = kissopenAgentDirectoryUnreadCount(directory.get());
        // Reconciles arrive constantly while an agent is working and almost none
        // of them change this number; only a change is worth an IPC message.
        if (count === published) return;
        published = count;
        report(count);
    };
    const unsubscribe = directory.subscribe(publish);
    publish();
    return unsubscribe;
}
