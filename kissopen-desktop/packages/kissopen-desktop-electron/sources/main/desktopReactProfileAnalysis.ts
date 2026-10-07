import {
    DESKTOP_REACT_COMPONENT_METADATA_LIMIT,
    DESKTOP_REACT_ELEMENT_TYPE_ROOT,
    DESKTOP_REACT_RENDER_RECORD_LIMIT,
    DESKTOP_REACT_RENDER_RECORDS_PER_COMPONENT_LIMIT,
    DESKTOP_REACT_TREE_OPERATION_ADD,
    DESKTOP_REACT_TREE_OPERATION_REMOVE,
    DESKTOP_REACT_TREE_OPERATION_REMOVE_ROOT,
    DESKTOP_REACT_TREE_OPERATION_REORDER_CHILDREN,
    DESKTOP_REACT_TREE_OPERATION_SET_SUBTREE_MODE,
    DESKTOP_REACT_TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS,
    DESKTOP_REACT_TREE_OPERATION_UPDATE_TREE_BASE_DURATION,
    type DesktopReactComponentIdentity,
    type DesktopReactComponentMetadata,
    type DesktopReactDevtoolsProfileChange,
    type DesktopReactDevtoolsProfilePayload,
    type DesktopReactHookDescriptor,
    type DesktopReactProfileReport,
    type DesktopReactRenderCause,
    type DesktopReactRenderRecord,
} from "../shared/desktopProfiler";

export function desktopReactComponentMetadataKey(identity: DesktopReactComponentIdentity): string {
    return `${identity.rendererId}:${identity.rootId}:${identity.fiberId}`;
}

interface DesktopReactMetadataAddOperation {
    readonly kind: "add";
    readonly metadata: DesktopReactComponentMetadata;
}

interface DesktopReactMetadataRemoveOperation {
    readonly fiberIds: readonly number[];
    readonly kind: "remove";
}

interface DesktopReactMetadataRemoveRootOperation {
    readonly kind: "remove-root";
    readonly rootId: number;
}

type DesktopReactMetadataOperation =
    | DesktopReactMetadataAddOperation
    | DesktopReactMetadataRemoveOperation
    | DesktopReactMetadataRemoveRootOperation;

interface DesktopReactOperationsParsed {
    readonly operations: readonly DesktopReactMetadataOperation[];
    readonly rendererId: number;
    readonly rootId: number;
}

/**
 * Bounded component metadata reconstructed from the official operations
 * stream. It deliberately stores no props, state, hook values, or owner
 * payloads; malformed/unknown batches are ignored without throwing.
 */
export class DesktopReactComponentMetadataCatalog {
    // Entries are historical labels; liveKeys is deliberately separate so
    // unmounted fibers remain nameable in the v5 session history.
    readonly #entries = new Map<string, DesktopReactComponentMetadata>();
    readonly #liveKeys = new Set<string>();

    get(): ReadonlyMap<string, DesktopReactComponentMetadata> {
        return this.#entries;
    }

    isLive(identity: DesktopReactComponentIdentity): boolean {
        return this.#liveKeys.has(desktopReactComponentMetadataKey(identity));
    }

    clear(): void {
        this.#entries.clear();
        this.#liveKeys.clear();
    }

    /**
     * A new capture starts a new historical window. Keep labels for the
     * currently mounted tree because the wall does not replay it on demand,
     * but release inactive labels retained only by the previous capture.
     */
    clearCaptureHistory(): void {
        for (const key of this.#entries.keys()) {
            if (!this.#liveKeys.has(key)) this.#entries.delete(key);
        }
    }

    apply(operations: readonly number[]): void {
        const parsed = desktopReactOperationsParse(operations);
        if (parsed === undefined) return;
        for (const operation of parsed.operations) {
            if (operation.kind === "add") {
                const key = desktopReactComponentMetadataKey(operation.metadata.identity);
                if (
                    !this.#entries.has(key) &&
                    this.#entries.size >= DESKTOP_REACT_COMPONENT_METADATA_LIMIT
                ) {
                    let oldestInactive: string | undefined;
                    for (const candidate of this.#entries.keys()) {
                        if (!this.#liveKeys.has(candidate)) {
                            oldestInactive = candidate;
                            break;
                        }
                    }
                    const evicted = oldestInactive ?? this.#entries.keys().next().value;
                    if (typeof evicted === "string") {
                        this.#entries.delete(evicted);
                        this.#liveKeys.delete(evicted);
                    }
                }
                this.#entries.set(key, operation.metadata);
                this.#liveKeys.add(key);
            } else if (operation.kind === "remove") {
                for (const fiberId of operation.fiberIds)
                    this.#fiberRemove(parsed.rendererId, parsed.rootId, fiberId);
            } else {
                for (const [key, metadata] of this.#entries) {
                    if (
                        metadata.identity.rendererId === parsed.rendererId &&
                        metadata.identity.rootId === operation.rootId
                    )
                        this.#liveKeys.delete(key);
                }
            }
        }
    }

    #fiberRemove(rendererId: number, rootId: number, fiberId: number): void {
        if (rootId >= 0) {
            this.#liveKeys.delete(
                desktopReactComponentMetadataKey({ fiberId, rendererId, rootId }),
            );
            return;
        }
        for (const [key, metadata] of this.#entries) {
            if (
                metadata.identity.rendererId === rendererId &&
                metadata.identity.fiberId === fiberId
            )
                this.#liveKeys.delete(key);
        }
    }
}

