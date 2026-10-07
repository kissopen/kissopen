import { io } from "socket.io-client";
import { Encryption } from "@kissopen/kissopen-sync/encryption/encryption";
import {
    DesktopRosterSchema,
    DesktopPacketSchema,
    DesktopRequestSchema,
    DesktopReplySchema,
    DESKTOP_MANAGEMENT_METHOD,
    DESKTOP_PREVIEW_BYTES,
    DESKTOP_RESPONSE_BYTES,
    type DesktopRequest,
    type DesktopReply,
} from "@kissopen/kissopen-sync/desktopManagement";
import type { KissopenCloudRequest, KissopenCloudResponse } from "../shared/kissopenCloud";
import {
    KissopenAgentDaemonClient,
    kissopenAgentDaemonPathsResolve,
    kissopenAgentDaemonTokenRead,
} from "./kissopenAgentDaemonClient";
import type { Cuid2 } from "@kissopen/kissopen-agent-client";

const failure = (
    code: Extract<DesktopReply, { ok: false }>["code"],
    error: string,
): DesktopReply => ({ ok: false, code, error });

/** Main-only adapter. No arbitrary proxy, secret export, path discovery or shell access. */
export async function desktopManagementRead(
    request: DesktopRequest,
    accountRequest: (request: KissopenCloudRequest) => Promise<KissopenCloudResponse>,
): Promise<DesktopReply> {
    if (request.action === "status") return { ok: true, data: { kind: "status", version: 1 } };
    if (request.action === "plugins.list" || request.action.startsWith("schedule")) {
        const path =
            request.action === "plugins.list"
                ? "/cloud/plugins"
                : request.action === "schedules.list"
                  ? "/schedules"
                  : request.action === "schedule.runs"
                    ? `/schedules/${request.id}/runs`
                    : request.action === "schedule.run"
                      ? `/schedules/${request.id}/run`
                      : request.action === "schedule.status"
                        ? `/schedules/${request.id}`
                        : "";
        if (!path) return failure("invalid", "This operation is not available.");
        const response = await accountRequest({
            path,
            method:
                request.action === "schedule.run" || request.action === "schedule.status"
                    ? "POST"
                    : "GET",
            ...(request.action === "schedule.run"
                ? { body: { id: request.runId } }
                : request.action === "schedule.status"
                  ? { body: { status: request.status } }
                  : {}),
        });
        const value = JSON.parse(response.text);
        if (response.status >= 400)
            return failure(
                response.status === 404 ? "missing" : "unavailable",
                typeof value.error === "string"
                    ? value.error
                    : "The desktop could not complete this operation.",
            );
        const kind =
            request.action === "plugins.list"
                ? "plugins"
                : request.action === "schedules.list"
                  ? "schedules"
                  : request.action === "schedule.runs"
                    ? "runs"
                    : "ack";
        return DesktopReplySchema.parse({ ok: true, data: { ...value, kind } });
    }
    const paths = kissopenAgentDaemonPathsResolve();
    const token = await kissopenAgentDaemonTokenRead(paths.tokenPath);
    if (!token) return failure("unavailable", "The desktop Agent is not connected.");
    const api = new KissopenAgentDaemonClient({ socketPath: paths.socketPath, token })
        .mobileLibrary;
    const options = { signal: AbortSignal.timeout(15000) };
    const bootstrap = await api.bootstrap(options);
    const projects = bootstrap.projects.filter(
        (project) => project.archivedAt === null && project.compute.type === "host",
    );
    if (request.action === "library.projects")
        return {
            ok: true,
            data: {
                kind: "projects",
                projects: projects.map((project) => ({ id: project.id, name: project.name })),
            },
        };
    if (request.action !== "library.directory" && request.action !== "library.read")
        return failure("invalid", "This operation is not available.");
    if (!projects.some((project) => project.id === request.projectId))
        return failure("forbidden", "This project is not available on this desktop.");
    if (request.action === "library.directory") {
        const page = await api.directory(
            request.projectId as Cuid2,
            {
                path: request.path,
                limit: 100,
                ...(request.cursor ? { cursor: request.cursor } : {}),
            },
            options,
        );
        return { ok: true, data: { kind: "directory", ...page } };
    }
    // Preflight the size before reading; recheck actual bytes if the file grew.
    const parent = request.path.split("/").slice(0, -1).join("/");
    const name = request.path.split("/").at(-1)!;
    let cursor: string | undefined;
    let found = false;
    for (let page = 0; page < 10; page++) {
        const listing = await api.directory(
            request.projectId as Cuid2,
            { path: parent, limit: 100, ...(cursor ? { cursor } : {}) },
            options,
        );
        const entry = listing.entries.find((entry) => entry.name === name);
        if (entry) {
            if (entry.type !== "file")
                return failure("forbidden", "Only regular project files can be previewed.");
            if (entry.size > DESKTOP_PREVIEW_BYTES)
                return failure(
                    "too_large",
                    "This file is too large for a mobile preview. Open it on your desktop.",
                );
            found = true;
            break;
        }
        if (!listing.nextCursor) break;
        cursor = listing.nextCursor;
    }
    if (!found) return failure("missing", "This file is no longer available.");
    const file = await api.read(request.projectId as Cuid2, request.path, options);
    if (Buffer.from(file.content, "base64").length > DESKTOP_PREVIEW_BYTES)
        return failure(
            "too_large",
            "This file is too large for a mobile preview. Open it on your desktop.",
        );
    return { ok: true, data: { kind: "file", name, ...file } };
}

