/**
 * The profiler boundary is deliberately closed. Renderer IPC receives only
 * these known React DevTools messages. React props, state, and hook values
 * never cross this boundary. The main process writes raw trace/profile/metric
 * evidence separately from the small redacted derived report.
 */

export const DESKTOP_PROFILER_SCHEMA_VERSION = 3 as const;
export const DESKTOP_REACT_VERSION = "19.2.7" as const;
export const DESKTOP_REACT_DEVTOOLS_CORE_VERSION = "6.1.5" as const;

export type DesktopProfilerBuildMode = "development" | "optimized" | "standard";

export type DesktopProfilerStatus =
    | "stopped"
    | "starting"
    | "running"
    | "stopping"
    | "partial"
    | "error"
    | "unavailable";

export interface DesktopProfilerCapabilities {
    readonly liveDebuggerAttach: boolean;
    readonly nativeTrace: boolean;
    readonly processMetrics: boolean;
    readonly reactAttribution: boolean;
    readonly reactDevtoolsProfiling: boolean;
    readonly rendererMetrics: boolean;
}

export interface DesktopProfilerArtifactSummary {
    readonly bytes: number;
    readonly finishedAt: number;
    readonly partial: boolean;
    readonly path: string;
    readonly sessionId: string;
}

export interface DesktopProfilerSnapshot {
    readonly artifact?: DesktopProfilerArtifactSummary;
    readonly capabilities: DesktopProfilerCapabilities;
    readonly error?: string;
    readonly partialReason?: string;
    readonly sessionId?: string;
    readonly startedAt?: number;
    readonly status: DesktopProfilerStatus;
}

export interface DesktopProfilerRequest {
    /**
     * The automatic stop limit protects a manually started capture from
     * retaining an unbounded trace when the reader forgets to press Stop.
     */
    readonly durationMs?: number;
}

export interface DesktopProfilerMetricSample {
    readonly cdp?: {
        readonly domNodes?: number;
        readonly jsHeapTotalBytes?: number;
        readonly jsHeapUsedBytes?: number;
        readonly layoutDurationSeconds?: number;
        readonly taskDurationSeconds?: number;
    };
    readonly mainProcess?: {
        readonly cpuPercent: number;
        readonly heapUsedBytes: number;
        readonly privateBytes?: number;
        readonly workingSetBytes?: number;
    };
    readonly rendererProcess?: {
        readonly cpuPercent: number;
        readonly privateBytes?: number;
        readonly workingSetBytes?: number;
    };
    readonly t: number;
}

export type DesktopReactDevtoolsCommand =
    | { readonly event: "getBackendVersion"; readonly payload: undefined }
    | { readonly event: "getBridgeProtocol"; readonly payload: undefined }
    | {
          readonly event: "getIfHasUnsupportedRendererVersion";
          readonly payload: undefined;
      }
    | { readonly event: "getHookSettings"; readonly payload: undefined }
    | { readonly event: "getProfilingStatus"; readonly payload: undefined }
    | {
          readonly event: "getProfilingData";
          readonly payload: { readonly rendererID: number };
      }
    | {
          readonly event: "inspectElement";
          readonly payload: {
              readonly forceFullData: true;
              readonly id: number;
              readonly path: null;
              readonly rendererID: number;
              readonly requestID: number;
          };
      }
    | {
          readonly event: "startProfiling";
          readonly payload: {
              readonly recordChangeDescriptions: true;
              readonly recordTimeline: false;
          };
      }
    | { readonly event: "stopProfiling"; readonly payload: undefined };

export interface DesktopReactHookDescriptor {
    readonly id: number | null;
    readonly name: string;
    readonly subHooks: readonly DesktopReactHookDescriptor[];
}

export interface DesktopReactDevtoolsProfileChange {
    readonly context: boolean | null;
    readonly didHooksChange: boolean;
    readonly hooks: readonly number[] | null;
    readonly isFirstMount: boolean;
    readonly props: readonly string[] | null;
    readonly state: readonly string[] | null;
}

