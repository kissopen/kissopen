/*
Telling the account's machines apart.

Three questions, two of which have honest answers and one of which does not.

Which is the cloud workspace: answered the way the phone answers it. The
business server names the account's cloud bot, and the session that bot speaks
in names the machine it runs on.

Which is this computer: not answered, only matched. Nothing on this desktop
holds the id the local Agent registered under, so the closest available test is
that a machine's hostname and home directory are this one's. That is a good
test and not a proof, and the badge it drives says "本机" rather than anything
stronger.

Which are the rest: whatever is left.
*/
import type { MachineMetadata } from "@kissopen/kissopen-sync/storageTypes";
import type { RelayMachineKind } from "../../shared/relayContract";

/** What this computer looks like, as the local Agent would have registered it. */
export interface RelayLocalIdentity {
    readonly host: string;
    readonly homeDir: string;
    /**
     * The id the local Agent says it registered under, once it has said. With
     * it the question has an answer rather than a match: that machine is this
     * one, and any other registration from the same hostname is another
     * profile or an earlier install, not the daemon this desktop drives.
     */
    readonly machineId?: string;
}

export interface RelayMachineKindInput {
    readonly metadata: MachineMetadata | null;
    readonly machineId: string;
    /** The machine the cloud workspace runs on, when it has been established. */
    readonly cloudMachineId?: string;
    readonly local: RelayLocalIdentity;
}

/**
 * Compares two paths as the same place.
 *
 * Windows writes the home directory with backslashes and a drive letter whose
 * case nobody agrees on, so comparing the strings as they arrive would tell
 * this computer apart from itself.
 */
function samePath(left: string, right: string): boolean {
    const normalise = (value: string) =>
        value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    return normalise(left) === normalise(right);
}

export function relayMachineKind(input: RelayMachineKindInput): RelayMachineKind {
    if (input.cloudMachineId && input.machineId === input.cloudMachineId) return "cloud";
    if (input.local.machineId !== undefined)
        return input.machineId === input.local.machineId ? "this" : "other";
    const metadata = input.metadata;
    // A machine whose metadata will not open cannot be recognised as this one.
    // Calling it "other" is the truthful answer: we do not know what it is.
    if (!metadata) return "other";
    if (
        metadata.host.toLowerCase() === input.local.host.toLowerCase() &&
        samePath(metadata.homeDir, input.local.homeDir)
    )
        return "this";
    return "other";
}
