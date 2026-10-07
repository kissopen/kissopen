import { t } from "kissopen-desktop-state";
import { Component, createElement } from "react";
import type { BrowserContentProps, BrowserController } from "kissopen-desktop-ui";
import { browserErrorDescribe } from "../shared/desktopContract";
import type { DesktopBrowserCommand, DesktopBrowserStatus } from "../shared/desktopContract";

interface BrowserWebViewEvent extends Event {
    readonly canGoBack?: boolean;
    readonly canGoForward?: boolean;
    readonly errorCode?: number;
    readonly errorDescription?: string;
    readonly isMainFrame?: boolean;
    readonly title?: string;
    readonly url?: string;
    readonly validatedURL?: string;
}

interface BrowserWebViewElement extends HTMLElement {
    canGoBack(): boolean;
    canGoForward(): boolean;
    executeJavaScript(code: string): Promise<unknown>;
    getTitle(): string;
    getURL(): string;
    getWebContentsId(): number;
}

const browserEvents = [
    "crashed",
    "did-fail-load",
    "did-navigate",
    "did-navigate-in-page",
    "did-start-loading",
    "did-stop-loading",
    "dom-ready",
    "page-title-updated",
    "render-process-gone",
] as const;

/**
 * Whether the committed document shows anything at all. A 4xx/5xx response that
 * carries its own error page is a normal page and must be rendered as one; an
 * empty one leaves Electron on a blank document, which is what the panel
 * replaces with a readable failure page.
 */
const browserBodyProbe = `(() => {
    const body = document.body;
    if (!body) return false;
    if (body.innerText.trim().length > 0) return true;
    return body.querySelector("img, svg, video, canvas, iframe, form, table, input, button") !== null;
})()`;

/**
 * Electron-only adapter for BrowserPanel. The class lifecycle is the imperative
 * boundary that attaches to one `<webview>` guest and cleans every listener up;
 * it owns no visual state or styling.
 */
export class DesktopBrowserView extends Component<BrowserContentProps> {
    state: { partition?: string } = {};
    private element?: BrowserWebViewElement;
    private proxyGeneration = 0;
    private statusUnsubscribe?: () => void;
    private automationUnsubscribe?: () => void;
    private initialized = false;
    /** Response of the navigation that is loading or has just committed. */
    private status?: DesktopBrowserStatus;
    /** Address of the newest requested navigation, for failures with no commit. */
    private requested?: string;

    private readonly controller: BrowserController = {
        browserBack: () => {
            this.requested = undefined;
            this.command({ action: "back" });
        },
        browserForward: () => {
            this.requested = undefined;
            this.command({ action: "forward" });
        },
        browserLoad: (url) => {
            this.status = undefined;
            this.requested = url;
            this.command({ action: "load", url });
        },
        browserReload: () => {
            if (this.element?.getURL() === "about:blank" && this.requested)
                this.controller.browserLoad(this.requested);
            else this.command({ action: "reload" });
        },
        browserStop: () => {
            this.command({ action: "stop" });
            this.props.browserLoadingChanged(false);
        },
    };

    private command(command: DesktopBrowserCommand, userInitiated = true): void {
        if (userInitiated && this.initialized) this.automationAction("pause");
        const desktop = window.kissopenDesktop;
        const target = this.props.target;
        const view = this.element;
        if (!desktop?.browserCommand || !target || !view || !this.initialized) return;
        const generation = this.proxyGeneration;
        // Superseded work is nobody's failure: another navigation has already
        // replaced what this one was going to show.
        const current = () =>
            generation === this.proxyGeneration &&
            !(command.action === "load" && this.requested !== command.url);
        void desktop
            .browserCommand(target, view.getWebContentsId(), command)
            .then((result) => {
                if (result.ok || !current()) return;
                this.props.browserFailed({
                    url: result.url,
                    ...(result.code === undefined ? {} : { code: result.code }),
                    ...(result.description === undefined
                        ? {}
                        : { description: result.description }),
                });
            })
            .catch((error: unknown) => {
                // A command that could not be carried out at all — no such
                // tab, not this window's. Still shown, because the reader
                // pressed something and nothing happened.
                if (!current()) return;
                this.props.browserFailed({
                    url: command.action === "load" ? command.url : view.getURL(),
                    ...browserErrorDescribe(error),
                });
            });
    }

