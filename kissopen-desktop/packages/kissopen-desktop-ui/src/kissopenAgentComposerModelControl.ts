import {
    t,
    type KissopenAgentMenusSnapshot,
    type KissopenAgentModelSelection,
    type KissopenAgentThinkingLevel,
} from "kissopen-desktop-state";
import type { ComposerModelControlProps } from "./ComposerModelControl";

/** Provider and model ids joined for composer choice ids (matches agent menu ids). */
const MODEL_ID_SEP = " ";

function kissopenAgentModelChoiceId(providerId: string, modelId: string): string {
    return `${providerId}${MODEL_ID_SEP}${modelId}`;
}

/** Built-in accounts without a configured display name use their readable account ID. */
function kissopenAgentProviderName(id: string): string {
    return id
        .split(/[_-]/)
        .filter(Boolean)
        .map((part) => part[0]!.toUpperCase() + part.slice(1))
        .join(" ");
}

/*
The KISSOPEN service's models are offered as one choice, the cloud model: which model answers is
the service's routing, not something a person picks. A conversation already on one of them keeps
it; one moved to the cloud from another provider takes the service's default, which the menus
list first.
*/
const CLOUD_PROVIDER_ID = "kissopen";

function cloudModelChoice(menus: KissopenAgentMenusSnapshot): string | undefined {
    const cloud = menus.modelOptions.filter((option) => option.providerId === CLOUD_PROVIDER_ID);
    const chosen =
        cloud.find((option) => option.modelId === menus.currentModelId) &&
        menus.currentProviderId === CLOUD_PROVIDER_ID
            ? menus.currentModelId
            : cloud[0]?.modelId;
    return chosen === undefined ? undefined : kissopenAgentModelChoiceId(CLOUD_PROVIDER_ID, chosen);
}

function currentEffortId(menus: KissopenAgentMenusSnapshot): string {
    const current = menus.effortOptions.find((option) => option.current);
    return current?.level ?? menus.currentEffort ?? menus.effortOptions[0]?.level ?? "";
}

/**
 * Maps a session menu snapshot into props for the shared composer model pill.
 */
export function kissopenAgentComposerModelControlProps(
    menus: KissopenAgentMenusSnapshot,
    handlers: {
        readonly onModelChange: (selection: KissopenAgentModelSelection) => void;
        readonly onEffortChange: (effort?: KissopenAgentThinkingLevel) => void;
        readonly disabled?: boolean;
    },
): ComposerModelControlProps {
    const cloud = cloudModelChoice(menus);
    const local = menus.modelOptions.filter((option) => option.providerId !== CLOUD_PROVIDER_ID);
    return {
        disabled: handlers.disabled,
        model:
            menus.currentProviderId === CLOUD_PROVIDER_ID && cloud !== undefined
                ? cloud
                : kissopenAgentModelChoiceId(menus.currentProviderId, menus.currentModelId),
        models: [
            ...(cloud === undefined ? [] : [{ group: t("云端"), id: cloud, label: t("云端模型") }]),
            ...local.map((option) => ({
                group: option.providerName ?? kissopenAgentProviderName(option.providerId),
                id: kissopenAgentModelChoiceId(option.providerId, option.modelId),
                label: option.name,
            })),
        ],
        effort: currentEffortId(menus),
        efforts: menus.effortOptions.map((option) => ({
            id: option.level,
            label: option.label,
        })),
        onModelChange: (id) => {
            const [providerId, modelId] = id.split(MODEL_ID_SEP);
            if (modelId) handlers.onModelChange({ providerId, modelId });
        },
        onEffortChange: (id) => handlers.onEffortChange(id as KissopenAgentThinkingLevel),
    };
}
