import { t } from "kissopen-desktop-state";
import { useState } from "react";
import { Badge } from "../../Badge";
import { Banner } from "../../Banner";
import { Box } from "../../Box";
import { Button } from "../../Button";
import { EmptyState } from "../../EmptyState";
import { FormRow } from "../../FormRow";
import { Icon } from "../../Icon";
import { Spinner } from "../../Spinner";
import {
    KissopenAgentSecretCreateDialog,
    kissopenAgentSecretCreateDraftValid,
    type KissopenAgentSecretCreateDraft,
} from "./KissopenAgentSecretCreateDialog";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export interface KissopenAgentSecretRow {
    readonly availableToAgents: boolean;
    readonly description: string;
    readonly environmentVariables: readonly string[];
    readonly id: string;
    readonly managed: boolean;
    /** Already localized by the application boundary. */
    readonly updatedAt: string;
}

export interface KissopenAgentSecretCreateInput {
    readonly availableToAgents: boolean;
    readonly description: string;
    readonly environmentVariables: readonly {
        readonly name: string;
        readonly value: string;
    }[];
}

export interface KissopenAgentSecretSettingsProps {
    readonly error?: string;
    /** Opens the transient create form on first render, for restored/fixture state. */
    readonly initialCreateOpen?: boolean;
    readonly loading?: boolean;
    readonly secrets: readonly KissopenAgentSecretRow[];
    readonly unavailable?: string;
    onSecretCreate(input: KissopenAgentSecretCreateInput): Promise<void>;
}

const createDraft = (): KissopenAgentSecretCreateDraft => ({
    availableToAgents: false,
    description: "",
    nextVariableId: 2,
    variables: [{ id: 1, name: "", value: "" }],
});