    private readonly receive = (raw: Event): void => {
        const event = raw as BrowserWebViewEvent;
        const view = this.element;
        if (!view) return;
        if (!this.initialized) {
            if (event.type === "dom-ready") {
                this.initialized = true;
                this.props.browserControllerReady(this.controller);
                if (this.props.automationId && this.props.target && this.props.active !== false) {
                    void window.kissopenDesktop
                        ?.browserAutomationBind?.(
                            this.props.automationId,
                            view.getWebContentsId(),
                            this.props.target,
                        )
                        .catch(() => this.props.browserAutomationChanged?.("closed"));
                }
                if (this.props.source !== "about:blank" && !this.props.automationId) {
                    this.requested = this.props.source;
                    this.command({ action: "load", url: this.props.source }, false);
                }
                return;
            }
            if (!["crashed", "render-process-gone", "did-fail-load"].includes(event.type)) return;
        }
        if (event.type === "did-start-loading") {
            this.status = undefined;
            this.props.browserLoadingChanged(true);
            return;
        }
        if (event.type === "did-stop-loading") {
            // The bootstrap blank document is not the requested address. Service
            // discovery may still be in flight when that document finishes.
            if (
                view.getURL() === "about:blank" &&
                this.requested &&
                this.requested !== "about:blank"
            )
                return;
            this.props.browserLoadingChanged(false);
            this.locationPublish();
            void this.statusVerify();
            return;
        }
        if (event.type === "did-fail-load") {
            // Chromium reports an intentional stop/replacement as ERR_ABORTED.
            if (event.errorCode !== -3 && event.isMainFrame !== false)
                this.props.browserFailed({
                    ...(event.errorCode === undefined ? {} : { code: event.errorCode }),
                    ...(event.errorDescription ? { description: event.errorDescription } : {}),
                    url: event.validatedURL || this.requested || view.getURL(),
                });
            return;
        }
        if (event.type === "crashed" || event.type === "render-process-gone") {
            this.props.browserFailed({
                message: t("This page stopped responding and was closed."),
                url: view.getURL() || this.requested,
            });
            return;
        }
        if (event.type === "page-title-updated") {
            this.props.browserTitleChanged(event.title ?? view.getTitle());
            return;
        }
        if (event.type === "dom-ready") {
            this.locationPublish();
            const title = view.getTitle();
            if (title) this.props.browserTitleChanged(title);
            return;
        }
        this.locationPublish(event.url ?? event.validatedURL);
    };

    componentDidMount(): void {
        this.automationUnsubscribe = window.kissopenDesktop?.browserAutomationSubscribe?.(
            (event) => {
                if (event.tabId !== this.props.automationId) return;
                if (event.kind === "open" && this.props.active !== false) this.automationBind();
                if (event.kind === "pointer" && this.props.active !== false)
                    this.props.browserPointerChanged?.({
                        operationId: event.operationId,
                        action: event.action,
                        phase: event.phase,
                        x: event.x,
                        y: event.y,
                    });
                if (event.kind === "state" && event.tabId === this.props.automationId)
                    this.props.browserAutomationChanged?.(event.state, event.message);
            },
        );
        this.statusUnsubscribe = window.kissopenDesktop?.browserStatusSubscribe((status) => {
            if (!this.initialized) return;
            if (status.guestId !== this.element?.getWebContentsId()) return;
            this.status = status;
            void this.statusVerify();
        });
        this.proxyApply();
    }

    componentDidUpdate(before: BrowserContentProps): void {
        if (before.active === false && this.props.active !== false) this.automationBind();
        if (before.active !== false && this.props.active === false) {
            this.props.browserPointerChanged?.(undefined);
            this.automationAction("pause");
        }
        if (
            before.target?.workspaceId !== this.props.target?.workspaceId ||
            before.target?.connectionId !== this.props.target?.connectionId
        )
            this.proxyApply();
    }

