import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class TestResizeObserver implements ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}

    disconnect() {}
    observe(_target: Element, _options?: ResizeObserverOptions) {}
    unobserve(_target: Element) {}
}

globalThis.ResizeObserver = TestResizeObserver;

/* jsdom has no IntersectionObserver. Components read it from their document's
 * window, so install the inert stub there as well as on the global. */
class TestIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly scrollMargin = "0px";
    readonly thresholds: readonly number[] = [0];

    constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}

    disconnect() {}
    observe(_target: Element) {}
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
    unobserve(_target: Element) {}
}

globalThis.IntersectionObserver = TestIntersectionObserver;
if (document.defaultView) document.defaultView.IntersectionObserver = TestIntersectionObserver;

afterEach(cleanup);
