import { t } from "kissopen-desktop-state";
import { Banner } from "../../Banner";
import { Box } from "../../Box";
import { Button } from "../../Button";
import { FormRow } from "../../FormRow";
import { Modal } from "../../Modal";
import { ModalOverlay } from "../../ModalOverlay";
import { Switch } from "../../Switch";
import { TextField } from "../../TextField";

export interface KissopenAgentSecretVariableDraft {
    readonly id: number;
    readonly name: string;
    readonly value: string;
}

export interface KissopenAgentSecretCreateDraft {
    readonly availableToAgents: boolean;
    readonly description: string;
    readonly nextVariableId: number;
    readonly variables: readonly KissopenAgentSecretVariableDraft[];
}

export interface KissopenAgentSecretCreateDialogProps {
    readonly attempted: boolean;
    readonly draft: KissopenAgentSecretCreateDraft;
    readonly error?: string;
    readonly submitting: boolean;
    readonly unavailable?: string;
    onAvailableToAgentsChange(value: boolean): void;
    onClose(): void;
    onDescriptionChange(value: string): void;
    onSubmit(): void;
    onVariableAdd(): void;
    onVariableNameChange(id: number, value: string): void;
    onVariableRemove(id: number): void;
    onVariableValueChange(id: number, value: string): void;
}

const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const DESCRIPTION_MAX_LENGTH = 2_000;
const ENVIRONMENT_NAME_MAX_LENGTH = 256;
const ENVIRONMENT_VALUE_MAX_LENGTH = 65_536;
export const KISSOPEN_AGENT_SECRET_ENVIRONMENT_MAX_VARIABLES = 256;

/** True when the complete draft satisfies the daemon's public create contract. */
export function kissopenAgentSecretCreateDraftValid(
    draft: KissopenAgentSecretCreateDraft,
): boolean {
    return (
        descriptionError(draft.description) === undefined &&
        draft.variables.length > 0 &&
        draft.variables.length <= KISSOPEN_AGENT_SECRET_ENVIRONMENT_MAX_VARIABLES &&
        draft.variables.every(
            (variable) =>
                variableNameError(variable.name, draft.variables) === undefined &&
                variableValueError(variable.value) === undefined,
        )
    );
}

