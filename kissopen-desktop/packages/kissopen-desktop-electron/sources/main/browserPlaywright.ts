import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { WebContents } from "electron";
import { WebSocketServer, WebSocket } from "ws";
import { chromium, type Browser, type Page, type ElementHandle } from "playwright-core";
import type { BrowserOperation, BrowserResult } from "@kissopen/kissopen-agent-client";

import browserObservationSource from "./browserObservation.ts?observation";
import type { BrowserObservation } from "./browserObservation";

import type { DesktopBrowserAutomationEvent } from "../shared/browserAutomation";

export type BrowserPointerTarget = Pick<
    Extract<DesktopBrowserAutomationEvent, { kind: "pointer" }>,
    "action" | "x" | "y"
>;

/** Private, single-guest CDP adapter. Its capability never leaves the main process. */
export class BrowserPlaywright {
    #server?: WebSocketServer;
    #socket?: WebSocket;
    #browser?: Browser;
    #page?: Page;
    #closed = false;
    #refs = new Map<string, ElementHandle<HTMLElement | SVGElement>>();
    #revision = 0;
    #attached = false;
    #ownsDebugger = false;
    // Only descendant iframe sessions of this guest are addressable.
    #sessions = new Map<string, string>();
    #frameSetup = new Map<
        string,
        { promise: Promise<void>; resolve(): void; methods: Set<string> }
    >();
    #fillTarget?: ElementHandle<HTMLElement | SVGElement>;
    #pointer?: {
        action: BrowserPointerTarget["action"];
        width: number;
        height: number;
        publish: (target: BrowserPointerTarget) => void;
    };

    constructor(
        readonly guest: WebContents,
        readonly allowed: () => boolean,
    ) {}

    async connect(): Promise<void> {
        this.#check();
        if (this.guest.debugger.isAttached())
            throw new Error("This tab is already being inspected.");
        this.guest.debugger.attach("1.3");
        this.#ownsDebugger = true;
        try {
            const token = randomBytes(32).toString("base64url");
            const targetInfo = {
                ...(await this.guest.debugger.sendCommand("Target.getTargetInfo")).targetInfo,
                type: "page",
                attached: true,
                browserContextId: "visible-profile",
            };
            const server = new WebSocketServer({
                host: "127.0.0.1",
                port: 0,
                maxPayload: 2 * 1024 * 1024,
                verifyClient: ({ req }: { req: IncomingMessage }) =>
                    !this.#closed &&
                    !this.#socket &&
                    !req.headers.origin &&
                    req.headers.authorization === `Bearer ${token}`,
            });
            this.#server = server;
            this.guest.debugger.on("message", this.#message);
            this.guest.on("did-navigate", this.#invalidate);
            server.on("connection", (socket) => {
                this.#socket = socket;
                socket.on("message", (bytes) => {
                    void (async () => {
                        let id: number | undefined;
                        let sessionId: string | undefined;
                        try {
                            this.#check();
                            const command = JSON.parse(bytes.toString());
                            id = command.id;
                            sessionId = command.sessionId;
                            if (
                                typeof id !== "number" ||
                                (sessionId &&
                                    sessionId !== "visible-tab" &&
                                    !this.#sessions.has(sessionId))
                            )
                                throw new Error("Invalid browser session.");
                            const { method, params = {} } = command;
                            let result: unknown;
                            if (method === "Target.setAutoAttach") {
                                result = {};
                                if (!sessionId && !this.#attached) {
                                    this.#attached = true;
                                    socket.send(
                                        JSON.stringify({
                                            method: "Target.attachedToTarget",
                                            params: {
                                                sessionId: "visible-tab",
                                                targetInfo,
                                                waitingForDebugger: false,
                                            },
                                        }),
                                    );
                                }
                                if (sessionId) {
                                    result = await this.guest.debugger.sendCommand(
                                        method,
                                        {
                                            autoAttach: true,
                                            waitForDebuggerOnStart: false,
                                            flatten: true,
                                            filter: [
                                                { type: "iframe", exclude: false },
                                                { exclude: true },
                                            ],
                                        },
                                        sessionId === "visible-tab" ? undefined : sessionId,
                                    );
                                }
                            } else if (method === "Target.getTargetInfo") result = { targetInfo };
                            else if (method === "Target.getTargets")
                                result = { targetInfos: [targetInfo] };
                            else if (method === "Target.getBrowserContexts")
                                result = { browserContextIds: [] };
                            else if (method === "Browser.getVersion")
                                result = await this.guest.debugger.sendCommand(method);
                            else {
                                // No profile management, other targets, filesystem, cookies, storage export,
                                // network response bodies, credential headers, or browser-wide debugging.
                                if (
                                    !sessionId ||
                                    !/^(Page|Runtime|DOM|CSS|Accessibility|Input|Emulation|Log|Network)\./u.test(
                                        method,
                                    ) ||
                                    /cookie|storage|responsebody|requestpostdata|extrahttpheaders|download|fileinput|screencast/iu.test(
                                        method,
                                    )
                                )
                                    throw new Error(
                                        "This operation is outside the visible tab capability.",
                                    );
                                this.#check();
                                // Electron's embedded guest can acknowledge CDP insertText without
                                // delivering it to its widget. Keep Playwright's focus/selection, but
                                // route this one input primitive through the same guest's native API.
                                if (method === "Input.insertText") {
                                    if (
                                        typeof params.text !== "string" ||
                                        params.text.length > 8000
                                    )
                                        throw new Error("Invalid input text.");
                                    // Recheck the actual focused field: a page can move focus after
                                    // Playwright selected an otherwise harmless input.
                                    const inputFrame = await this.#fillTarget?.ownerFrame();
                                    const safeInput = await this.#fillTarget?.evaluate((el) => {
                                        let focused = document.activeElement;
                                        while (focused?.shadowRoot?.activeElement)
                                            focused = focused.shadowRoot.activeElement;
                                        if (
                                            focused !== el ||
                                            !el.isConnected ||
                                            !["INPUT", "TEXTAREA"].includes(el.tagName)
                                        )
                                            return false;
                                        const input = el as HTMLInputElement;
                                        if (
                                            el.tagName === "INPUT" &&
                                            ![
                                                "text",
                                                "search",
                                                "email",
                                                "url",
                                                "tel",
                                                "number",
                                                "password",
                                            ].includes(input.type)
                                        )
                                            return false;
                                        return !(input.autocomplete || "")
                                            .split(/\s+/)
                                            .some(
                                                (token) =>
                                                    token.startsWith("cc-") ||
                                                    token === "current-password",
                                            );
                                    });
                                    this.#check();
                                    if (!safeInput)
                                        throw new Error(
                                            "HUMAN_TAKEOVER_REQUIRED: The focused input is sensitive or changed. Ask the user to continue.",
                                        );
                                    if (inputFrame !== this.#page?.mainFrame())
                                        await this.guest.debugger.sendCommand(
                                            "Input.insertText",
                                            params,
                                        );
                                    else await this.guest.insertText(params.text);
                                    result = {};
                                } else {
                                    result = await this.guest.debugger.sendCommand(
                                        method,
                                        params,
                                        sessionId === "visible-tab" ? undefined : sessionId,
                                    );
                                    if (
                                        method === "Page.getFrameTree" &&
                                        sessionId !== "visible-tab"
                                    ) {
                                        // Playwright receives this already-running iframe as a new
                                        // renderer session. Replay its existing descendant tree as
                                        // frame lifecycle events before buffered iframe attachments.
                                        const tree = (
                                            result as {
                                                frameTree: {
                                                    frame: { id: string };
                                                    childFrames?: unknown[];
                                                };
                                            }
                                        ).frameTree;
                                        const replay = (node: typeof tree, parentId?: string) => {
                                            if (parentId)
                                                socket.send(
                                                    JSON.stringify({
                                                        method: "Page.frameAttached",
                                                        sessionId,
                                                        params: {
                                                            frameId: node.frame.id,
                                                            parentFrameId: parentId,
                                                        },
                                                    }),
                                                );
                                            socket.send(
                                                JSON.stringify({
                                                    method: "Page.frameNavigated",
                                                    sessionId,
                                                    params: { frame: node.frame },
                                                }),
                                            );
                                            for (const child of node.childFrames ?? [])
                                                replay(child as typeof tree, node.frame.id);
                                        };
                                        for (const child of tree.childFrames ?? [])
                                            replay(child as typeof tree, tree.frame.id);
                                    }
                                    // Feedback uses the coordinates actually dispatched to this guest,
                                    // not a guessed element centre or the operating system cursor.
                                    const pointer = this.#pointer;
                                    if (
                                        method === "Input.dispatchMouseEvent" &&
                                        pointer &&
                                        typeof params.x === "number" &&
                                        Number.isFinite(params.x) &&
                                        typeof params.y === "number" &&
                                        Number.isFinite(params.y)
                                    ) {
                                        this.#check();
                                        pointer.publish({
                                            action: pointer.action,
                                            x: Math.max(0, Math.min(1, params.x / pointer.width)),
                                            y: Math.max(0, Math.min(1, params.y / pointer.height)),
                                        });
                                    }
                                }
                            }
                            if (sessionId && sessionId !== "visible-tab") {
                                const setup = this.#frameSetup.get(sessionId);
                                setup?.methods.add(method);
                                if (
                                    setup &&
                                    [
                                        "Page.getFrameTree",
                                        "Runtime.enable",
                                        "Page.addScriptToEvaluateOnNewDocument",
                                        "Target.setAutoAttach",
                                        "Runtime.runIfWaitingForDebugger",
                                    ].every((name) => setup.methods.has(name))
                                )
                                    setup.resolve();
                            }
                            if (socket.readyState === WebSocket.OPEN)
                                socket.send(
                                    JSON.stringify({ id, sessionId, result: result ?? {} }),
                                );
                        } catch (error) {
                            if (socket.readyState === WebSocket.OPEN)
                                socket.send(
                                    JSON.stringify({
                                        id,
                                        sessionId,
                                        error: {
                                            code: -32000,
                                            message:
                                                error instanceof Error
                                                    ? error.message
                                                    : "Browser operation refused.",
                                        },
                                    }),
                                );
                        }
                    })();
                });
            });
            await new Promise<void>((resolve, reject) => {
                server.once("listening", resolve);
                server.once("error", reject);
            });
            this.#check();
            const address = server.address();
            if (!address || typeof address === "string")
                throw new Error("Browser transport unavailable.");
            this.#browser = await chromium.connectOverCDP(`ws://127.0.0.1:${address.port}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 8000,
                noDefaults: true,
            });
            this.#check();
            this.#page = this.#browser.contexts()[0]?.pages()[0];
            if (!this.#page) throw new Error("The visible tab was not attached.");
            this.#page.setDefaultTimeout(5000);
            this.#page.on("framenavigated", this.#invalidate);
            this.#page.on("framedetached", this.#invalidate);
            await this.guest.debugger.sendCommand("Emulation.setFocusEmulationEnabled", {
                enabled: true,
            });
            await this.#waitForFrameSetup();
        } catch (error) {
            this.close();
            throw error;
        }
    }

    readonly #message = (
        _event: Electron.Event,
        method: string,
        params: unknown,
        sessionId?: string,
    ): void => {
        if (!this.#attached || !this.allowed() || (sessionId && !this.#sessions.has(sessionId)))
            return;
        const parent = sessionId || "visible-tab";
        if (method === "Target.attachedToTarget") {
            const attached = params as { sessionId: string; targetInfo: { type: string } };
            if (attached.targetInfo.type !== "iframe") return;
            this.#sessions.set(attached.sessionId, parent);
            let resolve!: () => void;
            const promise = new Promise<void>((done) => {
                resolve = done;
            });
            this.#frameSetup.set(attached.sessionId, { promise, resolve, methods: new Set() });
        } else if (method === "Target.detachedFromTarget") {
            const detached = params as { sessionId: string };
            if (!this.#sessions.has(detached.sessionId)) return;
            const removed = new Set([detached.sessionId]);
            for (let i = 0; i < this.#sessions.size; i++)
                for (const [child, ancestor] of this.#sessions)
                    if (removed.has(ancestor)) removed.add(child);
            for (const child of removed) {
                this.#sessions.delete(child);
                this.#frameSetup.get(child)?.resolve();
                this.#frameSetup.delete(child);
            }
        } else if (method.startsWith("Target.")) return;
        if (this.#socket?.readyState === WebSocket.OPEN)
            this.#socket.send(JSON.stringify({ method, params, sessionId: parent }));
    };
    readonly #invalidate = (): void => {
        this.#revision++;
        for (const handle of this.#refs.values()) void handle.dispose().catch(() => undefined);
        this.#refs.clear();
    };
    #check(): void {
        if (this.#closed || this.guest.isDestroyed() || !this.allowed())
            throw new Error("Browser control stopped. The user must resume it explicitly.");
    }

    async #waitForFrameSetup(): Promise<void> {
        let timer: ReturnType<typeof setTimeout>;
        const deadline = new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 2000);
        });
        try {
            for (let i = 0; i < 20; i++) {
                const setups = [...this.#frameSetup.values()];
                await Promise.race([Promise.all(setups.map((setup) => setup.promise)), deadline]);
                this.#check();
                if (setups.length === this.#frameSetup.size) break;
            }
        } finally {
            clearTimeout(timer!);
        }
    }

    async execute(
        operation: BrowserOperation,
        onPointer?: (target: BrowserPointerTarget) => void,
    ): Promise<BrowserResult> {
        this.#check();
        const page = this.#page;
        if (!page) throw new Error("Browser is not connected.");
        if (
            onPointer &&
            (operation.action === "click" ||
                operation.action === "fill" ||
                operation.action === "scroll" ||
                operation.action === "batch")
        ) {
            const viewport = await page.evaluate(() => ({
                width: innerWidth,
                height: innerHeight,
            }));
            this.#check();
            if (viewport.width > 0 && viewport.height > 0)
                this.#pointer = {
                    action:
                        operation.action === "batch"
                            ? operation.steps[0]!.action
                            : operation.action,
                    ...viewport,
                    publish: onPointer,
                };
        }
        try {
            return await this.#execute(operation);
        } finally {
            this.#pointer = undefined;
        }
    }

    async #execute(
        operation: BrowserOperation,
        batch?: {
            refs: Map<string, ElementHandle<HTMLElement | SVGElement>>;
            deadline: number;
        },
    ): Promise<BrowserResult> {
        this.#check();
        const page = this.#page;
        if (!page) throw new Error("Browser is not connected.");
        const timeout = () =>
            Math.max(1, Math.min(5000, batch ? batch.deadline - Date.now() : 5000));
        if (operation.action === "handoff")
            return {
                ok: true,
                text: "The user now controls the browser. Wait for explicit resume.",
            };
        if (operation.action === "navigate")
            throw new Error("Navigation must pass through the workspace's navigation guard.");
        if (operation.action === "batch") return this.#batch(operation);
        if (operation.action === "wait") {
            let error: unknown;
            try {
                const timeout = operation.timeoutMs ?? 5000;
                if ("ref" in operation) {
                    const element = this.#refs.get(operation.ref);
                    if (!element)
                        throw new Error("This page reference is stale. Read the page again.");
                    await element.waitForElementState(operation.condition, { timeout });
                } else await page.waitForLoadState(operation.condition, { timeout });
            } catch (caught) {
                error = caught;
            }
            this.#check();
            const observed = await this.#afterAction(
                error
                    ? "Wait did not reach its condition. No action was repeated; inspect the returned state."
                    : `Wait condition ${operation.condition} reached.`,
            );
            return { ...observed, ok: !error };
        }
        if (operation.action === "click" || operation.action === "fill") {
            const element = (batch?.refs ?? this.#refs).get(operation.ref);
            if (!element) throw new Error("This page reference is stale. Read the page again.");
            const safe = await element.evaluate((el) => {
                const input = el as HTMLInputElement;
                // Only concrete credential field semantics are handled here. Whether a
                // click accepts terms or submits payment is reviewed against the actual
                // page and user authority, not guessed from a keyword in a label or form.
                const editable =
                    el.tagName === "TEXTAREA" ||
                    (el.tagName === "INPUT" &&
                        ["text", "search", "email", "url", "tel", "number", "password"].includes(
                            input.type,
                        ));
                return {
                    protected:
                        ["file", "hidden"].includes(input.type) ||
                        (input.autocomplete || "")
                            .split(/\s+/)
                            .some(
                                (token) => token.startsWith("cc-") || token === "current-password",
                            ),
                    editable,
                };
            });
            this.#check();
            if (safe.protected || (operation.action === "fill" && !safe.editable))
                return {
                    ok: false,
                    text: "HUMAN_TAKEOVER_REQUIRED: This is an existing sign-in credential, payment field or unsupported input. The user must operate it directly. Authorized newly generated passwords may be filled in registration fields.",
                };
            this.guest.focus();
            if (operation.action === "fill") {
                // A real pointer focus is required to route embedded OOPIF text
                // to its renderer widget; DOM focus alone acknowledges but loses it.
                if ((await element.ownerFrame()) !== page.mainFrame())
                    await element.click({ timeout: timeout() });
                // Filling uses keyboard input. Move the guest's pointer to the actual
                // field first, so that its visual feedback also has a real position.
                if (this.#pointer) {
                    await element.scrollIntoViewIfNeeded({ timeout: timeout() });
                    const box = await element.boundingBox();
                    this.#check();
                    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                }
                if (operation.text === "") {
                    // Avoid synthetic Delete key events, which are indistinguishable from
                    // human keyboard takeover in an Electron guest.
                    await element.evaluate((el) => {
                        const prototype =
                            el.tagName === "TEXTAREA"
                                ? HTMLTextAreaElement.prototype
                                : HTMLInputElement.prototype;
                        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
                        if (!setter) throw new Error("Input cannot be cleared.");
                        setter.call(el, "");
                        el.dispatchEvent(new Event("input", { bubbles: true }));
                        el.dispatchEvent(new Event("change", { bubbles: true }));
                    });
                } else {
                    this.#fillTarget = element;
                    try {
                        await element.fill(operation.text, { timeout: timeout() });
                    } finally {
                        this.#fillTarget = undefined;
                    }
                }
                if ((await element.inputValue()) !== operation.text)
                    throw new Error(
                        "The input did not accept the text. Read the page before continuing.",
                    );
            } else await element.click({ timeout: timeout() });
            this.#invalidate();
            this.#check();
            if (batch) return { ok: true, text: "Action completed." };
            await this.#settle(5000);
            return this.#afterAction("Action completed in the visible browser.");
        }
        if (operation.action === "scroll") {
            await page.mouse.wheel(0, operation.direction === "down" ? 500 : -500);
            this.#invalidate();
            if (batch) return { ok: true, text: "Scrolled." };
            await this.#settle(5000);
            return this.#afterAction("Scrolled the visible page.");
        }
        if (operation.action === "screenshot") {
            const image = await page.screenshot({
                type: "png",
                scale: "css",
                timeout: 5000,
                mask: [page.locator("input,textarea,[contenteditable],iframe")],
            });
            this.#check();
            if (image.length > 220000)
                return {
                    ok: false,
                    text: "Screenshot exceeds the safe transport size. Use read instead.",
                };
            return {
                ok: true,
                text: "Visible page screenshot; inputs and embedded frames are masked.",
                image: image.toString("base64"),
            };
        }
        return this.#observe();
    }

    async #settle(timeout: number): Promise<void> {
        this.#check();
        try {
            await this.#page!.waitForLoadState("domcontentloaded", { timeout });
            // Observe after the browser has painted, rather than a fixed sleep.
            await this.#page!.waitForFunction(
                () =>
                    new Promise<boolean>((resolve) =>
                        requestAnimationFrame(() => resolve(document.readyState !== "loading")),
                    ),
                undefined,
                { timeout },
            );
        } catch {
            this.#check();
        }
    }

    async #batch(
        operation: Extract<BrowserOperation, { action: "batch" }>,
    ): Promise<BrowserResult> {
        if (
            operation.steps.reduce(
                (sum, step) => sum + (step.action === "fill" ? step.text.length : 0),
                0,
            ) > 12000
        )
            return { ok: false, text: "Batch fill budget exceeded. No steps executed." };
        const refs = this.#refs;
        // Keep the original identities alive without publishing reusable old refs.
        this.#refs = new Map();
        const watchers: import("playwright-core").JSHandle<{
            changed: boolean;
            disconnect(): void;
        }>[] = [];
        const frames = this.#page!.frames();
        const deadline = Date.now() + 12000;
        let completedSteps = 0;
        let reason: "completed" | "page_changed" | "failed" | "timeout" = "completed";
        let detail = "";
        try {
            if (frames.length > 20)
                throw new Error(
                    "This page exceeds the batch frame budget. Use individually observed steps.",
                );
            // Reject invalid refs before starting any writes.
            for (const step of operation.steps) {
                if (
                    "ref" in step &&
                    (!refs.has(step.ref) ||
                        !(await refs.get(step.ref)!.evaluate((el) => el.isConnected)))
                )
                    throw new Error("A batch ref is stale; no batch steps were started.");
            }
            for (const frame of frames) {
                watchers.push(
                    await frame.evaluateHandle(() => {
                        let changed = false;
                        const observer = new MutationObserver(() => {
                            changed = true;
                        });
                        const options = {
                            subtree: true,
                            childList: true,
                            attributes: true,
                            characterData: true,
                        };
                        observer.observe(document, options);
                        const visit = (root: Document | ShadowRoot) => {
                            for (const element of root.querySelectorAll("*")) {
                                if (element.shadowRoot) {
                                    observer.observe(element.shadowRoot, options);
                                    visit(element.shadowRoot);
                                }
                            }
                        };
                        visit(document);
                        return {
                            get changed() {
                                return changed || observer.takeRecords().length > 0;
                            },
                            disconnect() {
                                observer.disconnect();
                            },
                        };
                    }),
                );
            }
            const changed = async () => {
                const current = this.#page!.frames();
                if (
                    frames.length !== current.length ||
                    frames.some((frame) => !current.includes(frame))
                )
                    return true;
                try {
                    return (
                        await Promise.all(watchers.map((w) => w.evaluate((value) => value.changed)))
                    ).some(Boolean);
                } catch {
                    this.#check();
                    return true;
                }
            };
            for (const step of operation.steps) {
                this.#check();
                if (Date.now() >= deadline) {
                    reason = "timeout";
                    break;
                }
                if (await changed()) {
                    reason = "page_changed";
                    break;
                }
                if (
                    "ref" in step &&
                    !(await refs.get(step.ref)!.evaluate((el) => el.isConnected))
                ) {
                    reason = "page_changed";
                    break;
                }
                if (this.#pointer) this.#pointer.action = step.action;
                const result = await this.#execute(step, {
                    refs,
                    deadline,
                });
                this.#check();
                if (!result.ok) {
                    reason = "failed";
                    detail = result.text;
                    break;
                }
                completedSteps++;
                await this.#settle(Math.max(1, Math.min(1000, deadline - Date.now())));
                if (await changed()) {
                    reason = "page_changed";
                    break;
                }
            }
        } catch (error) {
            this.#check();
            reason =
                Date.now() >= deadline || (error instanceof Error && error.name === "TimeoutError")
                    ? "timeout"
                    : "failed";
            detail =
                error instanceof Error
                    ? error.message
                    : "Batch step failed; its outcome may be unknown.";
        } finally {
            for (const watcher of watchers) {
                await watcher.evaluate((value) => value.disconnect()).catch(() => undefined);
                await watcher.dispose().catch(() => undefined);
            }
            for (const ref of refs.values()) await ref.dispose().catch(() => undefined);
        }
        this.#check();
        const status = `${detail ? detail + "\n" : ""}Batch ${reason}: ${completedSteps}/${operation.steps.length} steps completed. Do not repeat completed or uncertain steps.`;
        const snapshot = await this.#afterAction(status);
        return {
            ...snapshot,
            ok: reason === "completed" || reason === "page_changed",
            batch: { completedSteps, totalSteps: operation.steps.length, reason },
        };
    }

    async #afterAction(status: string): Promise<BrowserResult> {
        try {
            const snapshot = await this.#observe();
            return { ...snapshot, text: (status + "\n" + snapshot.text).slice(0, 24000) };
        } catch {
            this.#check();
            return {
                ok: true,
                text:
                    status +
                    " The automatic page snapshot is unavailable. Read the page to verify the outcome before any further action; do not repeat the completed action.",
            };
        }
    }

    async #observe(retries = 2): Promise<BrowserResult> {
        this.#check();
        const page = this.#page!;
        this.#invalidate();
        const revision = this.#revision;
        const pending = new Map<string, ElementHandle<HTMLElement | SVGElement>>();
        const allFrames = page.frames();
        const frames = allFrames.slice(0, 20);
        const quota = Math.max(1, Math.floor(200 / frames.length));
        let controlBudget = 14000;
        let textBudget = 8000;
        const lines: string[] = [];
        let omitted = 0;
        let unavailable = allFrames.length - frames.length;
        let mainUnavailable = false;
        try {
            for (const [frameIndex, frame] of frames.entries()) {
                this.#check();
                let snapshot;
                try {
                    // A visible child document inside a hidden ancestor must not
                    // contribute actionable refs. This also works across origins.
                    let visible = true;
                    for (
                        let ancestor = frame;
                        ancestor.parentFrame();
                        ancestor = ancestor.parentFrame()!
                    ) {
                        const host = await ancestor.frameElement();
                        try {
                            visible =
                                (await host.isVisible()) &&
                                (await host.evaluate(
                                    (el) =>
                                        el instanceof Element &&
                                        !el.closest('[aria-hidden="true"],[inert]'),
                                ));
                        } finally {
                            await host.dispose();
                        }
                        if (!visible) break;
                    }
                    if (!visible) continue;
                    snapshot =
                        await frame.evaluateHandle<BrowserObservation>(browserObservationSource);
                    const metadataHandle = await snapshot.getProperty("metadata");
                    const metadata = await metadataHandle.jsonValue();
                    await metadataHandle.dispose();
                    const elements = await snapshot.getProperty("elements");
                    const properties = await elements.getProperties();
                    await elements.dispose();
                    const url = new URL(frame.url() || (await frame.evaluate(() => location.href)));
                    lines.push(`Frame f${frameIndex}: ${url.origin}${url.pathname}`);
                    omitted += metadata.omitted;
                    let count = 0;
                    for (const [index, handle] of properties) {
                        const element = handle.asElement();
                        const line = metadata.controls[Number(index)];
                        const cost = (line?.length || 0) + 40;
                        if (!element || !line || count >= quota || cost > controlBudget) {
                            if (element && line) omitted++;
                            await handle.dispose();
                            continue;
                        }
                        const ref = `r${revision}_f${frameIndex}_${index}`;
                        pending.set(ref, element as ElementHandle<HTMLElement | SVGElement>);
                        lines.push(`[${ref}] ${line}`);
                        controlBudget -= cost;
                        count++;
                    }
                    const text = metadata.text.slice(
                        0,
                        Math.min(textBudget, Math.max(500, Math.floor(8000 / frames.length))),
                    );
                    textBudget -= text.length;
                    if (text) lines.push(`Page text (f${frameIndex}): ${text}`);
                    if (metadata.truncated) lines.push(`Frame f${frameIndex} content truncated.`);
                    if (metadata.visuals)
                        lines.push(
                            `Frame f${frameIndex} has visual content; screenshot supplements semantics.`,
                        );
                } catch (error) {
                    this.#check();
                    if (frame === page.mainFrame()) {
                        mainUnavailable = true;
                        throw error;
                    }
                    unavailable++;
                    lines.push(
                        `Frame f${frameIndex} is changing or unavailable; no controls were inferred.`,
                    );
                } finally {
                    await snapshot?.dispose().catch(() => undefined);
                }
            }
            this.#check();
            if (revision !== this.#revision)
                throw new Error("The page navigated during observation. Read again.");
            this.#refs = pending;
            return {
                ok: true,
                text: [
                    "Page snapshot (input values omitted; references apply only to this snapshot):",
                    "Controls (enabled unless marked disabled):",
                    ...lines,
                    omitted
                        ? `${omitted} additional controls omitted. Scroll to the target region and use the next snapshot.`
                        : "",
                    unavailable
                        ? `${unavailable} frames unavailable or omitted by the frame budget. Read after loading completes.`
                        : "",
                ]
                    .filter(Boolean)
                    .join("\n")
                    .slice(0, 23800),
            };
        } catch (error) {
            for (const element of pending.values()) void element.dispose().catch(() => undefined);
            if ((mainUnavailable || revision !== this.#revision) && retries > 0) {
                await this.#settle(1000);
                return this.#observe(retries - 1);
            }
            throw error;
        }
    }

    close(): void {
        if (this.#closed) return;
        this.#closed = true;
        for (const setup of this.#frameSetup.values()) setup.resolve();
        this.#frameSetup.clear();
        this.#invalidate();
        this.#socket?.terminate();
        this.#server?.close();
        this.guest.removeListener("did-navigate", this.#invalidate);
        if (!this.guest.isDestroyed()) {
            this.guest.debugger.removeListener("message", this.#message);
            if (this.#ownsDebugger && this.guest.debugger.isAttached())
                this.guest.debugger.detach();
        }
        // Never browser.close(): this is the user's existing tab, not a browser we launched.
    }
}
