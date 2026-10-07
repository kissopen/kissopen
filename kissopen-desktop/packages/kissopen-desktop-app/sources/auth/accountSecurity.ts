import type {
    CommunitySecurity,
    CommunitySecurityClient,
    CommunityTotpSetup,
    CommunityProvider,
    CommunityLoginHandle,
} from "kissopen-desktop-state";
import type { CommunityAccountTransport } from "./communityAccount";
import { t } from "kissopen-desktop-state";

class SecurityChangeCancelled extends Error {}

export interface AccountSecuritySnapshot {
    readonly data: CommunitySecurity | null;
    readonly busy: boolean;
    readonly confirmation?: { readonly title: string; readonly factorRequired: boolean };
    readonly confirming: boolean;
    readonly needsFactor: boolean;
    readonly error?: string;
    readonly message?: string;
    readonly setup?: CommunityTotpSetup;
    readonly codes?: readonly string[];
}

/** Account credentials, proofs and authorization handles are ephemeral auth
 * boundary state, never product persistence or debug snapshots. */
export class AccountSecurity {
    private snapshot: AccountSecuritySnapshot = {
        data: null,
        busy: false,
        confirming: false,
        needsFactor: false,
    };
    private listeners = new Set<() => void>();
    private confirmation?: { resolve(proof: string): void; reject(error: Error): void };
    private generation = 0;
    private flow?: AbortController;
    private pending?: CommunityLoginHandle;
    private passwordFlow?: AbortController;
    private factorBusy = false;
    constructor(
        private readonly client: CommunitySecurityClient | undefined,
        private readonly auth: CommunityAccountTransport,
        private readonly open: (url: string) => Promise<boolean>,
    ) {}
    get = () => this.snapshot;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        if (this.listeners.size === 1) void this.refresh();
        return () => {
            this.listeners.delete(listener);
            if (!this.listeners.size) this.reset();
        };
    };
    private publish(snapshot: AccountSecuritySnapshot) {
        this.snapshot = snapshot;
        for (const l of this.listeners) l();
    }
    reset = () => {
        ++this.generation;
        this.flow?.abort();
        this.passwordFlow?.abort();
        this.flow = undefined;
        this.passwordFlow = undefined;
        if (this.pending) void this.auth.cancel(this.pending).catch(() => undefined);
        this.pending = undefined;
        this.confirmation?.reject(new SecurityChangeCancelled());
        this.confirmation = undefined;
        this.publish({ data: null, busy: false, confirming: false, needsFactor: false });
    };
    private async run(
        work: (client: CommunitySecurityClient, current: () => boolean) => Promise<void>,
        success?: string,
    ) {
        if (this.snapshot.busy) return;
        const generation = this.generation;
        const current = () => generation === this.generation;
        this.publish({ ...this.snapshot, busy: true, error: undefined, message: undefined });
        try {
            if (!this.client) throw new Error("Security is unavailable in this host.");
            await work(this.client, current);
            if (!current()) return;
            const data = await this.client.read();
            if (current())
                this.publish({
                    ...this.snapshot,
                    data,
                    busy: false,
                    ...(success ? { message: t(success) } : {}),
                });
        } catch (error) {
            if (current())
                this.publish({
                    ...this.snapshot,
                    busy: false,
                    error:
                        error instanceof SecurityChangeCancelled
                            ? undefined
                            : error instanceof Error
                              ? t(error.message)
                              : t("This change could not be saved. Please try again."),
                });
        }
    }
    refresh = () => this.run(async () => undefined);
    // Sensitive actions obtain and immediately consume their own proof. There
    // is no separate Verify action or globally "verified" settings state.
    private async proofForChange(
        client: CommunitySecurityClient,
        current: () => boolean,
        title: string,
    ): Promise<string> {
        const data = this.snapshot.data;
        if (!data) throw new Error("Security is unavailable in this host.");
        if (data.passwordEnabled) {
            return new Promise<string>((resolve, reject) => {
                this.confirmation = { resolve, reject };
                this.publish({
                    ...this.snapshot,
                    confirmation: {
                        title: t(title),
                        factorRequired: data.totpEnabled,
                    },
                    confirming: false,
                });
            });
        }
        const provider = data.providers.find((item) => item.linked && item.configured);
        if (!provider) throw new Error("No linked sign-in provider is available for verification.");
        const proof = await this.authorize(client, current, provider.provider, "reauthenticate");
        if (!proof) throw new Error("Authorization expired. Please start again.");
        return proof;
    }
    confirmChange = async (password: string, code: string) => {
        const confirmation = this.confirmation;
        if (!confirmation || !this.client || this.snapshot.confirming) return;
        this.publish({ ...this.snapshot, confirming: true, error: undefined });
        try {
            const proof = await this.client.verify(password, code || undefined);
            if (this.confirmation !== confirmation) return;
            this.confirmation = undefined;
            this.publish({ ...this.snapshot, confirmation: undefined, confirming: false });
            confirmation.resolve(proof);
        } catch (error) {
            if (this.confirmation === confirmation)
                this.publish({
                    ...this.snapshot,
                    confirming: false,
                    error:
                        error instanceof Error
                            ? t(error.message)
                            : t("This change could not be saved. Please try again."),
                });
        }
    };
    private change(
        title: string,
        work: (
            client: CommunitySecurityClient,
            current: () => boolean,
            proof: string,
        ) => Promise<void>,
        success?: string,
    ) {
        return this.run(async (client, current) => {
            const proof = await this.proofForChange(client, current, title);
            if (current()) await work(client, current, proof);
        }, success);
    }
    // The profile modal supplies the current password and MFA in the same
    // submission. No second modal or global verified mode is involved.
    passwordSave = async (password: string, currentPassword?: string, code?: string) => {
        if (this.snapshot.busy) throw new Error(t("A security change is already in progress."));
        const client = this.client,
            data = this.snapshot.data;
        if (!client || !data) throw new Error(t("Security is unavailable in this host."));
        if (!data.username)
            throw new Error(t("Set your sign-in username in Profile before adding a password."));
        if (data.totpEnabled && !code?.trim())
            throw new Error(t("Enter an authenticator or recovery code."));
        const generation = this.generation;
        const controller = (this.passwordFlow = new AbortController());
        const current = () => generation === this.generation && !controller.signal.aborted;
        let passwordSaved = false;
        this.publish({ ...this.snapshot, busy: true, error: undefined, message: undefined });
        try {
            let proof: string | undefined;
            if (data.passwordEnabled) {
                if (!currentPassword) throw new Error("Enter your current password.");
                proof = await client.verify(currentPassword, code || undefined);
            } else {
                const provider = data.providers.find((item) => item.linked && item.configured);
                if (!provider)
                    throw new Error("No linked sign-in provider is available for verification.");
                proof = await this.authorize(
                    client,
                    current,
                    provider.provider,
                    "reauthenticate",
                    undefined,
                    code,
                );
            }
            if (!current()) throw new SecurityChangeCancelled();
            if (!proof) throw new Error("Authorization expired. Please start again.");
            await client.password(proof, password);
            passwordSaved = true;
            if (!current()) throw new SecurityChangeCancelled();
            // A successful mutation authoritatively enables password sign-in,
            // even if the following status read encounters a network failure.
            let saved = { ...data, passwordEnabled: true };
            try {
                saved = await client.read();
            } catch {
                /* Retain the confirmed mutation. */
            }
            if (!current()) throw new SecurityChangeCancelled();
            this.publish({
                ...this.snapshot,
                data: saved,
                busy: false,
                needsFactor: false,
                message: t("Password saved. Other account sessions have been signed out."),
            });
        } catch (error) {
            if (generation === this.generation)
                this.publish({
                    ...this.snapshot,
                    data: passwordSaved ? { ...data, passwordEnabled: true } : this.snapshot.data,
                    busy: false,
                    needsFactor: false,
                    error:
                        error instanceof SecurityChangeCancelled
                            ? undefined
                            : error instanceof Error
                              ? t(error.message)
                              : t("This change could not be saved. Please try again."),
                });
            throw error;
        } finally {
            if (this.passwordFlow === controller) this.passwordFlow = undefined;
        }
    };
    totpBegin = () =>
        this.change("Set up two-factor authentication", async (client, current, proof) => {
            const setup = await client.totpBegin(proof);
            if (current()) this.publish({ ...this.snapshot, setup, codes: undefined });
        });
    totpConfirm = (code: string) =>
        this.run(async (client, current) => {
            if (!this.snapshot.setup) throw new Error("Start authenticator setup first.");
            const codes = await client.totpConfirm(this.snapshot.setup.setupToken, code.trim());
            if (current()) this.publish({ ...this.snapshot, setup: undefined, codes });
        }, "Two-factor authentication enabled. Save the recovery codes somewhere safe.");
    totpDisable = () =>
        this.change(
            "Disable two-factor authentication",
            async (client, current, proof) => {
                await client.totpDisable(proof);
                if (current()) this.hideSecrets();
            },
            "Two-factor authentication disabled.",
        );
    recovery = () =>
        this.change(
            "Replace recovery codes",
            async (client, current, proof) => {
                const codes = await client.recovery(proof);
                if (current()) this.publish({ ...this.snapshot, codes, setup: undefined });
            },
            "Save these new codes. Your previous recovery codes no longer work.",
        );
    hideSecrets = () => this.publish({ ...this.snapshot, setup: undefined, codes: undefined });
    unlink = (provider: CommunityProvider) =>
        this.change(
            "Unlink sign-in provider",
            async (client, _current, proof) => {
                await client.oauthUnlink(proof, provider);
            },
            "Sign-in provider unlinked.",
        );
    oauth = (provider: CommunityProvider) =>
        this.change(
            "Link sign-in provider",
            async (client, current, proof) => {
                await this.authorize(client, current, provider, "link", proof);
            },
            "Sign-in provider linked to this account.",
        );
    private async authorize(
        client: CommunitySecurityClient,
        current: () => boolean,
        provider: CommunityProvider,
        intent: "link" | "reauthenticate",
        proof?: string,
        factorCode?: string,
    ) {
        const controller = (this.flow = new AbortController());
        let login: CommunityLoginHandle | undefined;
        let factorSent = false;
        try {
            const started = await client.oauthStart(provider, intent, proof);
            login = started;
            if (!current() || controller.signal.aborted) throw new SecurityChangeCancelled();
            this.pending = login;
            if (!(await this.open(started.authorizationUrl)))
                throw new Error("Could not open the authorization browser.");
            while (
                current() &&
                !controller.signal.aborted &&
                Date.now() < Date.parse(login.expiresAt)
            ) {
                const status = await this.auth.status(login, controller.signal);
                if (!current()) return;
                if (controller.signal.aborted) throw new SecurityChangeCancelled();
                if (status.status === "failed") throw new Error(status.message);
                if (status.status === "linked") return;
                if (status.status === "second_factor" && factorCode && !this.auth.factor)
                    throw new Error("Security is unavailable in this host.");
                if (
                    status.status === "second_factor" &&
                    factorCode &&
                    !factorSent &&
                    this.auth.factor
                ) {
                    factorSent = true;
                    await this.auth.factor(login, factorCode, controller.signal);
                    continue;
                }
                if (status.status === "second_factor")
                    this.publish({ ...this.snapshot, needsFactor: true });
                if (status.status === "authorized" && intent === "reauthenticate") {
                    return await client.oauthComplete(login);
                }
                if (controller.signal.aborted) throw new SecurityChangeCancelled();
                await new Promise<void>((resolve, reject) => {
                    const abort = () => {
                        clearTimeout(timer);
                        reject(new SecurityChangeCancelled());
                    };
                    const timer = setTimeout(() => {
                        controller.signal.removeEventListener("abort", abort);
                        resolve();
                    }, 1500);
                    controller.signal.addEventListener("abort", abort, { once: true });
                });
            }
            if (controller.signal.aborted) throw new SecurityChangeCancelled();
            if (current()) throw new Error("Authorization expired. Please start again.");
        } catch (error) {
            if (controller.signal.aborted) throw new SecurityChangeCancelled();
            throw error;
        } finally {
            if (login) void this.auth.cancel(login).catch(() => undefined);
            if (this.pending === login) this.pending = undefined;
            if (this.flow === controller) this.flow = undefined;
            if (current()) {
                this.publish({ ...this.snapshot, needsFactor: false });
            }
        }
    }
    factor = async (code: string) => {
        if (!this.pending || !this.auth.factor || this.factorBusy) return;
        this.factorBusy = true;
        const generation = this.generation;
        try {
            await this.auth.factor(this.pending, code.trim(), this.flow?.signal);
            if (generation === this.generation)
                this.publish({ ...this.snapshot, error: undefined });
        } catch (error) {
            if (generation === this.generation)
                this.publish({
                    ...this.snapshot,
                    error:
                        error instanceof Error
                            ? t(error.message)
                            : t("Code could not be verified."),
                });
        } finally {
            this.factorBusy = false;
        }
    };
    cancel = () => {
        this.flow?.abort();
        this.passwordFlow?.abort();
        this.confirmation?.reject(new SecurityChangeCancelled());
        this.confirmation = undefined;
        this.publish({ ...this.snapshot, confirmation: undefined, confirming: false });
    };
}
