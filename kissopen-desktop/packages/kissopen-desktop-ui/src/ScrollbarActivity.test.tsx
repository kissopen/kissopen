import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import "./theme.css";
import "./styles/scrollbar.css";
import { ScrollArea } from "./Scrollbar";
import { createRenderer } from "./testing";

const pause = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

it("keeps fixed geometry and three restrained strengths without programmatic reveal", async () => {
    const view = createRenderer();
    view.render(
        () => (
            <div data-scrollbar-visibility="always" data-testid="scope">
                <ScrollArea
                    data-testid="scroller"
                    style={{ height: "120px", width: "200px" }}
                    viewportStyle={{ overflow: "auto" }}
                >
                    <div style={{ height: "1000px", width: "400px" }} />
                </ScrollArea>
            </div>
        ),
        { width: 240, height: 160, padding: 20 },
    );
    await view.ready();
    const scope = view.$('[data-testid="scope"]');
    const host = view.$('[data-testid="scroller"]');
    const viewport = view.$('[data-testid="scroller"] [data-scrollbar-viewport]');
    const track = view.$('[data-testid="scroller"] > [data-scrollbar-track][data-axis="vertical"]');
    const thumb = view.$(
        '[data-testid="scroller"] > [data-scrollbar-track][data-axis="vertical"] > .kissopen-scrollbar__thumb',
    );
    await expect.poll(() => host.element.hasAttribute("data-scrollbar-overflow-y")).toBe(true);

    expect(track.bounds().width).toBe(8);
    expect(thumb.bounds().width).toBe(8);
    expect(thumb.computedStyle("border-right-width")).toBe("2px");
    expect(viewport.bounds().width).toBe(host.bounds().width - 8);
    expect(thumb.computedStyle("background-color")).toBe("rgba(128, 128, 128, 0.32)");

    await userEvent.hover(viewport.element);
    expect(host.element.getAttribute("data-scrollbar-surface")).toBe("");
    expect(thumb.computedStyle("background-color")).toBe("rgba(128, 128, 128, 0.5)");

    await userEvent.hover(track.element);
    expect(host.element.getAttribute("data-scrollbar-hover")).toBe("");
    expect(thumb.computedStyle("background-color")).toBe("rgba(128, 128, 128, 0.68)");
    expect(track.bounds().width).toBe(8);

    scope.element.setAttribute("data-scrollbar-visibility", "automatic");
    await userEvent.hover(viewport.element);
    host.element.removeAttribute("data-scrollbar-active");
    (viewport.element as HTMLElement).scrollTop += 1;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(host.element.hasAttribute("data-scrollbar-active")).toBe(false);

    await userEvent.wheel(viewport.element, { delta: { y: 120 } });
    expect(host.element.getAttribute("data-scrollbar-active")).toBe("");
    expect(thumb.computedStyle("background-color")).toBe("rgba(128, 128, 128, 0.5)");

    await userEvent.hover(track.element);
    await pause(2100);
    expect(host.element.getAttribute("data-scrollbar-active")).toBe("");
    expect(thumb.computedStyle("background-color")).toBe("rgba(128, 128, 128, 0.68)");

    await userEvent.hover(scope.element);
    expect(host.element.getAttribute("data-scrollbar-active")).toBe("idle");
    await pause(520);
    expect(host.element.hasAttribute("data-scrollbar-active")).toBe(false);
    expect(track.bounds().width).toBe(8);
}, 10_000);