export interface DesktopReactDevtoolsCommit {
    readonly changeDescriptions:
        | readonly (readonly [number, DesktopReactDevtoolsProfileChange])[]
        | null;
    readonly duration: number;
    readonly effectDuration: number | null;
    readonly fiberActualDurations: readonly (readonly [number, number])[];
    readonly fiberSelfDurations: readonly (readonly [number, number])[];
    readonly passiveEffectDuration: number | null;
    readonly priorityLevel: string | null;
    readonly timestamp: number;
    readonly updaters: readonly DesktopReactDevtoolsUpdater[] | null;
}

export interface DesktopReactDevtoolsUpdater {
    readonly displayName: string;
    readonly id: number;
    readonly key?: string | null;
    readonly type: number;
}

export interface DesktopReactDevtoolsSnapshot {
    readonly children: readonly number[];
    readonly compiledWithForget: boolean;
    readonly displayName: string | null;
    readonly hocDisplayNames: readonly string[] | null;
    readonly id: number;
    readonly key: string | null;
    readonly type: number;
}

export interface DesktopReactDevtoolsProfileRoot {
    readonly commitData: readonly DesktopReactDevtoolsCommit[];
    readonly displayName: string;
    readonly initialTreeBaseDurations: readonly (readonly [number, number])[];
    readonly operations: readonly (readonly number[])[];
    readonly rendererId: number;
    readonly rootID: number;
    readonly snapshots: readonly DesktopReactDevtoolsSnapshot[];
}

export interface DesktopReactDevtoolsProfilePayload {
    readonly dataForRoots: readonly DesktopReactDevtoolsProfileRoot[];
    readonly rendererId: number;
    readonly version: 5;
}

export type DesktopReactDevtoolsMessage =
    | {
          readonly type: "backendInitialized";
      }
    | {
          readonly type: "inspectedElement";
          readonly elementId: number;
          readonly hooks: readonly DesktopReactHookDescriptor[];
          readonly rendererId?: number;
          readonly requestId: number;
      }
    | {
          readonly type: "operations";
          readonly rendererId: number;
          readonly rootId: number;
          readonly operations: readonly number[];
      }
    | {
          readonly type: "profilingData";
          readonly payload: DesktopReactDevtoolsProfilePayload;
      }
    | {
          readonly type: "profilingStatus";
          readonly active: boolean;
      }
    | {
          readonly type: "ready";
          readonly devtoolsVersion: typeof DESKTOP_REACT_DEVTOOLS_CORE_VERSION;
          readonly profileBuild: true;
          readonly reactVersion: typeof DESKTOP_REACT_VERSION;
      }
    | {
          readonly type: "renderer";
          readonly rendererId: number;
          readonly version?: string;
      }
    | {
          readonly type: "rendererAttached";
          readonly rendererId: number;
      };

export interface DesktopReactComponentIdentity {
    readonly fiberId: number;
    readonly rendererId: number;
    readonly rootId: number;
}

export type DesktopReactRenderCause =
    | "context-changed"
    | "first-mount"
    | "hooks-changed"
    | "parent-rendered"
    | "props-changed"
    | "state-changed";

export type DesktopReactRenderEvidence = "devtools-change-description" | "inferred-parent-cascade";

export interface DesktopReactRenderRecord {
    readonly actualDurationMs: number;
    readonly causes: readonly DesktopReactRenderCause[];
    readonly changedHookIndices: readonly number[] | null;
    readonly changedHookNames: readonly string[] | null;
    readonly changedProps: readonly string[] | null;
    readonly changedState: readonly string[] | null;
    readonly commitIndex: number;
    readonly contextChanged: boolean | null;
    readonly evidence: DesktopReactRenderEvidence;
    readonly selfDurationMs: number;
    readonly timestamp: number;
}