/** Global secret metadata and the write-only flow for creating one. */
export function KissopenAgentSecretSettings(props: KissopenAgentSecretSettingsProps) {
    const [draft, setDraft] = useState<KissopenAgentSecretCreateDraft | undefined>(() =>
        props.initialCreateOpen ? createDraft() : undefined,
    );
    const [attempted, setAttempted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string>();
    const close = () => {
        if (submitting) return;
        setDraft(undefined);
        setAttempted(false);
        setSubmitError(undefined);
    };
    const change = (
        update: (current: KissopenAgentSecretCreateDraft) => KissopenAgentSecretCreateDraft,
    ) => {
        setDraft((current) => (current === undefined ? current : update(current)));
        setSubmitError(undefined);
    };
    const submit = () => {
        if (draft === undefined || submitting) return;
        setAttempted(true);
        if (!kissopenAgentSecretCreateDraftValid(draft) || props.unavailable !== undefined) return;
        setSubmitting(true);
        setSubmitError(undefined);
        void Promise.resolve()
            .then(() =>
                props.onSecretCreate({
                    availableToAgents: draft.availableToAgents,
                    description: draft.description.trim(),
                    environmentVariables: draft.variables.map(({ name, value }) => ({
                        name,
                        value,
                    })),
                }),
            )
            .then(
                () => {
                    setSubmitting(false);
                    setDraft(undefined);
                    setAttempted(false);
                },
                (error: unknown) => {
                    setSubmitting(false);
                    setSubmitError(error instanceof Error ? error.message : String(error));
                },
            );
    };
    return (
        <>
            {props.unavailable ? (
                <Banner tone="neutral" title={t("KissOpen Agent reconnecting")}>
                    {props.unavailable}
                </Banner>
            ) : null}
            <KissopenAgentSettingsSection>
                <FormRow
                    control={
                        <Button
                            disabled={props.unavailable !== undefined}
                            icon="plus"
                            onClick={() => {
                                setDraft(createDraft());
                                setAttempted(false);
                                setSubmitError(undefined);
                            }}
                            title={props.unavailable}
                        >
                            {t("New secret")}
                        </Button>
                    }
                    description={t(
                        "Bundle one or more environment variables. Values are write-only; KissOpen Agent returns metadata, never the stored values.",
                    )}
                    label={t("Saved secrets")}
                />
            </KissopenAgentSettingsSection>
            {props.error ? (
                <Banner tone="danger" title={t("Secrets unavailable")}>
                    {props.error}
                </Banner>
            ) : props.loading ? (
                <Box className="kissopen-agent-settings__pending">
                    <Spinner size={16} />
                    <span>{t("Reading secrets…")}</span>
                </Box>
            ) : props.secrets.length === 0 ? (
                <EmptyState
                    description={t(
                        "Create a write-only environment bundle for agents on this KissOpen Agent.",
                    )}
                    icon="lock"
                    size="inline"
                    title={t("No secrets yet")}
                />
            ) : (
                <KissopenAgentSettingsSection rows="cards" title={t("Environment bundles")}>
                    {props.secrets.map((secret) => (
                        <article
                            className="kissopen-agent-secret"
                            data-kissopen-desktop-ui="kissopen-agent-secret"
                            key={secret.id}
                        >
                            <header className="kissopen-agent-secret__header">
                                <span
                                    className="kissopen-agent-secret__glyph"
                                    data-kissopen-desktop-ui="kissopen-agent-secret-glyph"
                                >
                                    <Icon name="lock" size={16} />
                                </span>
                                <Box className="kissopen-agent-secret__identity">
                                    <span
                                        className="kissopen-agent-secret__description"
                                        data-kissopen-desktop-ui="kissopen-agent-secret-description"
                                    >
                                        {secret.description}
                                    </span>
                                    <span
                                        className="kissopen-agent-secret__updated"
                                        data-kissopen-desktop-ui="kissopen-agent-secret-updated"
                                    >
                                        {t("Updated {time}", { time: secret.updatedAt })}
                                    </span>
                                </Box>
                                <Box className="kissopen-agent-secret__badges">
                                    {secret.managed ? (
                                        <Badge label={t("Managed")} variant="neutral" />
                                    ) : null}
                                    <Badge
                                        label={secret.availableToAgents ? "All agents" : "Scoped"}
                                        variant={secret.availableToAgents ? "success" : "outline"}
                                    />
                                </Box>
                            </header>
                            <Box
                                aria-label={t("Environment variables")}
                                className="kissopen-agent-secret__variables"
                            >
                                {secret.environmentVariables.map((name) => (
                                    <code
                                        className="kissopen-agent-secret__variable"
                                        data-kissopen-desktop-ui="kissopen-agent-secret-variable"
                                        key={name}
                                    >
                                        {name}
                                    </code>
                                ))}
                            </Box>
                        </article>
                    ))}
                </KissopenAgentSettingsSection>
            )}
            {draft === undefined ? null : (
                <KissopenAgentSecretCreateDialog
                    attempted={attempted}
                    draft={draft}
                    error={submitError}
                    onAvailableToAgentsChange={(availableToAgents) =>
                        change((current) => ({ ...current, availableToAgents }))
                    }
                    onClose={close}
                    onDescriptionChange={(description) =>
                        change((current) => ({ ...current, description }))
                    }
                    onSubmit={submit}
                    onVariableAdd={() =>
                        change((current) => ({
                            ...current,
                            nextVariableId: current.nextVariableId + 1,
                            variables: [
                                ...current.variables,
                                { id: current.nextVariableId, name: "", value: "" },
                            ],
                        }))
                    }
                    onVariableNameChange={(id, name) =>
                        change((current) => ({
                            ...current,
                            variables: current.variables.map((variable) =>
                                variable.id === id ? { ...variable, name } : variable,
                            ),
                        }))
                    }
                    onVariableRemove={(id) =>
                        change((current) => ({
                            ...current,
                            variables: current.variables.filter((variable) => variable.id !== id),
                        }))
                    }
                    onVariableValueChange={(id, value) =>
                        change((current) => ({
                            ...current,
                            variables: current.variables.map((variable) =>
                                variable.id === id ? { ...variable, value } : variable,
                            ),
                        }))
                    }
                    submitting={submitting}
                    unavailable={props.unavailable}
                />
            )}
        </>
    );
}
