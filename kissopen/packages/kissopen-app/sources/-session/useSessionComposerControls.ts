import * as React from 'react';
import { sessionSetAgentModes } from '@/sync/ops';
import { useSetting } from '@/sync/storage';
import { getRigReasoningSelection, isRigMetadata, isRigModelSelectionEnabled, isRigPermissionSelectionEnabled, isRigReasoningSelectionEnabled } from '@/sync/rig';
import { resolveAgentDefaultConfig } from '@/sync/agentDefaults';
import type { Session } from '@/sync/storageTypes';
import { t } from '@/text';
import type { ModelMode, PermissionMode } from '@/components/PermissionModeSelector';
import {
    getAvailableModels,
    getAvailablePermissionModes,
    getEffortLevelsForModel,
    getRigCurrentModelOptionKey,
    resolveCurrentOption,
    type EffortLevel,
} from '@/components/modelModeOptions';

export interface SessionComposerControls {
    readonly availableModes: PermissionMode[];
    readonly permissionMode: PermissionMode | null;
    readonly onPermissionModeChange: ((mode: PermissionMode) => void) | undefined;
    readonly availableModels: ModelMode[];
    readonly modelMode: ModelMode | null;
    readonly onModelModeChange: ((mode: ModelMode) => void) | undefined;
    readonly availableEffortLevels: EffortLevel[];
    readonly effortLevel: EffortLevel | null;
    readonly onEffortLevelChange: ((level: EffortLevel) => void) | undefined;
}

/**
 * What the composer offers above its text field, for one session.
 *
 * The composer is the same control wherever a person writes to an agent, so
 * what it can offer has to be derived in one place. It used to live inside the
 * session screen, which was fine while that screen was the only one with a
 * composer; the home's welcome page writes to a bot's session too now, and a
 * second copy of this reasoning would be a second answer to "which models does
 * this agent have" that drifts the first time either is touched.
 *
 * Every answer comes from the session, never from the screen asking. A control
 * whose selection this agent does not allow is handed back without an updater,
 * which is what makes it read-only rather than absent.
 *
 * A missing session is answered with empty controls rather than a missing hook.
 * The home renders its composer before the bot's session has finished syncing,
 * and a composer that appeared a beat later would shift the page under the
 * reader's thumb.
 */
export function useSessionComposerControls(sessionId: string | undefined, session: Session | null | undefined): SessionComposerControls {
    const flavor = session?.metadata?.flavor;
    const cliVersion = session?.metadata?.version;
    const isRig = isRigMetadata(session?.metadata);
    const agentDefaultOverrides = useSetting('agentDefaultOverrides');
    const effectiveAgentDefaults = React.useMemo(() => (
        resolveAgentDefaultConfig(agentDefaultOverrides, flavor, cliVersion)
    ), [agentDefaultOverrides, cliVersion, flavor]);

    const availableModels = React.useMemo(() => (
        getAvailableModels(
            flavor,
            session?.metadata,
            t,
            session?.modelMode ?? (isRig ? null : effectiveAgentDefaults.modelMode),
        )
    ), [flavor, session?.metadata, session?.modelMode, effectiveAgentDefaults.modelMode, isRig]);
    const availableModes = React.useMemo(() => (
        getAvailablePermissionModes(flavor, session?.metadata, t, session?.permissionMode)
    ), [flavor, session?.metadata, session?.permissionMode]);

    const permissionMode = React.useMemo<PermissionMode | null>(() => (
        resolveCurrentOption(availableModes, [
            session?.permissionMode,
            ...(isRig ? [
                session?.metadata?.currentOperatingModeCode,
                session?.metadata?.permissionMode,
                session?.metadata?.session?.permissionMode,
            ] : [
                effectiveAgentDefaults.permissionMode,
                session?.metadata?.currentOperatingModeCode,
            ]),
        ])
    ), [availableModes, session?.permissionMode, effectiveAgentDefaults.permissionMode, session?.metadata?.currentOperatingModeCode, session?.metadata?.permissionMode, session?.metadata?.session?.permissionMode, isRig]);

    const modelMode = React.useMemo<ModelMode | null>(() => (
        resolveCurrentOption(availableModels, [
            session?.modelMode,
            isRig ? getRigCurrentModelOptionKey(session?.metadata) : effectiveAgentDefaults.modelMode,
            isRig ? undefined : session?.metadata?.currentModelCode,
        ])
    ), [availableModels, session?.modelMode, effectiveAgentDefaults.modelMode, session?.metadata, isRig]);

    const modelKey = modelMode?.key ?? 'default';
    const availableEffortLevels = React.useMemo<EffortLevel[]>(() => (
        getEffortLevelsForModel(flavor, modelKey, session?.metadata)
    ), [flavor, modelKey, session?.metadata]);
    const effortLevel = React.useMemo<EffortLevel | null>(() => (
        resolveCurrentOption(availableEffortLevels, [
            session?.effortLevel,
            isRig ? getRigReasoningSelection(session?.metadata, modelKey) : effectiveAgentDefaults.effortLevel,
        ])
    ), [availableEffortLevels, session?.effortLevel, effectiveAgentDefaults.effortLevel, session?.metadata, modelKey, isRig]);

    const updatePermissionMode = React.useCallback((mode: PermissionMode) => {
        if (!sessionId) return;
        sessionSetAgentModes(sessionId, { permissionMode: mode.key });
    }, [sessionId]);
    const updateModelMode = React.useCallback((mode: ModelMode) => {
        if (!sessionId) return;
        const nextEffortLevels = getEffortLevelsForModel(flavor, mode.key, session?.metadata);
        const currentEffortSupported = session?.effortLevel
            ? nextEffortLevels.some((level) => level.key === session?.effortLevel)
            : true;
        sessionSetAgentModes(sessionId, {
            modelMode: mode.key,
            ...(!currentEffortSupported ? { effortLevel: mode.defaultThinkingLevel ?? null } : {}),
        });
    }, [sessionId, flavor, session?.metadata, session?.effortLevel]);
    const updateEffortLevel = React.useCallback((level: EffortLevel) => {
        if (!sessionId) return;
        sessionSetAgentModes(sessionId, { effortLevel: level.key });
    }, [sessionId]);

    return {
        availableModes,
        permissionMode,
        onPermissionModeChange: isRigPermissionSelectionEnabled(session?.metadata) ? updatePermissionMode : undefined,
        availableModels,
        modelMode,
        onModelModeChange: isRigModelSelectionEnabled(session?.metadata) ? updateModelMode : undefined,
        availableEffortLevels,
        effortLevel,
        onEffortLevelChange: isRigReasoningSelectionEnabled(session?.metadata) ? updateEffortLevel : undefined,
    };
}
