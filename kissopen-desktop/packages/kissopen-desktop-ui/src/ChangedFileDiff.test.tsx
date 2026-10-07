import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import "./theme.css";
import "./styles/scrollbar.css";
import "./styles/changed-file-diff.css";
import { ChangedFileDiff } from "./ChangedFileDiff";
import { createRenderer } from "./testing";

it("renders HEAD and working-tree text through Pierre Diffs in the active appearance", async () => {
    const view = createRenderer();
    view.render(
        () => (
            <div className="kissopen-theme-dark" style={{ height: "360px", width: "640px" }}>
                <ChangedFileDiff
                    appearance="dark"
                    data-testid="diff"
                    loading
                    newContent={"export const answer = 43;\nexport const ready = true;\n"}
                    oldContent={"export const answer = 42;\n"}
                    path="src/answer.ts"
                />
            </div>
        ),
        { width: 680, height: 400, padding: 20 },
    );
    await view.ready();

    const root = view.$('[data-testid="diff"]');
    expect(root.element.tagName).toBe("SECTION");
    expect(root.element.getAttribute("aria-label")).toBe("Changes in src/answer.ts");
    expect(root.bounds().height).toBe(360);
    expect(
        root.element.querySelector('[data-kissopen-desktop-ui="changed-file-diff-updating"]')
            ?.textContent,
    ).toBe("Updating…");

    const renderer = root.element.querySelector("diffs-container") as HTMLElement | null;
    expect(renderer).not.toBeNull();
    await expect
        .poll(
            () =>
                renderer?.shadowRoot?.querySelectorAll('[data-line-type="change-deletion"]').length,
        )
        .toBeGreaterThan(0);
    await expect
        .poll(
            () =>
                renderer?.shadowRoot?.querySelectorAll('[data-line-type="change-addition"]').length,
        )
        .toBeGreaterThan(0);

    const header = renderer?.shadowRoot?.querySelector("[data-diffs-header]");
    expect(header?.textContent).toContain("src/answer.ts");
    expect(getComputedStyle(renderer!).colorScheme).toBe("dark");
});

it("overlays the vertical diff thumb without taking width from its rows", async () => {
    const view = createRenderer();
    const content = Array.from(
        { length: 140 },
        (_, index) => `export const answer${String(index)} = ${String(index)};`,
    ).join("\n");
    view.render(
        () => (
            <div
                className="kissopen-theme-dark"
                data-scrollbar-visibility="always"
                style={{ height: "300px", width: "480px" }}
            >
                <ChangedFileDiff
                    appearance="dark"
                    data-testid="long-diff"
                    newContent={content}
                    oldContent=""
                    path="src/long.ts"
                />
            </div>
        ),
        { width: 520, height: 340, padding: 20 },
    );
    await view.ready();
    const root = view.$('[data-testid="long-diff"]');
    const renderer = root.element.querySelector("diffs-container") as HTMLElement;
    await expect
        .poll(() => renderer.shadowRoot?.querySelectorAll("[data-line]").length ?? 0)
        .toBeGreaterThan(100);

    const viewport = root.element.querySelector("[data-scrollbar-viewport]") as HTMLElement;
    const track = view.$('[data-testid="long-diff"] [data-scrollbar-track][data-axis="vertical"]');
    const thumb = view.$('[data-testid="long-diff"] .kissopen-scrollbar__thumb');
    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    expect(viewport.offsetWidth - viewport.clientWidth).toBe(0);
    expect(track.bounds().width).toBe(8);
    expect(track.bounds().x + track.bounds().width).toBe(root.bounds().x + root.bounds().width);
    expect(renderer.getBoundingClientRect().right).toBe(viewport.getBoundingClientRect().right);
    expect(thumb.bounds().width).toBe(8);
    expect(thumb.computedStyle("border-right-width")).toBe("2px");
    expect(thumb.computedStyle("background-color")).toBe("rgba(128, 128, 128, 0.32)");

    await userEvent.click(track.element, {
        position: { x: 4, y: track.bounds().height - 4 },
    });
    expect(viewport.scrollTop).toBeGreaterThan(0);
});
