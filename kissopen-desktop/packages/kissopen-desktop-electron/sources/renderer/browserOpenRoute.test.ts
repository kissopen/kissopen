/*
Whose link is it.

There is one window-level "open this page" event and more than one panel that
could take it. Before this, the answer was always the local workspace's, so a
link followed out of a project on another machine opened behind 工作 — in a
column the reader was not looking at, about a different project. It looked
like the link had done nothing.

These hold the rule, including the part that makes the fallback still work.
*/
import { describe, it, expect } from "vitest";
import { browserOpenClaim, browserOpenOffer } from "./browserOpenRoute";

describe("where a link lands", () => {
    it("goes to nobody when nothing is claiming", () => {
        expect(browserOpenOffer("https://example.com/")).toBe(false);
    });

    it("goes to the surface the reader is on", () => {
        const taken: string[] = [];
        const release = browserOpenClaim((url) => {
            taken.push(url);
            return true;
        });
        expect(browserOpenOffer("https://example.com/a")).toBe(true);
        expect(taken).toEqual(["https://example.com/a"]);
        release();
        expect(browserOpenOffer("https://example.com/b")).toBe(false);
    });

    /*
     * A claimant with nowhere to put a tab hands the link back rather than
     * swallowing it, so the ordinary route still owes the reader a page.
     */
    it("falls through when the claimant cannot take it", () => {
        const release = browserOpenClaim(() => false);
        expect(browserOpenOffer("https://example.com/")).toBe(false);
        release();
    });

    // The surface that mounted last is the one being read.
    it("gives it to the newest claimant", () => {
        const first: string[] = [];
        const second: string[] = [];
        const releaseFirst = browserOpenClaim((url) => {
            first.push(url);
            return true;
        });
        const releaseSecond = browserOpenClaim((url) => {
            second.push(url);
            return true;
        });
        browserOpenOffer("https://example.com/");
        expect(second).toHaveLength(1);
        expect(first).toHaveLength(0);
        releaseSecond();
        releaseFirst();
    });

    /*
     * React mounts the next surface before unmounting the last one, so a
     * release can arrive after somebody else has already claimed. It must not
     * take the link away from them.
     */
    it("keeps the newest claim when an older one is released late", () => {
        const second: string[] = [];
        const releaseFirst = browserOpenClaim(() => true);
        const releaseSecond = browserOpenClaim((url) => {
            second.push(url);
            return true;
        });
        releaseFirst();
        expect(browserOpenOffer("https://example.com/")).toBe(true);
        expect(second).toHaveLength(1);
        releaseSecond();
    });

    // Releasing gives the link back to whoever had it before.
    it("returns it to the previous claimant", () => {
        const first: string[] = [];
        const releaseFirst = browserOpenClaim((url) => {
            first.push(url);
            return true;
        });
        const releaseSecond = browserOpenClaim(() => true);
        releaseSecond();
        browserOpenOffer("https://example.com/");
        expect(first).toEqual(["https://example.com/"]);
        releaseFirst();
    });
});
