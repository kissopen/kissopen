import { randomBytes } from "node:crypto";
import type { WebContents } from "electron";
import {
    isBrowserControlResponse,
    KissopenAgentApiError,
    type BrowserControlRequest,
    type BrowserControlResponse,
    type BrowserCommand,
    type BrowserResult,
} from "@kissopen/kissopen-agent-client";
import type {
    DesktopBrowserScope,
    DesktopBrowserAutomationEvent,
} from "../shared/browserAutomation";
import { BrowserPlaywright, type BrowserPointerTarget } from "./browserPlaywright";

interface Binding {
    id: string;
    tabId: string;
    leaseId: string;
    scope: DesktopBrowserScope;
    account: string | undefined;
    owner: WebContents;
    closed: boolean;
    paused: boolean;
    version: number;
    controls: Promise<void>;
    page: TaskPage;
    ownerCleanup?: () => void;
    navigating?: boolean;
    guest?: WebContents;
    engine?: BrowserPlaywright;
    timer?: ReturnType<typeof setTimeout>;
    waiting?: { resolve: (guest: WebContents) => void; reject: (error: Error) => void };
    cleanup?: () => void;
}
interface TaskPage {
    key: string;
    owner: WebContents;
    account: string | undefined;
    tabId: string;
    guest?: WebContents;
    cleanup?: () => void;
}
interface Dependencies {
    account: () => string | undefined;
    request: (
        scope: DesktopBrowserScope,
        request: BrowserControlRequest,
    ) => Promise<BrowserControlResponse>;
    publish: (owner: WebContents, event: DesktopBrowserAutomationEvent) => void;
    navigate: (guest: WebContents, scope: DesktopBrowserScope, url: string) => Promise<void>;
}

/** Native ownership and cancellation boundary; controls only one visible guest per conversation. */
export class DesktopBrowserAutomation {
    readonly #bindings = new Map<number, Binding>();
    readonly #pages = new Map<string, TaskPage>();
    readonly #owners = new Map<WebContents, () => void>();
    constructor(readonly deps: Dependencies) {}

