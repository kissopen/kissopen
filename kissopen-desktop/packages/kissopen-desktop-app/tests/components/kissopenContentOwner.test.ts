/*
Who fills the content region.

This was a bug a reader met as "the sidebar stopped working": inside a cloud
conversation, 远程控制, 计划任务 and 插件 could be pressed and nothing changed.
Nothing was broken about the rows — the state moved every time — but 聊天's
transcript was written into the region after the host's content and simply won.

So the rule is a named thing now, and these are the cases it has to keep
answering the same way.
*/
import { describe, expect, it } from "vitest";
import { kissopenContentOwner } from "../../sources/KissopenView";

describe("who fills the content region", () => {
    /*
     * The one that used to fail. A reader in a cloud conversation presses
     * 计划任务: the host now has something to show, and it is the most recent
     * thing the reader asked for.
     */
    it("gives it to a host destination opened from inside a cloud conversation", () => {
        expect(kissopenContentOwner({ relay: true, chat: true, tab: "chat" })).toBe("relay");
    });

    // A host destination is reached from any tab, so it does not wait for one.
    it("gives it to a host destination on whatever tab the window is on", () => {
        for (const tab of ["workspace", "chat", "files", "billing"])
            expect(kissopenContentOwner({ relay: true, chat: false, tab })).toBe("relay");
    });

    /*
     * 最近的对话 is listed on every tab, but a conversation from it belongs to
     * 聊天. Showing a transcript on 资料库 would be showing it somewhere the
     * reader cannot tell what they are looking at.
     */
    it("gives it to a cloud conversation only on 聊天", () => {
        expect(kissopenContentOwner({ relay: false, chat: true, tab: "chat" })).toBe("chat");
        expect(kissopenContentOwner({ relay: false, chat: true, tab: "files" })).toBe("window");
        expect(kissopenContentOwner({ relay: false, chat: true, tab: "workspace" })).toBe("window");
    });

    // Nothing else wants it: the tab the reader is on has it.
    it("leaves it to the window when neither has anything", () => {
        expect(kissopenContentOwner({ relay: false, chat: false, tab: "files" })).toBe("window");
        expect(kissopenContentOwner({ relay: false, chat: false, tab: "workspace" })).toBe("window");
    });

    /*
     * 聊天 with no conversation open is not a claim on the region. The tab's
     * own page shows, rather than a blank where a transcript would be.
     */
    it("does not hand it to 聊天 with nothing to show", () => {
        expect(kissopenContentOwner({ relay: false, chat: false, tab: "chat" })).toBe("window");
    });
});
