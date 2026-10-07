import { describe, expect, it } from "vitest";
import { kissopenAgentClockStoreCreate } from "./kissopenAgentClock.js";

describe("kissopenAgentClockStore", () => {
    it("starts the interval on the first subscriber and stops it on the last", () => {
        let handler: (() => void) | undefined;
        let cleared = false;
        let value = 1_000;
        const clock = kissopenAgentClockStoreCreate({
            intervalMs: 100,
            now: () => value,
            setInterval: (fn) => {
                handler = fn;
                return 1;
            },
            clearInterval: () => {
                cleared = true;
            },
        });

        expect(handler).toBeUndefined();
        let ticks = 0;
        const unsubscribe = clock.subscribe(() => (ticks += 1));
        expect(handler).toBeDefined();
        expect(clock.get()).toBe(1_000);

        value = 2_000;
        handler!();
        expect(clock.get()).toBe(2_000);
        expect(ticks).toBe(1);

        // A tick with no advance notifies no one.
        handler!();
        expect(ticks).toBe(1);

        unsubscribe();
        expect(cleared).toBe(true);
    });
});