    async start(owner: WebContents, id: string, scope: DesktopBrowserScope): Promise<void> {
        const before = this.#bindings.get(owner.id);
        if (before?.id === id) return;
        if (before) this.#close(before);
        const account = this.deps.account();
        const key = JSON.stringify([
            owner.id,
            account ?? null,
            scope.kind,
            scope.workspaceId,
            scope.kind === "local" ? [scope.connectionId, scope.agentId] : scope.sessionId,
        ]);
        let page = this.#pages.get(key);
        if (!page) {
            if (this.#pages.size >= 128)
                throw new Error("Task browser page capacity reached. Close unused tabs first.");
            page = { key, owner, account, tabId: randomBytes(24).toString("base64url") };
            this.#pages.set(key, page);
            if (!this.#owners.has(owner)) {
                const closed = () => {
                    for (const candidate of this.#pages.values())
                        if (candidate.owner === owner) this.#forget(candidate);
                    this.#owners.delete(owner);
                };
                owner.once("destroyed", closed);
                this.#owners.set(owner, closed);
            }
        }
        const binding: Binding = {
            id,
            scope,
            owner,
            tabId: page.tabId,
            page,
            leaseId: randomBytes(32).toString("base64url"),
            account: this.deps.account(),
            closed: false,
            paused: false,
            version: 0,
            controls: Promise.resolve(),
        };
        this.#bindings.set(owner.id, binding);
        const ownerClosed = () => this.#close(binding);
        owner.once("destroyed", ownerClosed);
        binding.ownerCleanup = () => owner.removeListener("destroyed", ownerClosed);
        try {
            let answer: BrowserControlResponse;
            let retriedAttach = false;
            try {
                answer = await this.deps.request(scope, {
                    action: "attach",
                    leaseId: binding.leaseId,
                    tabId: binding.tabId,
                    capabilities: ["batch", "wait"],
                });
            } catch (error) {
                if (!(error instanceof KissopenAgentApiError) || error.status !== 400) throw error;
                this.#check(binding);
                retriedAttach = true;
                answer = await this.deps.request(scope, {
                    action: "attach",
                    leaseId: binding.leaseId,
                    tabId: binding.tabId,
                });
            }
            this.#check(binding);
            // An old daemon can reject unknown optional fields. Retry only the
            // idempotent attachment, never an action or an unknown completion.
            if (!retriedAttach && isBrowserControlResponse(answer) && !answer.ok)
                answer = await this.deps.request(scope, {
                    action: "attach",
                    leaseId: binding.leaseId,
                    tabId: binding.tabId,
                });
            this.#check(binding);
            if (!isBrowserControlResponse(answer) || !answer.ok)
                throw new Error(
                    answer && "error" in answer
                        ? answer.error
                        : "Update the Agent to enable the visible browser.",
                );
            binding.paused = answer.paused;
            if (page.guest)
                this.deps.publish(owner, {
                    kind: "open",
                    bindingId: id,
                    tabId: page.tabId,
                    url: "about:blank",
                });
            void this.#poll(binding);
        } catch (error) {
            this.#close(binding, error instanceof Error ? error.message : "Browser unavailable.");
        }
    }

    stop(owner: WebContents, id: string): void {
        const binding = this.#bindings.get(owner.id);
        if (binding?.id === id) this.#close(binding);
    }
    closeAll(): void {
        for (const binding of this.#bindings.values()) this.#close(binding);
        for (const page of this.#pages.values()) this.#forget(page);
        for (const [owner, closed] of this.#owners) owner.removeListener("destroyed", closed);
        this.#owners.clear();
    }

    bind(owner: WebContents, tabId: string, guest: WebContents): DesktopBrowserScope {
        const binding = this.#find(owner, tabId);
        if (binding.guest && binding.guest !== guest)
            throw new Error("A different tab already owns this browser lease.");
        if (binding.page.guest && binding.page.guest !== guest)
            throw new Error("A different tab already owns this task page.");
        if (!binding.waiting && !binding.guest && binding.page.guest !== guest)
            throw new Error("No browser tab was requested.");
        if (guest.hostWebContents !== owner) throw new Error("This tab belongs to another window.");
        if (!binding.guest) {
            binding.guest = guest;
            // Chromium input also includes Playwright-generated events. Guest input
            // and focus must not be mistaken for a request to pause AI control.
            if (!binding.page.guest) {
                const page = binding.page;
                page.guest = guest;
                const close = () => {
                    const active = this.#bindings.get(owner.id);
                    if (active?.page === page) this.#close(active);
                    this.#forget(page);
                };
                guest.once("destroyed", close);
                page.cleanup = () => guest.removeListener("destroyed", close);
            }
        }
        binding.waiting?.resolve(guest);
        delete binding.waiting;
        this.#publish(binding);
        return binding.scope;
    }
    scope(owner: WebContents, tabId: string): DesktopBrowserScope {
        return this.#find(owner, tabId).scope;
    }

    async action(
        owner: WebContents,
        tabId: string,
        action: "pause" | "resume" | "close",
    ): Promise<void> {
        if (action === "close") {
            const page = [...this.#pages.values()].find(
                (candidate) =>
                    candidate.tabId === tabId &&
                    candidate.owner === owner &&
                    candidate.account === this.deps.account(),
            );
            if (!page) throw new Error("This task browser page is no longer available.");
            const binding = this.#bindings.get(owner.id);
            if (binding?.page === page) this.#close(binding);
            this.#forget(page);
            return;
        }
        const binding = this.#find(owner, tabId);
        if (action === "resume" && !binding.paused) return;
        const version = ++binding.version;
        if (action === "pause") {
            // Local cancellation precedes the network request, including an in-flight Playwright wait.
            binding.paused = true;
            binding.engine?.close();
            delete binding.engine;
            if (binding.navigating && !binding.guest?.isDestroyed()) binding.guest?.stop();
            this.#publish(binding);
        }
        // Preserve pause/resume ordering on the wire as well as in the UI.
        binding.controls = binding.controls
            .then(async () => {
                this.#check(binding);
                const answer = await this.deps.request(binding.scope, {
                    action,
                    leaseId: binding.leaseId,
                });
                this.#check(binding);
                if (!isBrowserControlResponse(answer) || !answer.ok) {
                    this.#close(binding);
                    return;
                }
                if (action === "resume" && version === binding.version)
                    binding.paused = answer.paused;
                this.#publish(binding);
            })
            .catch(() =>
                this.#close(binding, "Browser control disconnected. Reopen the conversation."),
            );
        await binding.controls;
    }

    async #poll(binding: Binding): Promise<void> {
        try {
            this.#check(binding);
            const answer = await this.deps.request(binding.scope, {
                action: "poll",
                leaseId: binding.leaseId,
            });
            this.#check(binding);
            if (!isBrowserControlResponse(answer) || !answer.ok)
                throw new Error("Browser lease ended. Reopen the conversation to reconnect.");
            if (answer.command) {
                const command = answer.command;
                let result: BrowserResult;
                try {
                    result = await this.#execute(binding, command);
                } catch (error) {
                    result = {
                        ok: false,
                        text:
                            error instanceof Error
                                ? error.message
                                : "Browser action failed; do not replay it.",
                    };
                }
                this.#check(binding);
                // A pause may already have cancelled this command. Never send old observations after takeover.
                if (!binding.paused) {
                    await this.deps.request(binding.scope, {
                        action: "complete",
                        leaseId: binding.leaseId,
                        commandId: command.id,
                        result,
                    });
                    if (
                        command.operation.action === "handoff" ||
                        result.text.startsWith("HUMAN_TAKEOVER_REQUIRED")
                    )
                        await this.action(binding.owner, binding.tabId, "pause");
                }
            }
            this.#check(binding);
            binding.timer = setTimeout(() => void this.#poll(binding), 800);
        } catch (error) {
            this.#close(binding, error instanceof Error ? error.message : "Browser disconnected.");
        }
    }

    async #execute(binding: Binding, command: BrowserCommand): Promise<BrowserResult> {
        this.#check(binding, true);
        const version = binding.version;
        const checkCommand = () => {
            this.#check(binding, true);
            if (version !== binding.version || command.expiresAt <= Date.now())
                throw new Error("Browser action expired or control changed. Do not replay it.");
        };
        if (
            command.tabId !== binding.tabId ||
            command.expiresAt <= Date.now() ||
            command.expiresAt > Date.now() + 30000
        )
            throw new Error("Invalid or expired browser command. Do not retry it.");
        if (!binding.guest) {
            if (command.operation.action !== "navigate" && !binding.page.guest)
                return { ok: false, text: "Navigate to a URL first to open the visible browser." };
            await new Promise<WebContents>((resolve, reject) => {
                const timer = setTimeout(() => {
                    delete binding.waiting;
                    reject(new Error("The visible browser did not open."));
                }, 8000);
                binding.waiting = {
                    resolve: (guest) => {
                        clearTimeout(timer);
                        resolve(guest);
                    },
                    reject: (error) => {
                        clearTimeout(timer);
                        reject(error);
                    },
                };
                this.deps.publish(binding.owner, {
                    kind: "open",
                    bindingId: binding.id,
                    tabId: binding.tabId,
                    url:
                        command.operation.action === "navigate"
                            ? command.operation.url
                            : "about:blank",
                });
            });
        }
        checkCommand();
        const guest = binding.guest!;
        if (command.operation.action === "navigate") {
            const url = new URL(command.operation.url);
            if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
                throw new Error("Only credential-free HTTP(S) URLs are allowed.");
            binding.engine?.close();
            delete binding.engine;
            const deadline = setTimeout(
                () => {
                    if (version === binding.version && !binding.closed && !guest.isDestroyed())
                        guest.stop();
                },
                Math.max(1, command.expiresAt - Date.now()),
            );
            binding.navigating = true;
            try {
                await this.deps.navigate(guest, binding.scope, url.href);
            } finally {
                clearTimeout(deadline);
                binding.navigating = false;
            }
            checkCommand();
            // Continue through the same ownership/deadline boundary to observe this navigation.
        }
        if (!binding.engine) {
            const engine = new BrowserPlaywright(
                guest,
                () =>
                    !binding.closed &&
                    !binding.paused &&
                    version === binding.version &&
                    binding.account === this.deps.account() &&
                    !binding.owner.isDestroyed() &&
                    !guest.isDestroyed(),
            );
            binding.engine = engine;
            try {
                await engine.connect();
            } catch (error) {
                engine.close();
                if (binding.engine === engine) delete binding.engine;
                throw error;
            }
        }
        checkCommand();
        const engine = binding.engine!;
        const deadline = setTimeout(
            () => {
                engine.close();
                if (binding.engine === engine) delete binding.engine;
            },
            Math.max(1, command.expiresAt - Date.now()),
        );
        let pointer: BrowserPointerTarget | undefined;
        try {
            const result = await engine.execute(
                command.operation.action === "navigate" ? { action: "read" } : command.operation,
                (target) => {
                    checkCommand();
                    pointer = target;
                    this.deps.publish(binding.owner, {
                        kind: "pointer",
                        bindingId: binding.id,
                        tabId: binding.tabId,
                        operationId: command.id,
                        phase: "start",
                        ...target,
                    });
                },
            );
            checkCommand();
            return command.operation.action === "navigate"
                ? { ...result, text: "Opened in the visible right-side browser.\n" + result.text }
                : result;
        } finally {
            clearTimeout(deadline);
            if (pointer) {
                // A pause, tab switch or closed lease already cleared feedback. Never
                // reintroduce a pointer from an operation belonging to that old lease.
                try {
                    this.#check(binding, true);
                    if (version === binding.version)
                        this.deps.publish(binding.owner, {
                            kind: "pointer",
                            bindingId: binding.id,
                            tabId: binding.tabId,
                            operationId: command.id,
                            phase: "end",
                            ...pointer,
                        });
                } catch {
                    /* The owner has gone away. */
                }
            }
        }
    }

    #find(owner: WebContents, tabId: string): Binding {
        const binding = this.#bindings.get(owner.id);
        if (!binding || binding.tabId !== tabId)
            throw new Error("This browser tab is not controlled by this conversation.");
        this.#check(binding);
        return binding;
    }
    #forget(page: TaskPage): void {
        page.cleanup?.();
        this.#pages.delete(page.key);
    }
    #check(binding: Binding, active = false): void {
        if (
            binding.closed ||
            this.#bindings.get(binding.owner.id) !== binding ||
            binding.account !== this.deps.account() ||
            binding.owner.isDestroyed() ||
            binding.guest?.isDestroyed() ||
            (active && binding.paused)
        )
            throw new Error("Browser control is no longer active.");
    }
    #publish(binding: Binding, message?: string): void {
        if (!binding.owner.isDestroyed())
            this.deps.publish(binding.owner, {
                kind: "state",
                bindingId: binding.id,
                tabId: binding.tabId,
                state: binding.closed ? "closed" : binding.paused ? "paused" : "active",
                ...(message ? { message } : {}),
            });
    }
    #close(binding: Binding, message?: string): void {
        if (binding.closed) return;
        binding.closed = true;
        clearTimeout(binding.timer);
        binding.waiting?.reject(new Error("Browser control revoked."));
        binding.engine?.close();
        if (binding.navigating && !binding.guest?.isDestroyed()) binding.guest?.stop();
        binding.cleanup?.();
        binding.ownerCleanup?.();
        if (this.#bindings.get(binding.owner.id) === binding)
            this.#bindings.delete(binding.owner.id);
        this.#publish(binding, message);
        if (binding.account === this.deps.account())
            // The owning runtime can already be closed during shutdown. Contain
            // synchronous transport failures as well as rejected requests.
            void Promise.resolve()
                .then(() =>
                    this.deps.request(binding.scope, {
                        action: "revoke",
                        leaseId: binding.leaseId,
                    }),
                )
                .catch(() => undefined);
    }
}