export interface DesktopReactComponentReport {
    readonly actualDurationMs: number;
    readonly causes: readonly DesktopReactRenderCause[];
    readonly changedHookIndices: readonly number[];
    readonly changedHookNames: readonly string[];
    readonly displayName: string;
    readonly fiberId: number;
    readonly identity: DesktopReactComponentIdentity;
    readonly inspectedHookNames: readonly string[];
    readonly renderCount: number;
    /**
     * Bounded per-commit rerender evidence. Pure first mounts are omitted;
     * `causes` above remains the component-wide union.
     */
    readonly renders: readonly DesktopReactRenderRecord[];
    /** Number of eligible non-mount rerenders seen for this component. */
    readonly renderRecordsEligible: number;
    /** Number of eligible rerenders retained after both budgets are applied. */
    readonly renderRecordsRetained: number;
    /** Number of eligible rerenders omitted by either budget. */
    readonly renderRecordsDropped: number;
    readonly selfDurationMs: number;
}

export interface DesktopReactHookNameCoverage {
    readonly changedHookComponentCount: number;
    readonly inspectedComponentCount: number;
    readonly namedHookComponentCount: number;
    readonly unresolvedHookComponentCount: number;
    /** Fraction of changed-hook component identities with at least one name. */
    readonly namedHookCoverage: number;
}

export interface DesktopReactProfileReport {
    readonly commits: number;
    readonly components: readonly DesktopReactComponentReport[];
    readonly hookNameCoverage: DesktopReactHookNameCoverage;
    readonly renderRecordLimit: number;
    readonly renderRecordsDropped: number;
    readonly renderRecordsPerComponentLimit: number;
    readonly renderRecordsRetained: number;
    readonly renderRecordsTruncated: boolean;
    readonly roots: readonly DesktopReactDevtoolsProfileRoot[];
}

export interface DesktopReactInspectionSummary {
    /** All live changed-hook candidates before the bounded inspection slice. */
    readonly candidateCount: number;
    readonly candidatesTruncated: boolean;
    /**
     * Changed-hook components present in the profile but no longer live when
     * inspection began. The controller can populate this when it compares the
     * complete profile against the live metadata catalog; it is optional so
     * older/native-only controllers remain valid.
     */
    readonly nonLiveChangedHookComponentCount?: number;
    readonly inspectedCount: number;
    readonly limit: number;
    readonly timeBudgetMs: number;
    readonly timedOut: boolean;
}

/**
 * React DevTools 6.1.5's operations wall protocol. These values are part of
 * bridge protocol v2 and must stay pinned to the reviewed backend.
 */
export const DESKTOP_REACT_TREE_OPERATION_ADD = 1 as const;
export const DESKTOP_REACT_TREE_OPERATION_REMOVE = 2 as const;
export const DESKTOP_REACT_TREE_OPERATION_REORDER_CHILDREN = 3 as const;
export const DESKTOP_REACT_TREE_OPERATION_UPDATE_TREE_BASE_DURATION = 4 as const;
export const DESKTOP_REACT_TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS = 5 as const;
export const DESKTOP_REACT_TREE_OPERATION_REMOVE_ROOT = 6 as const;
export const DESKTOP_REACT_TREE_OPERATION_SET_SUBTREE_MODE = 7 as const;
export const DESKTOP_REACT_ELEMENT_TYPE_ROOT = 11 as const;
export const DESKTOP_REACT_COMPONENT_METADATA_LIMIT = 100_000 as const;
export const DESKTOP_REACT_RENDER_RECORD_LIMIT = 5_000 as const;
export const DESKTOP_REACT_RENDER_RECORDS_PER_COMPONENT_LIMIT = 64 as const;

export interface DesktopReactComponentMetadata {
    readonly displayName: string;
    readonly elementType: number;
    readonly identity: DesktopReactComponentIdentity;
    readonly key: string | null;
    readonly parentId: number;
}

