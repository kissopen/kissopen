import { createHash } from "node:crypto";
import type { Session, WebContents, OnBeforeRequestListenerDetails } from "electron";
import { browserErrorDescribe } from "../shared/desktopContract";
import type {
    DesktopBrowserCommand,
    DesktopBrowserCommandResult,
    DesktopBrowserProxyTarget,
} from "../shared/desktopContract";
import {
    serviceBrowserAddress,
    serviceBrowserAdmissionHeader,
    serviceBrowserProxyCreate,
    type ServiceBrowserProxy,
} from "./kissopenAgentServiceBrowserProxy";
import type { DesktopRuntime } from "./desktopRuntime";

interface Guest {
    readonly contents: WebContents;
    generation: number;
    pending?: { readonly address: string; readonly expiresAt: number };
}

interface RequestAdmission {
    readonly origin: string | undefined;
    credential?: string;
}

/** Chromium remains local. Only trusted workspace navigation admits a private service origin. */
export class KissopenAgentServiceBrowser {
    readonly #guests = new Map<number, Guest>();
    readonly #requests = new Map<number, RequestAdmission>();
    readonly #suffix: string;
    #closed = false;

    static partition(target: DesktopBrowserProxyTarget): string {
        return `persist:kissopen-service-browser-${scope(target)}`;
    }

    static async create(
        session: Session,
        target: DesktopBrowserProxyTarget,
        runtime: DesktopRuntime,
    ): Promise<KissopenAgentServiceBrowser> {
        const proxy = await serviceBrowserProxyCreate(
            (id, signal) => runtime.openServiceHttpProxy(target, id, signal),
            `.${scope(target)}.kissopen.invalid`,
        );
        const browser = new KissopenAgentServiceBrowser(session, target, runtime, proxy);
        try {
            browser.#configureRequests();
            // The exact workspace suffix is private. Everything else uses the local browser's network.
            const pac = `function FindProxyForURL(url, host) { if (dnsDomainIs(host, ${JSON.stringify(browser.#suffix)})) return "PROXY 127.0.0.1:${proxy.port}"; return "DIRECT"; }`;
            await session.setProxy({
                mode: "pac_script",
                pacScript: `data:application/x-ns-proxy-autoconfig;base64,${Buffer.from(pac).toString("base64")}`,
                proxyBypassRules: "<-loopback>",
            });
            await session.closeAllConnections();
            if (
                (await session.resolveProxy(`http://s-preview${browser.#suffix}/`)) !==
                    `PROXY 127.0.0.1:${proxy.port}` ||
                (await session.resolveProxy("https://example.com/")) !== "DIRECT"
            )
                throw new Error("Chromium could not establish the private service route.");
            return browser;
        } catch (error) {
            browser.close();
            throw error;
        }
    }

    private constructor(
        readonly session: Session,
        readonly target: DesktopBrowserProxyTarget,
        readonly runtime: DesktopRuntime,
        readonly proxy: ServiceBrowserProxy,
    ) {
        // Chromium always bypasses PAC for .localhost. A reserved non-loopback
        // origin lets ordinary internet traffic remain DIRECT without bypassing
        // the private route. These first-version service origins are plain HTTP.
        this.#suffix = `.${scope(target)}.kissopen.invalid`;
    }

