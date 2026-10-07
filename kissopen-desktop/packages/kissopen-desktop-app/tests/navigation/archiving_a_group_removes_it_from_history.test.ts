import { beforeEach, describe, expect, it, onTestFinished } from "vitest";
import type { KissopenAgentSessionId, KissopenAgentWorkspaceStore } from "kissopen-desktop-state";
import { appearanceStoreCreate, kissopenAgentSettingsStoreCreate } from "kissopen-desktop-state";
import type {
    AppKissopenAgentDirectorySnapshot,
    AppKissopenAgentDirectoryStore,
} from "../../sources/AppKissopenAgentView";
import { kissopenAgentHistoryCreate } from "../../sources/navigation/kissopenAgentHistory";
import {
    kissopenAgentRouterCreate,
    kissopenAgentRouterGroupForget,
    type KissopenAgentRouterContext,
} from "../../sources/navigation/kissopenAgentRouter";
import {
    kissopenAgentRoutePath,
    kissopenAgentRoutePathParse,
    type KissopenAgentRoute,
} from "../../sources/navigation/kissopenAgentRoute";

/**
 * Archiving a project takes it out of the window's navigation entirely. These
 * prove the removal is a real deletion — no dead entry to step back onto, none
 * to reach going forward — and that it moves nobody who was somewhere else.
 */

/** A stack held in memory, so a test can watch what a window would have kept. */
function persistenceFake() {
    let held: unknown;
    return {
        read: () => held,
        write: (document: unknown) => {
            held = JSON.parse(JSON.stringify(document));
        },
        peek: () => held as { entries: KissopenAgentRoute[]; index: number } | undefined,
    };
}

/** Where the window is standing, and what it would go back to, in order. */
function stack(history: ReturnType<typeof kissopenAgentHistoryCreate>) {
    const document = (history as unknown as { location: { pathname: string } }).location;
    return document.pathname;
}

// Each case is its own freshly opened window: jsdom carries one document URL
// across a file, and a leftover address would read as a deep link.
beforeEach(() => {
    window.history.replaceState(null, "", "/");
});

describe("a window's own stack", () => {
    it("removes every place inside the archived group, not just the open one", () => {
        const history = kissopenAgentHistoryCreate();
        history.push("/chats/r1");
        history.push("/chats/r1/g1");
        history.push("/chats/r1/g1/c1");
        history.push("/chats/r1/g1/c2");
        expect(history.length).toBe(5);

        expect(history.groupForget("r1", "g1")).toBe(true);

        // The group and both conversations opened inside it are gone together.
        expect(history.length).toBe(2);
        expect(stack(history)).toBe("/chats/r1");
    });

    it("leaves nothing to reach by going forward", () => {
        const history = kissopenAgentHistoryCreate();
        history.push("/chats/r1");
        history.push("/chats/r1/g1");
        history.push("/chats/r1/g1/c1");
        history.groupForget("r1", "g1");

        // The reader is at the end of what survived, so forward is not a way
        // back into the archived project.
        const landed = stack(history);
        history.forward();
        expect(stack(history)).toBe(landed);
        history.forward();
        expect(stack(history)).toBe(landed);
    });

    it("never steps back onto a place that is gone", () => {
        const history = kissopenAgentHistoryCreate();
        history.push("/chats/r1");
        history.push("/chats/r1/g1");
        history.push("/chats/r1/g1/c1");
        history.push("/settings/appearance");
        history.groupForget("r1", "g1");

        // Walking the whole stack backwards must never land inside g1.
        const seen: string[] = [stack(history)];
        for (let step = 0; step < 6; step++) {
            history.back();
            seen.push(stack(history));
        }
        expect(seen.some((path) => path.startsWith("/chats/r1/g1"))).toBe(false);
    });

    it("keeps a reader who was somewhere else exactly where they were", () => {
        const history = kissopenAgentHistoryCreate();
        history.push("/chats/r1/g1");
        history.push("/settings/appearance");

        expect(history.groupForget("r1", "g1")).toBe(true);
        expect(stack(history)).toBe("/settings/appearance");
    });

    it("is inert when the archived group is not one this window has been in", () => {
        const history = kissopenAgentHistoryCreate();
        history.push("/chats/r1/g9");

        expect(history.groupForget("r1", "g1")).toBe(false);
        expect(stack(history)).toBe("/chats/r1/g9");
    });

    it("does not leave the same place twice in a row after removing between them", () => {
        const history = kissopenAgentHistoryCreate();
        history.push("/chats/r1");
        history.push("/chats/r1/g1/c1");
        history.push("/chats/r1");
        history.groupForget("r1", "g1");

        // Collapsed to one entry: a Back that appeared to do nothing would be a
        // reader pressing it twice to move once.
        expect(history.length).toBe(2);
        expect(stack(history)).toBe("/chats/r1");
        history.back();
        expect(stack(history)).toBe("/");
    });

    it("falls back to one addressable place when the whole stack was in the group", () => {
        const history = kissopenAgentHistoryCreate({
            initialEntries: [{ kind: "group", kissopenAgentId: "r1", groupId: "g1" }],
        });
        history.push("/chats/r1/g1/c1");

        expect(history.groupForget("r1", "g1")).toBe(true);
        expect(history.length).toBe(1);
        expect(stack(history)).toBe("/");
    });
});

