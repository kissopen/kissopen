import { app, type WebContents } from "electron";
import { randomBytes } from "node:crypto";
import {
    DESKTOP_REACT_VERSION,
    type DesktopProfilerBuildMode,
    type DesktopProfilerCapabilities,
    type DesktopProfilerMetricSample,
    type DesktopProfilerRequest,
    type DesktopProfilerSnapshot,
    type DesktopReactDevtoolsCommand,
    type DesktopReactDevtoolsMessage,
    type DesktopReactDevtoolsProfilePayload,
    type DesktopReactHookDescriptor,
    type DesktopReactInspectionSummary,
} from "../shared/desktopProfiler";
import { desktopIpc } from "../shared/desktopContract";
import {
    desktopReactProfileAnalyze,
    DesktopReactComponentMetadataCatalog,
} from "./desktopReactProfileAnalysis";
import { desktopProfilerArtifactWrite } from "./desktopProfilerArtifact";
import { desktopProfilerCdpStart, type DesktopProfilerCdp } from "./desktopProfilerCdp";

// Full Chromium timeline capture is intentionally profile-flavor-only. A
// Realistic concurrent workloads can produce large Chromium traces because
// timeline categories may retain dependent lanes even when negatively filtered.
// Keep the evidence useful while preserving an explicit hard bound.
const TRACE_MAX_BYTES = 256 * 1024 * 1024;
const TRACE_READ_CHUNK_BYTES = 1024 * 1024;
const TRACE_READ_LIMIT = 4096;
const TRACE_COMPLETION_TIMEOUT_MS = 5_000;
const TRACE_COMPLETION_GRACE_MS = 2_000;
const TRACE_READ_COMMAND_TIMEOUT_MS = 1_000;
const PROFILE_PAYLOAD_LIMIT = 64;
const PROFILE_DATA_TIMEOUT_MS = 2_000;
const INSPECTION_LIMIT = 64;
const INSPECTION_TIME_BUDGET_MS = 3_000;
const INSPECTION_TIMEOUT_MS = 350;
const SAMPLE_INTERVAL_MS = 500;
const DEFAULT_DURATION_MS = 60_000;

interface ProcessMetric {
    readonly cpu?: { readonly percentCPUUsage?: number };
    readonly memory?: {
        readonly privateBytes?: number;
        readonly workingSetSize?: number;
    };
    readonly pid?: number;
}

interface DesktopProfilerControllerOptions {
    readonly artifactRoot: string;
    readonly buildMode: DesktopProfilerBuildMode;
    readonly buildLabel?: string;
    readonly changed: (snapshot: DesktopProfilerSnapshot) => void;
    readonly renderer: () => WebContents | undefined;
}

const defaultCapabilities: DesktopProfilerCapabilities = {
    liveDebuggerAttach: true,
    nativeTrace: true,
    processMetrics: true,
    reactAttribution: false,
    reactDevtoolsProfiling: false,
    rendererMetrics: true,
};

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

function finiteNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function processMetricBytes(value: unknown): number | undefined {
    const kibibytes = finiteNumber(value);
    return kibibytes === undefined ? undefined : kibibytes * 1024;
}

function mainHeapUsedBytes(): number {
    const electronProcess = process as typeof process & {
        getHeapStatistics?: () => { readonly usedHeapSize: number };
    };
    try {
        // Electron's process.getHeapStatistics() reports every statistic in KiB.
        // CDP Runtime.getHeapUsage remains byte-based and is converted separately.
        return processMetricBytes(electronProcess.getHeapStatistics?.().usedHeapSize) ?? 0;
    } catch {
        return 0;
    }
}

function metricsMap(value: unknown): ReadonlyMap<string, number> {
    const record = recordValue(value);
    const values = Array.isArray(record?.metrics) ? record.metrics : [];
    const entries = values.flatMap((candidate) => {
        const item = recordValue(candidate);
        const name = typeof item?.name === "string" ? item.name : undefined;
        const number = finiteNumber(item?.value);
        return name !== undefined && number !== undefined ? [[name, number] as const] : [];
    });
    return new Map(entries);
}

