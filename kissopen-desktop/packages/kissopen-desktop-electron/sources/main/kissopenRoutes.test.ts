/*
The boundary, exercised.

This list is the one part of "the window can only reach the consumer API" that
a reader can check, so what it must refuse is written down rather than assumed.
Every case here is a path a caller could construct from a value the window
interpolates — an id out of a list, a name out of an answer.
*/
import { describe, it, expect } from "vitest";
import { kissopenRouteAllowed } from "./kissopenRoutes";

describe("what the window may ask the business API for", () => {
    it("allows the account's own surfaces", () => {
        for (const path of ["/config", "/me", "/models", "/billing", "/profile", "/files"])
            expect(kissopenRouteAllowed("GET", path)).toBe(true);
    });

    it("allows buying a plan and reading announcements", () => {
        for (const path of [
            "/billing/pay-methods",
            "/billing/orders/1790510872343192A9ABE",
            "/announcements",
        ])
            expect(kissopenRouteAllowed("GET", path)).toBe(true);
        expect(kissopenRouteAllowed("POST", "/billing/checkout")).toBe(true);
        expect(kissopenRouteAllowed("GET", "/billing/checkout")).toBe(false);
        expect(kissopenRouteAllowed("GET", "/billing/orders/../../auth/login")).toBe(false);
        expect(kissopenRouteAllowed("GET", "/billing/orders/a/b")).toBe(false);
    });

    it("allows scheduled tasks and the plugins of the cloud workspace", () => {
        for (const path of [
            "/schedules",
            "/schedules/sch_abc-123",
            "/schedules/sch_abc-123/runs",
            "/cloud/plugins",
            "/cloud/catalog",
            "/cloud/catalog/weather",
        ])
            expect(kissopenRouteAllowed("GET", path)).toBe(true);
        for (const path of [
            "/schedules",
            "/schedules/draft",
            "/schedules/sch_abc-123",
            "/schedules/sch_abc-123/runs/run_9/cancel",
            "/cloud/plugins",
            "/cloud/plugins/weather",
            "/cloud/plugins/apply",
            "/cloud/catalog/weather",
        ])
            expect(kissopenRouteAllowed("POST", path)).toBe(true);
    });

    /*
     * The separator is the whole point. Every id here comes from an answer the
     * window read, and an id carrying a slash, a dot or an escape would reach
     * a route this list does not name.
     */
    it("refuses an identifier that is really a path", () => {
        for (const path of [
            "/schedules/../auth/login",
            "/schedules/a/b",
            "/cloud/plugins/../../auth/logout",
            "/cloud/catalog/%2e%2e%2fauth",
            "/cloud/catalog/a.b",
            "/schedules/a%2Fb",
        ]) {
            expect(kissopenRouteAllowed("GET", path)).toBe(false);
            expect(kissopenRouteAllowed("POST", path)).toBe(false);
        }
    });

    // The consumer chat left the window; its routes left with it. A renderer
    // that no longer draws any of it must not still be able to send to it.
    it("refuses the chat routes that were removed", () => {
        expect(kissopenRouteAllowed("GET", "/conversations")).toBe(false);
        expect(kissopenRouteAllowed("POST", "/chat")).toBe(false);
    });

    it("refuses a method it does not know", () => {
        expect(kissopenRouteAllowed("DELETE", "/schedules/sch_1")).toBe(false);
        expect(kissopenRouteAllowed("PUT", "/profile")).toBe(false);
    });

    /*
     * Reading a plan is a GET and changing one is a POST; neither borrows the
     * other's list.
     *
     * `GET /schedules/draft` is not in here, because it cannot be: "draft" is
     * a legal identifier, so that path is a request to read a plan by that
     * name. The server answers 404, which is the honest answer — there is no
     * such plan.
     */
    it("does not let one method reach the other's routes", () => {
        expect(kissopenRouteAllowed("GET", "/auth/login")).toBe(false);
        expect(kissopenRouteAllowed("GET", "/cloud/plugins/weather")).toBe(false);
        expect(kissopenRouteAllowed("POST", "/schedules/sch_1/runs")).toBe(false);
    });

    // An empty id is not an id, and an over-long one is not one this window
    // read out of an answer.
    it("refuses an identifier that is missing or absurd", () => {
        expect(kissopenRouteAllowed("GET", "/schedules/")).toBe(false);
        expect(kissopenRouteAllowed("GET", `/schedules/${"a".repeat(65)}`)).toBe(false);
    });
});
