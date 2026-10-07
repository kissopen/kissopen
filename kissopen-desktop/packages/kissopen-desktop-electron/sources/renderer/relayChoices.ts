/*
What a relay conversation offers in its composer: models and thinking levels.

Both come from the session's own metadata, which is how the phone reads them
too — the machine running the session publishes what it can do, and a client
picks from that rather than from a list of its own. A desktop that offered a
model the far side does not have would be offering a message that fails.

Choosing is not a change to the session. The selection rides out with the next
message, the way the phone sends it: `meta.model`, `meta.modelProviderId` and
`meta.effort`. Nothing is written back to the machine, so nothing drifts if the
reader changes their mind and says nothing.
*/
import type { Metadata } from "@kissopen/kissopen-sync/storageTypes";
import type { ComposerModelChoice } from "kissopen-desktop-ui";
import { t } from "kissopen-desktop-state";

/*
The names of the effort levels an agent publishes, in the reader's language.
The agent names a level by its code; a code this desktop does not know keeps
the name the agent gave it.
*/
const EFFORT_NAMES: Readonly<Record<string, string>> = {
    off: "Off",
    on: "On",
    none: "Off",
    minimal: "Minimal",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra High",
    max: "Maximum",
    ultra: "Ultra",
};

/** A model as both the picker and the outgoing message need it. */
export interface RelayModelChoice extends ComposerModelChoice {
    /** Provider the far side knows this model by, when it names one. */
    readonly providerId?: string;
    /** The model id to send, which is not always the code shown. */
    readonly modelId?: string;
}

export interface RelayChoices {
    readonly models: readonly RelayModelChoice[];
    readonly model: string;
    readonly efforts: readonly ComposerModelChoice[];
    readonly effort: string;
}

/**
 * Reads what this conversation may be asked for.
 *
 * Empty when the session says nothing, and the picker then shows nothing —
 * better than a list of guesses the far side would refuse.
 */
export function relayChoices(metadata: Metadata | null): RelayChoices {
    const models = (metadata?.models ?? []).map((model) => ({
        id: model.code,
        label: model.name || model.value || model.code,
        ...(model.providerId ? { providerId: model.providerId } : {}),
        ...(model.id ? { modelId: model.id } : {}),
    }));
    const efforts = (metadata?.thoughtLevels ?? []).map((level) => ({
        id: level.code,
        label: EFFORT_NAMES[level.code] ? t(EFFORT_NAMES[level.code]!) : level.value || level.code,
    }));
    return {
        models,
        model: metadata?.currentModelCode ?? models[0]?.id ?? "",
        efforts,
        effort: metadata?.currentThoughtLevelCode ?? efforts[0]?.id ?? "",
    };
}

/** The mode fields a message carries, for the choices currently made. */
export function relayMessageMode(
    choices: RelayChoices,
    model: string,
    effort: string,
): { model?: string; modelProviderId?: string; effort?: string } {
    const chosen = choices.models.find((candidate) => candidate.id === model);
    return {
        ...(chosen?.modelId ? { model: chosen.modelId } : chosen ? { model: chosen.id } : {}),
        ...(chosen?.providerId ? { modelProviderId: chosen.providerId } : {}),
        ...(effort ? { effort } : {}),
    };
}
