import { t } from "kissopen-desktop-state";
import { useState } from "react";
import { Button } from "../../Button";
import { ModalOverlay } from "../../ModalOverlay";
import { CustomProviderDialog, type CustomProviderDialogProps } from "./CustomProviderDialog";
import {
    CustomProviderEditDialog,
    type CustomProviderEditDialogProps,
} from "./CustomProviderEditDialog";
import { CustomProviderDeleteDialog } from "./CustomProviderDeleteDialog";
import type { CustomModelReasoning } from "./CustomModelReasoningDialog";
import { Badge, type BadgeVariant } from "../../Badge";
import { Banner } from "../../Banner";
import { Box } from "../../Box";
import { EmptyState } from "../../EmptyState";
import { Icon } from "../../Icon";
import { Spinner } from "../../Spinner";
import { Switch } from "../../Switch";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

/** Why a provider is or is not usable, straight from the daemon's catalog. */
export type KissopenAgentProviderStatus =
    | "ready"
    | "not_authenticated"
    | "not_enabled"
    | "no_models";

export interface KissopenAgentProviderModelRow {
    readonly customReasoning?: CustomModelReasoning | null;
    /** Stable row key, `${providerId}:${modelId}`. */
    readonly id: string;
    readonly name: string;
    /** The model's own identifier, shown as the machine-readable subtitle. */
    readonly modelId: string;
    readonly enabled: boolean;
    /** The workspace default; it is offered even when the rest are switched off. */
    readonly isDefault: boolean;
    readonly contextWindow?: number;
    /** Reasoning levels this model exposes, already labelled. */
    readonly efforts: readonly string[];
}

export interface KissopenAgentProviderRow {
    readonly custom?: boolean;
    readonly id: string;
    readonly name: string;
    readonly status: KissopenAgentProviderStatus;
    /** Whether the machine will use this provider at all. */
    readonly enabled: boolean;
    /** A requested enablement change the machine has not confirmed yet. */
    readonly saving?: boolean;
    readonly models: readonly KissopenAgentProviderModelRow[];
    /** Service tiers the provider offers, already labelled. */
    readonly serviceTiers: readonly string[];
}

export type KissopenAgentProviderSettingsProps = {
    onCustomRead?(
        providerId: string,
        signal: AbortSignal,
    ): ReturnType<CustomProviderEditDialogProps["onRead"]>;
    onCustomDiscoverExisting?(
        providerId: string,
        input: Parameters<CustomProviderDialogProps["onDiscover"]>[0],
        signal: AbortSignal,
    ): ReturnType<CustomProviderDialogProps["onDiscover"]>;
    onCustomUpdate?(
        providerId: string,
        input: Parameters<CustomProviderDialogProps["onSave"]>[0],
    ): Promise<void>;
    onCustomDelete?(providerId: string): Promise<void>;
    onCustomDiscover?: CustomProviderDialogProps["onDiscover"];
    onCustomSave?: CustomProviderDialogProps["onSave"];
    providers: readonly KissopenAgentProviderRow[];
    loading?: boolean;
    error?: string;
    /** Why the last provider change was refused. */
    saveError?: string;
    /** Why model enablement cannot currently be changed. */
    unavailable?: string;
    onModelEnabledChange: (id: string, enabled: boolean) => void;
    /** Switches one whole provider on or off for the machine. */
    onProviderEnabledChange: (id: string, enabled: boolean) => void;
};

const STATUS_LABELS: Record<KissopenAgentProviderStatus, string> = {
    ready: "Connected",
    not_authenticated: "Not signed in",
    not_enabled: "Disabled",
    no_models: "No models",
};

const STATUS_VARIANTS: Record<KissopenAgentProviderStatus, BadgeVariant> = {
    ready: "success",
    not_authenticated: "warning",
    not_enabled: "neutral",
    no_models: "neutral",
};

/** What has to happen in Kissopen Agent itself before the provider's models become usable. */
const STATUS_HINTS: Partial<Record<KissopenAgentProviderStatus, string>> = {
    not_authenticated: "Sign this provider in from KissOpen Agent to use its models.",
    not_enabled: "Switched off on this machine, so no agent here may use it.",
};