describe("what a window keeps between runs", () => {
    it("stores places, never path strings", () => {
        const storage = persistenceFake();
        const history = kissopenAgentHistoryCreate({ persistence: storage });
        history.push("/chats/r1/g1/c1");

        expect(storage.peek()?.entries.at(-1)).toEqual({
            chatId: "c1",
            groupId: "g1",
            kind: "chat",
            kissopenAgentId: "r1",
        });
    });

    it("reopens where the reader was left, with what they can go back to intact", () => {
        const storage = persistenceFake();
        const first = kissopenAgentHistoryCreate({ persistence: storage });
        first.push("/chats/r1");
        first.push("/chats/r1/g1");

        const reopened = kissopenAgentHistoryCreate({ persistence: storage });

        expect(reopened.length).toBe(3);
        expect(stack(reopened)).toBe("/chats/r1/g1");
        reopened.back();
        expect(stack(reopened)).toBe("/chats/r1");
    });

    it("keeps the readable places when a record names one this build has lost", () => {
        const storage = persistenceFake();
        storage.write({
            entries: [
                { kind: "kissopenAgent", kissopenAgentId: "r1" },
                { kind: "somethingThisBuildRemoved", kissopenAgentId: "r1" },
                { kind: "group", kissopenAgentId: "r1", groupId: "g1" },
            ],
            index: 2,
        });

        const history = kissopenAgentHistoryCreate({ persistence: storage });

        expect(history.length).toBe(2);
        expect(stack(history)).toBe("/chats/r1/g1");
    });

    it("opens on its default address when the record is not a stack at all", () => {
        for (const damaged of [null, 42, "a string", {}, { entries: [] }, { entries: "no" }]) {
            const storage = persistenceFake();
            storage.write(damaged);
            expect(stack(kissopenAgentHistoryCreate({ persistence: storage }))).toBe("/");
        }
    });

    it("does not let an archived place survive in the record", () => {
        const storage = persistenceFake();
        const history = kissopenAgentHistoryCreate({ persistence: storage });
        history.push("/chats/r1");
        history.push("/chats/r1/g1/c1");

        history.groupForget("r1", "g1");

        const kept = storage.peek()?.entries ?? [];
        expect(kept.some((route) => route.kind === "chat" || route.kind === "group")).toBe(false);
    });
});

/**
 * The document holds no second stack. Back and Forward are delivered to this
 * window as a direction, so nothing the document raises is another way to move —
 * and nothing this window does grows a browser entry that would then have to be
 * kept in step with the array above.
 */
describe("the document's own history", () => {
    it("is not a second way to move", () => {
        const history = kissopenAgentHistoryCreate();
        history.push("/chats/r1");

        window.dispatchEvent(new PopStateEvent("popstate", { state: { kissopenTicket: 0 } }));

        expect(stack(history)).toBe("/chats/r1");
    });

    it("does not grow an entry per step this window takes", () => {
        const before = window.history.length;
        const history = kissopenAgentHistoryCreate();
        history.push("/chats/r1");
        history.push("/chats/r1/g1");
        history.push("/chats/r1/g1/c1");

        expect(window.history.length).toBe(before);
    });
});

/**
 * A window honours the address it was opened on; honouring one that arrives
 * afterwards is the same act. The window that stopped doing it showed one place
 * in its URL while standing on another — invisibly, since the URL still said
 * what was asked for.
 */
describe("an address arriving in the document's URL", () => {
    it("is somewhere to go, not something to ignore", async () => {
        const history = kissopenAgentHistoryCreate();
        history.push("/chats/r1");

        window.location.hash = "/chats/r1/g9";
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(stack(history)).toBe("/chats/r1/g9");
    });

    it("is not acted on when it only reflects where the window already is", async () => {
        const history = kissopenAgentHistoryCreate();
        history.push("/chats/r1/g1");
        const before = history.length;

        window.location.hash = "/chats/r1/g1";
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Mirroring the window's own step back at it must not grow the stack,
        // or Back would need two presses to leave one place.
        expect(history.length).toBe(before);
        expect(stack(history)).toBe("/chats/r1/g1");
    });
});

