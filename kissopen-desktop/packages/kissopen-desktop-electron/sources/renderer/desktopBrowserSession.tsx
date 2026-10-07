import { Component } from "react";
import type { BrowserAutomationSessionProps } from "kissopen-desktop-ui";
import type { KissopenDesktopBridge } from "../shared/desktopContract";

type MessageTarget =
    | { readonly kind: "local"; readonly agentId: string; readonly connectionId: string | null }
    | { readonly kind: "relay"; readonly sessionId: string };

interface BrowserAttachment {
    readonly id: string;
    ready: Promise<void>;
    phase: "starting" | "ready" | "closed";
    paused: boolean;
    pauseVersion: number;
    tabId?: string;
}

// Only mounted conversation attachments participate. Leaving the conversation or
// signing out removes the attachment; a message cannot revive a revoked lease.
const attachments = new Set<DesktopBrowserSession>();

/** A new human instruction hands this conversation's browser back to AI before sending. */
export async function desktopBrowserMessagePrepare(target: MessageTarget): Promise<void> {
    // Recovery replaces an attachment in this Set. Iterate a snapshot so a
    // failed reconnect cannot turn one send into an unbounded retry loop.
    for (const attachment of [...attachments]) {
        const scope = attachment.props.scope;
        const matches =
            target.kind === "local"
                ? scope.kind === "local" &&
                  scope.agentId === target.agentId &&
                  scope.connectionId === target.connectionId
                : scope.kind === "relay" && scope.sessionId === target.sessionId;
        if (matches) await attachment.messagePrepare();
    }
}

/** All relay composers (including the first message and question follow-ups) use this boundary. */
export function desktopBrowserMessageBridge(bridge: KissopenDesktopBridge): KissopenDesktopBridge {
    return {
        ...bridge,
        relaySay: async (...args) => {
            await desktopBrowserMessagePrepare({ kind: "relay", sessionId: args[0] });
            return bridge.relaySay(...args);
        },
        relayAnswerQuestion: async (...args) => {
            await desktopBrowserMessagePrepare({ kind: "relay", sessionId: args[0] });
            return bridge.relayAnswerQuestion(...args);
        },
    };
}

/** Native session attachment; unmounting (including Activity hiding) revokes its lease. */
export class DesktopBrowserSession extends Component<BrowserAutomationSessionProps> {
    private binding?: BrowserAttachment;
    private unsubscribe?: () => void;
    componentDidMount(): void {
        this.start();
    }
    componentDidUpdate(before: BrowserAutomationSessionProps): void {
        if (JSON.stringify(before.scope) !== JSON.stringify(this.props.scope)) {
            this.stop();
            this.start();
        }
    }
    componentWillUnmount(): void {
        this.stop();
    }
    private start(): void {
        const bridge = window.kissopenDesktop;
        if (!bridge?.browserAutomationStart) return;
        const id = crypto.randomUUID().replaceAll("-", "");
        const binding: BrowserAttachment = {
            id,
            ready: Promise.resolve(),
            phase: "starting",
            paused: false,
            pauseVersion: 0,
        };
        this.binding = binding;
        attachments.add(this);
        this.unsubscribe = bridge.browserAutomationSubscribe?.((event) => {
            if (event.bindingId !== id || this.binding !== binding) return;
            binding.tabId = event.tabId;
            if (event.kind === "state") {
                binding.phase = event.state === "closed" ? "closed" : "ready";
                binding.paused = event.state === "paused";
                if (binding.paused) binding.pauseVersion += 1;
            }
            if (event.kind === "open") this.props.onOpen("about:blank", event.tabId);
        });
        // Attaching is optional, but a fast model must not outrun it. Bound the
        // wait so an unavailable browser never prevents delivery of a message.
        let deadline: ReturnType<typeof setTimeout>;
        binding.ready = Promise.race([
            bridge.browserAutomationStart(id, this.props.scope),
            new Promise<never>((_, reject) => {
                deadline = setTimeout(
                    () => reject(new Error("Browser connection timed out.")),
                    8000,
                );
            }),
        ])
            .then(() => {
                if (this.binding === binding && binding.phase === "starting")
                    binding.phase = "ready";
            })
            .catch(() => {
                if (this.binding !== binding) return;
                binding.phase = "closed";
                void bridge.browserAutomationStop?.(id).catch(() => undefined);
            })
            .finally(() => clearTimeout(deadline));
    }
    private stop(): void {
        attachments.delete(this);
        const binding = this.binding;
        if (binding) binding.phase = "closed";
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.binding = undefined;
        if (binding)
            void window.kissopenDesktop?.browserAutomationStop?.(binding.id).catch(() => undefined);
    }
    async messagePrepare(): Promise<void> {
        const scope = JSON.stringify(this.props.scope);
        const atInstruction = this.binding;
        const pauseVersion = atInstruction?.pauseVersion;
        let recovered = false;
        while (this.binding && JSON.stringify(this.props.scope) === scope) {
            const binding = this.binding;
            if (binding.phase === "closed" && !recovered) {
                // A fresh human instruction may acquire a fresh attachment. Never
                // reconnect on a timer or replay an action from the old lease.
                recovered = true;
                this.stop();
                this.start();
                continue;
            }
            await binding.ready;
            if (JSON.stringify(this.props.scope) !== scope) return;
            if (this.binding !== binding) continue;
            if (binding.phase !== "ready" || !binding.tabId || !binding.paused) return;
            if (binding !== atInstruction || binding.pauseVersion !== pauseVersion) return;
            // The main process serializes pause/resume. A click after this request
            // wins; never restore control on a timer, transport retry or AI output.
            await window.kissopenDesktop
                ?.browserAutomationAction?.(binding.tabId, "resume")
                .catch(() => undefined);
            return;
        }
    }
    render() {
        return null;
    }
}
