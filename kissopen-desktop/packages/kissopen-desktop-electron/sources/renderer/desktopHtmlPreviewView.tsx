import { Component, createElement } from "react";
import type { HtmlPreviewProps } from "kissopen-desktop-ui";
import {
    kissopenHtmlPreviewPartition,
    type DesktopPreviewNavigation,
} from "../shared/desktopContract";

interface HtmlPreviewWebViewElement extends HTMLElement {
    getWebContentsId(): number;
    reload(): void;
}

/**
 * How many steps are held while this view still has no guest id.
 *
 * The window publishes every preview guest's steps to every preview view, so a
 * view cannot attribute one until it knows its own guest. Attachment is a few
 * messages away at most, and a document's whole life is a handful of steps, so
 * this only has to be larger than that — it exists so a view that never attaches
 * cannot grow a list for as long as the app is open.
 */
const PREVIEW_STEP_BUFFER = 64;

/**
 * Electron adapter for a rendered HTML file: one Chromium guest showing the
 * document exactly as a browser would, over the loopback site the main process
 * serves the file's own directory as.
 *
 * The guest carries no preload, no Node privilege, and a session of its own
 * whose only reachable network is that server, so a workspace page runs its
 * scripts without being able to reach the daemon, the app, or the internet.
 *
 * The class lifecycle is the imperative boundary the guest needs: the page is
 * reloaded when the file behind it changes, which is what keeps a document
 * someone is editing current without a control that asks for it.
 *
 * Whether there is a page is decided entirely by the ordered navigation stream
 * the main process publishes. That process is the only one that sees a guest's
 * response code, and the only one that sees the start, the finish, the failure,
 * and the lost renderer in one order — so this view follows one navigation at a
 * time and reports what that document did, rather than joining independent
 * signals and guessing which reload each belonged to. It writes no copy: the
 * words a reader sees belong to `kissopen-desktop-ui`.
 */
export class DesktopHtmlPreviewView extends Component<HtmlPreviewProps> {
    private element?: HtmlPreviewWebViewElement;
    private unsubscribe?: () => void;
    /** This view's guest, once it has attached and can be identified. */
    private guestId?: number;
    /** Steps that arrived before that, kept so an early failure is not lost. */
    private pending: DesktopPreviewNavigation[] = [];
    /**
     * The newest navigation this view has heard of. Every step of an older one
     * is ignored: a reload is a new document, and the answer a previous revision
     * was still owed says nothing about the one now on screen.
     */
    private navigation = 0;
    /**
     * Whether the current navigation committed a refused response. A refused
     * document finishes loading like any other, so this is what separates a
     * finish that is a page from a finish that is the server's refusal.
     */
    private refused = false;

    componentDidMount(): void {
        this.unsubscribe = window.kissopenDesktop?.previewNavigationSubscribe(this.receive);
    }

    componentDidUpdate(before: HtmlPreviewProps): void {
        // A new address remounts the guest through its key; only a new revision
        // of the same file is a reload.
        if (before.revision !== this.props.revision && before.source === this.props.source)
            this.element?.reload();
    }

    componentWillUnmount(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.elementApply(null);
        this.pending = [];
    }

    private readonly receive = (step: DesktopPreviewNavigation): void => {
        if (this.guestId === undefined) {
            this.identify();
            if (this.guestId === undefined) {
                if (this.pending.length >= PREVIEW_STEP_BUFFER) this.pending.shift();
                this.pending.push(step);
                return;
            }
            this.drain();
        }
        if (step.guestId !== this.guestId) return;
        this.apply(step);
    };

    /**
     * Learns which guest is this view's, once the element has one. A guest is
     * created a few messages after the element is in the document, so this is
     * asked rather than waited for, and answers nothing until it can.
     */
    private identify(): void {
        const view = this.element;
        if (!view) return;
        try {
            this.guestId = view.getWebContentsId();
        } catch {
            // The guest has not attached yet. The step that prompted this is
            // held, so nothing about the page is lost by asking too early.
        }
    }

    /** Replays what arrived before the guest could be identified, in order. */
    private drain(): void {
        const held = this.pending;
        this.pending = [];
        for (const step of held) if (step.guestId === this.guestId) this.apply(step);
    }

    private apply(step: DesktopPreviewNavigation): void {
        // Anything belonging to a document this guest has already left is news
        // about a page that is gone, and must not land on the one after it.
        if (step.navigationId < this.navigation) return;
        if (step.navigationId > this.navigation) {
            this.navigation = step.navigationId;
            this.refused = false;
        }
        switch (step.phase) {
            case "started":
                // The page on screen stays until this document settles, so a
                // reload does not blink through an empty region.
                return;
            case "responded":
                // Everything a preview serves is a local file: a refused status
                // means there is no page, never an error document worth reading.
                this.refused = step.status >= 400;
                if (this.refused)
                    this.props.previewFailed({
                        kind: "load-failed",
                        source: step.url,
                        status: step.status,
                        ...(step.statusText ? { description: step.statusText } : {}),
                    });
                return;
            case "loaded":
                if (this.refused) return;
                this.props.previewLoaded();
                return;
            case "failed":
                this.props.previewFailed({
                    kind: "load-failed",
                    source: step.url || this.props.source,
                    code: step.code,
                    ...(step.description ? { description: step.description } : {}),
                });
                return;
            case "gone":
                this.props.previewFailed({
                    kind: "renderer-gone",
                    source: step.url || this.props.source,
                    ...(step.reason ? { detail: step.reason } : {}),
                });
                return;
        }
    }

    /**
     * The moment the guest exists. Identification is driven from here rather
     * than only from an arriving step, so a document whose whole life is
     * reported before attachment is still applied instead of sitting in the
     * buffer waiting for a step that never comes.
     */
    private readonly attached = (): void => {
        if (this.guestId !== undefined) return;
        this.identify();
        if (this.guestId !== undefined) this.drain();
    };

    private readonly elementApply = (view: HtmlPreviewWebViewElement | null): void => {
        if (view === this.element) return;
        this.element?.removeEventListener("did-attach", this.attached);
        this.element = view ?? undefined;
        this.element?.addEventListener("did-attach", this.attached);
        // A different element is a different guest, and everything this view
        // believed about a page belongs to the one it no longer holds.
        this.guestId = undefined;
        this.pending = [];
        this.navigation = 0;
        this.refused = false;
    };

    render() {
        return createElement("webview", {
            "data-kissopen-html-preview-guest": "",
            key: this.props.source,
            partition: kissopenHtmlPreviewPartition,
            ref: this.elementApply,
            src: this.props.source,
            webpreferences: "contextIsolation=yes,nodeIntegration=no,sandbox=yes",
        });
    }
}
