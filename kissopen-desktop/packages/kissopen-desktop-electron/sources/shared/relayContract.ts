/*
What the main process tells the window about the account's relay.

The wire between the two processes, defined once. The credential that made it
possible stays in main; what crosses is already decrypted and already belongs
to the signed-in account.

Deliberately not the relay's own records: those carry ciphertext, versions and
keys the window has no use for, and sending them would put the account's
encrypted material into a place that does not need it.
*/
import type { AgentState, MachineMetadata, Metadata } from "@kissopen/kissopen-sync/storageTypes";
import type { Message } from "@kissopen/kissopen-sync/typesMessage";
import type {
    KissopenAgentFileContent,
    KissopenAgentGitFile,
    KissopenAgentGitState,
} from "@kissopen/kissopen-sync/agentGit";

export type { KissopenAgentFileContent, KissopenAgentGitFile, KissopenAgentGitState };

/**
 * Which of the account's machines this is, as far as the window should say.
 *
 * `cloud` is established the way the phone establishes it: the account's cloud
 * workspace names a bot, and the session that bot speaks in names the machine.
 *
 * `this` is a match, not an identity. Nothing on this desktop holds the id the
 * local Agent registered under, so the best available answer is that the
 * machine's hostname and home directory are this computer's. Two machines that
 * genuinely share both would be indistinguishable here, which is why the badge
 * says what it means rather than claiming more.
 */
export type RelayMachineKind = "this" | "cloud" | "other";

/** One of the account's machines. The cloud workspace is one of these. */
export interface RelayMachineView {
    readonly id: string;
    readonly active: boolean;
    readonly activeAt: number;
    readonly kind: RelayMachineKind;
    /** Null when this machine's metadata will not open under the account key. */
    readonly metadata: MachineMetadata | null;
}

/*
One project on one of the account's machines.

Projects are how a person thinks about work on a machine — a directory they
keep coming back to — so remote control lists them rather than the individual
conversations underneath.
*/
export interface RelayProjectView {
    readonly id: string;
    /** Null when this project's name will not open under the account key. */
    readonly name: string | null;
    /** The machine it belongs to, taken from the sessions that name both. */
    readonly machineId: string | undefined;
    readonly sessions: number;
    readonly updatedAt: number;
}

/** One conversation, from whichever machine it lives on. */
export interface RelaySessionView {
    readonly id: string;
    readonly seq: number;
    readonly active: boolean;
    readonly updatedAt: number;
    readonly machineId: string | undefined;
    /** The project this conversation belongs to, when it names one. */
    readonly projectId: string | undefined;
    readonly metadata: Metadata | null;
}

export interface RelaySnapshotView {
    readonly machines: readonly RelayMachineView[];
    readonly projects: readonly RelayProjectView[];
    readonly sessions: readonly RelaySessionView[];
    /**
     * Whether the socket to the relay is up. Absent from an older main
     * process, which is taken as up.
     */
    readonly connected?: boolean;
    /**
     * The conversations the relay says are working right now, so a window
     * opened mid-run knows without waiting for the next change. Absent from an
     * older main process.
     */
    readonly thinking?: readonly string[];
    /**
     * Why the rest of the account is not here, when it is not.
     *
     * Carried rather than logged. A main-process warning is invisible in a
     * packaged app, so a relay that cannot be reached looked exactly like an
     * account with one computer — and the reader had no way to tell those
     * apart, or to know there was anything to fix.
     */
    readonly error?: string;
}

/*
A conversation, decrypted and reduced, in the shape the shared core produces.

Not flattened on the way. An earlier version sent one line of text per row,
which turned every tool call into prose and left the window unable to draw the
thing it draws for local work. These are the same messages the phone holds, so
the window can project them into the same transcript rows the local Agent
produces — that is what makes it one transcript component rather than two.
*/
/*
What one conversation has spent of its context window.

Produced by the shared reducer, not counted here: compaction resets it and a
context reset zeroes it, and a window that added tokens up on its own would
show a different number from the phone for the same conversation.
*/
export interface RelayUsage {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheCreation: number;
    readonly cacheRead: number;
    /** What is currently in the window. */
    readonly contextSize: number;
    /** The whole window, when the provider reported one. */
    readonly contextWindow?: number;
}

/**
 * How one of the agent's turns ended, as the agent itself reported it.
 *
 * The shared reducer folds the agent's turn-end event into a lifecycle marker
 * and drops what it carried, so the duration is read off the raw event here
 * and carried beside the messages. The agent measured it; a window that
 * measured the span between the messages it happened to keep would show a
 * one-sentence reply as taking no time at all.
 */