    private automationBind(): void {
        const view = this.element;
        if (!this.initialized || !view || !this.props.automationId || !this.props.target) return;
        void window.kissopenDesktop
            ?.browserAutomationBind?.(
                this.props.automationId,
                view.getWebContentsId(),
                this.props.target,
            )
            .catch(() => this.props.browserAutomationChanged?.("closed"));
    }

    componentWillUnmount(): void {
        this.automationAction("close");
        this.automationUnsubscribe?.();
        this.proxyGeneration += 1;
        this.statusUnsubscribe?.();
        this.statusUnsubscribe = undefined;
        this.elementApply(undefined);
    }

    /**
     * Report a committed error response that rendered nothing. Electron ships no
     * built-in error page, so a 4xx/5xx with an empty body leaves a blank guest
     * unless the panel is told to draw the failure itself.
     */
    private async statusVerify(): Promise<void> {
        const status = this.status;
        const view = this.element;
        if (!view || !status || status.status < 400) return;
        if (status.url !== view.getURL()) return;
        const rendered = await view.executeJavaScript(browserBodyProbe).catch(() => true);
        if (rendered !== false) return;
        if (this.status !== status || this.element !== view) return;
        this.props.browserFailed({
            status: status.status,
            description: status.statusText,
            url: status.url,
        });
    }

    private readonly elementApply = (view: BrowserWebViewElement | null | undefined): void => {
        if (view === this.element) return;
        if (this.element)
            for (const event of browserEvents)
                this.element.removeEventListener(event, this.receive);
        this.element = view ?? undefined;
        this.initialized = false;
        if (this.element) {
            for (const event of browserEvents) this.element.addEventListener(event, this.receive);
        } else {
            this.props.browserControllerReady(undefined);
        }
    };

    private automationAction(action: "pause" | "resume" | "close"): void {
        if (action !== "resume") this.props.browserPointerChanged?.(undefined);
        if (this.props.automationId)
            void window.kissopenDesktop
                ?.browserAutomationAction?.(this.props.automationId, action)
                .catch(() => undefined);
    }

    private proxyApply(): void {
        const target = this.props.target;
        const desktop = window.kissopenDesktop;
        const generation = (this.proxyGeneration += 1);
        this.elementApply(undefined);
        if (this.state.partition) this.setState({ partition: undefined });
        if (!target || !desktop) {
            this.props.browserFailed({
                message: t("The browser has no KissOpen Agent workspace."),
            });
            return;
        }
        if (!desktop.browserCommand) {
            this.props.browserFailed({
                message: t(
                    "Update KissOpen Nightly to enable the private workspace service browser.",
                ),
            });
            return;
        }
        void desktop.browserProxyApply(target).then(
            (partition) => {
                if (generation === this.proxyGeneration) this.setState({ partition });
            },
            (error: unknown) => {
                if (generation !== this.proxyGeneration) return;
                this.props.browserFailed({
                    message:
                        error instanceof Error
                            ? error.message
                            : t("The KissOpen Agent browser proxy could not be opened."),
                });
            },
        );
    }

    private locationPublish(candidate?: string): void {
        const view = this.element;
        if (!view) return;
        const url = candidate || view.getURL();
        if (!url) return;
        if (url === "about:blank" && this.requested && this.requested !== "about:blank") return;
        this.props.browserLocationChanged(url, view.canGoBack(), view.canGoForward());
    }

    render() {
        if (!this.state.partition)
            return createElement("div", {
                "data-kissopen-browser-proxy-loading": "",
            });
        return createElement("webview", {
            allowpopups: "",
            "data-kissopen-browser-guest": "",
            partition: this.state.partition,
            ref: this.elementApply,
            src: "about:blank",
            webpreferences: "contextIsolation=yes,nodeIntegration=no,sandbox=yes",
        });
    }
}