/** The write-only create form hosted on the standard Settings modal layer. */
export function KissopenAgentSecretCreateDialog(props: KissopenAgentSecretCreateDialogProps) {
    const disabled = props.submitting || props.unavailable !== undefined;
    return (
        <ModalOverlay
            onDismiss={() => {
                if (!props.submitting) props.onClose();
            }}
        >
            <Modal
                footer={
                    <>
                        <Button disabled={props.submitting} onClick={props.onClose} variant="ghost">
                            {t("Cancel")}
                        </Button>
                        <Button
                            disabled={props.unavailable !== undefined}
                            loading={props.submitting}
                            onClick={props.onSubmit}
                        >
                            {t("Create secret")}
                        </Button>
                    </>
                }
                icon="lock"
                onClose={props.submitting ? undefined : props.onClose}
                size="medium"
                title={t("Create secret")}
            >
                <Box
                    className="kissopen-agent-secret-create"
                    data-kissopen-desktop-ui="kissopen-agent-secret-create"
                >
                    <Banner icon="lock" tone="neutral" title={t("Values stay hidden")}>
                        {t(
                            "Secret values are sent once and are never returned by KissOpen Agent or shown in this list.",
                        )}
                    </Banner>
                    {props.unavailable ? (
                        <Banner tone="neutral" title={t("KissOpen Agent unavailable")}>
                            {props.unavailable}
                        </Banner>
                    ) : null}
                    {props.error ? (
                        <Banner tone="danger" title={t("Secret not created")}>
                            {props.error}
                        </Banner>
                    ) : null}
                    <TextField
                        autoFocus
                        disabled={disabled}
                        error={
                            props.attempted ? descriptionError(props.draft.description) : undefined
                        }
                        fullWidth
                        label={t("Description")}
                        onSubmit={props.onSubmit}
                        onValueChange={props.onDescriptionChange}
                        placeholder={t("Production deploy credentials")}
                        value={props.draft.description}
                    />
                    <fieldset className="kissopen-agent-secret-create__environment">
                        <legend>{t("Environment variables")}</legend>
                        <p>
                            {t(
                                "Add the variable names agents receive and the write-only values to store under them.",
                            )}
                        </p>
                        <Box className="kissopen-agent-secret-create__variables">
                            {props.draft.variables.map((variable) => (
                                <Box
                                    className="kissopen-agent-secret-create__variable"
                                    data-kissopen-desktop-ui="kissopen-agent-secret-create-variable"
                                    key={variable.id}
                                >
                                    <TextField
                                        autoComplete="off"
                                        disabled={disabled}
                                        error={
                                            props.attempted
                                                ? variableNameError(
                                                      variable.name,
                                                      props.draft.variables,
                                                  )
                                                : undefined
                                        }
                                        fullWidth
                                        label={t("Variable name")}
                                        onSubmit={props.onSubmit}
                                        onValueChange={(value) =>
                                            props.onVariableNameChange(variable.id, value)
                                        }
                                        placeholder="API_TOKEN"
                                        value={variable.name}
                                    />
                                    <TextField
                                        autoComplete="new-password"
                                        disabled={disabled}
                                        error={
                                            props.attempted
                                                ? variableValueError(variable.value)
                                                : undefined
                                        }
                                        fullWidth
                                        label={t("Secret value")}
                                        onSubmit={props.onSubmit}
                                        onValueChange={(value) =>
                                            props.onVariableValueChange(variable.id, value)
                                        }
                                        placeholder={t("Enter value")}
                                        type="password"
                                        value={variable.value}
                                    />
                                    <Box className="kissopen-agent-secret-create__remove">
                                        <Button
                                            aria-label={t("Remove {name}", {
                                                name: variable.name || t("environment variable"),
                                            })}
                                            disabled={
                                                disabled || props.draft.variables.length === 1
                                            }
                                            icon="trash"
                                            iconOnly
                                            onClick={() => props.onVariableRemove(variable.id)}
                                            size="medium"
                                            variant="ghost"
                                        />
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                        <Button
                            disabled={
                                disabled ||
                                props.draft.variables.length >=
                                    KISSOPEN_AGENT_SECRET_ENVIRONMENT_MAX_VARIABLES
                            }
                            icon="plus"
                            onClick={props.onVariableAdd}
                            size="small"
                            variant="ghost"
                        >
                            {t("Add variable")}
                        </Button>
                    </fieldset>
                    <FormRow
                        control={
                            <Switch
                                aria-label={t("Available to every agent")}
                                checked={props.draft.availableToAgents}
                                disabled={disabled}
                                id="kissopen-agent-secret-create-available"
                                onChange={props.onAvailableToAgentsChange}
                            />
                        }
                        description={t(
                            "When off, the secret stays stored until scoped access is granted to a project, workspace, or agent.",
                        )}
                        htmlFor="kissopen-agent-secret-create-available"
                        label={t("Available to every agent")}
                    />
                </Box>
            </Modal>
        </ModalOverlay>
    );
}

function descriptionError(description: string): string | undefined {
    if (description.trim().length === 0) return "Enter a description.";
    if (description.length > DESCRIPTION_MAX_LENGTH)
        return t("Use {value} characters or fewer.", { value: String(DESCRIPTION_MAX_LENGTH) });
    return undefined;
}

function variableNameError(
    name: string,
    variables: readonly KissopenAgentSecretVariableDraft[],
): string | undefined {
    if (name.length === 0) return "Enter a variable name.";
    if (name.length > ENVIRONMENT_NAME_MAX_LENGTH)
        return t("Use {value} characters or fewer.", {
            value: String(ENVIRONMENT_NAME_MAX_LENGTH),
        });
    if (!ENVIRONMENT_NAME.test(name))
        return "Use letters, numbers, and underscores, starting with a letter or underscore.";
    if (variables.filter((variable) => variable.name === name).length > 1)
        return "Each variable name must be unique.";
    return undefined;
}

function variableValueError(value: string): string | undefined {
    if (value.includes("\0")) return "Secret values cannot contain a null character.";
    if (value.length > ENVIRONMENT_VALUE_MAX_LENGTH)
        return t("Use {value} characters or fewer.", {
            value: String(ENVIRONMENT_VALUE_MAX_LENGTH),
        });
    return undefined;
}
