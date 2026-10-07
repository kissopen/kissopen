import type {
    DesktopActiveTarget,
    DesktopStartRequest,
    DesktopTopology,
    DesktopTopologyTarget,
} from "../shared/desktopContract";

export function desktopStartRequestValidate(request: unknown): DesktopStartRequest {
    if (
        request &&
        typeof request === "object" &&
        !Array.isArray(request) &&
        (request as Record<string, unknown>).mode === "local" &&
        Object.keys(request).every((key) => key === "mode")
    )
        return { mode: "local" };
    throw new Error("KissOpen Desktop supports local KissOpen Agent mode only.");
}

export function desktopTopologyFromRequest(
    id: string,
    _request: DesktopStartRequest,
): DesktopTopology {
    if (!desktopTopologyIdValid(id)) throw new Error("The desktop topology identity is invalid.");
    return { id, mode: "local" };
}

export function desktopTopologyRequest(_topology: DesktopTopology): DesktopStartRequest {
    return { mode: "local" };
}

export function desktopTopologyTarget(topology: DesktopTopology): DesktopTopologyTarget {
    return {
        detail: `System KissOpen Agent · ${topology.id.slice(-6)}`,
        id: topology.id,
        kind: "local",
        label: "This Mac",
        mode: "local",
    };
}

export function desktopActiveTarget(
    topology: DesktopTopology,
    kissopenAgentVersion?: string,
    kissopenAgentHttpUrl?: string,
): DesktopActiveTarget {
    if (!kissopenAgentVersion) throw new Error("The local KissOpen Agent version is unavailable.");
    if (!kissopenAgentHttpUrl) throw new Error("The local KissOpen Agent HTTP proxy is unavailable.");
    return {
        ...desktopTopologyTarget(topology),
        authentication: "kissopenAgent",
        mode: "local",
        kissopenAgentVersion,
        kissopenAgentHttpUrl,
    };
}

/**
 * One Kissopen Agent version named by a renderer. It reaches a GitHub release tag
 * and a directory name, so nothing but a semantic version is let through.
 */
export function desktopDaemonVersionValidate(value: unknown): string {
    if (
        typeof value === "string" &&
        value.length <= 128 &&
        /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value)
    )
        return value;
    throw new Error("The requested KissOpen Agent version is invalid.");
}

export function desktopTopologyIdValidate(value: unknown): string {
    if (desktopTopologyIdValid(value)) return value;
    throw new Error("The desktop topology identity is invalid.");
}

export function desktopTopologyIdValid(value: unknown): value is string {
    return typeof value === "string" && /^top_[a-f0-9]{32}$/u.test(value);
}
