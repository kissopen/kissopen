/*
The three things a reader can ask of the machine a conversation runs on.

Approving a paused tool call, refusing it, and stopping a run. None of them is
a record to be appended: on the other end an agent is blocked, waiting for an
answer, and the relay carries that answer as an acknowledged call over the
socket rather than through the message log.

Built in the phone's exact shapes, because the agent on the other end is the
one that reads them and it has one reader, not one per client. A field spelled
differently here would fail as "nothing happened" — the agent would keep
waiting and the desktop would look like it had done its part.
*/

/** What the relay's RPC method name is for a session. */
export function relayRpcMethod(sessionId: string, verb: string): string {
    return `${sessionId}:${verb}`;
}

/*
An answer to a permission request.

`id` is the request's own key in the agent state, not the tool call's id: a
scoped request (a subagent's `agentID:toolUseID`) answers under the key it was
published as, and the tool id is only how the row finds its call.

`decision` is spelled out beside `approved` because the CLI records it into the
completed request and reads it back — the two are not redundant on the wire
even though they say the same thing here.
*/
export function relayPermissionAnswer(
    id: string,
    approved: boolean,
): { id: string; approved: boolean; decision: "approved" | "denied" } {
    return { id, approved, decision: approved ? "approved" : "denied" };
}

/*
Stopping a run.

The reason travels with it because the agent puts it into the transcript as the
tool result: it is what the model is told about why it was interrupted, and an
empty one leaves the next turn guessing. This is the phone's wording, so a run
stopped from a desktop reads in the transcript exactly as one stopped from a
phone.
*/
export const RELAY_ABORT_REASON =
    "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.";