describe("every place this window can address", () => {
    const ALL: KissopenAgentRoute[] = [
        { kind: "home" },
        { kind: "chats" },
        { kind: "kissopenAgent", kissopenAgentId: "r1" },
        { kind: "group", groupId: "g1", kissopenAgentId: "r1" },
        { chatId: "c1", groupId: "g1", kind: "chat", kissopenAgentId: "r1" },
        { kind: "inbox", kissopenAgentId: "r1" },
        { kind: "blueprint" },
        { kind: "settings" },
        { kind: "settingsSection", section: "appearance" },
    ];

    it("survives being written as a path and read back", () => {
        for (const route of ALL)
            expect(kissopenAgentRoutePathParse(kissopenAgentRoutePath(route))).toEqual(route);
    });

    it("keeps an identifier that looks like path syntax whole", () => {
        const route: KissopenAgentRoute = { groupId: "c?d#e", kind: "group", kissopenAgentId: "a/b" };
        expect(kissopenAgentRoutePathParse(kissopenAgentRoutePath(route))).toEqual(route);
    });

    it("refuses a path that names no place", () => {
        for (const path of ["/nope", "/chats/a/b/c/d", "/inbox", "/blueprint/x", "relative"])
            expect(kissopenAgentRoutePathParse(path)).toBeUndefined();
    });
});

/** One connected KISSOPEN Agent named `local`, whose workspace records what was applied. */
function directory(applied: string[]): AppKissopenAgentDirectoryStore {
    const workspace = {
        get: () => ({ list: { projects: { type: "loading" } }, conversation: {} }),
        subscribe: () => () => undefined,
        conversationOpen: (conversationId: KissopenAgentSessionId) =>
            applied.push(`open:${conversationId}`),
        conversationClose: () => applied.push("close"),
        groupOpen: (groupId: string) => applied.push(`group:${groupId}`),
        [Symbol.dispose]: () => undefined,
    } as unknown as KissopenAgentWorkspaceStore;
    const snapshot: AppKissopenAgentDirectorySnapshot = {
        kissopenAgents: [
            {
                id: "local",
                label: "This Mac",
                status: "connected",
                session: { workspace },
            },
        ],
    } as unknown as AppKissopenAgentDirectorySnapshot;
    return {
        get: () => snapshot,
        subscribe: () => () => undefined,
        kissopenAgentActivate: () => undefined,
    } as unknown as AppKissopenAgentDirectoryStore;
}

describe("the router the window actually renders", () => {
    /** A router standing where the given addresses left it. */
    async function routerAt(...addresses: readonly string[]) {
        const applied: string[] = [];
        const history = kissopenAgentHistoryCreate();
        const router = kissopenAgentRouterCreate(history);
        onTestFinished(() => router.history.destroy());
        router.update({
            context: {
                appearance: appearanceStoreCreate(),
                kissopenAgents: directory(applied),
                settings: kissopenAgentSettingsStoreCreate(),
            } as KissopenAgentRouterContext,
        });
        await router.load();
        for (const address of addresses) {
            history.push(address);
            await router.load();
        }
        return { applied, history, router };
    }

    it("re-addresses the reader when the group they are inside is archived", async () => {
        const { history, router } = await routerAt(
            "/chats/local/prj_one",
            "/chats/local/prj_one/ses_one",
        );
        expect(router.state.location.pathname).toBe("/chats/local/prj_one/ses_one");

        kissopenAgentRouterGroupForget(router, "local", "prj_one");
        await router.load();

        // The address the window shows is one that still exists, and it is all
        // that is left: the window opened on `/`, which redirects onto the KISSOPEN Agent's
        // own list in place, so the two addresses inside the project were the
        // only other things the stack held.
        expect(router.state.location.pathname).toBe("/chats/local");
        expect(history.length).toBe(1);
    });

    it("does not move a reader who is looking at something else", async () => {
        const { router } = await routerAt("/chats/local/prj_one", "/settings/general");

        kissopenAgentRouterGroupForget(router, "local", "prj_one");
        await router.load();

        expect(router.state.location.pathname).toBe("/settings/general");
    });

    it("does not move anyone when another machine's group is archived", async () => {
        const { router } = await routerAt("/chats/local/prj_one/ses_one");

        kissopenAgentRouterGroupForget(router, "other-machine", "prj_one");
        await router.load();

        expect(router.state.location.pathname).toBe("/chats/local/prj_one/ses_one");
    });
});
