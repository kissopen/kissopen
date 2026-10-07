import { app, safeStorage } from "electron";
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { CommunityAuthClient, type CommunityProfile } from "@kissopen/kissopen-sync/communityAuth";
import type { Billing, CatalogPackage } from "kissopen-desktop-state";
import type { KissopenCloudRequest, KissopenCloudResponse } from "../shared/kissopenCloud";
import { kissopenRouteAllowed } from "./kissopenRoutes";
import { LocalPlugins } from "./localPlugins";
import { localScheduledTasksRequest } from "./localScheduledTasks";
import { localThemeGenerationRequest } from "./localThemeGeneration";
import { communityDesktopWorkspaceStart } from "./communityWorkspace";

export const KISSOPEN_SERVER_ORIGIN = "https://kissopen.com";
function origin(variable: string) {
    return new CommunityAuthClient(
        (!app.isPackaged && process.env[variable]) || KISSOPEN_SERVER_ORIGIN,
    ).origin;
}
const oauth = () => new CommunityAuthClient(origin("KISSOPEN_COMMUNITY_AUTH_URL"));
const sessionPath = () => join(app.getPath("userData"), "community-session.enc");
let epoch = 0;
// Files alone do not close live MCP connections. A new account must not
// inherit another account's running plugin tools before the daemon reloads.
let pluginsNeedReload = false;
let local: { profile: CommunityProfile; generation: number; plugins: LocalPlugins } | undefined;
let workspaceStop: (() => Promise<void>) | undefined;

