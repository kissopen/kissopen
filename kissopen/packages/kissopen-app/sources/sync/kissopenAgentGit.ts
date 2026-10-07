/*
The Git-changes reader, bound to this app's socket and store.

The reading itself moved to @kissopen/kissopen-sync, which the desktop client
shares: what it decodes is not obvious — a side arrives base64 or not, a file
may be binary, an image, a rename, or too large to diff — and two
implementations of those rules would show the same change differently on a
phone and on a desktop.

What stays here is the binding. The shared module is told how to call a
session and what that session says it can do; on this client that is the
socket and the session store.
*/
import {
    getKissopenAgentGitState as gitStateRead,
    readKissopenAgentGitFile as gitFileRead,
    type AgentGitSession,
    type KissopenAgentFileContent,
    type KissopenAgentGitFile,
    type KissopenAgentGitState,
} from '@kissopen/kissopen-sync/agentGit';
import { apiSocket } from './apiSocket';
import { storage } from './storage';

export {
    KissopenAgentGitFileSchema,
    KissopenAgentGitStateSchema,
    supportsKissopenAgentGit,
} from '@kissopen/kissopen-sync/agentGit';
export type {
    AgentGitSession,
    KissopenAgentFileContent,
    KissopenAgentGitFile,
    KissopenAgentGitState,
} from '@kissopen/kissopen-sync/agentGit';

/** One session, as the shared reader needs it. */
function session(sessionId: string): AgentGitSession {
    return {
        rpc: (method, params) => apiSocket.sessionRPC(sessionId, method, params),
        get metadata() {
            return storage.getState().sessions[sessionId]?.metadata;
        },
    };
}

/** Fetches and validates one native Git snapshot for a session. */
export async function getKissopenAgentGitState(sessionId: string): Promise<KissopenAgentGitState> {
    return gitStateRead(session(sessionId));
}

/** Reads the two sides of one snapshot file through the native session RPCs. */
export async function readKissopenAgentGitFile(
    sessionId: string,
    gitBase: string,
    file: KissopenAgentGitFile,
): Promise<KissopenAgentFileContent> {
    return gitFileRead(session(sessionId), gitBase, file);
}