function numberValue(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function integerValue(value: unknown): number | undefined {
    const number = numberValue(value);
    return number !== undefined && Number.isInteger(number) ? number : undefined;
}

function desktopReactOperationsParse(
    operations: readonly number[],
): DesktopReactOperationsParsed | undefined {
    if (operations.length < 3 || operations.length > 1_000_000) return undefined;
    const rendererId = integerValue(operations[0]);
    const rootId = integerValue(operations[1]);
    const stringTableSize = integerValue(operations[2]);
    if (
        rendererId === undefined ||
        rootId === undefined ||
        stringTableSize === undefined ||
        stringTableSize < 0
    )
        return undefined;

    const stringTableEnd = 3 + stringTableSize;
    if (stringTableEnd > operations.length) return undefined;
    const stringTable: (string | null)[] = [null];
    let index = 3;
    while (index < stringTableEnd) {
        const length = integerValue(operations[index]);
        if (length === undefined || length < 0 || index + 1 + length > stringTableEnd)
            return undefined;
        const codePoints = operations.slice(index + 1, index + 1 + length);
        if (
            codePoints.some(
                (codePoint) =>
                    codePoint < 0 || codePoint > 0x10ffff || !Number.isInteger(codePoint),
            )
        )
            return undefined;
        try {
            stringTable.push(String.fromCodePoint(...codePoints));
        } catch {
            return undefined;
        }
        index += 1 + length;
    }
    if (index !== stringTableEnd) return undefined;

    const parsed: DesktopReactMetadataOperation[] = [];
    const stringAt = (id: number): string | null | undefined => {
        if (id < 0 || id >= stringTable.length) return undefined;
        return stringTable[id];
    };
    const integerAt = (offset: number): number | undefined => integerValue(operations[offset]);
    const numberAt = (offset: number): number | undefined => numberValue(operations[offset]);

    index = stringTableEnd;
    while (index < operations.length) {
        const operation = integerAt(index);
        if (operation === undefined) return undefined;
        if (operation === DESKTOP_REACT_TREE_OPERATION_ADD) {
            const id = integerAt(index + 1);
            const elementType = integerAt(index + 2);
            if (id === undefined || elementType === undefined || index + 6 >= operations.length)
                return undefined;
            if (elementType === DESKTOP_REACT_ELEMENT_TYPE_ROOT) {
                if (
                    integerAt(index + 3) === undefined ||
                    integerAt(index + 4) === undefined ||
                    integerAt(index + 5) === undefined ||
                    integerAt(index + 6) === undefined
                )
                    return undefined;
                parsed.push({
                    kind: "add",
                    metadata: {
                        displayName: "Root",
                        elementType,
                        identity: {
                            fiberId: id,
                            rendererId,
                            rootId: rootId >= 0 ? rootId : id,
                        },
                        key: null,
                        parentId: 0,
                    },
                });
                index += 7;
                continue;
            }
            const parentId = integerAt(index + 3);
            const displayNameStringId = integerAt(index + 5);
            const keyStringId = integerAt(index + 6);
            if (
                parentId === undefined ||
                integerAt(index + 4) === undefined ||
                displayNameStringId === undefined ||
                keyStringId === undefined
            )
                return undefined;
            const displayName = stringAt(displayNameStringId);
            const key = stringAt(keyStringId);
            if (displayName === undefined || key === undefined) return undefined;
            parsed.push({
                kind: "add",
                metadata: {
                    displayName: displayName ?? "",
                    elementType,
                    identity: { fiberId: id, rendererId, rootId },
                    key,
                    parentId,
                },
            });
            index += 7;
            continue;
        }
        if (operation === DESKTOP_REACT_TREE_OPERATION_REMOVE) {
            const length = integerAt(index + 1);
            if (length === undefined || length < 0 || index + 2 + length > operations.length)
                return undefined;
            const fiberIds = operations.slice(index + 2, index + 2 + length);
            if (fiberIds.some((fiberId) => !Number.isInteger(fiberId))) return undefined;
            parsed.push({ fiberIds, kind: "remove" });
            index += 2 + length;
            continue;
        }
        if (operation === DESKTOP_REACT_TREE_OPERATION_REMOVE_ROOT) {
            const removedRootId = integerAt(index + 1);
            if (removedRootId === undefined) return undefined;
            parsed.push({ kind: "remove-root", rootId: removedRootId });
            index += 2;
            continue;
        }
        if (operation === DESKTOP_REACT_TREE_OPERATION_REORDER_CHILDREN) {
            const childCount = integerAt(index + 2);
            if (
                integerAt(index + 1) === undefined ||
                childCount === undefined ||
                childCount < 0 ||
                index + 3 + childCount > operations.length
            )
                return undefined;
            if (
                operations
                    .slice(index + 3, index + 3 + childCount)
                    .some((childId) => !Number.isInteger(childId))
            )
                return undefined;
            index += 3 + childCount;
            continue;
        }
        if (operation === DESKTOP_REACT_TREE_OPERATION_UPDATE_TREE_BASE_DURATION) {
            if (integerAt(index + 1) === undefined || numberAt(index + 2) === undefined)
                return undefined;
            index += 3;
            continue;
        }
        if (operation === DESKTOP_REACT_TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS) {
            if (
                integerAt(index + 1) === undefined ||
                integerAt(index + 2) === undefined ||
                integerAt(index + 3) === undefined
            )
                return undefined;
            index += 4;
            continue;
        }
        if (operation === DESKTOP_REACT_TREE_OPERATION_SET_SUBTREE_MODE) {
            if (integerAt(index + 1) === undefined || integerAt(index + 2) === undefined)
                return undefined;
            index += 3;
            continue;
        }
        return undefined;
    }
    return { operations: parsed, rendererId, rootId };
}

function hookNames(hooks: readonly DesktopReactHookDescriptor[]): readonly string[] {
    return hooks.flatMap((hook) => [hook.name, ...hookNames(hook.subHooks)]);
}

function hookNameMap(hooks: readonly DesktopReactHookDescriptor[]): ReadonlyMap<number, string> {
    const names = new Map<number, string>();
    const visit = (nodes: readonly DesktopReactHookDescriptor[]): void => {
        for (const hook of nodes) {
            if (hook.id !== null) names.set(hook.id, hook.name);
            visit(hook.subHooks);
        }
    };
    visit(hooks);
    return names;
}

interface DesktopReactRenderAnalysis {
    readonly causes: ReadonlySet<DesktopReactRenderCause>;
    readonly changedHookIndices: ReadonlySet<number>;
    readonly changedHookNames: readonly string[];
    readonly changedProps: readonly string[] | null;
    readonly changedState: readonly string[] | null;
}

interface DesktopReactComponentAnalysis {
    actualDurationMs: number;
    causes: Set<DesktopReactRenderCause>;
    changedHookIndices: Set<number>;
    changedHookNames: Set<string>;
    displayName: string;
    fiberId: number;
    identity: DesktopReactComponentIdentity;
    inspectedHookNames: Set<string>;
    renderRecordsEligible: number;
    renderRecordsRetained: number;
    renderRecordsDropped: number;
    renders: DesktopReactRenderRecord[];
    renderCount: number;
    selfDurationMs: number;
}

function profileRenderAnalysis(
    description: DesktopReactDevtoolsProfileChange | undefined,
    inspected: readonly DesktopReactHookDescriptor[] | undefined,
): DesktopReactRenderAnalysis {
    const causes = new Set<DesktopReactRenderCause>();
    const changedHookIndices = new Set<number>();
    const changedProps = description?.props ?? null;
    const changedState = description?.state ?? null;
    if (!description) causes.add("parent-rendered");
    else {
        const hooks = description.hooks ?? [];
        if (description.isFirstMount) causes.add("first-mount");
        if (description.didHooksChange || hooks.length > 0) causes.add("hooks-changed");
        if (description.context === true) causes.add("context-changed");
        if ((changedProps?.length ?? 0) > 0) causes.add("props-changed");
        if ((changedState?.length ?? 0) > 0) causes.add("state-changed");
        for (const hook of hooks) changedHookIndices.add(hook);
        if (
            !description.isFirstMount &&
            !description.didHooksChange &&
            (changedProps?.length ?? 0) === 0 &&
            (changedState?.length ?? 0) === 0 &&
            !description.context
        )
            causes.add("parent-rendered");
    }
    const namesById = inspected ? hookNameMap(inspected) : new Map();
    const changedHookNames = [...changedHookIndices]
        .flatMap((index) => {
            const name = namesById.get(index);
            return name === undefined ? [] : [name];
        })
        .sort();
    return {
        causes,
        changedHookIndices,
        changedHookNames,
        changedProps,
        changedState,
    };
}

function renderRecordCreate(
    analysis: DesktopReactRenderAnalysis,
    actualDurationMs: number,
    commitIndex: number,
    description: DesktopReactDevtoolsProfileChange | undefined,
    selfDurationMs: number,
    timestamp: number,
): DesktopReactRenderRecord {
    const directCause = [...analysis.causes].some((cause) => cause !== "parent-rendered");
    return {
        actualDurationMs,
        causes: [...analysis.causes],
        changedHookIndices:
            description?.hooks === null || description === undefined
                ? null
                : [...analysis.changedHookIndices].sort((a, b) => a - b),
        changedHookNames:
            description?.hooks === null || description === undefined
                ? null
                : analysis.changedHookNames,
        changedProps: analysis.changedProps === null ? null : [...analysis.changedProps].sort(),
        changedState: analysis.changedState === null ? null : [...analysis.changedState].sort(),
        commitIndex,
        contextChanged: description?.context ?? null,
        evidence: directCause ? "devtools-change-description" : "inferred-parent-cascade",
        selfDurationMs,
        timestamp,
    };
}

export function desktopReactProfileAnalyze(
    payloads: readonly DesktopReactDevtoolsProfilePayload[],
    inspectedHooks: ReadonlyMap<string, readonly DesktopReactHookDescriptor[]>,
    componentMetadata: ReadonlyMap<string, DesktopReactComponentMetadata> = new Map(),
): DesktopReactProfileReport {
    const components = new Map<string, DesktopReactComponentAnalysis>();
    const roots = payloads.flatMap((payload) => payload.dataForRoots);
    let commits = 0;

    // Pass one computes complete component aggregates and counts every eligible
    // rerender. It intentionally does not retain timeline records, so the
    // bounded allocation below is independent of commit arrival order.
    for (const payload of payloads) {
        for (const root of payload.dataForRoots) {
            const rendererId = root.rendererId;
            const names = new Map(
                root.snapshots.map((snapshot) => [snapshot.id, snapshot.displayName]),
            );
            for (const commit of root.commitData) {
                commits += 1;
                const descriptions = new Map(commit.changeDescriptions ?? []);
                const selfDurations = new Map(commit.fiberSelfDurations);
                for (const [fiberId, actualDurationMs] of commit.fiberActualDurations) {
                    const key = `${rendererId}:${root.rootID}:${fiberId}`;
                    const metadata = componentMetadata.get(key);
                    const description = descriptions.get(fiberId);
                    const inspected = inspectedHooks.get(`${rendererId}:${fiberId}`);
                    const analysis = profileRenderAnalysis(description, inspected);
                    const selfDurationMs = selfDurations.get(fiberId) ?? 0;
                    const existing = components.get(key) ?? {
                        actualDurationMs: 0,
                        causes: new Set<DesktopReactRenderCause>(),
                        changedHookIndices: new Set<number>(),
                        changedHookNames: new Set<string>(),
                        displayName:
                            metadata?.displayName || names.get(fiberId) || `Fiber ${fiberId}`,
                        fiberId,
                        identity: { fiberId, rendererId, rootId: root.rootID },
                        inspectedHookNames: new Set<string>(),
                        renderRecordsEligible: 0,
                        renderRecordsRetained: 0,
                        renderRecordsDropped: 0,
                        renders: [],
                        renderCount: 0,
                        selfDurationMs: 0,
                    };
                    if (metadata?.displayName) existing.displayName = metadata.displayName;
                    existing.actualDurationMs += actualDurationMs;
                    existing.renderCount += 1;
                    existing.selfDurationMs += selfDurationMs;
                    for (const cause of analysis.causes) existing.causes.add(cause);
                    for (const hook of analysis.changedHookIndices)
                        existing.changedHookIndices.add(hook);
                    for (const name of analysis.changedHookNames)
                        existing.changedHookNames.add(name);
                    if (inspected) {
                        for (const name of hookNames(inspected))
                            existing.inspectedHookNames.add(name);
                    }
                    if (description?.isFirstMount !== true) existing.renderRecordsEligible += 1;
                    components.set(key, existing);
                }
            }
        }
    }

    // Allocate records deterministically by total self time. Ties use the
    // complete renderer/root/fiber identity, so repeated captures do not
    // depend on Map insertion order or which commit arrived first.
    const rankedComponents = [...components.entries()].sort(
        ([leftKey, left], [rightKey, right]) =>
            right.selfDurationMs - left.selfDurationMs || leftKey.localeCompare(rightKey),
    );
    let renderRecordsRetained = 0;
    let renderRecordsDropped = 0;
    for (const [, component] of rankedComponents) {
        const remaining = DESKTOP_REACT_RENDER_RECORD_LIMIT - renderRecordsRetained;
        component.renderRecordsRetained = Math.min(
            component.renderRecordsEligible,
            DESKTOP_REACT_RENDER_RECORDS_PER_COMPONENT_LIMIT,
            Math.max(0, remaining),
        );
        component.renderRecordsDropped =
            component.renderRecordsEligible - component.renderRecordsRetained;
        renderRecordsRetained += component.renderRecordsRetained;
        renderRecordsDropped += component.renderRecordsDropped;
    }

    // Pass two replays the official payloads chronologically, but only
    // materializes records for identities that received a budget above. This
    // preserves commit order and all null/direct-vs-inferred semantics without
    // allowing early commits to consume the global budget.
    let commitIndex = 0;
    for (const payload of payloads) {
        for (const root of payload.dataForRoots) {
            const rendererId = root.rendererId;
            for (const commit of root.commitData) {
                const descriptions = new Map(commit.changeDescriptions ?? []);
                const selfDurations = new Map(commit.fiberSelfDurations);
                for (const [fiberId, actualDurationMs] of commit.fiberActualDurations) {
                    const key = `${rendererId}:${root.rootID}:${fiberId}`;
                    const component = components.get(key);
                    const description = descriptions.get(fiberId);
                    if (component && description?.isFirstMount !== true) {
                        const inspected = inspectedHooks.get(`${rendererId}:${fiberId}`);
                        if (component.renders.length < component.renderRecordsRetained) {
                            component.renders.push(
                                renderRecordCreate(
                                    profileRenderAnalysis(description, inspected),
                                    actualDurationMs,
                                    commitIndex,
                                    description,
                                    selfDurations.get(fiberId) ?? 0,
                                    commit.timestamp,
                                ),
                            );
                        }
                    }
                }
                commitIndex += 1;
            }
        }
    }

    const componentReports = [...components.values()];
    const changedHookComponentCount = componentReports.filter(
        (component) => component.changedHookIndices.size > 0,
    ).length;
    const namedHookComponentCount = componentReports.filter(
        (component) => component.changedHookIndices.size > 0 && component.changedHookNames.size > 0,
    ).length;
    const inspectedComponentCount = componentReports.filter(
        (component) => component.inspectedHookNames.size > 0,
    ).length;
    return {
        commits,
        components: componentReports
            .map((component) => ({
                actualDurationMs: component.actualDurationMs,
                causes: [...component.causes],
                changedHookIndices: [...component.changedHookIndices].sort((a, b) => a - b),
                changedHookNames: [...component.changedHookNames],
                displayName: component.displayName,
                fiberId: component.fiberId,
                identity: component.identity,
                inspectedHookNames: [...component.inspectedHookNames],
                renderCount: component.renderCount,
                renders: component.renders,
                renderRecordsEligible: component.renderRecordsEligible,
                renderRecordsRetained: component.renderRecordsRetained,
                renderRecordsDropped: component.renderRecordsDropped,
                selfDurationMs: component.selfDurationMs,
            }))
            .sort((a, b) => b.selfDurationMs - a.selfDurationMs),
        hookNameCoverage: {
            changedHookComponentCount,
            inspectedComponentCount,
            namedHookComponentCount,
            unresolvedHookComponentCount: changedHookComponentCount - namedHookComponentCount,
            namedHookCoverage:
                changedHookComponentCount === 0
                    ? 1
                    : namedHookComponentCount / changedHookComponentCount,
        },
        renderRecordLimit: DESKTOP_REACT_RENDER_RECORD_LIMIT,
        renderRecordsDropped,
        renderRecordsPerComponentLimit: DESKTOP_REACT_RENDER_RECORDS_PER_COMPONENT_LIMIT,
        renderRecordsRetained,
        renderRecordsTruncated: renderRecordsDropped > 0,
        roots,
    };
}