export interface RelayTurn {
    readonly turn: string;
    readonly elapsedMs: number;
    readonly status: "completed" | "failed" | "cancelled";
    /** The agent's word for why, in the vocabulary the status row draws. */
    readonly reason: "abort" | "completed" | "error" | "steering";
}

export type RelayConversation =
    | {
          readonly ok: true;
          readonly messages: readonly Message[];
          /** How each turn ended, for agents recent enough to say. */
          readonly turns?: readonly RelayTurn[];
          /** Absent until the provider has measured this conversation once. */
          readonly usage?: RelayUsage;
          /**
           * What the agent is doing right now, as it last reported.
           *
           * This is what tells a reader whether they are waiting. Without it a
           * remote conversation looks finished the moment it is opened, which
           * is wrong most of the times it matters.
           */
          readonly agentState: AgentState;
          /**
           * The relay could not be reached, and this is the copy this computer
           * kept the last time it could. Absent when it is the relay's answer.
           */
          readonly offline?: true;
      }
    | { readonly ok: false; readonly error: string };

/**
 * The relay as the window should draw it.
 *
 * Null means nobody is reading it — signed out, or not connected yet. That is
 * not the same as an account with nothing in it, and a window that cannot tell
 * the two apart shows an empty list to someone who has just signed out.
 */
export type RelayState = RelaySnapshotView | null;

/*
What a reader can ask of the machine a conversation runs on.

These are not records to append. They are answers a paused agent is blocking
on, so they go as acknowledged calls and come back with whether the machine
took them — which is the whole point: a control that silently did nothing on a
sleeping computer is worse than one that is not there.
*/
export type RelayCommandResult =
    | { readonly ok: true }
    | { readonly ok: false; readonly error: string };

/*
A remote checkout, read over the relay.

The shapes are the shared reader's own, so what a phone shows for a change and
what this window shows for it are the same decision made once. A session that
does not advertise the Git surface answers with the refusal rather than being
asked and left waiting.
*/
export type RelayGitState =
    | { readonly ok: true; readonly git: KissopenAgentGitState }
    | { readonly ok: false; readonly error: string };

/*
One terminal on another machine, as this window needs it.

The shapes are the agent's own answers: a refusal is a value with a reason,
because the answer travelled encrypted and a thrown error would arrive as
"the request failed" with the reason lost on the way.
*/
export interface RelayTerminal {
    readonly id: string;
    readonly cols: number;
    readonly rows: number;
    readonly colorScheme: "light" | "dark";
    readonly status: "running" | "exited";
    readonly exitCode?: number;
}

export type RelayTerminalResult =
    | { readonly ok: true; readonly terminal: RelayTerminal }
    | { readonly ok: false; readonly error: string };

export type RelayTerminalsResult =
    | { readonly ok: true; readonly terminals: readonly RelayTerminal[] }
    | { readonly ok: false; readonly error: string };

/** The handle this window addresses one open attachment by. */
export type RelayTerminalAttached =
    | { readonly ok: true; readonly handle: number }
    | { readonly ok: false; readonly error: string };

/** One file from another machine, as base64 bytes. */
export type RelayFileRead =
    | { readonly ok: true; readonly base64: string }
    | { readonly ok: false; readonly error: string; readonly reason?: "uncached" | "unavailable" };

/** Narrow project metadata reads; ordinary file previews keep their existing policy. */
export interface RelayProjectFileReadOptions {
    readonly accountId: string;
    readonly machineId: string;
    readonly projectId: string;
    readonly projectPath: string;
    readonly source: "cache" | "remote";
}

/** A file sent to another machine: where it landed there, relative to the conversation's folder. */
export type RelayFileUploaded =
    | { readonly ok: true; readonly path: string }
    | { readonly ok: false; readonly error: string };

/** One entry of a folder on another machine. */
export interface RelayDirectoryEntry {
    readonly name: string;
    readonly kind: "file" | "directory";
    /** Bytes, for a file; absent when the machine did not say. */
    readonly size?: number;
    /** When it last changed, epoch milliseconds; absent when the machine did not say. */
    readonly modified?: number;
}

/**
 * One folder on another machine, by its path within the conversation's
 * workspace (`""` for the workspace itself). `truncated` says the machine
 * stopped listing at its limit.
 */
export type RelayDirectory =
    | {
          readonly ok: true;
          readonly entries: readonly RelayDirectoryEntry[];
          readonly truncated: boolean;
      }
    | { readonly ok: false; readonly error: string };

export type RelayGitFile =
    | { readonly ok: true; readonly content: KissopenAgentFileContent }
    | { readonly ok: false; readonly error: string };
