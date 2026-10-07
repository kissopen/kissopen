import { useState } from "react";
import { composerStoreCreate } from "kissopen-desktop-state";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import "./theme.css";
import "./styles/button.css";
import "./styles/command-picker.css";
import "./styles/composer.css";
import "./styles/composer-panel.css";
import "./styles/conversation.css";
import "./styles/icon.css";
import { Composer } from "./Composer";
import type { CommandPickerItem } from "./CommandPicker";
import { ComposerPanel } from "./ComposerPanel";
import { ConversationDock } from "./ConversationDock";
import { createRenderer } from "./testing";

const agentsCommand: CommandPickerItem = {
    id: "agents",
    slash: "/agents",
    description: "Monitor delegated subagents",
    icon: "users",
};

function CommandHarness() {
    const [value, setValue] = useState("");
    const [selected, setSelected] = useState("");
    return (
        <div style={{ paddingTop: "160px" }}>
            <Composer
                commands={value.startsWith("/") ? [agentsCommand] : []}
                onCommandSelect={(id) => {
                    setSelected(id);
                    setValue("");
                }}
                onSend={() => undefined}
                onValueChange={setValue}
                value={value}
            />
            <output data-testid="selected-command">{selected}</output>
        </div>
    );
}

it("dismisses slash autocomplete as soon as its suggestion is accepted", async () => {
    const view = createRenderer();
    view.render(() => <CommandHarness />, { width: 600, height: 420, padding: 20 });
    await view.ready();

    const textarea = view.$('[data-kissopen-desktop-ui="composer-textarea"]')
        .element as HTMLTextAreaElement;
    await userEvent.click(textarea);
    await userEvent.type(textarea, "/ag");
    expect(
        view.container.querySelector('[data-kissopen-desktop-ui="command-picker"]'),
    ).not.toBeNull();

    await userEvent.click(
        view.$('[data-kissopen-desktop-ui="command-picker-row"]').element as HTMLButtonElement,
    );

    expect(view.$('[data-testid="selected-command"]').element.textContent).toBe("agents");
    expect(textarea.value).toBe("");
    expect(view.container.querySelector('[data-kissopen-desktop-ui="command-picker"]')).toBeNull();
    expect(document.activeElement).toBe(textarea);
}, 120_000);

it.each([960, 720])(
    "aligns an above-composer panel exactly with the input at a %ipx desktop width",
    async (width) => {
        const view = createRenderer();
        const composer = composerStoreCreate(`geometry-${String(width)}`).getState();
        view.render(
            () => (
                <ConversationDock
                    composer={composer}
                    composerAboveControl={
                        <ComposerPanel onClose={() => undefined} title="Session activity">
                            <div>One uninterrupted activity surface</div>
                        </ComposerPanel>
                    }
                    onComposerSend={() => undefined}
                    onComposerValueChange={() => undefined}
                />
            ),
            { width, height: 360 },
        );
        await view.ready();

        const panel = view.$('[data-kissopen-desktop-ui="composer-panel"]');
        const composerBox = view.$('[data-kissopen-desktop-ui="composer"]');
        expect(panel.bounds()).toMatchObject({
            x: composerBox.bounds().x,
            width: composerBox.bounds().width,
        });
        expect(
            view
                .$('[data-kissopen-desktop-ui="composer-panel-header"]')
                .computedStyle("border-bottom-width"),
        ).toBe("0px");
    },
    120_000,
);
