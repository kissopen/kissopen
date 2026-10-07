import { readFile } from "node:fs/promises";

import type { GymProfilerArtifactReference } from "./types.js";

/**
 * The Electron profiler owns these files and their formats. Gym reads only the
 * manifest index so a workload result can point at the original trace,
 * metrics, and React DevTools backend profile payloads without copying,
 * re-serializing, or replacing any profiler output.
 */
export async function gymProfilerArtifactReferenceRead(
    manifestPath: string,
): Promise<GymProfilerArtifactReference> {
    const value = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
    const record = recordValue(value);
    const derived = recordValue(record?.derived);
    const raw = recordValue(record?.raw);
    const metrics = recordValue(raw?.metrics);
    const trace = recordValue(raw?.trace);
    const reactProfiles = arrayValue(raw?.reactProfiles);
    if (!record || !derived || !raw || !metrics || !trace || !reactProfiles) {
        throw new Error(`Invalid KISSOPEN profiler artifact manifest: ${manifestPath}`);
    }

    const profilePaths = reactProfiles.map((profile, index) => {
        const entry = recordValue(profile);
        if (entry?.format !== "react-devtools-backend-profile-v5" || entry.version !== 5) {
            throw new Error(
                `KISSOPEN profiler artifact has an invalid React backend profile at index ${index}: ${manifestPath}`,
            );
        }
        return stringRequire(entry.path, `raw.reactProfiles[${index}].path`, manifestPath);
    });

    return {
        manifestPath,
        metricsPath: stringRequire(metrics.path, "raw.metrics.path", manifestPath),
        reactBackendProfilePaths: profilePaths,
        reportPath: stringRequire(derived.reportPath, "derived.reportPath", manifestPath),
        tracePath: stringRequire(trace.path, "raw.trace.path", manifestPath),
    };
}

function arrayValue(value: unknown): readonly unknown[] | undefined {
    return Array.isArray(value) ? value : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

function stringRequire(value: unknown, field: string, manifestPath: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`KISSOPEN profiler artifact field ${field} is invalid: ${manifestPath}`);
    }
    return value;
}
