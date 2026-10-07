/*
Whether the panel took a link.

A clicked link in a conversation is handed to this panel first, so it opens
beside the thing that named it. But the panel's tabs belong to the open
project, and there is not always one — a reader who has opened no project, or
who has no local Agent at all and is talking to the cloud assistant. Before,
the call returned nothing in that case and the caller had no way to tell it
apart from success, so the link simply did nothing and read as broken.

These tests hold the one fact the caller needs: whether there is now a tab.
*/
import { describe, expect, it } from "vitest";
import { kissopenAgentPanelStoreCreate } from "./kissopenAgentPanelStore";
import type { KissopenAgentGroupId, KissopenAgentSessionId } from "./kissopenAgentTypes";

function panel() {
    return kissopenAgentPanelStoreCreate({
        terminalOpen: () => {
            throw new Error("no terminal in this test");
        },
    });
}

describe("handing a link to the panel", () => {
    it("selects a retained task page without replacing its live tab or saved URL", () => {
        const store = panel();
        store.scopeApply("group-1" as KissopenAgentGroupId, "task-a" as KissopenAgentSessionId);
        store.browserAdd("https://example.com/logged-in", "task-page-a");
        const first = store.get().tabs.find((tab) => tab.kind === "browser")!;
        store.scopeApply("group-1" as KissopenAgentGroupId, "task-b" as KissopenAgentSessionId);
        store.browserAdd("https://example.com/task-b", "task-page-b");
        store.scopeApply("group-1" as KissopenAgentGroupId, "task-a" as KissopenAgentSessionId);
        store.browserAdd("about:blank", "task-page-a");
        expect(store.get().tabs.filter((tab) => tab.kind === "browser")).toHaveLength(2);
        expect(store.get().activeViewId).toBe(first.id);
        expect(store.get().tabs.find((tab) => tab.id === first.id)).toBe(first);
        store[Symbol.dispose]();
    });
    it("takes it into the open project, and says so", () => {
        const store = panel();
        store.scopeApply("group-1" as KissopenAgentGroupId, "session-1" as KissopenAgentSessionId);
        expect(store.browserAdd("https://example.com/a")).toBe(true);
        // Taking a link is also how the panel comes into view: a tab nobody
        // can see is the same as no tab.
        expect(store.get().open).toBe(true);
    });

    /*
     * The case the reader met. Nothing is addressed, so there is nowhere to
     * put a tab — and the caller has to learn that, because its next move is
     * to open the link somewhere the reader can actually read it.
     */
    it("refuses it when no project is open", () => {
        const store = panel();
        expect(store.browserAdd("https://example.com/a")).toBe(false);
        expect(store.get().open).toBe(false);
    });

    it("refuses it once the panel is disposed", () => {
        const store = panel();
        store.scopeApply("group-1" as KissopenAgentGroupId, "session-1" as KissopenAgentSessionId);
        store[Symbol.dispose]();
        expect(store.browserAdd("https://example.com/a")).toBe(false);
    });
});
