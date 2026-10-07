import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
    DESKTOP_PROFILER_SCHEMA_VERSION,
    DESKTOP_REACT_DEVTOOLS_CORE_VERSION,
    DESKTOP_REACT_VERSION,
    type DesktopProfilerBuildMode,
    type DesktopProfilerMetricSample,
    type DesktopReactInspectionSummary,
    type DesktopReactDevtoolsProfilePayload,
    type DesktopReactProfileReport,
} from "../shared/desktopProfiler";

export interface DesktopProfilerArtifactInput {
    readonly buildMode: DesktopProfilerBuildMode;
    readonly buildLabel?: string;
    readonly finishedAt: number;
    readonly metrics: readonly DesktopProfilerMetricSample[];
    readonly partial: boolean;
    readonly partialReason?: string;
    readonly profileBuildVerified: boolean;
    readonly react: DesktopReactProfileReport;
    readonly reactInspection: DesktopReactInspectionSummary;
    readonly reactProfiles: readonly DesktopReactDevtoolsProfilePayload[];
    readonly sessionId: string;
    readonly startedAt: number;
    readonly tracePartialPrefix?: Uint8Array;
    readonly traceOverflow: boolean;
    readonly traceRawJson: string;
}

export interface DesktopProfilerArtifact {
    readonly bytes: number;
    readonly finishedAt: number;
    readonly partial: boolean;
    readonly path: string;
    readonly sessionId: string;
}

interface DesktopProfilerRawProfileIndex {
    readonly format: "react-devtools-backend-profile-v5";
    readonly path: string;
    readonly rendererId: number;
    readonly version: 5;
}

interface DesktopProfilerArtifactManifest {
    readonly capture: {
        readonly buildMode: DesktopProfilerBuildMode;
        readonly buildLabel?: string;
        readonly finishedAt: number;
        readonly partial: boolean;
        readonly partialReason?: string;
        readonly profileBuildVerified: boolean;
        readonly sessionId: string;
        readonly startedAt: number;
    };
    readonly derived: {
        readonly reportPath: string;
    };
    readonly raw: {
        readonly metrics: {
            readonly format: "ndjson";
            readonly path: string;
        };
        readonly partial?: {
            readonly bytes: number;
            readonly complete: false;
            readonly format: "chromium-trace-json-prefix";
            readonly loadable: false;
            readonly path: string;
        };
        readonly reactProfiles: readonly DesktopProfilerRawProfileIndex[];
        readonly trace: {
            readonly format: "chromium-trace-json";
            readonly overflow: boolean;
            readonly path: string;
        };
    };
    readonly schemaVersion: typeof DESKTOP_PROFILER_SCHEMA_VERSION;
    readonly versions: {
        readonly react: typeof DESKTOP_REACT_VERSION;
        readonly reactDevtoolsCore: typeof DESKTOP_REACT_DEVTOOLS_CORE_VERSION;
    };
}

interface DesktopProfilerArtifactReport {
    readonly redacted: true;
    readonly capture: {
        readonly buildMode: DesktopProfilerBuildMode;
        readonly buildLabel?: string;
        readonly finishedAt: number;
        readonly partial: boolean;
        readonly partialReason?: string;
        readonly profileBuildVerified: boolean;
        readonly sessionId: string;
        readonly startedAt: number;
    };
    readonly metricsPath: string;
    readonly react: Omit<DesktopReactProfileReport, "roots">;
    readonly reactInspection: DesktopReactInspectionSummary;
    readonly reactBackendProfilePaths: readonly string[];
    readonly schemaVersion: typeof DESKTOP_PROFILER_SCHEMA_VERSION;
    readonly tracePartial?: {
        readonly bytes: number;
        readonly complete: false;
        readonly format: "chromium-trace-json-prefix";
        readonly loadable: false;
        readonly path: string;
    };
    readonly tracePath: string;
    readonly traceOverflow: boolean;
    readonly versions: {
        readonly react: typeof DESKTOP_REACT_VERSION;
        readonly reactDevtoolsCore: typeof DESKTOP_REACT_DEVTOOLS_CORE_VERSION;
    };
}

function derivedReactProfileReport(
    report: DesktopReactProfileReport,
): Omit<DesktopReactProfileReport, "roots"> {
    return {
        commits: report.commits,
        components: report.components,
        hookNameCoverage: report.hookNameCoverage,
        renderRecordLimit: report.renderRecordLimit,
        renderRecordsDropped: report.renderRecordsDropped,
        renderRecordsPerComponentLimit: report.renderRecordsPerComponentLimit,
        renderRecordsRetained: report.renderRecordsRetained,
        renderRecordsTruncated: report.renderRecordsTruncated,
    };
}

async function atomicWrite(path: string, contents: string): Promise<number> {
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, contents, "utf8");
    await rename(temporary, path);
    return Buffer.byteLength(contents);
}

async function atomicWriteBytes(path: string, contents: Uint8Array): Promise<number> {
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, contents);
    await rename(temporary, path);
    return contents.byteLength;
}

/**
 * React DevTools' 6.1.5 backend profiling payload is kept as standalone JSON.
 * It is raw backend evidence, not the frontend Store export accepted by the
 * React DevTools profile importer: the backend does not provide that export's
 * operations and snapshots. Values remain excluded at the renderer boundary.
 */