/**
 * The Providers category: every provider the daemon knows about, whether it is
 * usable, and which of its models the session pickers may offer. A provider that
 * is not signed in or switched off still lists its models — knowing what would be
 * available is the reason to go and connect it.
 */
export function KissopenAgentProviderSettings(props: KissopenAgentProviderSettingsProps) {
    const [customOpen, setCustomOpen] = useState(false);
    const [editing, setEditing] = useState<{
        id: string;
        read: CustomProviderEditDialogProps["onRead"];
    }>();
    const [deleting, setDeleting] = useState<{ id: string; name: string }>();
    if (props.error)
        return (
            <Banner tone="danger" title={t("Providers unavailable")}>
                {props.error}
            </Banner>
        );
    if (props.loading)
        return (
            <Box className="kissopen-agent-settings__pending">
                <Spinner size={16} />
                <span>{t("Reading the model catalog…")}</span>
            </Box>
        );
    return (
        <>
            {editing && props.onCustomDiscoverExisting && props.onCustomUpdate ? (
                <ModalOverlay>
                    <CustomProviderEditDialog
                        key={editing.id}
                        onRead={editing.read}
                        onClose={() => setEditing(undefined)}
                        onDiscover={(input, signal) =>
                            props.onCustomDiscoverExisting!(editing.id, input, signal)
                        }
                        onSave={(input) => props.onCustomUpdate!(editing.id, input)}
                    />
                </ModalOverlay>
            ) : null}
            {deleting && props.onCustomDelete ? (
                <ModalOverlay>
                    <CustomProviderDeleteDialog
                        name={deleting.name}
                        onClose={() => setDeleting(undefined)}
                        onDelete={() => props.onCustomDelete!(deleting.id)}
                    />
                </ModalOverlay>
            ) : null}
            {props.onCustomDiscover && props.onCustomSave ? (
                <Box className="kissopen-custom-provider__toolbar">
                    <Button
                        icon="plus"
                        disabled={props.unavailable !== undefined}
                        onClick={() => setCustomOpen(true)}
                    >
                        {t("Add custom models")}
                    </Button>
                </Box>
            ) : null}
            {customOpen && props.onCustomDiscover && props.onCustomSave ? (
                <ModalOverlay>
                    <CustomProviderDialog
                        onDiscover={props.onCustomDiscover}
                        onSave={props.onCustomSave}
                        onClose={() => setCustomOpen(false)}
                    />
                </ModalOverlay>
            ) : null}
            {props.providers.length === 0 ? (
                <EmptyState
                    description={t("This KissOpen Agent daemon reports no model providers yet.")}
                    icon="globe"
                    title={t("No providers")}
                />
            ) : null}
            {props.unavailable ? (
                <Banner tone="neutral" title={t("KissOpen Agent reconnecting")}>
                    {props.unavailable}
                </Banner>
            ) : null}
            {props.saveError ? (
                <Banner tone="danger" title={t("Provider unchanged")}>
                    {props.saveError}
                </Banner>
            ) : null}
            <KissopenAgentSettingsSection
                description={t(
                    "Switching a provider off stops every agent on this machine from using it. Switching off one model only keeps it out of this window's session pickers.",
                )}
                rows="cards"
                title={t("Model providers")}
            >
                {props.providers.map((provider) => (
                    <article
                        className="kissopen-agent-provider"
                        data-kissopen-desktop-ui="kissopen-agent-provider"
                        data-status={provider.status}
                        key={provider.id}
                    >
                        <header className="kissopen-agent-provider__header">
                            <Box className="kissopen-agent-provider__identity">
                                <span
                                    className="kissopen-agent-provider__glyph"
                                    data-kissopen-desktop-ui="kissopen-agent-provider-glyph"
                                >
                                    <Icon name="globe" size={16} />
                                </span>
                                <Box className="kissopen-agent-provider__naming">
                                    <span
                                        className="kissopen-agent-provider__name"
                                        data-kissopen-desktop-ui="kissopen-agent-provider-name"
                                    >
                                        {provider.name}
                                    </span>
                                    <span
                                        className="kissopen-agent-provider__meta"
                                        data-kissopen-desktop-ui="kissopen-agent-provider-meta"
                                    >
                                        {providerMeta(provider)}
                                    </span>
                                </Box>
                            </Box>
                            <Badge
                                label={t(STATUS_LABELS[provider.status])}
                                variant={STATUS_VARIANTS[provider.status]}
                            />
                            {provider.saving ? <Spinner size={16} /> : null}
                            {provider.custom && props.onCustomRead && props.onCustomUpdate ? (
                                <Button
                                    size="small"
                                    variant="ghost"
                                    disabled={props.unavailable !== undefined || provider.saving}
                                    onClick={() =>
                                        setEditing({
                                            id: provider.id,
                                            read: (signal) =>
                                                props.onCustomRead!(provider.id, signal),
                                        })
                                    }
                                >
                                    {t("Edit")}
                                </Button>
                            ) : null}
                            {provider.custom && props.onCustomDelete ? (
                                <Button
                                    size="small"
                                    variant="ghost"
                                    disabled={props.unavailable !== undefined || provider.saving}
                                    onClick={() =>
                                        setDeleting({ id: provider.id, name: provider.name })
                                    }
                                >
                                    {t("Delete")}
                                </Button>
                            ) : null}
                            <Switch
                                aria-label={t("{name} enabled", { name: provider.name })}
                                checked={provider.enabled}
                                disabled={props.unavailable !== undefined || provider.saving}
                                onChange={(enabled) =>
                                    props.onProviderEnabledChange(provider.id, enabled)
                                }
                            />
                        </header>
                        <Box className="kissopen-agent-provider__models">
                            {provider.models.map((model) => (
                                <Box
                                    className="kissopen-agent-provider__model"
                                    data-kissopen-desktop-ui="kissopen-agent-provider-model"
                                    key={model.id}
                                >
                                    <Box className="kissopen-agent-provider__model-text">
                                        <Box className="kissopen-agent-provider__model-title">
                                            <span
                                                className="kissopen-agent-provider__model-name"
                                                data-kissopen-desktop-ui="kissopen-agent-provider-model-name"
                                            >
                                                {model.name}
                                            </span>
                                            {model.isDefault ? (
                                                <Badge label={t("Default")} variant="accent" />
                                            ) : null}
                                        </Box>
                                        <span
                                            className="kissopen-agent-provider__model-meta"
                                            data-kissopen-desktop-ui="kissopen-agent-provider-model-meta"
                                        >
                                            {modelMeta(model)}
                                        </span>
                                    </Box>
                                    <Switch
                                        aria-label={t("{name} enabled", { name: model.name })}
                                        checked={model.enabled}
                                        disabled={
                                            props.unavailable !== undefined ||
                                            model.isDefault ||
                                            provider.status !== "ready"
                                        }
                                        onChange={(enabled) =>
                                            props.onModelEnabledChange(model.id, enabled)
                                        }
                                    />
                                </Box>
                            ))}
                            {provider.models.length === 0 ? (
                                <span
                                    className="kissopen-agent-provider__models-empty"
                                    data-kissopen-desktop-ui="kissopen-agent-provider-models-empty"
                                >
                                    {t("This provider offers no models right now.")}
                                </span>
                            ) : null}
                        </Box>
                        {STATUS_HINTS[provider.status] ? (
                            <p
                                className="kissopen-agent-provider__hint"
                                data-kissopen-desktop-ui="kissopen-agent-provider-hint"
                            >
                                {t(STATUS_HINTS[provider.status] ?? "")}
                            </p>
                        ) : null}
                    </article>
                ))}
            </KissopenAgentSettingsSection>
        </>
    );
}

function providerMeta(provider: KissopenAgentProviderRow): string {
    const models =
        provider.models.length === 1
            ? t("1 model")
            : t("{count} models", { count: provider.models.length });
    return provider.serviceTiers.length > 0
        ? `${models} · ${provider.serviceTiers.join(", ")}`
        : models;
}

function modelMeta(model: KissopenAgentProviderModelRow): string {
    const parts = [model.modelId];
    if (model.contextWindow !== undefined)
        parts.push(t("{size}K context", { size: Math.round(model.contextWindow / 1000) }));
    if (model.efforts.length > 0) parts.push(model.efforts.join(" · "));
    return parts.join("  —  ");
}
