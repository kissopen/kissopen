import { useCallback, useRef, useState } from "react";
import { t } from "kissopen-desktop-state";
import { Banner } from "../../Banner";
import { Button } from "../../Button";
import { Checkbox } from "../../Checkbox";
import { Modal } from "../../Modal";
import { Spinner } from "../../Spinner";
import { TextField } from "../../TextField";
import { ModalOverlay } from "../../ModalOverlay";
import {
    CustomModelReasoningDialog,
    type CustomModelReasoning,
} from "./CustomModelReasoningDialog";

export interface CustomModelRow {
    readonly id: string;
    readonly name: string;
    readonly reasoning?: CustomModelReasoning | null;
    readonly discoveredReasoning?: CustomModelReasoning | null;
}
export interface CustomProviderInput {
    readonly baseUrl: string;
    readonly apiKey: string;
}
export interface CustomProviderDialogProps {
    initial?: { name: string; baseUrl: string; models: readonly CustomModelRow[] };
    onDiscover(
        input: CustomProviderInput,
        signal: AbortSignal,
    ): Promise<{ models: readonly CustomModelRow[] }>;
    onSave(input: CustomProviderInput & { name?: string; models: CustomModelRow[] }): Promise<void>;
    onClose(): void;
}

function invalidKey(value: string): boolean {
    const key = value.trim();
    return (
        key.length > 16384 ||
        Array.from(key).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
    );
}

