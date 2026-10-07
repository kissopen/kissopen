import type {
    CommunityProvider,
    CommunityProfile,
    CommunityAuthorization,
    CommunityAuthorizationStatus,
    CommunityLoginResult,
    CommunityLoginHandle,
    CommunitySecurityClient,
} from "kissopen-desktop-state";
import { AccountSecurity } from "./accountSecurity";

/** Authentication lives outside the product-state package. The host injects
 * browser opening and session persistence; no machine credential enters UI. */
export interface CommunityAccountTransport {
    providers(signal?: AbortSignal): Promise<CommunityProvider[]>;
    start(provider: CommunityProvider, signal?: AbortSignal): Promise<CommunityAuthorization>;
    password?(
        username: string,
        password: string,
        signal?: AbortSignal,
    ): Promise<CommunityLoginHandle>;
    factor?(login: CommunityLoginHandle, code: string, signal?: AbortSignal): Promise<void>;
    security?(
        send: (path: string, body?: Readonly<Record<string, unknown>>) => Promise<unknown>,
    ): CommunitySecurityClient;
    status(
        login: CommunityLoginHandle,
        signal?: AbortSignal,
    ): Promise<CommunityAuthorizationStatus>;
    complete(
        login: CommunityLoginHandle,
        workspace?: undefined,
        signal?: AbortSignal,
    ): Promise<CommunityLoginResult>;
    cancel(login: CommunityLoginHandle): Promise<void>;
    account(token: string, signal?: AbortSignal): Promise<CommunityProfile>;
    signOut(token: string): Promise<void>;
}
export interface CommunityAccountSnapshot {
    readonly providers: readonly CommunityProvider[];
    readonly profile: CommunityProfile | null;
    readonly status: "loading" | "ready" | "authorizing";
    readonly error?: string;
    readonly needsFactor?: boolean;
}
export class CommunityAccount {
    private snapshot: CommunityAccountSnapshot = {
        providers: [],
        profile: null,
        status: "loading",
    };
    private listeners = new Set<() => void>();
    private poll?: AbortController;
    private flow?: AbortController;
    private generation = 0;
    private pending?: CommunityLoginHandle;
    private factorBusy = false;
    readonly security: AccountSecurity;
    constructor(
        private readonly client: CommunityAccountTransport,
        private readonly host: {
            open(url: string): Promise<boolean>;
            sessionRead(): Promise<CommunityProfile | null>;
            sessionAccept(token: string): Promise<CommunityProfile>;
            sessionClear(): Promise<void>;
            securityRequest?(
                path: string,
                body?: Readonly<Record<string, unknown>>,
            ): Promise<unknown>;
            securityUsernameSaved?(): Promise<void>;
        },
    ) {
        this.security = new AccountSecurity(
            host.securityRequest ? client.security?.(host.securityRequest) : undefined,
            client,
            host.open,
        );
    }
    get = () => this.snapshot;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            const controller = (this.poll = new AbortController());
            void this.watch(controller);
        }
        return () => {
            this.listeners.delete(listener);
            if (!this.listeners.size) {
                this.poll?.abort();
                this.signInCancel();
            }
        };
    };
    private publish(snapshot: CommunityAccountSnapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners) listener();
    }
    private async watch(controller: AbortController) {
        const initialGeneration = this.generation;
        try {
            const profile = await this.host.sessionRead();
            if (!controller.signal.aborted && initialGeneration === this.generation)
                this.publish({ ...this.snapshot, profile });
        } catch {
            if (!controller.signal.aborted && initialGeneration === this.generation)
                this.publish({
                    ...this.snapshot,
                    error: "Session storage is unavailable. Sign-in cannot be remembered in this window.",
                });
        }
        while (!controller.signal.aborted) {
            const generation = this.generation;
            try {
                const providers = await this.client.providers(controller.signal);
                const profile = await this.host.sessionRead();
                if (!controller.signal.aborted && generation === this.generation)
                    this.publish({
                        ...this.snapshot,
                        providers,
                        profile,
                        status: this.flow ? "authorizing" : "ready",
                        error: this.flow ? this.snapshot.error : undefined,
                    });
            } catch (error) {
                if (!controller.signal.aborted && generation === this.generation)
                    this.publish({
                        ...this.snapshot,
                        status: this.flow ? "authorizing" : "ready",
                        error: message(error),
                    });
            }
            await wait(10000, controller.signal).catch(() => undefined);
        }
    }
    signIn = (provider: CommunityProvider) => this.login(provider);
    signInPassword = (username: string, password: string) =>
        this.login(undefined, username, password);
    private login = async (provider?: CommunityProvider, username?: string, password?: string) => {
        if (
            this.flow ||
            (provider && !this.snapshot.providers.includes(provider)) ||
            this.snapshot.profile
        )
            return;
        const controller = (this.flow = new AbortController());
        ++this.generation;
        this.publish({ ...this.snapshot, status: "authorizing", error: undefined });
        let login: CommunityLoginHandle | undefined;
        let completed = false;
        try {
            if (provider) {
                const authorization = await this.client.start(provider, controller.signal);
                login = authorization;
                if (controller.signal.aborted) return;
                if (!(await this.host.open(authorization.authorizationUrl)))
                    throw new Error(
                        "Could not open your browser. Allow external links and try again.",
                    );
            } else {
                if (!this.client.password)
                    throw new Error("Password sign-in is unavailable in this host.");
                login = await this.client.password(
                    username?.trim().toLowerCase() ?? "",
                    password ?? "",
                    controller.signal,
                );
            }
            this.pending = login;
            if (controller.signal.aborted) return;
            while (!controller.signal.aborted && Date.now() < Date.parse(login.expiresAt)) {
                const status = await this.client.status(login, controller.signal);
                if (status.status === "failed") throw new Error(status.message);
                if (status.status === "second_factor")
                    this.publish({ ...this.snapshot, needsFactor: true });
                if (status.status === "authorized") {
                    const result = await this.client.complete(login, undefined, controller.signal);
                    completed = true;
                    if (controller.signal.aborted) {
                        void this.client.signOut(result.token).catch(() => undefined);
                        return;
                    }
                    let profile: CommunityProfile;
                    try {
                        profile = await this.host.sessionAccept(result.token);
                    } catch {
                        void this.client.signOut(result.token).catch(() => undefined);
                        throw new Error("Could not save your sign-in session in this window.");
                    }
                    if (controller.signal.aborted) {
                        await this.host.sessionClear();
                        return;
                    }
                    ++this.generation;
                    this.publish({
                        providers: this.snapshot.providers,
                        profile,
                        status: "ready",
                    });
                    return;
                }
                await wait(2000, controller.signal);
            }
            if (!controller.signal.aborted)
                throw new Error("Authorization expired. Please sign in again.");
        } catch (error) {
            if (!controller.signal.aborted)
                this.publish({ ...this.snapshot, status: "ready", error: message(error) });
        } finally {
            if (login && !completed) void this.client.cancel(login).catch(() => undefined);
            if (this.flow === controller) this.flow = undefined;
            if (this.pending === login) {
                this.pending = undefined;
                this.publish({ ...this.snapshot, needsFactor: false });
            }
        }
    };
    signInFactor = async (code: string) => {
        const login = this.pending,
            flow = this.flow;
        if (!login || !flow || !this.client.factor || this.factorBusy) return;
        this.factorBusy = true;
        try {
            await this.client.factor(login, code.trim(), flow.signal);
            if (flow === this.flow)
                this.publish({ ...this.snapshot, error: undefined, needsFactor: false });
        } catch (error) {
            if (flow === this.flow && !flow.signal.aborted)
                this.publish({ ...this.snapshot, error: message(error) });
        } finally {
            this.factorBusy = false;
        }
    };
    signInCancel = () => {
        ++this.generation;
        this.flow?.abort();
        this.flow = undefined;
        this.pending = undefined;
        if (this.snapshot.status === "authorizing")
            this.publish({
                ...this.snapshot,
                status: "ready",
                error: undefined,
                needsFactor: false,
            });
    };
    signOut = async () => {
        this.security.reset();
        this.signInCancel();
        ++this.generation;
        try {
            await this.host.sessionClear();
        } catch {
            this.publish({
                ...this.snapshot,
                error: "Could not clear session storage. Close this window to end the local session.",
            });
            return;
        }
        this.publish({ providers: this.snapshot.providers, profile: null, status: "ready" });
    };
}
function message(error: unknown) {
    return error instanceof Error ? error.message : "Sign-in could not be completed.";
}
function wait(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new Error("Cancelled"));
            return;
        }
        const abort = () => {
            clearTimeout(timer);
            reject(new Error("Cancelled"));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", abort);
            resolve();
        }, ms);
        signal.addEventListener("abort", abort, { once: true });
    });
}
