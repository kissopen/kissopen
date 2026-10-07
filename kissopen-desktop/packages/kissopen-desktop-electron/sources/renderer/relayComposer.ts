/*
A composer over something that is not a machine.

The window's composer expects a snapshot of a draft it does not own. Two
surfaces need one without any of what a session's composer carries — no
mentions, no slash commands, no shell — so the shape they both want lives here
rather than being written twice and drifting.
*/
import { composerCapabilitiesNone } from "kissopen-desktop-state";
import type { ComposerAttachment, ComposerSnapshot } from "kissopen-desktop-state";

export function plainComposer(
    /** What this draft belongs to, so two surfaces never share one draft. */
    scopeId: string,
    text: string,
    attachments: readonly ComposerAttachment[] = [],
): ComposerSnapshot {
    return {
        scopeId,
        text,
        attachments,
        revision: 0,
        submission: { status: "idle" },
        focused: false,
        agentUserIds: [],
        // Nobody to mention: the people and agents a mention offers belong to
        // the machine the session runs on, which this window does not enumerate.
        mentionCandidates: [],
        // No slash commands and no shell mode: those run things on a machine,
        // and the composer that offers them should be the one attached to it.
        capabilities: composerCapabilitiesNone,
    };
}
