import { expect, it, vi } from "vitest";
import type {
    KissopenAgentMenusSnapshot,
    KissopenAgentModelSelection,
} from "kissopen-desktop-state";
import "./theme.css";
import "./styles/icon.css";
import "./styles/vector-icon.css";
import "./styles/badge.css";
import "./styles/menu.css";
import "./styles/kissopen-agent-chat.css";
import { KissopenAgentSessionControls } from "./KissopenAgentSessionControls";
import { createRenderer } from "./testing";

const menus: KissopenAgentMenusSnapshot = {
    modelOptions: [
        {
            providerId: "codex",
            modelId: "gpt-5.6-sol",
            name: "GPT Sol",
            disabled: false,
            current: true,
        },
        {
            providerId: "claude",
            modelId: "opus-4-8",
            name: "Opus",
            disabled: false,
            current: false,
        },
    ],
    effortOptions: [
        { level: "medium", label: "Medium", current: true, isDefault: true },
        { level: "high", label: "High", current: false, isDefault: false },
    ],
    permissionModeOptions: [
        { mode: "auto", label: "Auto", current: true },
        { mode: "read_only", label: "Read only", current: false },
    ],
    serviceTierOptions: [
        { tier: null, label: "Standard", current: true },
        { tier: "fast", label: "Fast", current: false },
    ],
    currentProviderId: "codex",
    currentModelId: "gpt-5.6-sol",
    currentEffort: "medium",
    currentPermissionMode: "auto",
    currentServiceTier: undefined,
};

it("opens a control menu, selects an option, and closes on outside pointer-down", async () => {
    const selections: KissopenAgentModelSelection[] = [];
    const view = createRenderer();
    view.render(
        () => (
            <div style={{ padding: "40px", width: "620px", height: "260px" }}>
                <KissopenAgentSessionControls
                    data-testid="controls"
                    menus={menus}
                    onEffortChange={() => undefined}
                    onModelChange={(selection) => selections.push(selection)}
                    onPermissionModeChange={() => undefined}
                    onServiceTierChange={() => undefined}
                />
            </div>
        ),
        { width: 700, height: 340, padding: 0 },
    );
    await view.ready();

    // Trigger shows the current value.
    expect(
        view.$(
            '[data-testid="kissopen-agent-control-model"] [data-kissopen-desktop-ui="kissopen-agent-control-value"]',
        ).element.textContent,
    ).toBe("GPT Sol");

    const trigger = view.$(
        '[data-testid="kissopen-agent-control-model"] [data-kissopen-desktop-ui="kissopen-agent-control-trigger"]',
    ).element as HTMLButtonElement;
    expect(
        view.container.querySelector(
            '[data-testid="kissopen-agent-control-model"] [data-kissopen-desktop-ui="menu"]',
        ),
    ).toBeNull();

    trigger.click();
    await vi.waitFor(() =>
        expect(
            view.container.querySelector(
                '[data-testid="kissopen-agent-control-model"] [data-kissopen-desktop-ui="menu"]',
            ),
        ).not.toBeNull(),
    );
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    // Current option carries a check icon in its leading slot.
    expect(
        view.container.querySelector(
            '[data-testid="kissopen-agent-control-model"] [data-item-id="codex gpt-5.6-sol"] [data-kissopen-desktop-ui="menu-item-icon"] [data-name="check"]',
        ),
    ).not.toBeNull();

    // Choose the non-current model → parsed provider/model reported, menu closes.
    (
        view.$('[data-testid="kissopen-agent-control-model"] [data-item-id="claude opus-4-8"]')
            .element as HTMLButtonElement
    ).click();
    await vi.waitFor(() => expect(selections.length).toBe(1));
    expect(selections[0]).toEqual({ providerId: "claude", modelId: "opus-4-8" });
    await vi.waitFor(() =>
        expect(
            view.container.querySelector(
                '[data-testid="kissopen-agent-control-model"] [data-kissopen-desktop-ui="menu"]',
            ),
        ).toBeNull(),
    );

    // Reopen, then dismiss by clicking the transparent backdrop.
    trigger.click();
    await vi.waitFor(() =>
        expect(
            view.container.querySelector(
                '[data-testid="kissopen-agent-control-model"] [data-kissopen-desktop-ui="menu"]',
            ),
        ).not.toBeNull(),
    );
    (
        view.$(
            '[data-testid="kissopen-agent-control-model"] [data-kissopen-desktop-ui="kissopen-agent-control-backdrop"]',
        ).element as HTMLButtonElement
    ).click();
    await vi.waitFor(() =>
        expect(
            view.container.querySelector(
                '[data-testid="kissopen-agent-control-model"] [data-kissopen-desktop-ui="menu"]',
            ),
        ).toBeNull(),
    );

    await view.screenshot("KissopenAgentSessionControls.test");
}, 120_000);

it("renders only the requested controls, in the requested order", async () => {
    const view = createRenderer();
    view.render(
        () => (
            <KissopenAgentSessionControls
                data-testid="split"
                fields={["permission", "tier"]}
                menus={menus}
                onEffortChange={() => undefined}
                onModelChange={() => undefined}
                onPermissionModeChange={() => undefined}
                onServiceTierChange={() => undefined}
            />
        ),
        { width: 620, height: 120, padding: 16 },
    );
    await view.ready();

    // A surface that shows the model picker elsewhere must not get a second copy.
    expect(view.container.querySelector('[data-testid="kissopen-agent-control-model"]')).toBeNull();
    expect(
        view.container.querySelector('[data-testid="kissopen-agent-control-effort"]'),
    ).toBeNull();

    // The permission mode names itself, so it carries no caption at all.
    const rendered = [
        ...view.container.querySelectorAll<HTMLElement>(
            '[data-kissopen-desktop-ui="kissopen-agent-control-label"]',
        ),
    ].map((label) => label.textContent);
    expect(rendered).toEqual(["Speed"]);
    expect(
        view.$(
            '[data-testid="kissopen-agent-control-permission"] [data-kissopen-desktop-ui="kissopen-agent-control-value"]',
        ).element.textContent,
    ).toBe("Auto");
});

it("drops the speed control for a model that offers only the standard tier", async () => {
    const view = createRenderer();
    view.render(
        () => (
            <KissopenAgentSessionControls
                data-testid="standard-only"
                fields={["permission", "tier"]}
                menus={{
                    ...menus,
                    serviceTierOptions: [{ tier: null, label: "Standard", current: true }],
                }}
                onEffortChange={() => undefined}
                onModelChange={() => undefined}
                onPermissionModeChange={() => undefined}
                onServiceTierChange={() => undefined}
            />
        ),
        { width: 620, height: 120, padding: 16 },
    );
    await view.ready();

    expect(view.container.querySelector('[data-testid="kissopen-agent-control-tier"]')).toBeNull();
    expect(
        view.container.querySelector('[data-testid="kissopen-agent-control-permission"]'),
    ).not.toBeNull();
});

it("defaults to every control when no fields are requested", async () => {
    const view = createRenderer();
    view.render(
        () => (
            <KissopenAgentSessionControls
                data-testid="all"
                menus={menus}
                onEffortChange={() => undefined}
                onModelChange={() => undefined}
                onPermissionModeChange={() => undefined}
                onServiceTierChange={() => undefined}
            />
        ),
        { width: 760, height: 120, padding: 16 },
    );
    await view.ready();

    const rendered = [
        ...view.container.querySelectorAll<HTMLElement>(
            '[data-kissopen-desktop-ui="kissopen-agent-control-label"]',
        ),
    ].map((label) => label.textContent);
    expect(rendered).toEqual(["Model", "Effort", "Speed"]);
});