function reactBackendProfileJson(
    payload: DesktopReactDevtoolsProfilePayload,
): Record<string, unknown> {
    return {
        dataForRoots: payload.dataForRoots.map((root) => ({
            commitData: root.commitData.map((commit) => ({
                changeDescriptions:
                    commit.changeDescriptions === null
                        ? null
                        : commit.changeDescriptions.map(([fiberId, description]) => [
                              fiberId,
                              {
                                  context: description.context,
                                  didHooksChange: description.didHooksChange,
                                  hooks: description.hooks,
                                  isFirstMount: description.isFirstMount,
                                  props: description.props,
                                  state: description.state,
                              },
                          ]),
                duration: commit.duration,
                effectDuration: commit.effectDuration,
                fiberActualDurations: rootDurationPairs(commit.fiberActualDurations),
                fiberSelfDurations: rootDurationPairs(commit.fiberSelfDurations),
                passiveEffectDuration: commit.passiveEffectDuration,
                priorityLevel: commit.priorityLevel,
                timestamp: commit.timestamp,
                updaters:
                    commit.updaters === null
                        ? null
                        : commit.updaters.map((updater) => ({
                              displayName: updater.displayName,
                              id: updater.id,
                              ...(updater.key === undefined ? {} : { key: updater.key }),
                              type: updater.type,
                          })),
            })),
            displayName: root.displayName,
            initialTreeBaseDurations: rootDurationPairs(root.initialTreeBaseDurations),
            rootID: root.rootID,
        })),
        rendererID: payload.rendererId,
        version: payload.version,
    };
}

function rootDurationPairs(
    pairs: readonly (readonly [number, number])[],
): readonly (readonly [number, number])[] {
    return pairs.map(([id, duration]) => [id, duration]);
}

/**
 * Writes raw evidence first, then a derived report and a small manifest that
 * indexes it. Chromium can open a complete trace file directly. React backend
 * payloads remain separate raw evidence and are intentionally not presented as
 * frontend-importable DevTools profiles; the report never replaces either.
 */
export async function desktopProfilerArtifactWrite(
    root: string,
    input: DesktopProfilerArtifactInput,
): Promise<DesktopProfilerArtifact> {
    const directory = join(root, "profiler");
    await mkdir(directory, { recursive: true });
    const base = join(directory, `session-${input.sessionId}`);
    const tracePath = `${base}.trace.json`;
    const tracePartialPath = `${base}.trace.partial`;
    const metricsPath = `${base}.metrics.ndjson`;
    const reportPath = `${base}.report.json`;
    const manifestPath = `${base}.json`;
    const reactBackendProfilePaths = input.reactProfiles.map(
        (profile, index) => `${base}.react-backend-profile-${index}-${profile.rendererId}.json`,
    );

    const traceRawJson =
        input.traceRawJson.trim().length > 0 ? input.traceRawJson : '{"traceEvents":[]}';
    await atomicWrite(tracePath, traceRawJson);
    const tracePartial =
        input.tracePartialPrefix && input.tracePartialPrefix.byteLength > 0
            ? {
                  bytes: await atomicWriteBytes(tracePartialPath, input.tracePartialPrefix),
                  complete: false as const,
                  format: "chromium-trace-json-prefix" as const,
                  loadable: false as const,
                  path: tracePartialPath,
              }
            : undefined;
    const metricsNdjson = input.metrics.map((sample) => JSON.stringify(sample)).join("\n");
    await atomicWrite(metricsPath, metricsNdjson.length > 0 ? `${metricsNdjson}\n` : "");
    for (const [index, profile] of input.reactProfiles.entries())
        await atomicWrite(
            reactBackendProfilePaths[index],
            `${JSON.stringify(reactBackendProfileJson(profile))}\n`,
        );

    const capture = {
        buildMode: input.buildMode,
        ...(input.buildLabel ? { buildLabel: input.buildLabel } : {}),
        finishedAt: input.finishedAt,
        partial: input.partial,
        ...(input.partialReason ? { partialReason: input.partialReason } : {}),
        profileBuildVerified: input.profileBuildVerified,
        sessionId: input.sessionId,
        startedAt: input.startedAt,
    };
    const versions = {
        react: DESKTOP_REACT_VERSION,
        reactDevtoolsCore: DESKTOP_REACT_DEVTOOLS_CORE_VERSION,
    };
    const report: DesktopProfilerArtifactReport = {
        capture,
        metricsPath,
        react: derivedReactProfileReport(input.react),
        reactInspection: input.reactInspection,
        reactBackendProfilePaths,
        redacted: true,
        schemaVersion: DESKTOP_PROFILER_SCHEMA_VERSION,
        ...(tracePartial ? { tracePartial } : {}),
        tracePath,
        traceOverflow: input.traceOverflow,
        versions,
    };
    await atomicWrite(reportPath, `${JSON.stringify(report)}\n`);
    const manifest: DesktopProfilerArtifactManifest = {
        capture,
        derived: { reportPath },
        raw: {
            metrics: { format: "ndjson", path: metricsPath },
            ...(tracePartial ? { partial: tracePartial } : {}),
            reactProfiles: input.reactProfiles.map((profile, index) => ({
                format: "react-devtools-backend-profile-v5",
                path: reactBackendProfilePaths[index],
                rendererId: profile.rendererId,
                version: profile.version,
            })),
            trace: {
                format: "chromium-trace-json",
                overflow: input.traceOverflow,
                path: tracePath,
            },
        },
        schemaVersion: DESKTOP_PROFILER_SCHEMA_VERSION,
        versions,
    };
    const bytes = await atomicWrite(manifestPath, `${JSON.stringify(manifest)}\n`);
    return {
        bytes,
        finishedAt: input.finishedAt,
        partial: input.partial,
        path: manifestPath,
        sessionId: input.sessionId,
    };
}