export class DesktopProfilerController {
    readonly #options: DesktopProfilerControllerOptions;
    #artifact: DesktopProfilerSnapshot["artifact"];
    #capabilities = defaultCapabilities;
    readonly #componentMetadata = new DesktopReactComponentMetadataCatalog();
    #cdp: DesktopProfilerCdp | undefined;
    #contents: WebContents | undefined;
    #error: string | undefined;
    #finishPromise: Promise<void> | undefined;
    #inspectionId = 0;
    #inspectionWaiters = new Map<
        number,
        {
            readonly generation: number;
            readonly rendererId: number;
            readonly resolve: (received: boolean) => void;
            readonly timer: ReturnType<typeof setTimeout>;
        }
    >();
    #inspectedHooks = new Map<string, readonly DesktopReactHookDescriptor[]>();
    #inspectionSummary: DesktopReactInspectionSummary = {
        candidateCount: 0,
        candidatesTruncated: false,
        inspectedCount: 0,
        limit: INSPECTION_LIMIT,
        nonLiveChangedHookComponentCount: 0,
        timeBudgetMs: INSPECTION_TIME_BUDGET_MS,
        timedOut: false,
    };
    #metrics: DesktopProfilerMetricSample[] = [];
    #partialReason: string | undefined;
    #profilePayloads = new Map<number, DesktopReactDevtoolsProfilePayload>();
    #profileBuildVerified = false;
    #profilingDataWaiters = new Map<
        number,
        {
            readonly generation: number;
            readonly resolve: (received: boolean) => void;
            readonly timer: ReturnType<typeof setTimeout>;
        }
    >();
    #reactReady = false;
    #reactRendererVersionVerified = false;
    #reactProfilingStarted = false;
    #rendererIds = new Set<number>();
    #rendererGeneration = 0;
    #captureRendererGeneration: number | undefined;
    #sampling = false;
    #sampleInFlight: Promise<void> | undefined;
    #samplingTimer: ReturnType<typeof setInterval> | undefined;
    #durationTimer: ReturnType<typeof setTimeout> | undefined;
    #sessionId: string | undefined;
    #startedAt: number | undefined;
    #status: DesktopProfilerSnapshot["status"] = "stopped";
    #traceChunks: string[] = [];
    #traceBytes = 0;
    #traceComplete: Promise<void> | undefined;
    #traceCompleteResolve: (() => void) | undefined;
    #traceReadInFlight: Promise<void> | undefined;
    #traceStarted = false;
    #traceMode: "events" | "stream" = "events";
    #traceOverflow = false;
    #tracePartialPrefix: Uint8Array | undefined;
    #traceRawJson = '{"traceEvents":[]}';
    #traceFinalized = false;

    constructor(options: DesktopProfilerControllerOptions) {
        this.#options = options;
    }

    get(): DesktopProfilerSnapshot {
        return {
            ...(this.#artifact ? { artifact: this.#artifact } : {}),
            capabilities: this.#capabilities,
            ...(this.#error ? { error: this.#error } : {}),
            ...(this.#partialReason ? { partialReason: this.#partialReason } : {}),
            ...(this.#sessionId ? { sessionId: this.#sessionId } : {}),
            ...(this.#startedAt ? { startedAt: this.#startedAt } : {}),
            status: this.#status,
        };
    }

    isActive(): boolean {
        return (
            this.#status === "starting" || this.#status === "running" || this.#status === "stopping"
        );
    }

    refresh(): void {
        const renderer = this.#options.renderer();
        if (
            this.#contents &&
            (renderer !== this.#contents ||
                renderer.isDestroyed() ||
                !renderer.debugger.isAttached())
        ) {
            const reason = "The renderer navigated, crashed, or was replaced.";
            this.#rendererGeneration += 1;
            this.#reactReady = false;
            this.#reactRendererVersionVerified = false;
            this.#profileBuildVerified = false;
            this.#reactProfilingStarted = false;
            this.#rendererIds.clear();
            this.#inspectedHooks.clear();
            this.#componentMetadata.clear();
            this.#cancelInspectionWaiters();
            this.#cancelProfilingDataWaiters();
            if (this.isActive()) this.#partialReason ??= reason;
            this.#capabilities = {
                ...this.#capabilities,
                reactAttribution: false,
                reactDevtoolsProfiling: false,
            };
            this.#publish();
        }
        if (
            this.#finishPromise === undefined &&
            (this.#status === "running" ||
                (this.#status === "starting" && this.#cdp !== undefined)) &&
            (!renderer ||
                renderer !== this.#contents ||
                renderer.isDestroyed() ||
                !renderer.debugger.isAttached())
        ) {
            this.#finishSafe(true, "The renderer navigated, crashed, or was replaced.");
        }
    }

    reactMessage(message: DesktopReactDevtoolsMessage): void {
        if (message.type === "ready") {
            this.#reactReady = true;
            this.#profileBuildVerified = this.#reactRendererVersionVerified;
            this.#capabilities = {
                ...this.#capabilities,
                reactAttribution: true,
                reactDevtoolsProfiling: true,
            };
            this.#startReactProfiling();
            this.#publish();
            return;
        }
        if (message.type === "renderer" || message.type === "rendererAttached") {
            this.#rendererIds.add(message.rendererId);
            if (message.type === "renderer" && message.version === DESKTOP_REACT_VERSION) {
                this.#reactRendererVersionVerified = true;
                this.#profileBuildVerified = this.#reactReady;
                this.#publish();
            }
            return;
        }
        if (message.type === "operations") {
            this.#rendererIds.add(message.rendererId);
            this.#componentMetadata.apply(message.operations);
            return;
        }
        if (message.type === "backendInitialized") {
            this.#sendHandshake();
            return;
        }
        if (message.type === "inspectedElement") {
            const waiter = this.#inspectionWaiters.get(message.requestId);
            if (waiter && waiter.generation === this.#rendererGeneration) {
                clearTimeout(waiter.timer);
                this.#inspectionWaiters.delete(message.requestId);
                const rendererId = message.rendererId ?? waiter.rendererId;
                this.#inspectedHooks.set(`${rendererId}:${message.elementId}`, message.hooks);
                waiter.resolve(true);
            }
            return;
        }
        if (
            message.type === "profilingData" &&
            (this.#status === "running" || this.#status === "stopping")
        ) {
            if (this.#captureRendererGeneration !== this.#rendererGeneration) return;
            const rendererId = message.payload.rendererId;
            this.#rendererIds.add(rendererId);
            if (
                this.#profilePayloads.size < PROFILE_PAYLOAD_LIMIT ||
                this.#profilePayloads.has(rendererId)
            )
                this.#profilePayloads.set(rendererId, message.payload);
            // A parsed v5 payload proves that the pre-React bridge reached an
            // attached renderer and completed a real profiling lifecycle. This
            // is stronger evidence than bootstrap constants or launch flags.
            this.#profileBuildVerified = this.#reactReady;
            const waiter = this.#profilingDataWaiters.get(rendererId);
            if (waiter && waiter.generation === this.#rendererGeneration) {
                clearTimeout(waiter.timer);
                this.#profilingDataWaiters.delete(rendererId);
                waiter.resolve(true);
            }
            return;
        }
    }

    navigationStarted(): void {
        const reason = "The renderer navigated, crashed, or was replaced.";
        this.#rendererGeneration += 1;
        this.#reactReady = false;
        this.#reactRendererVersionVerified = false;
        this.#profileBuildVerified = false;
        this.#reactProfilingStarted = false;
        this.#rendererIds.clear();
        this.#inspectedHooks.clear();
        this.#componentMetadata.clear();
        this.#cancelInspectionWaiters();
        this.#cancelProfilingDataWaiters();
        if (this.isActive()) this.#partialReason ??= reason;
        this.#capabilities = {
            ...this.#capabilities,
            reactAttribution: false,
            reactDevtoolsProfiling: false,
        };
        this.#publish();
        if (
            this.#finishPromise === undefined &&
            (this.#status === "running" || (this.#status === "starting" && this.#cdp !== undefined))
        )
            this.#finishSafe(true, reason);
    }

    start(request: DesktopProfilerRequest = {}): Promise<DesktopProfilerSnapshot> {
        if (this.#status === "starting" || this.#status === "running")
            return Promise.reject(new Error("A KissOpen profile is already running."));
        if (this.#status === "stopping")
            return Promise.reject(new Error("The profile is stopping."));
        const duration =
            request.durationMs === undefined
                ? DEFAULT_DURATION_MS
                : Math.max(1_000, Math.min(request.durationMs, 10 * 60_000));
        this.#status = "starting";
        this.#artifact = undefined;
        this.#error = undefined;
        this.#partialReason = undefined;
        this.#publish();
        return this.#start(duration).then(
            () => this.get(),
            async (error: unknown) => {
                if (this.get().status === "partial") return this.get();
                if (this.#finishPromise) {
                    await this.#finishPromise.catch(() => undefined);
                    if (this.get().status === "partial") return this.get();
                }
                await this.#abortStart();
                this.#status = "error";
                this.#error = errorMessage(error, "The profiler could not start.");
                this.#publish();
                throw error;
            },
        );
    }

    stop(): Promise<DesktopProfilerSnapshot> {
        if (this.#status === "stopped" || this.#status === "partial")
            return Promise.resolve(this.get());
        if (this.#finishPromise) return this.#finishPromise.then(() => this.get());
        return this.#finish(false).then(() => this.get());
    }

    close(): Promise<void> {
        if (this.#finishPromise) return this.#finishPromise;
        if (this.#status === "running" || this.#status === "starting")
            return this.#finish(true, "KissOpen is quitting.");
        return Promise.resolve();
    }

    async #start(durationMs: number): Promise<void> {
        const contents = this.#options.renderer();
        if (!contents || contents.isDestroyed())
            throw new Error("The KissOpen renderer is not available.");
        this.#contents = contents;
        this.#captureRendererGeneration = this.#rendererGeneration;
        this.#sessionId = randomBytes(12).toString("hex");
        this.#startedAt = Date.now();
        this.#componentMetadata.clearCaptureHistory();
        this.#profilePayloads.clear();
        this.#profileBuildVerified = this.#reactReady && this.#reactRendererVersionVerified;
        this.#cancelProfilingDataWaiters();
        this.#reactProfilingStarted = false;
        this.#metrics = [];
        this.#inspectedHooks.clear();
        this.#traceChunks = [];
        this.#traceBytes = 0;
        this.#traceReadInFlight = undefined;
        this.#traceStarted = false;
        this.#traceMode = "events";
        this.#traceOverflow = false;
        this.#tracePartialPrefix = undefined;
        this.#traceRawJson = '{"traceEvents":[]}';
        this.#traceFinalized = false;
        this.#inspectionSummary = {
            candidateCount: 0,
            candidatesTruncated: false,
            inspectedCount: 0,
            limit: INSPECTION_LIMIT,
            nonLiveChangedHookComponentCount: 0,
            timeBudgetMs: INSPECTION_TIME_BUDGET_MS,
            timedOut: false,
        };
        this.#cdp = await desktopProfilerCdpStart(
            contents,
            (method, params) => this.#cdpMessage(method, params),
            (reason) => {
                this.#partialReason = `The renderer debugger detached: ${reason}.`;
                if (this.#finishPromise === undefined) this.#finishSafe(true, this.#partialReason);
            },
        );
        if (this.#captureRendererGeneration !== this.#rendererGeneration) {
            await this.#finish(true, "The renderer navigated, crashed, or was replaced.");
            return;
        }
        this.#traceComplete = new Promise<void>((resolve) => {
            this.#traceCompleteResolve = resolve;
        });
        await this.#cdp.sendCommand("Runtime.enable");
        await this.#cdp.sendCommand("Performance.enable");
        const tracingParameters = {
            // Plain devtools.timeline retains FunctionCall/Paint and React's
            // named TimeStamp tracks. Ask Chromium to exclude the high-volume
            // V8 GC lane; some builds retain it as a timeline dependency, so
            // artifact size and overflow fields remain the source of truth.
            categories: "blink.user_timing,devtools.timeline,-disabled-by-default-v8.gc",
        };
        if (this.#finishPromise || this.#status !== "starting") {
            if (this.#finishPromise) await this.#finishPromise;
            return;
        }
        try {
            await this.#cdp.sendCommand("Tracing.start", {
                ...tracingParameters,
                transferMode: "ReturnAsStream",
            });
            this.#traceMode = "stream";
        } catch (error) {
            // Older Chromium builds may not implement ReturnAsStream. Keep the
            // capture usable with event fallback, but retain the same bounded
            // raw trace contract and explicit overflow bit.
            await this.#cdp.sendCommand("Tracing.start", tracingParameters).catch(() => {
                throw error;
            });
            this.#traceMode = "events";
        }
        this.#traceStarted = true;
        if (this.#status !== "starting") {
            if (this.#finishPromise) {
                await this.#finishPromise;
                return;
            }
            const cdp = this.#cdp;
            try {
                await cdp.sendCommand("Tracing.end");
            } catch {
                // The stopping path may already have ended the trace.
            }
            this.#traceStarted = false;
            await this.#traceCompletionWait();
            await cdp?.close();
            if (this.#cdp === cdp) {
                this.#cdp = undefined;
                this.#contents = undefined;
            }
            return;
        }
        this.#status = "running";
        this.#publish();
        this.#sampleStart();
        this.#startReactProfiling();
        this.#durationTimer = setTimeout(() => {
            this.#durationTimer = undefined;
            if (this.#status === "running") this.#finishSafe(false);
        }, durationMs);
    }

    async #abortStart(): Promise<void> {
        if (this.#samplingTimer) clearInterval(this.#samplingTimer);
        if (this.#durationTimer) clearTimeout(this.#durationTimer);
        this.#samplingTimer = undefined;
        this.#durationTimer = undefined;
        this.#sampling = false;
        this.#reactProfilingStarted = false;
        const cdp = this.#cdp;
        if (this.#traceStarted && cdp) {
            try {
                await cdp.sendCommand("Tracing.end");
            } catch {
                // A renderer detach or an already-running stop may own the end.
            }
            this.#traceStarted = false;
            await this.#traceCompletionWait();
        }
        this.#cdp = undefined;
        this.#contents = undefined;
        await cdp?.close();
    }

    async #finish(partial: boolean, reason?: string): Promise<void> {
        if (this.#finishPromise) return this.#finishPromise;
        this.#finishPromise = this.#finishImpl(partial, reason).finally(() => {
            this.#finishPromise = undefined;
        });
        return this.#finishPromise;
    }

    #finishSafe(partial: boolean, reason?: string): void {
        void this.#finish(partial, reason).catch((error: unknown) => {
            this.#status = "error";
            this.#error = errorMessage(error, "The profiler capture failed.");
            this.#publish();
            console.error("KissOpen profiler capture failed.", error);
        });
    }

    async #finishImpl(partial: boolean, reason?: string): Promise<void> {
        if (reason) this.#partialReason = reason;
        const cdp = this.#cdp;
        if (!cdp) {
            this.#reactProfilingStarted = false;
            this.#status = partial ? "partial" : "stopped";
            this.#publish();
            return;
        }
        this.#status = "stopping";
        this.#publish();
        if (this.#samplingTimer) clearInterval(this.#samplingTimer);
        this.#samplingTimer = undefined;
        if (this.#durationTimer) clearTimeout(this.#durationTimer);
        this.#durationTimer = undefined;
        const reactProfilingStarted = this.#reactProfilingStarted;
        const rendererIds = [...this.#rendererIds];
        if (reactProfilingStarted) {
            this.#sendReactCommand({ event: "stopProfiling", payload: undefined });
            const profilingDataWaiters = rendererIds.map((rendererID) =>
                this.#profilingDataRequest(rendererID),
            );
            for (const rendererID of rendererIds)
                this.#sendReactCommand({
                    event: "getProfilingData",
                    payload: { rendererID },
                });
            const profilingDataResults = await Promise.all(profilingDataWaiters);
            this.#profilingDataWaiters.clear();
            if (
                this.#profilePayloads.size === 0 ||
                profilingDataResults.some((received) => !received)
            )
                this.#partialReason ??=
                    "React profiling started, but profiling data did not arrive for every renderer before the bounded timeout.";
            this.#reactProfilingStarted = false;
            const initial = desktopReactProfileAnalyze(
                [...this.#profilePayloads.values()],
                this.#inspectedHooks,
                this.#componentMetadata.get(),
            );
            const allHookCandidates = initial.components.filter(
                (component) => component.changedHookIndices.length > 0,
            );
            const allCandidates = allHookCandidates.filter((component) =>
                this.#componentMetadata.isLive(component.identity),
            );
            const candidates = allCandidates.slice(0, INSPECTION_LIMIT);
            const inspectionDeadline = Date.now() + INSPECTION_TIME_BUDGET_MS;
            let inspectedCount = 0;
            let inspectionTimedOut = false;
            for (const component of candidates) {
                if (Date.now() >= inspectionDeadline) {
                    inspectionTimedOut = true;
                    break;
                }
                const received = await this.#inspect(
                    component.identity.rendererId,
                    component.fiberId,
                );
                if (received) inspectedCount += 1;
                else inspectionTimedOut = true;
            }
            this.#inspectionSummary = {
                candidateCount: allCandidates.length,
                candidatesTruncated: allCandidates.length > candidates.length,
                inspectedCount,
                limit: INSPECTION_LIMIT,
                nonLiveChangedHookComponentCount: allHookCandidates.length - allCandidates.length,
                timeBudgetMs: INSPECTION_TIME_BUDGET_MS,
                timedOut: inspectionTimedOut,
            };
        }
        if (this.#traceStarted) {
            try {
                await cdp.sendCommand("Tracing.end");
                await this.#traceCompletionWait();
            } catch (error) {
                this.#partialReason ??= `Tracing stopped early: ${errorMessage(error, "unknown error")}`;
            }
        }
        await this.#sample();
        this.#sampling = false;
        const finishedAt = Date.now();
        const react = desktopReactProfileAnalyze(
            [...this.#profilePayloads.values()],
            this.#inspectedHooks,
            this.#componentMetadata.get(),
        );
        this.#traceStarted = false;
        await cdp.close();
        this.#cdp = undefined;
        this.#contents = undefined;
        try {
            const artifact = await desktopProfilerArtifactWrite(this.#options.artifactRoot, {
                buildMode: this.#options.buildMode,
                ...(this.#options.buildLabel ? { buildLabel: this.#options.buildLabel } : {}),
                finishedAt,
                metrics: this.#metrics,
                partial: partial || this.#partialReason !== undefined || this.#traceOverflow,
                ...(this.#partialReason ? { partialReason: this.#partialReason } : {}),
                profileBuildVerified: this.#profileBuildVerified,
                react,
                reactInspection: this.#inspectionSummary,
                reactProfiles: [...this.#profilePayloads.values()],
                sessionId: this.#sessionId ?? "unknown",
                startedAt: this.#startedAt ?? finishedAt,
                ...(this.#tracePartialPrefix
                    ? { tracePartialPrefix: this.#tracePartialPrefix }
                    : {}),
                traceOverflow: this.#traceOverflow,
                traceRawJson: this.#traceRawJson,
            });
            this.#artifact = artifact;
            this.#error = undefined;
            this.#status = artifact.partial ? "partial" : "stopped";
            this.#publish();
        } catch (error) {
            this.#status = "error";
            this.#error = errorMessage(error, "The profiler artifact could not be written.");
            this.#publish();
            throw new Error(
                `Could not write the profile artifact: ${errorMessage(error, "unknown error")}`,
            );
        }
    }

    #startReactProfiling(): void {
        if (
            this.#reactProfilingStarted ||
            !this.#reactReady ||
            this.#status !== "running" ||
            this.#captureRendererGeneration !== this.#rendererGeneration
        )
            return;
        this.#reactProfilingStarted = true;
        this.#sendReactCommand({
            event: "startProfiling",
            payload: { recordChangeDescriptions: true, recordTimeline: false },
        });
    }

    #sendHandshake(): void {
        const commands: readonly DesktopReactDevtoolsCommand[] = [
            { event: "getBridgeProtocol", payload: undefined },
            { event: "getBackendVersion", payload: undefined },
            { event: "getIfHasUnsupportedRendererVersion", payload: undefined },
            { event: "getHookSettings", payload: undefined },
            { event: "getProfilingStatus", payload: undefined },
        ];
        for (const command of commands) this.#sendReactCommand(command);
    }

    #sendReactCommand(command: DesktopReactDevtoolsCommand): void {
        const contents = this.#contents ?? this.#options.renderer();
        if (!contents || contents.isDestroyed()) return;
        contents.send(desktopIpc.profilerReactCommand, command);
    }

    #cdpMessage(method: string, params: Record<string, unknown>): void {
        if (method === "Tracing.dataCollected") {
            if (this.#traceMode !== "events") return;
            const values = Array.isArray(params.value) ? params.value : [];
            for (const value of values) this.#traceEventAppend(value);
            return;
        }
        if (method !== "Tracing.tracingComplete") return;
        const stream = typeof params.stream === "string" ? params.stream : undefined;
        const cdp = this.#cdp;
        if (stream !== undefined && this.#traceMode === "stream" && cdp !== undefined) {
            const read = this.#traceStreamRead(cdp, stream);
            this.#traceReadInFlight = read;
            void read.then(
                () => {
                    if (this.#traceReadInFlight === read) this.#traceReadInFlight = undefined;
                    this.#traceCompleteResolve?.();
                    this.#traceCompleteResolve = undefined;
                },
                () => {
                    if (this.#traceReadInFlight === read) this.#traceReadInFlight = undefined;
                    this.#traceCompleteResolve?.();
                    this.#traceCompleteResolve = undefined;
                },
            );
            return;
        }
        if (this.#traceMode === "stream") {
            this.#traceOverflow = true;
            this.#partialReason ??= "Chromium completed the trace without returning its stream.";
        }
        this.#traceMode = "events";
        this.#traceEventsFinalize();
        this.#traceCompleteResolve?.();
        this.#traceCompleteResolve = undefined;
    }

    #profilingDataRequest(rendererId: number): Promise<boolean> {
        const generation = this.#rendererGeneration;
        const previous = this.#profilingDataWaiters.get(rendererId);
        if (previous) {
            clearTimeout(previous.timer);
            previous.resolve(false);
        }
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                const waiter = this.#profilingDataWaiters.get(rendererId);
                if (waiter?.generation === generation)
                    this.#profilingDataWaiters.delete(rendererId);
                resolve(false);
            }, PROFILE_DATA_TIMEOUT_MS);
            this.#profilingDataWaiters.set(rendererId, {
                generation,
                resolve,
                timer,
            });
        });
    }

    #cancelProfilingDataWaiters(): void {
        for (const waiter of this.#profilingDataWaiters.values()) {
            clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        this.#profilingDataWaiters.clear();
    }

    #cancelInspectionWaiters(): void {
        for (const waiter of this.#inspectionWaiters.values()) {
            clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        this.#inspectionWaiters.clear();
    }

    #traceEventAppend(value: unknown): void {
        const serialized = JSON.stringify(value);
        if (typeof serialized !== "string" || this.#traceOverflow) return;
        const separatorBytes = this.#traceChunks.length === 0 ? 0 : 1;
        const bytes = Buffer.byteLength(serialized) + separatorBytes;
        if (this.#traceBytes + bytes > TRACE_MAX_BYTES) {
            this.#traceOverflow = true;
            this.#partialReason ??= `The raw trace exceeded the bounded ${TRACE_MAX_BYTES} byte capture limit.`;
            return;
        }
        this.#traceBytes += bytes;
        this.#traceChunks.push(serialized);
    }

    #traceEventsFinalize(): void {
        if (this.#traceFinalized) return;
        const events = [...this.#traceChunks];
        if (this.#traceOverflow)
            events.push(
                JSON.stringify({
                    args: {
                        maxBytes: TRACE_MAX_BYTES,
                        reason:
                            this.#partialReason ??
                            "The raw trace was truncated before any event could be retained.",
                    },
                    cat: "kissopen.profiler",
                    name: "kissopen.profiler.trace_overflow",
                    ph: "I",
                    pid: 0,
                    s: "t",
                    tid: 0,
                    ts: 0,
                }),
            );
        this.#traceRawJson = `{"traceEvents":[${events.join(",")}]}`;
        this.#traceFinalized = true;
    }

    async #traceStreamRead(cdp: DesktopProfilerCdp, handle: string): Promise<void> {
        const buffers: Buffer[] = [];
        let bytes = 0;
        let overflow = false;
        let eof = false;
        let reads = 0;
        const deadline = Date.now() + TRACE_COMPLETION_TIMEOUT_MS;
        try {
            while (!eof && reads < TRACE_READ_LIMIT) {
                reads += 1;
                const remaining = deadline - Date.now();
                if (remaining <= 0) {
                    overflow = true;
                    this.#partialReason ??=
                        "Chromium trace stream exceeded the bounded read-drain time limit.";
                    break;
                }
                const result = recordValue(
                    await Promise.race([
                        cdp.sendCommand("IO.read", {
                            handle,
                            size: TRACE_READ_CHUNK_BYTES,
                        }),
                        new Promise<never>((_, reject) => {
                            setTimeout(
                                () => reject(new Error("Chromium IO.read timed out.")),
                                Math.min(remaining, TRACE_READ_COMMAND_TIMEOUT_MS),
                            );
                        }),
                    ]),
                );
                if (!result) {
                    overflow = true;
                    this.#partialReason ??= "Chromium returned an invalid IO.read result.";
                    break;
                }
                if (typeof result.data !== "string") {
                    overflow = true;
                    this.#partialReason ??= "Chromium returned an invalid IO.read result.";
                    break;
                }
                const data = result.data;
                const buffer =
                    result.base64Encoded === true
                        ? Buffer.from(data, "base64")
                        : Buffer.from(data, "utf8");
                if (!overflow) {
                    if (bytes + buffer.byteLength > TRACE_MAX_BYTES) {
                        const remaining = TRACE_MAX_BYTES - bytes;
                        if (remaining > 0) {
                            buffers.push(buffer.subarray(0, remaining));
                            bytes += remaining;
                        }
                        overflow = true;
                        this.#partialReason ??= `The raw trace exceeded the bounded ${TRACE_MAX_BYTES} byte capture limit.`;
                    } else {
                        buffers.push(buffer);
                        bytes += buffer.byteLength;
                    }
                }
                eof = result.eof === true;
            }
            if (!eof) {
                overflow = true;
                this.#partialReason ??= `Chromium trace stream exceeded the bounded ${TRACE_READ_LIMIT} IO.read limit before EOF.`;
            }
        } catch (error) {
            overflow = true;
            this.#partialReason ??= `The raw trace stream ended early: ${errorMessage(error, "unknown error")}`;
        } finally {
            try {
                await Promise.race([
                    cdp.sendCommand("IO.close", { handle }),
                    new Promise<void>((resolve) =>
                        setTimeout(resolve, TRACE_READ_COMMAND_TIMEOUT_MS),
                    ),
                ]);
            } catch {
                // Chromium closes the stream when the renderer detaches.
            }
        }
        // A completion timeout may already have finalized the bounded marker
        // artifact. A late IO.read must never mutate state after that boundary.
        if (this.#traceFinalized) return;
        if ((overflow || this.#traceOverflow) && bytes > 0)
            this.#tracePartialPrefix = Buffer.concat(buffers);
        if (overflow) {
            this.#traceOverflow = true;
            this.#traceMode = "events";
            this.#traceEventsFinalize();
            return;
        }
        const raw = Buffer.concat(buffers).toString("utf8");
        if (raw.trim().length === 0) {
            this.#traceOverflow = true;
            if (bytes > 0) this.#tracePartialPrefix = Buffer.concat(buffers);
            this.#partialReason ??= "Chromium returned an empty raw trace stream.";
            this.#traceMode = "events";
            this.#traceEventsFinalize();
            return;
        }
        try {
            JSON.parse(raw);
        } catch {
            this.#traceOverflow = true;
            if (bytes > 0) this.#tracePartialPrefix = Buffer.concat(buffers);
            this.#partialReason ??= "Chromium returned an invalid raw trace JSON stream.";
            this.#traceMode = "events";
            this.#traceEventsFinalize();
            return;
        }
        this.#traceRawJson = raw;
        this.#traceFinalized = true;
    }

    async #traceCompletionWait(): Promise<void> {
        const complete = this.#traceComplete;
        if (!complete) {
            this.#traceEventsFinalize();
            return;
        }
        await Promise.race([
            complete,
            new Promise<void>((resolve) => setTimeout(resolve, TRACE_COMPLETION_TIMEOUT_MS)),
        ]);
        // Tracing.tracingComplete can arrive just after the first deadline.
        // Give that event a short grace window before finalizing the marker;
        // if it starts an IO.read drain, the drain owns its own bounded
        // deadline and is awaited below.
        if (!this.#traceFinalized && !this.#traceReadInFlight)
            await Promise.race([
                complete,
                new Promise<void>((resolve) => setTimeout(resolve, TRACE_COMPLETION_GRACE_MS)),
            ]);
        const pendingRead = this.#traceReadInFlight;
        // Once Chromium has handed us a stream, its reader owns a separate
        // finite deadline plus a bounded IO.close. Awaiting that self-bounded
        // operation guarantees an exact prefix reaches the artifact instead
        // of letting this outer event timeout finalize a marker milliseconds
        // before the reader publishes what it already drained.
        if (pendingRead && !this.#traceFinalized) await pendingRead;
        if (!this.#traceFinalized) {
            this.#traceOverflow = true;
            this.#partialReason ??=
                "Chromium did not finish the raw trace before the bounded completion timeout.";
            this.#traceMode = "events";
            this.#traceEventsFinalize();
        }
    }

    #inspect(rendererId: number, elementId: number): Promise<boolean> {
        const requestId = ++this.#inspectionId;
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.#inspectionWaiters.delete(requestId);
                resolve(false);
            }, INSPECTION_TIMEOUT_MS);
            this.#inspectionWaiters.set(requestId, {
                generation: this.#rendererGeneration,
                rendererId,
                resolve,
                timer,
            });
            this.#sendReactCommand({
                event: "inspectElement",
                payload: {
                    forceFullData: true,
                    id: elementId,
                    path: null,
                    rendererID: rendererId,
                    requestID: requestId,
                },
            });
        });
    }

    #sampleStart(): void {
        this.#sampling = true;
        void this.#sample();
        this.#samplingTimer = setInterval(() => void this.#sample(), SAMPLE_INTERVAL_MS);
    }

    #sample(): Promise<void> {
        if (this.#sampleInFlight) return this.#sampleInFlight;
        const promise = this.#sampleImpl().finally(() => {
            if (this.#sampleInFlight === promise) this.#sampleInFlight = undefined;
        });
        this.#sampleInFlight = promise;
        return promise;
    }

    async #sampleImpl(): Promise<void> {
        if (!this.#sampling || !this.#cdp || !this.#contents) return;
        const contents = this.#contents;
        const appMetrics = app.getAppMetrics() as readonly ProcessMetric[];
        const main = appMetrics.find((metric) => metric.pid === process.pid);
        const renderer = appMetrics.find((metric) => metric.pid === contents.getOSProcessId());
        let heap: Record<string, unknown> | undefined;
        let dom: Record<string, unknown> | undefined;
        let performance: ReadonlyMap<string, number> = new Map();
        try {
            heap = recordValue(await this.#cdp.sendCommand("Runtime.getHeapUsage"));
        } catch {
            heap = undefined;
        }
        try {
            dom = recordValue(await this.#cdp.sendCommand("Memory.getDOMCounters"));
        } catch {
            dom = undefined;
        }
        try {
            performance = metricsMap(await this.#cdp.sendCommand("Performance.getMetrics"));
        } catch {
            performance = new Map();
        }
        const mainPrivateBytes = processMetricBytes(main?.memory?.privateBytes);
        const mainWorkingSetBytes = processMetricBytes(main?.memory?.workingSetSize);
        const rendererPrivateBytes = processMetricBytes(renderer?.memory?.privateBytes);
        const rendererWorkingSetBytes = processMetricBytes(renderer?.memory?.workingSetSize);
        this.#metrics.push({
            ...(heap || dom || performance.size > 0
                ? {
                      cdp: {
                          ...(finiteNumber(dom?.nodes)
                              ? { domNodes: finiteNumber(dom?.nodes) }
                              : {}),
                          ...(finiteNumber(heap?.totalSize)
                              ? { jsHeapTotalBytes: finiteNumber(heap?.totalSize) }
                              : {}),
                          ...(finiteNumber(heap?.usedSize)
                              ? { jsHeapUsedBytes: finiteNumber(heap?.usedSize) }
                              : {}),
                          ...(performance.has("LayoutDuration")
                              ? { layoutDurationSeconds: performance.get("LayoutDuration") }
                              : {}),
                          ...(performance.has("TaskDuration")
                              ? { taskDurationSeconds: performance.get("TaskDuration") }
                              : {}),
                      },
                  }
                : {}),
            ...(main
                ? {
                      mainProcess: {
                          cpuPercent: main.cpu?.percentCPUUsage ?? 0,
                          heapUsedBytes: mainHeapUsedBytes(),
                          ...(mainPrivateBytes === undefined
                              ? {}
                              : { privateBytes: mainPrivateBytes }),
                          ...(mainWorkingSetBytes === undefined
                              ? {}
                              : { workingSetBytes: mainWorkingSetBytes }),
                      },
                  }
                : {}),
            ...(renderer
                ? {
                      rendererProcess: {
                          cpuPercent: renderer.cpu?.percentCPUUsage ?? 0,
                          ...(rendererPrivateBytes === undefined
                              ? {}
                              : { privateBytes: rendererPrivateBytes }),
                          ...(rendererWorkingSetBytes === undefined
                              ? {}
                              : { workingSetBytes: rendererWorkingSetBytes }),
                      },
                  }
                : {}),
            t: Date.now(),
        });
    }

    #publish(): void {
        this.#options.changed(this.get());
    }
}
