/*
Reading Chromium's complaint.

A page that will not load reaches this window as a rejected `loadURL`, whose
message is a sentence Chromium wrote: `ERR_NAME_NOT_RESOLVED (-105) loading
'https://…'`. The panel draws its failure page from the name and the number in
it, so both processes now read that message the same way — main, to answer the
command with the failure, and the window, when a command could not be carried
out at all.
*/
import { describe, it, expect } from "vitest";
import { browserErrorDescribe } from "./desktopContract";

describe("reading a failed load", () => {
    it("takes the name and the number Chromium gave", () => {
        const read = browserErrorDescribe(
            new Error("ERR_NAME_NOT_RESOLVED (-105) loading 'https://nowhere.example/'"),
        );
        expect(read).toEqual({ code: -105, description: "ERR_NAME_NOT_RESOLVED" });
    });

    // The one the reader met: a load that was aborted rather than refused.
    it("reads an aborted load", () => {
        expect(
            browserErrorDescribe(
                new Error("ERR_FAILED (-2) loading 'https://www.nodeloc.com/t/topic/110191'"),
            ),
        ).toEqual({ code: -2, description: "ERR_FAILED" });
    });

    /*
     * Anything else is passed through as it came. A message this cannot parse
     * is still the only thing anybody knows about what went wrong, and an
     * empty failure page would be worse than an unfamiliar sentence.
     */
    it("keeps a message it cannot parse", () => {
        expect(browserErrorDescribe(new Error("The browser tab is unavailable."))).toEqual({
            description: "The browser tab is unavailable.",
        });
    });

    it("survives something that is not an error at all", () => {
        expect(browserErrorDescribe("plain string")).toEqual({ description: "plain string" });
        expect(browserErrorDescribe(undefined)).toEqual({ description: "undefined" });
    });
});