/** C-706. Credentials live only in this transient form, never in a product snapshot. */
export function CustomProviderDialog(props: CustomProviderDialogProps) {
    const [name, setName] = useState(props.initial?.name ?? "");
    const [baseUrl, setBaseUrl] = useState(props.initial?.baseUrl ?? "");
    const [apiKey, setApiKey] = useState("");
    const [models, setModels] = useState<readonly CustomModelRow[]>(props.initial?.models ?? []);
    const [selected, setSelected] = useState<ReadonlySet<string>>(
        new Set(props.initial?.models.map((m) => m.id)),
    );
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(props.initial !== undefined);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();
    const [reasoningModelId, setReasoningModelId] = useState<string>();
    const [advanced, setAdvanced] = useState(false);
    const reasoningModel = models.find((model) => model.id === reasoningModelId);
    const nameError =
        name.trim().length > 80 ||
        Array.from(name).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
            ? t("Use up to 80 characters without line breaks or control characters.")
            : undefined;
    const urlError =
        baseUrl.trim() && !/^https?:\/\/\S+$/u.test(baseUrl.trim())
            ? t("Enter a valid API base URL, for example https://example.com/v1.")
            : undefined;
    const keyError = invalidKey(apiKey)
        ? t("Check the API Key: remove spaces and line breaks before connecting.")
        : undefined;
    const pending = useRef<{
        timer?: ReturnType<typeof setTimeout>;
        request?: AbortController;
        generation: number;
        mounted: boolean;
    }>({ generation: 0, mounted: true });
    const cancel = () => {
        const state = pending.current;
        state.generation++;
        clearTimeout(state.timer);
        state.request?.abort();
        delete state.timer;
        delete state.request;
    };
    // Keep the ref callback stable: ordinary form renders must not cancel the pending discovery.
    // Event-owned work is cancelled at the form's DOM lifetime, with no effect or secret store.
    const attach = useCallback((element: HTMLDivElement | null) => {
        if (!element) return;
        pending.current.mounted = true;
        return () => {
            const state = pending.current;
            state.mounted = false;
            state.generation++;
            clearTimeout(state.timer);
            state.request?.abort();
        };
    }, []);
    const discover = (url: string, key: string, delay = 800) => {
        const sameEndpoint = url.trim() === props.initial?.baseUrl;
        const previousModels =
            url.trim() === baseUrl.trim() && models.length
                ? models
                : sameEndpoint
                  ? props.initial!.models
                  : [];
        const previousSelected =
            url.trim() === baseUrl.trim() && loaded
                ? selected
                : new Set(sameEndpoint ? props.initial!.models.map((m) => m.id) : []);
        cancel();
        setModels([]);
        setSelected(new Set());
        setLoaded(false);
        setError(undefined);
        setLoading(false);
        if (
            (!key.trim() && (!props.initial || url.trim() !== props.initial.baseUrl)) ||
            invalidKey(key) ||
            !/^https?:\/\/\S+$/u.test(url.trim())
        )
            return;
        const generation = pending.current.generation;
        setLoading(true);
        pending.current.timer = setTimeout(() => {
            const request = new AbortController();
            pending.current.request = request;
            void props.onDiscover({ baseUrl: url.trim(), apiKey: key.trim() }, request.signal).then(
                (result) => {
                    if (!pending.current.mounted || generation !== pending.current.generation)
                        return;
                    setModels(
                        result.models.map((model) => {
                            const previous = previousModels.find(
                                (candidate) => candidate.id === model.id,
                            );
                            return previous?.reasoning === undefined
                                ? model
                                : { ...model, reasoning: previous.reasoning };
                        }),
                    );
                    if (props.initial)
                        setSelected(
                            new Set(
                                result.models
                                    .filter((model) => previousSelected.has(model.id))
                                    .map((model) => model.id),
                            ),
                        );
                    setLoaded(true);
                    setLoading(false);
                },
                (reason: unknown) => {
                    if (
                        !pending.current.mounted ||
                        generation !== pending.current.generation ||
                        request.signal.aborted
                    )
                        return;
                    setLoading(false);
                    setError(
                        t(
                            reason instanceof Error
                                ? reason.message
                                : "Unable to load models. Try again.",
                        ),
                    );
                },
            );
        }, delay);
    };
    const close = () => {
        if (saving) return;
        cancel();
        setApiKey("");
        props.onClose();
    };
    const save = () => {
        if (saving || loading || !selected.size || !loaded || nameError || urlError || keyError)
            return;
        setSaving(true);
        setError(undefined);
        void props
            .onSave({
                ...(name.trim() ? { name: name.trim() } : {}),
                baseUrl: baseUrl.trim(),
                apiKey: apiKey.trim(),
                models: models.filter((m) => selected.has(m.id)),
            })
            .then(
                () => {
                    if (pending.current.mounted) {
                        cancel();
                        setApiKey("");
                        props.onClose();
                    }
                },
                (reason: unknown) => {
                    if (pending.current.mounted) {
                        setSaving(false);
                        setError(
                            t(
                                reason instanceof Error
                                    ? reason.message
                                    : "Unable to save this provider. Try again.",
                            ),
                        );
                    }
                },
            );
    };
    return (
        <Modal
            title={t(props.initial ? "Edit provider" : "Add custom models")}
            size="large"
            onClose={saving ? undefined : close}
            footer={
                <>
                    <Button variant="ghost" disabled={saving} onClick={close}>
                        {t("Cancel")}
                    </Button>
                    <Button
                        loading={saving}
                        disabled={
                            loading ||
                            !loaded ||
                            !selected.size ||
                            !!nameError ||
                            !!urlError ||
                            !!keyError
                        }
                        onClick={save}
                    >
                        {t("Save selected models")}
                    </Button>
                </>
            }
        >
            <div className="kissopen-custom-provider" ref={attach}>
                <p>
                    {t(
                        "Connect an OpenAI-compatible service. Enter its API base URL and key to load models automatically.",
                    )}
                </p>
                <TextField
                    label={t("Provider name")}
                    placeholder={t("For example: My model service")}
                    hint={t(
                        "Optional. Shown in model selection and usage; defaults to the API hostname.",
                    )}
                    value={name}
                    error={nameError}
                    disabled={saving}
                    fullWidth
                    onValueChange={setName}
                />
                <TextField
                    autoFocus
                    label={t("API base URL")}
                    placeholder="https://example.com/v1"
                    value={baseUrl}
                    error={urlError}
                    disabled={saving}
                    fullWidth
                    onValueChange={(value) => {
                        setBaseUrl(value);
                        discover(value, apiKey);
                    }}
                />
                <TextField
                    label="API Key"
                    hint={
                        props.initial
                            ? t(
                                  "Leave blank to keep your saved API Key. Enter a new key when changing the URL.",
                              )
                            : undefined
                    }
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    error={keyError}
                    disabled={saving}
                    fullWidth
                    onValueChange={(value) => {
                        setApiKey(value);
                        discover(baseUrl, value);
                    }}
                />
                <span className="kissopen-custom-provider__hint">
                    {t(
                        "Your key stays in the local Agent and is never returned or sent to the account server.",
                    )}
                </span>
                {loading ? (
                    <div className="kissopen-custom-provider__status">
                        <Spinner size={16} />
                        {t("Loading available models…")}
                    </div>
                ) : null}
                {error ? (
                    <Banner title={t("Connection needs attention")} tone="danger">
                        {error}
                        <Button
                            variant="ghost"
                            size="small"
                            disabled={saving}
                            onClick={() => discover(baseUrl, apiKey, 0)}
                        >
                            {t("Try again")}
                        </Button>
                    </Banner>
                ) : null}
                {loaded && !models.length ? (
                    <Banner title={t("No models returned")} tone="neutral">
                        {t("Check whether this key has model access permissions.")}
                    </Banner>
                ) : null}
                {models.length ? (
                    <>
                        {props.initial ? (
                            <Button
                                variant="ghost"
                                size="small"
                                disabled={saving || loading}
                                onClick={() => discover(baseUrl, apiKey, 0)}
                            >
                                {t("Load available models")}
                            </Button>
                        ) : null}
                        <div className="kissopen-custom-provider__selection">
                            <Checkbox
                                checked={selected.size === models.length}
                                indeterminate={selected.size > 0 && selected.size < models.length}
                                disabled={saving}
                                label={t("Select all")}
                                onChange={(checked) =>
                                    setSelected(
                                        checked ? new Set(models.map((m) => m.id)) : new Set(),
                                    )
                                }
                            />
                            <span>{t("{count} selected", { count: selected.size })}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="small"
                            disabled={saving}
                            aria-expanded={advanced}
                            onClick={() => setAdvanced(!advanced)}
                        >
                            {t("Advanced settings")}
                        </Button>
                        <div className="kissopen-custom-provider__models">
                            {models.map((model) => (
                                <div className="kissopen-custom-provider__model-row" key={model.id}>
                                    <Checkbox
                                        checked={selected.has(model.id)}
                                        disabled={saving}
                                        label={
                                            model.name === model.id
                                                ? model.id
                                                : `${model.name} · ${model.id}`
                                        }
                                        onChange={(checked) =>
                                            setSelected((current) => {
                                                const next = new Set(current);
                                                if (checked) next.add(model.id);
                                                else next.delete(model.id);
                                                return next;
                                            })
                                        }
                                    />
                                    {advanced ? (
                                        <Button
                                            variant="ghost"
                                            size="small"
                                            disabled={saving}
                                            onClick={() => setReasoningModelId(model.id)}
                                        >
                                            {t("Reasoning configuration")}
                                        </Button>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </>
                ) : null}
            </div>
            {reasoningModel ? (
                <ModalOverlay>
                    <CustomModelReasoningDialog
                        key={reasoningModel.id}
                        modelName={reasoningModel.name}
                        reasoning={reasoningModel.reasoning}
                        allowAutomatic
                        onClose={() => setReasoningModelId(undefined)}
                        onSave={async (reasoning) => {
                            setModels((current) =>
                                current.map((model) =>
                                    model.id === reasoningModel.id
                                        ? { ...model, reasoning }
                                        : model,
                                ),
                            );
                        }}
                    />
                </ModalOverlay>
            ) : null}
        </Modal>
    );
}