it("supports overflow, overlay, and stable gutters with a draggable real track", async () => {
    const view = createRenderer();
    view.render(
        () => (
            <div data-scrollbar-visibility="always" style={{ display: "flex", gap: "20px" }}>
                <ScrollArea
                    data-testid="gutter"
                    style={{ height: "100px", width: "200px" }}
                    viewportStyle={{ overflow: "auto" }}
                >
                    <div style={{ height: "600px" }} />
                </ScrollArea>
                <ScrollArea
                    axes="both"
                    data-testid="overlay"
                    placement="overlay"
                    style={{ height: "100px", width: "200px" }}
                    viewportStyle={{ overflow: "auto" }}
                >
                    <div style={{ height: "600px", width: "400px" }} />
                </ScrollArea>
                <ScrollArea
                    data-testid="stable"
                    placement="stable-gutter"
                    style={{ height: "100px", width: "200px" }}
                    viewportStyle={{ overflow: "auto" }}
                >
                    <div style={{ height: "20px" }} />
                </ScrollArea>
            </div>
        ),
        { width: 700, height: 140, padding: 20 },
    );
    await view.ready();
    const gutter = view.$('[data-testid="gutter"]');
    const gutterViewport = view.$('[data-testid="gutter"] [data-scrollbar-viewport]');
    const overlay = view.$('[data-testid="overlay"]');
    const overlayViewport = view.$('[data-testid="overlay"] [data-scrollbar-viewport]');
    const overlayTrack = view.$(
        '[data-testid="overlay"] > [data-scrollbar-track][data-axis="vertical"]',
    );
    const overlayHorizontalTrack = view.$(
        '[data-testid="overlay"] > [data-scrollbar-track][data-axis="horizontal"]',
    );
    const stable = view.$('[data-testid="stable"]');
    const stableViewport = view.$('[data-testid="stable"] [data-scrollbar-viewport]');
    const stableTrack = view.$(
        '[data-testid="stable"] > [data-scrollbar-track][data-axis="vertical"]',
    );
    const stableThumb = view.$('[data-testid="stable"] .kissopen-scrollbar__thumb');
    await expect.poll(() => overlay.element.hasAttribute("data-scrollbar-overflow-y")).toBe(true);

    expect(gutterViewport.bounds().width).toBe(gutter.bounds().width - 8);
    expect(overlayViewport.bounds().width).toBe(overlay.bounds().width);
    expect(
        (overlayViewport.element as HTMLElement).offsetWidth -
            (overlayViewport.element as HTMLElement).clientWidth,
    ).toBe(0);
    expect(overlayTrack.bounds().x + overlayTrack.bounds().width).toBe(
        overlay.bounds().x + overlay.bounds().width,
    );
    expect(overlayHorizontalTrack.bounds().height).toBe(8);
    expect(overlayHorizontalTrack.bounds().y + overlayHorizontalTrack.bounds().height).toBe(
        overlay.bounds().y + overlay.bounds().height,
    );
    expect(stableViewport.bounds().width).toBe(stable.bounds().width - 8);
    expect(stableTrack.computedStyle("display")).toBe("block");
    expect(stableThumb.computedStyle("display")).toBe("none");

    await userEvent.click(overlayTrack.element, {
        position: { x: 4, y: overlayTrack.bounds().height - 4 },
    });
    expect((overlayViewport.element as HTMLElement).scrollTop).toBeGreaterThan(0);
    await userEvent.click(overlayHorizontalTrack.element, {
        position: { x: overlayHorizontalTrack.bounds().width - 4, y: 4 },
    });
    expect((overlayViewport.element as HTMLElement).scrollLeft).toBeGreaterThan(0);
});

it("activates only the innermost registered scrollport that can consume a wheel", async () => {
    const view = createRenderer();
    view.render(
        () => (
            <div data-scrollbar-visibility="automatic">
                <ScrollArea
                    data-testid="outer"
                    style={{ height: "120px", width: "220px" }}
                    viewportStyle={{ overflow: "auto" }}
                >
                    <ScrollArea
                        data-testid="inner"
                        style={{ height: "80px", width: "180px" }}
                        viewportStyle={{ overflow: "auto" }}
                    >
                        <div style={{ height: "500px" }} />
                    </ScrollArea>
                    <div style={{ height: "500px" }} />
                </ScrollArea>
            </div>
        ),
        { width: 260, height: 160, padding: 20 },
    );
    await view.ready();
    const outer = view.$('[data-testid="outer"]');
    const inner = view.$('[data-testid="inner"]');
    const innerViewport = view.$('[data-testid="inner"] [data-scrollbar-viewport]');
    await expect.poll(() => inner.element.hasAttribute("data-scrollbar-overflow-y")).toBe(true);

    await userEvent.wheel(innerViewport.element, { delta: { y: 80 } });
    expect(inner.element.getAttribute("data-scrollbar-active")).toBe("");
    expect(outer.element.hasAttribute("data-scrollbar-active")).toBe(false);

    const element = innerViewport.element as HTMLElement;
    element.scrollTop = element.scrollHeight - element.clientHeight;
    inner.element.removeAttribute("data-scrollbar-active");
    await userEvent.wheel(innerViewport.element, { delta: { y: 80 } });
    expect(inner.element.hasAttribute("data-scrollbar-active")).toBe(false);
    expect(outer.element.getAttribute("data-scrollbar-active")).toBe("");
});
