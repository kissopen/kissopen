import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class TestResizeObserver implements ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}

    disconnect() {}
    observe(_target: Element, _options?: ResizeObserverOptions) {}
    unobserve(_target: Element) {}
}

globalThis.ResizeObserver = TestResizeObserver;

afterEach(cleanup);