/** A separate user-scoped socket never replaces the Agent's machine presence. */
export async function desktopManagementConnect(options: {
    origin: string;
    token: string;
    secret: string;
    machineId: string;
    signal: AbortSignal;
    request: (request: KissopenCloudRequest) => Promise<KissopenCloudResponse>;
}) {
    const response = await fetch(`${options.origin}/v1/machines`, {
        headers: { Authorization: `Bearer ${options.token}` },
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(10000)]),
    });
    if (!response.ok) throw new Error("The desktop device roster is unavailable.");
    const machine = DesktopRosterSchema.parse(await response.json()).find(
        (machine) => machine.id === options.machineId,
    );
    if (!machine) throw new Error("This desktop is not registered to the signed-in workspace.");
    const encryption = await Encryption.create(
        new Uint8Array(Buffer.from(options.secret, "base64url")),
    );
    const key = machine.dataEncryptionKey
        ? await encryption.decryptEncryptionKey(machine.dataEncryptionKey)
        : null;
    if (machine.dataEncryptionKey && !key)
        throw new Error("This desktop encryption key could not be verified.");
    await encryption.initializeMachines(new Map([[machine.id, key]]));
    const cipher = encryption.getMachineEncryption(machine.id)!;
    if (options.signal.aborted) {
        key?.fill(0);
        return () => undefined;
    }
    const method = `${machine.id}:${DESKTOP_MANAGEMENT_METHOD}`;
    const socket = io(options.origin, {
        path: "/v1/updates",
        transports: ["websocket"],
        auth: {
            token: options.token,
            clientType: "user-scoped",
            kissopenClient: "kissopen-desktop-management",
        },
    });
    let pending = 0;
    const close = () => {
        socket.removeAllListeners();
        socket.disconnect();
        key?.fill(0);
    };
    options.signal.addEventListener("abort", close, { once: true });
    socket.on("connect", () => {
        if (!options.signal.aborted) socket.emit("rpc-register", { method });
    });
    socket.on("rpc-request", async (raw: unknown, acknowledge: (value: string) => void) => {
        const packet = DesktopPacketSchema.safeParse(raw);
        if (!packet.success || packet.data.method !== method || options.signal.aborted) return;
        let result: DesktopReply;
        if (pending >= 4)
            result = failure("unavailable", "The desktop is busy. Try again shortly.");
        else {
            pending++;
            try {
                const request = DesktopRequestSchema.safeParse(
                    await cipher.decryptRaw(packet.data.params),
                );
                result = request.success
                    ? await desktopManagementRead(request.data, options.request)
                    : failure("invalid", "This mobile request is incomplete.");
            } catch {
                result = failure(
                    "unavailable",
                    "The desktop could not read this data. It has not been changed.",
                );
            } finally {
                pending--;
            }
        }
        if (Buffer.byteLength(JSON.stringify(result)) > DESKTOP_RESPONSE_BYTES)
            result = failure(
                "too_large",
                "There is too much data to display at once. Open this item on your desktop.",
            );
        if (!options.signal.aborted && socket.connected) {
            try {
                const checked = DesktopReplySchema.safeParse(result);
                let encrypted = await cipher.encryptRaw(
                    checked.success
                        ? checked.data
                        : failure(
                              "unavailable",
                              "The desktop returned data this mobile version cannot display.",
                          ),
                );
                if (Buffer.byteLength(encrypted) > DESKTOP_RESPONSE_BYTES)
                    encrypted = await cipher.encryptRaw(
                        failure(
                            "too_large",
                            "There is too much data to display at once. Open this item on your desktop.",
                        ),
                    );
                if (!options.signal.aborted && socket.connected) acknowledge(encrypted);
            } catch {
                /* A cancelled account must never send an unencrypted reply. */
            }
        }
    });
    return () => {
        options.signal.removeEventListener("abort", close);
        close();
    };
}
