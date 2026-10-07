import { t } from "../i18n/locale.js";
declare const __KISSOPEN_ALLOW_SOURCE_AGENT__: boolean | undefined;

import {
    KISSOPEN_AGENT_PROTOCOL_VERSION,
    type DaemonVersion,
} from "@kissopen/kissopen-agent-client";
import type { ServerCompatibility } from "./types.js";

export const MINIMUM_KISSOPEN_AGENT_PROTOCOL_VERSION = KISSOPEN_AGENT_PROTOCOL_VERSION;

/**
 * The oldest Kissopen Agent this build works with, as the daemon's own product
 * version — the number people see, install, and update to.
 *
 * This is the one knob to raise when Kissopen starts requiring a newer daemon.
 * The wire protocol number stays the hard gate underneath: a daemon speaking
 * an older protocol cannot be talked to at all, whatever its version says.
 * The screens quote this version, not the protocol number.
 */
export const MINIMUM_KISSOPEN_AGENT_VERSION = "0.4.44";

/**
 * Orders two daemon product versions by their dotted numeric fields. A
 * prerelease suffix on a field ("29-beta") counts as the number it starts
 * with; the daemon and this client share one version scheme, so nothing finer
 * is needed to say "at least".
 */
function versionCompare(left: string, right: string): number {
    const leftParts = left.split(".");
    const rightParts = right.split(".");
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
        const leftValue = Number.parseInt(leftParts[index] ?? "0", 10) || 0;
        const rightValue = Number.parseInt(rightParts[index] ?? "0", 10) || 0;
        if (leftValue !== rightValue) return leftValue < rightValue ? -1 : 1;
    }
    return 0;
}

/** Whether the last daemon product version observed supports a versioned feature. */
export function kissopenAgentVersionAtLeast(
    version: string | undefined,
    minimumVersion: string,
): boolean {
    return version !== undefined && versionCompare(version, minimumVersion) >= 0;
}

export const CHECKING_SERVER_COMPATIBILITY: ServerCompatibility = {
    status: "checking",
    minimumSupportedProtocolVersion: MINIMUM_KISSOPEN_AGENT_PROTOCOL_VERSION,
    minimumSupportedVersion: MINIMUM_KISSOPEN_AGENT_VERSION,
};

export function serverCompatibility(
    version: DaemonVersion,
): Exclude<ServerCompatibility, { status: "checking" }> {
    const protocol =
        Number.isSafeInteger(version.protocol) && version.protocol >= 0 ? version.protocol : 0;
    const supported = {
        minimumSupportedProtocolVersion: MINIMUM_KISSOPEN_AGENT_PROTOCOL_VERSION,
        minimumSupportedVersion: MINIMUM_KISSOPEN_AGENT_VERSION,
        serverProtocolVersion: protocol,
        serverVersion: version.daemon,
    };
    // Opt-in source builds retain their honest 0.0.0 identity. The wire protocol
    // remains mandatory, and ordinary builds still require the released version.
    const sourceBuild =
        typeof __KISSOPEN_ALLOW_SOURCE_AGENT__ !== "undefined" &&
        __KISSOPEN_ALLOW_SOURCE_AGENT__ === true &&
        version.daemon === "0.0.0";
    if (
        protocol < MINIMUM_KISSOPEN_AGENT_PROTOCOL_VERSION ||
        (!sourceBuild &&
            !kissopenAgentVersionAtLeast(version.daemon, MINIMUM_KISSOPEN_AGENT_VERSION))
    )
        return { ...supported, status: "server_outdated" };
    return { ...supported, status: "compatible" };
}

export function describeServerCompatibility(compatibility: ServerCompatibility): string {
    if (compatibility.status === "server_outdated") {
        if (compatibility.serverProtocolVersion < compatibility.minimumSupportedProtocolVersion)
            return t(
                "KissOpen Agent on this machine is version {serverVersion}, but this build of KissOpen requires a more recent version.",
                { serverVersion: compatibility.serverVersion },
            );
        return t(
            "KissOpen Agent on this machine is version {serverVersion}, but this build of KissOpen needs at least version {minimumSupportedVersion}.",
            {
                serverVersion: compatibility.serverVersion,
                minimumSupportedVersion: compatibility.minimumSupportedVersion,
            },
        );
    }
    return compatibility.status === "compatible"
        ? "The KissOpen Agent server is compatible."
        : "The KissOpen Agent server compatibility check is still in progress.";
}
