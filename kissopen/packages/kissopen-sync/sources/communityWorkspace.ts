import { CommunityAuthClient, communityAuthorizationWait } from "./communityAuth";
import { communityWorkspaceDeliveryMessage } from "@kissopen/kissopen-wire";
import { syncPlatform } from "./platform";
import { decryptBox, encryptBox } from "./crypto/libsodium";

export class CommunityWorkspaceUnavailableError extends Error {
    constructor(readonly reason: "peer-required" | "key-mismatch") {
        super(reason === "peer-required"
            ? "This older workspace has not been migrated to account recovery. Open its original device or use its saved recovery key once. Existing history has been preserved."
            : "This key does not belong to the signed-in account. Your history has been preserved.");
    }
}

/** Account escrow is authoritative. Device-held keys are a one-time migration. */
export async function communityWorkspaceConnect(options: {
    client: CommunityAuthClient; token: string; signal: AbortSignal;
    identityId: string;
    read(): Promise<string | null>; save(secret: string): Promise<void>;
    /** A previous QR session is reusable only after matching the account's key. */
    readLegacy?(): Promise<string | null>;
    waiting?(): void;
}) {
    const { sodium, base64 } = syncPlatform();
    const workspace = options.client.workspace(options.token);
    const recipient = sodium.crypto_box_keypair();
    let seed: Uint8Array | undefined;
    try {
        const recipientKey = base64.encodeBase64(recipient.publicKey);
        let session = await workspace.session(recipientKey, options.signal);
        if (session.identityId !== options.identityId) throw new Error("Account changed. Sign in again.");
        const saved = await options.read();
        seed = saved ? base64.decodeBase64(saved, "base64url") : undefined;
        if (seed && seed.length !== 32) throw new Error("The recovery key is incomplete. Restore the complete key from your original device.");
        if (!seed && session.status === "restore_required" && options.readLegacy) {
            const legacy = await options.readLegacy();
            if (legacy) {
                const candidate = base64.decodeBase64(legacy, "base64url");
                try {
                    if (candidate.length === 32) {
                        const key = sodium.crypto_sign_seed_keypair(candidate);
                        try {
                            const hex = Array.from(key.publicKey, value => value.toString(16).padStart(2, "0")).join("");
                            if (hex === session.publicKey) seed = candidate.slice();
                        } finally { key.privateKey.fill(0); }
                    }
                } finally { candidate.fill(0); }
            }
        }
        const publicKeyOf = (value: Uint8Array) => {
            const key = sodium.crypto_sign_seed_keypair(value);
            try { return Array.from(key.publicKey, byte => byte.toString(16).padStart(2, "0")).join(""); }
            finally { key.privateKey.fill(0); }
        };
        if (seed && publicKeyOf(seed) !== session.publicKey) throw new CommunityWorkspaceUnavailableError("key-mismatch");
        if (!seed && session.status === "restore_required") {
            options.waiting?.();
            const ticket = await workspace.open(recipientKey, options.signal);
            if (ticket.publicKey !== session.publicKey) throw new CommunityWorkspaceUnavailableError("key-mismatch");
            while (Date.now() < Date.parse(ticket.expiresAt)) {
                // A different signed-in device may just have migrated the seed.
                // Do not make new clients wait for a separate peer transfer then.
                session = await workspace.session(recipientKey, options.signal);
                if (session.identityId !== options.identityId) throw new Error("Account changed. Sign in again.");
                if (session.status === "ready") break;
                let state;
                try { state = await workspace.state(ticket.id, options.signal); }
                catch (error) {
                    if ((error as { status?: number }).status === 410) break;
                    throw error;
                }
                if (state.envelope) {
                    seed = decryptBox(base64.decodeBase64(state.envelope), recipient.privateKey) ?? undefined;
                    if (!seed || seed.length !== 32) throw new Error("The device key transfer could not be verified.");
                    break;
                }
                await communityAuthorizationWait(5000, options.signal);
            }
        }
        if (session.status === "restore_required") {
            if (!seed) throw new CommunityWorkspaceUnavailableError("peer-required");
            if (publicKeyOf(seed) !== session.publicKey) throw new CommunityWorkspaceUnavailableError("key-mismatch");
            const imported = await workspace.escrow(base64.encodeBase64(seed, "base64url"), options.signal);
            if (imported.identityId !== options.identityId || imported.publicKey !== session.publicKey)
                throw new Error("Workspace migration could not be verified.");
            session = await workspace.session(recipientKey, options.signal);
        }
        if (session.identityId !== options.identityId || session.status !== "ready") throw new Error("Workspace recovery could not be verified.");
        const restored = decryptBox(base64.decodeBase64(session.envelope), recipient.privateKey);
        if (!restored || restored.length !== 32) { restored?.fill(0); throw new Error("Workspace recovery could not be verified."); }
        const matches = publicKeyOf(restored) === session.publicKey;
        seed?.fill(0); seed = restored;
        if (!matches) throw new CommunityWorkspaceUnavailableError("key-mismatch");
        if (options.signal.aborted) throw new Error("Sign-in cancelled.");
        const secret = base64.encodeBase64(seed, "base64url");
        await options.save(secret);
        if (options.signal.aborted) throw new Error("Sign-in cancelled.");
        return { secret, workspaceToken: session.workspaceToken };
    } finally {
        recipient.privateKey.fill(0);
        seed?.fill(0);
    }
}

/** Only a signed-in device holding the matching workspace seed can answer. */
export async function communityWorkspaceDeliver(client: CommunityAuthClient, token: string, secret: string, signal: AbortSignal) {
    const { sodium, base64 } = syncPlatform();
    const seed = base64.decodeBase64(secret, "base64url");
    const key = sodium.crypto_sign_seed_keypair(seed);
    try {
        const publicKey = Array.from(key.publicKey, value => value.toString(16).padStart(2, "0")).join("");
        for (const ticket of await client.workspace(token).requests(signal)) {
            if (ticket.publicKey !== publicKey || signal.aborted) continue;
            const envelope = base64.encodeBase64(encryptBox(seed, base64.decodeBase64(ticket.recipientKey)));
            const signature = base64.encodeBase64(sodium.crypto_sign_detached(new TextEncoder().encode(communityWorkspaceDeliveryMessage(ticket, envelope)), key.privateKey));
            await client.workspace(token).deliver(ticket.id, envelope, signature, signal);
        }
    } finally {
        seed.fill(0);
        key.privateKey.fill(0);
    }
}