async function api(request: KissopenCloudRequest, token: string): Promise<KissopenCloudResponse> {
    const response = await fetch(origin("KISSOPEN_COMMUNITY_API_URL") + "/api" + request.path, {
        method: request.method,
        redirect: "error",
        signal: AbortSignal.timeout(request.path === "/documents/pdf" ? 120000 : 30000),
        headers: {
            "Content-Type": "application/json",
            "X-KISSOPEN-Request": "1",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    });
    return { status: response.status, text: await response.text() };
}
async function localStop() {
    const stop = workspaceStop;
    workspaceStop = undefined;
    if (stop) await stop().catch(() => undefined);
    const old = local;
    local = undefined;
    if (old) {
        pluginsNeedReload ||= (await old.plugins.list()).plugins.some((row) => row.active);
        await old.plugins.deactivate();
    }
}
async function localStart(
    profile: CommunityProfile,
    generation: number,
    restart: () => Promise<unknown>,
) {
    if (local?.profile.id === profile.id && local.generation === generation) return;
    await localStop();
    if (generation !== epoch) return;
    const data = app.getPath("userData");
    const home = process.env.KISSOPEN_HOME_DIR;
    if (!home) throw new Error("The local Agent data folder has not been configured.");
    const plugins = new LocalPlugins(
        {
            data: join(data, "local-plugins"),
            skills: join(process.env.HOME || homedir(), ".agents", "skills"),
            mcp: join(
                dirname(home),
                process.platform === "darwin" ? "KISSOPEN" : "kissopen",
                process.platform === "darwin" ? "Config" : "config",
                "mcp.toml",
            ),
        },
        profile.id,
    );
    pluginsNeedReload = (await plugins.deactivateOtherAccounts()) || pluginsNeedReload;
    if (generation !== epoch) return;
    if (pluginsNeedReload) {
        await restart();
        if (generation !== epoch) return;
        pluginsNeedReload = false;
    }
    local = { profile, generation, plugins };
    const token = await tokenRead();
    if (token && generation === epoch)
        workspaceStop = communityDesktopWorkspaceStart(oauth().origin, profile.id, token, async request => {
            if (generation !== epoch || local?.profile.id !== profile.id)
                return answer(403, { error: "The account changed. This device is no longer authorized." });
            const result = await kissopenCloudRequest(request, restart);
            return generation === epoch && local?.profile.id === profile.id
                ? result : answer(403, { error: "The account changed." });
        });
}
// Serialise credential snapshots with account mutation, never API network work.
let mutations: Promise<unknown> = Promise.resolve();
function mutate<T>(action: () => Promise<T>): Promise<T> {
    const result = mutations.then(action);
    mutations = result.catch(() => undefined);
    return result;
}
async function tokenRead(): Promise<string | null> {
    let bytes: Buffer;
    try {
        bytes = await readFile(sessionPath());
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
    }
    if (!safeStorage.isEncryptionAvailable())
        throw new Error("Unlock your login keychain to restore your KissOpen sign-in.");
    return safeStorage.decryptString(bytes);
}
async function clear() {
    ++epoch;
    const stopping = localStop().catch((error: unknown) => {
        console.warn(
            "Local plugin cleanup requires attention:",
            error instanceof Error ? error.message : "cleanup failed",
        );
    });
    const token = await tokenRead().catch(() => null);
    await unlink(sessionPath()).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
    });
    await stopping;
    if (token)
        await oauth()
            .signOut(token)
            .catch(() => undefined);
}
const answer = (status: number, value: unknown): KissopenCloudResponse => ({
    status,
    text: JSON.stringify(value),
});
export async function kissopenCloudRequest(
    request: KissopenCloudRequest,
    restart: () => Promise<unknown>,
): Promise<KissopenCloudResponse> {
    if (!request || !kissopenRouteAllowed(request.method, request.path))
        return answer(403, { error: "This account action is not available." });
    // Local tasks are independent of OAuth credentials and remote account availability.
    if (request.path === "/schedules" || request.path.startsWith("/schedules/"))
        return await localScheduledTasksRequest(request);
    if (request.path === "/themes/generation" || request.path === "/themes/generate")
        return await localThemeGenerationRequest(request);
    try {
        if (request.path === "/auth/community" && request.method === "POST")
            return await mutate(async () => {
                const token = request.body?.token;
                if (typeof token !== "string" || token.length < 24 || token.length > 4096)
                    return answer(400, { error: "Invalid sign-in session. Please sign in again." });
                const profile = await oauth().account(token);
                if (!safeStorage.isEncryptionAvailable())
                    throw new Error("Unlock your login keychain to save your KissOpen sign-in.");
                await mkdir(app.getPath("userData"), { recursive: true, mode: 0o700 });
                await writeFile(sessionPath() + ".tmp", safeStorage.encryptString(token), {
                    mode: 0o600,
                });
                await rename(sessionPath() + ".tmp", sessionPath());
                ++epoch;
                await localStart(profile, epoch, restart);
                return answer(200, profile);
            });
        if (request.path === "/auth/logout" && request.method === "POST")
            return await mutate(async () => {
                await clear();
                return answer(200, { ok: true });
            });
        const { generation, token } = await mutate(async () => ({
            generation: epoch,
            token: await tokenRead(),
        }));
        if (generation !== epoch)
            return answer(409, { error: "The account changed. Please try again." });
        if (request.path === "/auth/community/session" && request.method === "GET") {
            if (!token) return answer(200, null);
            try {
                const profile = await oauth().account(token);
                await mutate(async () => {
                    if (generation === epoch) await localStart(profile, generation, restart);
                });
                return generation === epoch
                    ? answer(200, profile)
                    : answer(409, { error: "The account changed. Please try again." });
            } catch (error) {
                if ((error as { status?: number }).status !== 401) throw error;
                await mutate(async () => {
                    if (generation === epoch) await clear();
                });
                return answer(200, null);
            }
        }
        if (!token && request.path !== "/config")
            return answer(401, { error: "Please sign in to KissOpen." });
        if (
            request.path.startsWith("/cloud/plugins") ||
            (request.method === "POST" && /^\/cloud\/catalog\/[a-z][a-z0-9-]*$/u.test(request.path))
        ) {
            if (!local || local.generation !== generation)
                return answer(401, {
                    error: "Please restore your KissOpen sign-in before managing local plugins.",
                });
            const current = local;
            let downloaded: CatalogPackage | undefined;
            if (request.path.startsWith("/cloud/catalog/")) {
                const response = await api(
                    { method: "GET", path: request.path + "/package" },
                    token!,
                );
                if (response.status !== 200) return response;
                downloaded = JSON.parse(response.text) as CatalogPackage;
            }
            return await mutate(async () => {
                if (generation !== epoch || local !== current)
                    return answer(409, { error: "The account changed." });
                if (request.path === "/cloud/plugins" && request.method === "GET")
                    return answer(200, await current.plugins.list());
                if (request.path === "/cloud/plugins" && request.method === "POST") {
                    if (typeof request.body?.archive !== "string")
                        return answer(400, { error: "Select a plugin ZIP archive to install." });
                    await current.plugins.install(request.body.archive);
                } else if (downloaded) {
                    const id = request.path.split("/")[3]!;
                    if (
                        downloaded.id !== id ||
                        typeof downloaded.archive !== "string" ||
                        !/^[a-f0-9]{64}$/u.test(downloaded.sha256)
                    )
                        return answer(502, { error: "The catalog package could not be verified." });
                    await current.plugins.install(downloaded.archive, {
                        id,
                        sha256: downloaded.sha256,
                    });
                } else if (request.path === "/cloud/plugins/apply" && request.method === "POST") {
                    current.plugins.apply(() =>
                        generation === epoch
                            ? restart()
                            : Promise.reject(new Error("The account changed.")),
                    );
                    return answer(200, { applying: true });
                } else {
                    const match = /^\/cloud\/plugins\/([a-z][a-z0-9-]{0,63})$/u.exec(request.path);
                    if (
                        !match ||
                        request.method !== "POST" ||
                        typeof request.body?.enabled !== "boolean"
                    )
                        return answer(400, {
                            error: "Manage account-backed MCP connections in your local Agent's MCP settings.",
                        });
                    await current.plugins.set(
                        match[1]!,
                        request.body.enabled,
                        request.body.remove === true,
                    );
                }
                return answer(200, { restart_required: true });
            });
        }
        const response = await api(request, token ?? "");
        if (generation !== epoch)
            return answer(409, { error: "The account changed. Please try again." });
        if (response.status === 401 && token)
            await mutate(async () => {
                if (generation === epoch) await clear();
            });
        return response;
    } catch (error) {
        const status = (error as { status?: number }).status || 503;
        const connectionFailure =
            error instanceof TypeError ||
            (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name));
        return answer(status, {
            error: connectionFailure
                ? "Cannot reach the KissOpen account service. Check your connection and try again shortly."
                : error instanceof Error
                  ? error.message
                  : "Account service is temporarily unavailable. Please try again shortly.",
        });
    }
}
export async function kissopenBillingRead(): Promise<Billing | undefined> {
    const response = await kissopenCloudRequest(
        { method: "GET", path: "/billing" },
        async () => undefined,
    );
    return response.status === 200 ? (JSON.parse(response.text) as Billing) : undefined;
}
export function kissopenCloudBaseUrl(): string {
    return origin("KISSOPEN_COMMUNITY_API_URL");
}