    register(guest: WebContents): void {
        if (this.#closed || guest.session !== this.session)
            throw new Error("Invalid service browser profile.");
        this.#guests.set(guest.id, { contents: guest, generation: 0 });
        guest.once("destroyed", () => this.#guests.delete(guest.id));
    }

    owns(guest: WebContents): boolean {
        return this.#guests.get(guest.id)?.contents === guest;
    }

    popupAllowed(guest: WebContents, candidate: string): boolean {
        try {
            const address = new URL(candidate);
            if (!localAddress(address) || this.#directLocalAddress(address)) return true;
            return (
                this.owns(guest) &&
                this.#serviceId(address) !== undefined &&
                new URL(guest.getURL()).origin === address.origin
            );
        } catch {
            return false;
        }
    }

    async command(
        contents: WebContents,
        command: DesktopBrowserCommand,
    ): Promise<DesktopBrowserCommandResult> {
        const guest = this.#guests.get(contents.id);
        if (this.#closed || !guest || guest.contents !== contents || contents.isDestroyed())
            throw new Error("The browser tab is unavailable.");
        const generation = ++guest.generation;
        guest.pending = undefined;
        if (command.action === "stop") {
            contents.stop();
            return { ok: true };
        }
        const history = contents.navigationHistory;
        const offset = command.action === "back" ? -1 : 1;
        let candidate: string;
        if (command.action === "load") candidate = command.url;
        else if (command.action === "reload") candidate = contents.getURL();
        else {
            // Nowhere to go in that direction: the command is answered,
            // not failed — the reader asked for a step that does not exist.
            if (!history.canGoToOffset(offset)) return { ok: true };
            const entry = history.getEntryAtIndex(history.getActiveIndex() + offset);
            if (!entry) return { ok: true };
            candidate = entry.url;
        }
        const address = await this.#resolve(candidate);
        if (this.#closed || contents.isDestroyed() || guest.generation !== generation)
            return { ok: true };
        guest.pending = { address: withoutHash(address), expiresAt: Date.now() + 10_000 };
        if (command.action === "back" || command.action === "forward") history.goToOffset(offset);
        else if (command.action === "reload") contents.reload();
        else
            try {
                await contents.loadURL(address);
            } catch (error) {
                /*
                 * The page did not load. Chromium says why in the message it
                 * rejects with, and that is what the panel draws its failure
                 * page from, so it is carried back rather than thrown: the
                 * command was carried out, and this is its answer.
                 */
                return { ok: false, url: address, ...browserErrorDescribe(error) };
            }
        return { ok: true };
    }

    connectionsClose(): void {
        for (const guest of this.#guests.values()) {
            guest.generation += 1;
            guest.pending = undefined;
        }
        this.#requests.clear();
        this.proxy.connectionsClose();
    }

    close(): void {
        this.#closed = true;
        this.connectionsClose();
        this.proxy.close();
        this.#guests.clear();
        // Keep the installed request guard: a retired profile must never fall back to localhost.
    }

    #serviceId(address: URL): string | undefined {
        if (
            address.protocol !== "http:" ||
            address.port ||
            !address.hostname.endsWith(this.#suffix)
        )
            return undefined;
        const label = address.hostname.slice(0, -this.#suffix.length);
        return /^s-[a-z][a-z0-9]{1,127}$/.test(label) ? label.slice(2) : undefined;
    }

    #directLocalAddress(address: URL): boolean {
        // Ordinary local development is browser traffic, independent of the daemon's
        // service API. Explicit service selectors retain their private admission path.
        return (
            this.target.connectionId === null &&
            loopbackAddress(address) &&
            serviceSelector(address) === undefined
        );
    }

    async #resolve(candidate: string): Promise<string> {
        if (candidate === "about:blank") return candidate;
        const address = new URL(candidate);
        if (
            !["http:", "https:"].includes(address.protocol) ||
            address.username ||
            address.password ||
            candidate.length > 65536
        )
            throw new Error("The browser address is invalid.");
        if (this.#directLocalAddress(address)) return address.href;
        let selector: { id: string } | { port: number } | undefined;
        const own = this.#serviceId(address);
        if (own) selector = { id: own };
        else {
            const named = serviceSelector(address);
            if (named && address.protocol === "http:" && !address.port) selector = { id: named };
            else if (
                ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(address.hostname) &&
                address.protocol === "http:"
            )
                selector = { port: Number(address.port || 80) };
            else if (localAddress(address))
                throw new Error(
                    "This private address does not belong to this workspace. Open the service from its owning workspace.",
                );
        }
        if (!selector) return address.href;
        const id = await this.runtime.browserServiceResolve(
            this.target,
            selector,
            AbortSignal.timeout(10_000),
        );
        address.hostname = `s-${id}${this.#suffix}`;
        address.port = "";
        return address.href;
    }

    #configureRequests(): void {
        const release = (id: number) => {
            const admission = this.#requests.get(id);
            if (admission?.credential) this.proxy.revoke(admission.credential);
            this.#requests.delete(id);
        };
        this.session.webRequest.onBeforeRequest((details, callback) => {
            let address: URL;
            try {
                address = new URL(details.url);
            } catch {
                callback({ cancel: true });
                return;
            }
            const normalized = serviceBrowserAddress(details.url);
            const id = normalized ? this.#serviceId(normalized) : undefined;
            if (!id) {
                if (localAddress(address) && !this.#directLocalAddress(address)) {
                    release(details.id);
                    callback({ cancel: true });
                    return;
                }
                if (this.#requests.size >= 2048) {
                    callback({ cancel: true });
                    return;
                }
                // Remember external requests too: an external redirect back into a service
                // cannot borrow authority from the document that is being replaced.
                this.#requests.set(details.id, { origin: undefined });
                callback({});
                return;
            }
            const guest = this.#guests.get(details.webContentsId ?? -1);
            if (
                this.#closed ||
                !guest ||
                guest.contents.isDestroyed() ||
                this.#requests.size >= 2048
            ) {
                release(details.id);
                callback({ cancel: true });
                return;
            }
            const origin = normalized!.origin;
            const previous = this.#requests.get(details.id);
            let allowed = previous ? previous.origin === origin : false;
            if (!previous) {
                const pending = guest.pending;
                if (
                    details.resourceType === "mainFrame" &&
                    pending &&
                    pending.expiresAt >= Date.now() &&
                    pending.address === normalized!.href
                ) {
                    allowed = true;
                    guest.pending = undefined;
                } else allowed = this.#sameOriginInitiator(details, guest.contents, origin);
            }
            if (!allowed) {
                release(details.id);
                callback({ cancel: true });
                return;
            }
            this.#requests.set(details.id, { origin });
            callback({});
        });
        this.session.webRequest.onBeforeSendHeaders((details, callback) => {
            const headers = { ...details.requestHeaders };
            for (const name of Object.keys(headers))
                if (
                    [
                        serviceBrowserAdmissionHeader.toLowerCase(),
                        "x-kissopen-service-authorization",
                        "proxy-authorization",
                    ].includes(name.toLowerCase())
                )
                    delete headers[name];
            const address = serviceBrowserAddress(details.url);
            const id = address ? this.#serviceId(address) : undefined;
            if (!id) {
                callback({ requestHeaders: headers });
                return;
            }
            const admission = this.#requests.get(details.id);
            if (this.#closed || !admission || admission.origin !== address!.origin) {
                callback({ cancel: true });
                return;
            }
            try {
                if (admission.credential) this.proxy.revoke(admission.credential);
                admission.credential = this.proxy.authorize(details.url, details.method, id);
                headers[serviceBrowserAdmissionHeader] = admission.credential;
                callback({ requestHeaders: headers });
            } catch {
                release(details.id);
                callback({ cancel: true });
            }
        });
        this.session.webRequest.onBeforeRedirect((details) => {
            const admission = this.#requests.get(details.id);
            if (admission?.credential) this.proxy.revoke(admission.credential);
            const destination = serviceBrowserAddress(details.redirectURL);
            this.#requests.set(details.id, {
                origin: destination?.origin === admission?.origin ? admission?.origin : undefined,
            });
        });
        this.session.webRequest.onCompleted((details) => release(details.id));
        this.session.webRequest.onErrorOccurred((details) => release(details.id));
    }

    #sameOriginInitiator(
        details: OnBeforeRequestListenerDetails,
        contents: WebContents,
        origin: string,
    ): boolean {
        try {
            if (new URL(contents.getURL()).origin !== origin) return false;
            let frame = details.frame;
            if (!frame) return false;
            // An initially blank same-origin iframe may load its first document.
            if (details.resourceType === "subFrame" && frame.url === "about:blank")
                frame = frame.parent;
            if (!frame) return false;
            while (frame) {
                if (new URL(frame.url).origin !== origin) return false;
                frame = frame.parent;
            }
            return true;
        } catch {
            return false;
        }
    }
}

function scope(target: DesktopBrowserProxyTarget): string {
    return createHash("sha256")
        .update(JSON.stringify([target.connectionId, target.workspaceId]))
        .digest("hex")
        .slice(0, 32);
}

function withoutHash(candidate: string): string {
    const address = new URL(candidate);
    address.hash = "";
    return address.href;
}

function localAddress(address: URL): boolean {
    return loopbackAddress(address) || address.hostname.endsWith(".kissopen.invalid");
}

function serviceSelector(address: URL): string | undefined {
    return /^service-([a-z][a-z0-9]{1,127})\.localhost$/.exec(address.hostname)?.[1];
}

function loopbackAddress(address: URL): boolean {
    return (
        address.hostname === "localhost" ||
        address.hostname.endsWith(".localhost") ||
        address.hostname.startsWith("127.") ||
        ["0.0.0.0", "[::1]"].includes(address.hostname)
    );
}
