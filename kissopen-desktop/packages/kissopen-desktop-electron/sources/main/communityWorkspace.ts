import { app, safeStorage } from "electron";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { CommunityAuthClient, communityAuthorizationWait } from "@kissopen/kissopen-sync/communityAuth";
import { communityWorkspaceConnect } from "@kissopen/kissopen-sync/communityWorkspace";
import { nodePlatform } from "@kissopen/kissopen-sync/node";
import { syncPlatformInstall, syncPlatform } from "@kissopen/kissopen-sync/platform";
import { Encryption } from "@kissopen/kissopen-sync/encryption/encryption";
import { encryptBox } from "@kissopen/kissopen-sync/crypto/libsodium";
import { kissopenWorkspaceConnect, kissopenWorkspaceDisconnect } from "./kissopenWorkspace";
import { desktopManagementConnect } from "./desktopManagement";
import type { KissopenCloudRequest, KissopenCloudResponse } from "../shared/kissopenCloud";

const keyPath = (origin: string, id: string) => join(app.getPath("userData"), "workspace-keys",
    createHash("sha256").update(origin + "\n" + id).digest("hex") + ".enc");

/** An account-scoped worker. Cancellation precedes unlink, never publishes old work. */
export function communityDesktopWorkspaceStart(origin: string, id: string, token: string,
    request: (request: KissopenCloudRequest) => Promise<KissopenCloudResponse>) {
    const active = new AbortController();
    let management: { machineId: string; close: () => void } | undefined;
    const finished = (async () => {
        syncPlatformInstall(await nodePlatform());
        const client = new CommunityAuthClient(origin);
        const path = keyPath(origin, id);
        const read = async () => {
            if (!safeStorage.isEncryptionAvailable()) throw new Error("Unlock your login keychain to connect your devices.");
            try { return safeStorage.decryptString(await readFile(path)); }
            catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
        };
        const save = async (secret: string) => {
            if (active.signal.aborted) throw new Error("Account changed.");
            await mkdir(join(app.getPath("userData"), "workspace-keys"), { recursive: true, mode: 0o700 });
            await writeFile(path + ".tmp", safeStorage.encryptString(secret), { mode: 0o600 });
            await rename(path + ".tmp", path);
        };
        let secret: string | undefined;
        let workspaceToken: string | undefined;
        while (!active.signal.aborted) {
            try {
                if (!secret) {
                    const connected = await communityWorkspaceConnect({ client, token, identityId: id, signal: active.signal, read, save });
                    secret = connected.secret;
                    workspaceToken = connected.workspaceToken;
                }
                if (active.signal.aborted) break;
                const integration = await kissopenWorkspaceConnect({ id, phone: "", origin }, async authorization => {
                    if (active.signal.aborted) throw new Error("Account changed.");
                    const target = await client.workspace(token).pair(authorization, undefined, active.signal);
                    const { base64 } = syncPlatform();
                    const encryption = await Encryption.create(base64.decodeBase64(secret!, "base64url"));
                    const bundle = new Uint8Array(33);
                    bundle.set(encryption.contentDataKey, 1);
                    const envelope = base64.encodeBase64(encryptBox(bundle, base64.decodeBase64(target.recipientKey)));
                    bundle.fill(0);
                    if (active.signal.aborted) throw new Error("Account changed.");
                    await client.workspace(token).pair(authorization, envelope, active.signal);
                });
                if (integration.status !== 'connected' || !integration.machineId) {
                    management?.close(); management = undefined;
                } else if (!management || management.machineId !== integration.machineId) {
                    management?.close(); management = undefined;
                    if (workspaceToken && !active.signal.aborted) {
                        const close = await desktopManagementConnect({ origin, token: workspaceToken, secret, machineId: integration.machineId, signal: active.signal, request });
                        management = { machineId: integration.machineId, close };
                    }
                }
            } catch (error) {
                management?.close(); management = undefined;
                if (!active.signal.aborted) console.warn("KissOpen device connection:", error instanceof Error ? error.message : "Connection unavailable");
                if ((error as { status?: number }).status === 401) break;
            }
            await communityAuthorizationWait(3000, active.signal).catch(() => undefined);
        }
    })();
    // Attach the handler immediately; account cancellation can race startup.
    void finished.catch(error => {
        if (!active.signal.aborted)
            console.warn("KissOpen device connection could not start:", error instanceof Error ? error.message : "Connection unavailable");
    });
    return async () => {
        active.abort();
        management?.close(); management = undefined;
        await finished.catch(() => undefined);
        await kissopenWorkspaceDisconnect();
    };
}
