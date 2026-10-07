/*
Where a link opened out of a conversation lands.

There is one window-level "open this page" event — Chromium asks, the main
process forwards it — and more than one panel that could take it. The local
workspace has one; a project on another machine has its own, with its own
tabs, because its tabs belong to that project and not to whatever the local
workspace happens to be showing.

So the question "whose is this link?" is answered in one place instead of by
whichever subscriber ran first. The surface the reader is looking at claims
the link while it is on screen, and everything else is the fallback: the local
panel, then the reader's own browser.

A claim is held by at most one surface. Only one of these panels is ever on
screen — the remote project's replaces the workspace in the content region —
so a second claimant would mean two surfaces each believing they were the one
being read.
*/

/** Takes a link if it can. False hands it back to the fallback. */
export type BrowserOpenClaimant = (url: string) => boolean;

let claimant: BrowserOpenClaimant | undefined;

/**
 * Claims links for as long as the returned function is uncalled.
 *
 * A later claim replaces an earlier one rather than queueing behind it: the
 * surface that mounted last is the one the reader moved to.
 */
export function browserOpenClaim(take: BrowserOpenClaimant): () => void {
    const previous = claimant;
    claimant = take;
    return () => {
        // Only release what is still ours. A surface unmounting after another
        // has already claimed must not silently take the link away from it.
        if (claimant === take) claimant = previous;
    };
}

/**
 * Offers one link to whoever has claimed them.
 *
 * True means it was taken and is now somewhere the reader can see. False
 * means nobody claimed it, or the claimant had nowhere to put it — either
 * way the caller still owes the reader a page.
 */
export function browserOpenOffer(url: string): boolean {
    return claimant?.(url) === true;
}
