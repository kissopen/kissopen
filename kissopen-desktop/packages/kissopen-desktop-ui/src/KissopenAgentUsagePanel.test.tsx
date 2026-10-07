import { expect, it } from "vitest";
import type { KissopenAgentSessionUsage } from "kissopen-desktop-state";
import "./theme.css";
import "./styles/kissopen-agent-usage.css";
import { KissopenAgentUsagePanel } from "./KissopenAgentUsagePanel";
import { createRenderer } from "./testing";

const usage: KissopenAgentSessionUsage = {
    currentProviderId: "openai",
    groups: [
        {
            modelId: "gpt-5.6-sol",
            providerId: "openai",
            inputTokens: 128_400,
            outputTokens: 24_100,
            cacheReadTokens: 96_000,
            cacheWriteTokens: 12_000,
            totalTokens: 260_500,
            reasoningTokens: 8_200,
            cost: 1.42,
        },
        {
            modelId: "sonnet-5",
            providerId: "anthropic",
            inputTokens: 32_000,
            outputTokens: 9_800,
            cacheReadTokens: 4_000,
            cacheWriteTokens: 1_200,
            totalTokens: 47_000,
            cost: 0.31,
        },
    ],
    totalTokens: 307_500,
    totalCost: 1.73,
    context: {
        modelId: "gpt-5.6-sol",
        providerId: "openai",
        totalTokens: 184_200,
        approximate: true,
    },
    quotas: [
        {
            providerId: "openai",
            windows: [
                { kind: "fiveHour", usedPercent: 42, resetsAt: Date.UTC(2026, 6, 25, 17, 0, 0) },
                { kind: "weekly", usedPercent: 93, resetsAt: Date.UTC(2026, 6, 25, 17, 0, 0) },
            ],
        },
    ],
};

it("renders per-model token/cost rows, totals, context, and quota windows", async () => {
    const view = createRenderer();
    view.render(() => <KissopenAgentUsagePanel data-testid="u" usage={usage} />, {
        width: 620,
        height: 520,
        padding: 16,
    });
    await view.ready();

    // Two model group rows.
    const rows = view.container.querySelectorAll(
        '[data-testid="u"] [data-kissopen-desktop-ui="kissopen-agent-usage-group"]',
    );
    expect(rows.length).toBe(2);
    expect(rows[0]!.querySelector(".kissopen-agent-usage__model")!.textContent).toBe("gpt-5.6-sol");

    // Totals reflect the snapshot (locale-formatted token count).
    expect(
        view.$('[data-testid="u"] [data-kissopen-desktop-ui="kissopen-agent-usage-totals"]').element
            .textContent,
    ).toContain("307,500");

    // Context line reports approximate occupancy.
    expect(
        view.$('[data-testid="u"] [data-kissopen-desktop-ui="kissopen-agent-usage-context"]')
            .element.textContent,
    ).toContain("approximate");

    // Two quota windows, the 93% one flagged full.
    const windows = view.container.querySelectorAll(
        '[data-testid="u"] [data-kissopen-desktop-ui="kissopen-agent-usage-quota-window"]',
    );
    expect(windows.length).toBe(2);
    expect(
        view.container.querySelector(".kissopen-agent-usage__quota-fill[data-full]"),
    ).not.toBeNull();
}, 120_000);

it("shows loading and error states without a snapshot", async () => {
    const view = createRenderer();
    view.render(
        () => (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "560px" }}>
                <KissopenAgentUsagePanel data-testid="loading" loading />
                <KissopenAgentUsagePanel data-testid="error" error="Usage unavailable." />
            </div>
        ),
        { width: 620, height: 400, padding: 16 },
    );
    await view.ready();

    expect(
        view.container.querySelector(
            '[data-testid="loading"] [data-kissopen-desktop-ui="kissopen-agent-usage-empty"]',
        ),
    ).not.toBeNull();
    expect(
        view.$('[data-testid="error"] [data-kissopen-desktop-ui="kissopen-agent-usage-error"]')
            .element.textContent,
    ).toBe("Usage unavailable.");
}, 120_000);
