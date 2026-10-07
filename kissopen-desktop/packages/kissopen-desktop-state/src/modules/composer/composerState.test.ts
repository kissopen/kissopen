import { describe, expect, it } from "vitest";
import { composerStoreCreate, type ComposerOutput } from "./composerState.js";

describe("composerState slash commands", () => {
    it("clears the durable draft before invoking an accepted command", () => {
        const output: ComposerOutput[] = [];
        const store = composerStoreCreate("session-a", {
            capabilities: {
                shellMode: false,
                commands: [{ id: "agents", label: "/agents" }],
                mentions: false,
            },
            now: () => 42,
            output: (event) => output.push(event),
        });

        store.getState().textUpdate("/agents");
        output.length = 0;
        store.getState().commandInvoke("agents");

        expect(store.getState()).toMatchObject({
            text: "",
            textUpdatedAt: 42,
            commandQuery: undefined,
        });
        expect(output).toEqual([
            { type: "textUpdated", scopeId: "session-a", text: "" },
            { type: "commandInvoked", scopeId: "session-a", commandId: "agents" },
        ]);
    });
});
