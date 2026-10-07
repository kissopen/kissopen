import { z } from "zod";
import {
    CommunityProvidersSchema,
    CommunityStartResponseSchema,
    CommunityStatusSchema,
    CommunityCompleteResponseSchema,
    CommunityProfileSchema,
    CommunityLoginHandleSchema,
    CommunitySecuritySchema,
    CommunityProofSchema,
    CommunityTotpSetupSchema,
    CommunityRecoverySchema,
    CommunityWorkspaceTicketSchema, CommunityWorkspaceStateSchema,
    CommunityWorkspaceRequestsSchema, CommunityWorkspaceResultSchema,
    CommunityWorkspacePairResultSchema,
    CommunityWorkspaceSessionSchema, CommunityWorkspaceEscrowResultSchema,
    type CommunityProvider,
    type CommunityProfile,
} from "@kissopen/kissopen-wire";

export type { CommunityProvider, CommunityProfile };
export type CommunityAuthorization = z.infer<typeof CommunityStartResponseSchema>;
export type CommunityLoginHandle = z.infer<typeof CommunityLoginHandleSchema>;
export type CommunitySecurity = z.infer<typeof CommunitySecuritySchema>;
export type CommunityTotpSetup = z.infer<typeof CommunityTotpSetupSchema>;
export type CommunityAuthorizationStatus = z.infer<typeof CommunityStatusSchema>;
export type CommunityLoginResult = z.infer<typeof CommunityCompleteResponseSchema>;

/** The account service escrows workspace seeds; model-provider keys stay local. */
export class CommunityAuthClient {
    readonly origin: string;
    constructor(origin: string) {
        const url = new URL(origin);
        if (
            url.username ||
            url.password ||
            url.search ||
            url.hash ||
            url.pathname !== "/" ||
            (url.protocol !== "https:" &&
                !(
                    url.protocol === "http:" &&
                    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
                )) ||
            url.hostname === "firstcache.cc" ||
            url.hostname.endsWith(".firstcache.cc")
        )
            throw new Error("Configure an independent HTTPS KissOpen service.");
        this.origin = url.origin;
    }

    async providers(signal?: AbortSignal) {
        return CommunityProvidersSchema.parse(
            await this.request("/v1/community/auth/providers", "GET", undefined, undefined, signal),
        ).providers;
    }
    async start(provider: CommunityProvider, signal?: AbortSignal) {
        const result = CommunityStartResponseSchema.parse(
            await this.request("/v1/community/auth/start", "POST", { provider }, undefined, signal),
        );
        const target = new URL(result.authorizationUrl);
        if (
            target.origin !== this.origin ||
            target.username ||
            target.password ||
            target.hash ||
            target.pathname !== `/v1/community/auth/${result.id}/authorize`
        )
            throw new Error("The service returned an invalid authorization address.");
        return result;
    }
    async password(username: string, password: string, signal?: AbortSignal) {
        return CommunityLoginHandleSchema.parse(
            await this.request(
                "/v1/community/auth/password",
                "POST",
                { username, password },
                undefined,
                signal,
            ),
        );
    }
    async factor(login: CommunityLoginHandle, code: string, signal?: AbortSignal) {
        await this.request(
            `/v1/community/auth/${encodeURIComponent(login.id)}/factor`,
            "POST",
            { code },
            login.pollToken,
            signal,
        );
    }
    async status(login: CommunityLoginHandle, signal?: AbortSignal) {
        return CommunityStatusSchema.parse(
            await this.request(
                `/v1/community/auth/${encodeURIComponent(login.id)}/status`,
                "GET",
                undefined,
                login.pollToken,
                signal,
            ),
        );
    }
    async complete(
        login: CommunityLoginHandle,
        workspace?: { publicKey: string; signature: string },
        signal?: AbortSignal,
    ) {
        return CommunityCompleteResponseSchema.parse(
            await this.request(
                `/v1/community/auth/${encodeURIComponent(login.id)}/complete`,
                "POST",
                workspace ? { mode: "workspace", ...workspace } : { mode: "identity" },
                login.pollToken,
                signal,
            ),
        );
    }
    async cancel(login: CommunityLoginHandle) {
        await this.request(
            `/v1/community/auth/${encodeURIComponent(login.id)}`,
            "DELETE",
            undefined,
            login.pollToken,
        );
    }
    async account(token: string, signal?: AbortSignal) {
        return CommunityProfileSchema.parse(
            await this.request("/v1/community/account", "GET", undefined, token, signal),
        );
    }
    async signOut(token: string) {
        await this.request("/v1/community/account/session", "DELETE", undefined, token);
    }
    workspace(token: string) {
        const send = (path: string, method: string, body?: object, signal?: AbortSignal) =>
            this.request("/v1/community/workspace" + path, method, body, token, signal);
        return {
            session: async (recipientKey: string, signal?: AbortSignal) =>
                CommunityWorkspaceSessionSchema.parse(await send("/session", "POST", { recipientKey }, signal)),
            escrow: async (secret: string, signal?: AbortSignal) =>
                CommunityWorkspaceEscrowResultSchema.parse(await send("/escrow", "POST", { secret }, signal)),
            open: async (recipientKey: string, signal?: AbortSignal) =>
                CommunityWorkspaceTicketSchema.parse(await send("/open", "POST", { recipientKey }, signal)),
            state: async (id: string, signal?: AbortSignal) =>
                CommunityWorkspaceStateSchema.parse(await send("/" + encodeURIComponent(id), "GET", undefined, signal)),
            complete: async (id: string, proof: { publicKey: string; signature: string }, signal?: AbortSignal) =>
                CommunityWorkspaceResultSchema.parse(await send("/" + encodeURIComponent(id) + "/complete", "POST", proof, signal)),
            requests: async (signal?: AbortSignal) =>
                CommunityWorkspaceRequestsSchema.parse(await send("/requests", "GET", undefined, signal)).requests,
            deliver: async (id: string, envelope: string, signature: string, signal?: AbortSignal) =>
                send("/" + encodeURIComponent(id) + "/deliver", "POST", { envelope, signature }, signal),
            pair: async (authorization: string, envelope?: string, signal?: AbortSignal) =>
                CommunityWorkspacePairResultSchema.parse(await send("/pair", "POST", { authorization, envelope }, signal)),
        };
    }
    security(send: (path: string, body?: Readonly<Record<string, unknown>>) => Promise<unknown>) {
        return new CommunitySecurityClient(send, this.origin);
    }

