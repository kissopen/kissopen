import { t } from "kissopen-desktop-state/i18n";
import { app } from "electron";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { KissopenIntegrationResponse } from "@kissopen/kissopen-agent-client";
import {
    KissopenAgentDaemonClient,
    kissopenAgentDaemonPathsResolve,
    kissopenAgentDaemonTokenRead,
} from "./kissopenAgentDaemonClient";

/**
 * Whose this computer's local workspace is. `phone` and `origin` are the
 * account's full phone number and the server it was bound on; bindings made
 * before they were recorded have neither.
 */
type Binding = { userId: string; initialized: boolean; phone?: string; origin?: string };

/** The signed-in account, as the connect route knows it. */
export type WorkspaceAccount = {
    readonly id: string;
    readonly phone: string;
    readonly origin: string;
};
const bindingPath = () => join(app.getPath("userData"), "kissopen-workspace-owner.json");
async function bindingRead(): Promise<Binding | undefined> {
    try {
        return JSON.parse(await readFile(bindingPath(), "utf8")) as Binding;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
    }
}
async function bindingSave(binding: Binding): Promise<void> {
    await mkdir(app.getPath("userData"), { recursive: true });
    await writeFile(`${bindingPath()}.tmp`, JSON.stringify(binding), { mode: 0o600 });
    await rename(`${bindingPath()}.tmp`, bindingPath());
}
async function integration(
    method: string,
    suffix = "",
): Promise<KissopenIntegrationResponse["integration"]> {
    const paths = kissopenAgentDaemonPathsResolve();
    const token = await kissopenAgentDaemonTokenRead(paths.tokenPath);
    if (!token) throw new Error(t("桌面工作引擎正在启动，稍后将自动同步"));
    const client = new KissopenAgentDaemonClient({ socketPath: paths.socketPath, token });
    const response = await client.rawRequest({
        method,
        path: `/v0/integrations/kissopen${suffix}`,
        signal: AbortSignal.timeout(15000),
    });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 65536) {
            response.body.destroy();
            throw new Error(t("工作空间响应无效"));
        }
        chunks.push(Buffer.from(chunk));
    }
    if (response.statusCode !== 200) throw new Error(t("桌面工作空间暂不可用，正在自动重连"));
    return (JSON.parse(Buffer.concat(chunks).toString("utf8")) as KissopenIntegrationResponse)
        .integration;
}

// The existing Agent owns all workspace data and transport. This only exchanges
// its ephemeral authorization using the authenticated Kissopen account. Neither
// the consumer token nor a workspace recovery key is exposed to the renderer.
export async function kissopenWorkspaceConnect(
    account: WorkspaceAccount,
    authorize: (data: string) => Promise<void>,
) {
    const userId = account.id;
    let binding = await bindingRead();
    if (binding && binding.userId !== userId) {
        // The same person under a new account id — the account moved to another
        // server, whose database gave it a new one — keeps their workspace. The
        // phone number is what says it is the same person; a binding made
        // before it was recorded cannot say so and is still refused.
        const samePerson = account.phone !== "" && binding.phone === account.phone;
        await integration("DELETE");
        if (!samePerson) {
            // Never publish an earlier account's local history into the new account.
            throw new Error(
                t(
                    "这份本地工作空间属于另一个 KissOpen 账号。请使用原账号登录，或为另一个账号使用独立的本机工作区；原有资料不会上传到新账号。",
                ),
            );
        }
        binding = undefined;
    }
    const owner = (initialized: boolean): Binding => ({
        userId,
        initialized,
        phone: account.phone,
        origin: account.origin,
    });
    if (!binding) {
        await integration("DELETE");
        binding = owner(false);
        await bindingSave(binding);
    }
    const current = await integration("POST", "/start");
    if (current.status === "disabled") throw new Error(t("桌面工作空间同步已在工作引擎配置中停用"));
    if (current.authorization) {
        await authorize(current.authorization.data);
        await bindingSave(owner(true));
        return { status: "connecting", machineId: current.machineId };
    }
    if (!current.configured) throw new Error(t("正在重新建立账号工作空间连接"));
    // Also records the phone and server on a binding made before they were kept.
    if (
        !binding.initialized ||
        binding.phone !== account.phone ||
        binding.origin !== account.origin
    )
        await bindingSave(owner(true));
    return { status: current.status, machineId: current.machineId };
}
export async function kissopenWorkspaceDisconnect(): Promise<void> {
    // Preserve the durable owner so switching accounts cannot disclose old work.
    if (await bindingRead()) await integration("DELETE");
}