function numberValue(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function integerValue(value: unknown): number | undefined {
    const number = numberValue(value);
    return number !== undefined && Number.isInteger(number) ? number : undefined;
}

function stringValue(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

function arrayValue(value: unknown): readonly unknown[] | undefined {
    return Array.isArray(value) ? value : undefined;
}

function numberArray(value: unknown): readonly number[] | undefined {
    const values = arrayValue(value);
    if (!values || values.some((candidate) => numberValue(candidate) === undefined))
        return undefined;
    return values.map((candidate) => numberValue(candidate)!);
}

function integerArray(value: unknown): readonly number[] | undefined {
    const values = arrayValue(value);
    if (!values || values.some((candidate) => integerValue(candidate) === undefined))
        return undefined;
    return values.map((candidate) => integerValue(candidate)!);
}

function pairArray(value: unknown): readonly (readonly [number, number])[] {
    const values = arrayValue(value);
    if (!values) return [];
    const pairs: [number, number][] = [];
    if (
        values.every((candidate) => {
            const pair = arrayValue(candidate);
            return (
                pair !== undefined &&
                pair.length >= 2 &&
                numberValue(pair[0]) !== undefined &&
                numberValue(pair[1]) !== undefined
            );
        })
    ) {
        for (const candidate of values) {
            const pair = arrayValue(candidate)!;
            pairs.push([numberValue(pair[0])!, numberValue(pair[1])!]);
        }
        return pairs;
    }
    for (let index = 0; index + 1 < values.length; index += 2) {
        const id = numberValue(values[index]);
        const duration = numberValue(values[index + 1]);
        if (id !== undefined && duration !== undefined) pairs.push([id, duration]);
    }
    return pairs;
}

function hookDescriptors(value: unknown): readonly DesktopReactHookDescriptor[] {
    const record = recordValue(value);
    const values = arrayValue(value) ?? arrayValue(record?.data);
    if (!values) return [];
    return values.flatMap((candidate) => {
        const hook = recordValue(candidate);
        const name = stringValue(hook?.name);
        if (!name) return [];
        return [
            {
                id:
                    hook?.id === null || hook?.id === undefined
                        ? null
                        : (integerValue(hook.id) ?? null),
                name,
                subHooks: hookDescriptors(hook?.subHooks),
            },
        ];
    });
}

function changeDescription(value: unknown): DesktopReactDevtoolsProfileChange {
    const record = recordValue(value);
    const context =
        record?.context === null || record?.context === undefined ? null : record.context === true;
    const hooks =
        record?.hooks === null || record?.hooks === undefined
            ? null
            : (integerArray(record.hooks) ?? null);
    const props =
        record?.props === null || record?.props === undefined
            ? null
            : (arrayValue(record.props) ?? []).flatMap((candidate) => {
                  const name = stringValue(candidate);
                  return name === undefined ? [] : [name];
              });
    const state =
        record?.state === null || record?.state === undefined
            ? null
            : (arrayValue(record.state) ?? []).flatMap((candidate) => {
                  const name = stringValue(candidate);
                  return name === undefined ? [] : [name];
              });
    return {
        context,
        didHooksChange: record?.didHooksChange === true,
        hooks,
        isFirstMount: record?.isFirstMount === true,
        props,
        state,
    };
}

function changeDescriptions(
    value: unknown,
): readonly (readonly [number, DesktopReactDevtoolsProfileChange])[] | null {
    if (value === null || value === undefined) return null;
    const values = arrayValue(value);
    if (!values) return null;
    return values.flatMap((candidate) => {
        const pair = arrayValue(candidate);
        const id = integerValue(pair?.[0]);
        if (id === undefined) return [];
        return [[id, changeDescription(pair?.[1])] as const];
    });
}

function profileCommit(value: unknown): DesktopReactDevtoolsCommit | undefined {
    const record = recordValue(value);
    const timestamp = numberValue(record?.timestamp);
    const duration = numberValue(record?.duration);
    if (timestamp === undefined || duration === undefined) return undefined;
    const priorityLevel = stringValue(record?.priorityLevel) ?? null;
    return {
        changeDescriptions: changeDescriptions(record?.changeDescriptions),
        duration,
        effectDuration: numberValue(record?.effectDuration) ?? null,
        fiberActualDurations: pairArray(record?.fiberActualDurations),
        fiberSelfDurations: pairArray(record?.fiberSelfDurations),
        passiveEffectDuration: numberValue(record?.passiveEffectDuration) ?? null,
        priorityLevel,
        timestamp,
        updaters: profileUpdaters(record?.updaters),
    };
}

function profileUpdaters(value: unknown): readonly DesktopReactDevtoolsUpdater[] | null {
    if (value === null || value === undefined) return null;
    const values = arrayValue(value);
    if (!values) return null;
    return values.flatMap((candidate) => {
        const record = recordValue(candidate);
        const id = integerValue(record?.id);
        const type = integerValue(record?.type);
        const displayName = stringValue(record?.displayName);
        if (id === undefined || type === undefined || displayName === undefined) return [];
        return [
            {
                displayName,
                id,
                ...(record?.key === undefined ? {} : { key: stringValue(record.key) ?? null }),
                type,
            },
        ];
    });
}

function profileSnapshot(value: unknown): DesktopReactDevtoolsSnapshot | undefined {
    const pair = arrayValue(value);
    const record = recordValue(pair?.[1]);
    const id = integerValue(pair?.[0]);
    if (id === undefined || !record) return undefined;
    return {
        children: numberArray(record.children) ?? [],
        compiledWithForget: record.compiledWithForget === true,
        displayName: stringValue(record.displayName) ?? null,
        hocDisplayNames:
            record.hocDisplayNames === null || record.hocDisplayNames === undefined
                ? null
                : (arrayValue(record.hocDisplayNames) ?? []).flatMap((candidate) => {
                      const name = stringValue(candidate);
                      return name === undefined ? [] : [name];
                  }),
        id,
        key: stringValue(record.key) ?? null,
        type: integerValue(record.type) ?? 0,
    };
}

function profileRoot(
    value: unknown,
    rendererId: number,
): DesktopReactDevtoolsProfileRoot | undefined {
    const record = recordValue(value);
    const rootID = integerValue(record?.rootID);
    const roots = arrayValue(record?.commitData);
    if (rootID === undefined || !roots) return undefined;
    return {
        commitData: roots.flatMap((candidate) => {
            const commit = profileCommit(candidate);
            return commit === undefined ? [] : [commit];
        }),
        displayName: stringValue(record?.displayName) ?? "Root",
        initialTreeBaseDurations: pairArray(record?.initialTreeBaseDurations),
        operations: (arrayValue(record?.operations) ?? []).flatMap((candidate) => {
            const values = numberArray(candidate);
            return values === undefined ? [] : [values];
        }),
        rendererId,
        rootID,
        snapshots: (arrayValue(record?.snapshots) ?? []).flatMap((candidate) => {
            const snapshot = profileSnapshot(candidate);
            return snapshot === undefined ? [] : [snapshot];
        }),
    };
}

export function desktopReactProfilePayloadParse(
    value: unknown,
): DesktopReactDevtoolsProfilePayload | undefined {
    const record = recordValue(value);
    const roots = arrayValue(record?.dataForRoots);
    const rendererId = integerValue(record?.rendererID) ?? integerValue(record?.rendererId);
    if (!roots || rendererId === undefined) return undefined;
    const parsed = roots.flatMap((candidate) => {
        const root = profileRoot(candidate, rendererId);
        return root === undefined ? [] : [root];
    });
    if (parsed.length === 0) return undefined;
    return {
        dataForRoots: parsed,
        rendererId,
        version: 5,
    };
}

export function desktopReactDevtoolsMessageParse(
    event: unknown,
    payload: unknown,
): DesktopReactDevtoolsMessage | undefined {
    if (event === "backendInitialized") return { type: "backendInitialized" };
    if (event === "profilingStatus" && typeof payload === "boolean")
        return { active: payload, type: "profilingStatus" };
    if (event === "renderer" || event === "renderer-attached") {
        const record = recordValue(payload);
        const rendererId = integerValue(record?.id);
        if (rendererId === undefined) return undefined;
        return event === "renderer"
            ? {
                  ...(stringValue(record?.version)
                      ? { version: stringValue(record?.version) }
                      : {}),
                  rendererId,
                  type: "renderer",
              }
            : { rendererId, type: "rendererAttached" };
    }
    if (event === "operations") {
        const operations = integerArray(payload);
        const rendererId = integerValue(operations?.[0]);
        const rootId = integerValue(operations?.[1]);
        if (!operations || rendererId === undefined || rootId === undefined) return undefined;
        return { operations, rendererId, rootId, type: "operations" };
    }
    if (event === "profilingData") {
        const parsed = desktopReactProfilePayloadParse(payload);
        return parsed === undefined ? undefined : { payload: parsed, type: "profilingData" };
    }
    if (event === "inspectedElement") {
        const record = recordValue(payload);
        if (record?.type !== "full-data") return undefined;
        const value = recordValue(record?.value);
        const requestId = integerValue(record.responseID);
        const elementId = integerValue(record.id) ?? integerValue(value?.id);
        const rendererId = integerValue(record?.rendererID);
        if (requestId === undefined || elementId === undefined || value === undefined)
            return undefined;
        return {
            elementId,
            hooks: hookDescriptors(value?.hooks),
            ...(rendererId === undefined ? {} : { rendererId }),
            requestId,
            type: "inspectedElement",
        };
    }
    return undefined;
}

/** Validates the already-normalized object crossing preload → main IPC. */
export function desktopReactDevtoolsMessageValidate(
    value: unknown,
): DesktopReactDevtoolsMessage | undefined {
    const record = recordValue(value);
    if (!record) return undefined;
    const type = record?.type;
    if (type === "backendInitialized") return { type };
    if (type === "ready") {
        return record.profileBuild === true &&
            record.reactVersion === DESKTOP_REACT_VERSION &&
            record.devtoolsVersion === DESKTOP_REACT_DEVTOOLS_CORE_VERSION
            ? {
                  devtoolsVersion: DESKTOP_REACT_DEVTOOLS_CORE_VERSION,
                  profileBuild: true,
                  reactVersion: DESKTOP_REACT_VERSION,
                  type,
              }
            : undefined;
    }
    if (type === "profilingStatus" && typeof record.active === "boolean")
        return { active: record.active, type };
    if (type === "renderer" || type === "rendererAttached") {
        const rendererId = integerValue(record.rendererId);
        if (rendererId === undefined) return undefined;
        return type === "renderer"
            ? {
                  ...(stringValue(record.version) ? { version: stringValue(record.version) } : {}),
                  rendererId,
                  type,
              }
            : { rendererId, type };
    }
    if (type === "operations") {
        const operations = integerArray(record.operations);
        const rendererId = integerValue(record.rendererId);
        const rootId = integerValue(record.rootId);
        return operations && rendererId !== undefined && rootId !== undefined
            ? { operations, rendererId, rootId, type }
            : undefined;
    }
    if (type === "profilingData") {
        const payload = desktopReactProfilePayloadParse(record.payload);
        return payload === undefined ? undefined : { payload, type };
    }
    if (type === "inspectedElement") {
        const requestId = integerValue(record.requestId);
        const elementId = integerValue(record.elementId);
        const rendererId = integerValue(record.rendererId);
        const hooks = hookDescriptors(record.hooks);
        return requestId !== undefined && elementId !== undefined
            ? {
                  elementId,
                  hooks,
                  ...(rendererId === undefined ? {} : { rendererId }),
                  requestId,
                  type,
              }
            : undefined;
    }
    return undefined;
}