    private async request(
        path: string,
        method: string,
        body?: object,
        token?: string,
        signal?: AbortSignal,
    ): Promise<unknown> {
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (signal?.aborted) abort();
        signal?.addEventListener("abort", abort, { once: true });
        const timer = setTimeout(abort, 15000);
        try {
            const response = await fetch(this.origin + path, {
                method,
                redirect: "error",
                cache: "no-store",
                signal: controller.signal,
                headers: {
                    Accept: "application/json",
                    ...(body ? { "Content-Type": "application/json" } : {}),
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const value: unknown = await response.json();
            if (!response.ok) {
                const error = z.object({ error: z.string() }).safeParse(value);
                throw new CommunityAuthError(
                    response.status,
                    error.success
                        ? error.data.error
                        : "Sign-in could not be completed. Please try again.",
                );
            }
            return value;
        } catch (error) {
            if (error instanceof CommunityAuthError) throw error;
            if (signal?.aborted) throw new Error("Sign-in cancelled.");
            throw new Error(
                "Cannot reach the KissOpen account service. Please check your connection.",
            );
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
        }
    }
}

/** Authenticated transport is injected by the host. Desktop keeps the account
 * token in its secure main-process store; this client never asks UI for it. */
export class CommunitySecurityClient {
    constructor(
        private readonly send: (
            path: string,
            body?: Readonly<Record<string, unknown>>,
        ) => Promise<unknown>,
        private readonly origin: string,
    ) {}
    async read() {
        return CommunitySecuritySchema.parse(await this.send("/security"));
    }
    async verify(password?: string, code?: string) {
        return CommunityProofSchema.parse(await this.send("/security/verify", { password, code }))
            .proof;
    }
    async username(proof: string, username: string) {
        await this.send("/security/username", { proof, username });
    }
    async password(proof: string, password: string) {
        await this.send("/security/password", { proof, password });
    }
    async totpBegin(proof: string) {
        return CommunityTotpSetupSchema.parse(await this.send("/security/totp/begin", { proof }));
    }
    async totpConfirm(setupToken: string, code: string) {
        return CommunityRecoverySchema.parse(
            await this.send("/security/totp/confirm", { setupToken, code }),
        ).codes;
    }
    async totpDisable(proof: string) {
        await this.send("/security/totp/disable", { proof });
    }
    async recovery(proof: string) {
        return CommunityRecoverySchema.parse(await this.send("/security/recovery", { proof }))
            .codes;
    }
    async oauthStart(
        provider: CommunityProvider,
        intent: "link" | "reauthenticate",
        proof?: string,
    ) {
        const login = CommunityStartResponseSchema.parse(
            await this.send("/security/oauth/start", {
                provider,
                intent,
                ...(proof ? { proof } : {}),
            }),
        );
        const target = new URL(login.authorizationUrl);
        if (
            target.origin !== new URL(this.origin).origin ||
            target.username ||
            target.password ||
            target.hash ||
            target.pathname !== `/v1/community/auth/${login.id}/authorize`
        )
            throw new Error("Invalid account authorization address.");
        return login;
    }
    async oauthComplete(login: CommunityLoginHandle) {
        return CommunityProofSchema.parse(
            await this.send("/security/oauth/complete", {
                id: login.id,
                pollToken: login.pollToken,
            }),
        ).proof;
    }
    async oauthUnlink(proof: string, provider: CommunityProvider) {
        await this.send("/security/oauth/unlink", { proof, provider });
    }
}

export class CommunityAuthError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}

export function communityAuthorizationWait(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new Error("Sign-in cancelled."));
            return;
        }
        const abort = () => {
            clearTimeout(timer);
            reject(new Error("Sign-in cancelled."));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", abort);
            resolve();
        }, ms);
        signal.addEventListener("abort", abort, { once: true });
    });
}
