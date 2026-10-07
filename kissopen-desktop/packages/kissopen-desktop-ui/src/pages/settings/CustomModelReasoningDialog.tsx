import { useState } from "react";
import { t } from "kissopen-desktop-state";
import { Banner } from "../../Banner";
import { Button } from "../../Button";
import { Checkbox } from "../../Checkbox";
import { Modal } from "../../Modal";
import { Select } from "../../Select";

export type CustomReasoningEffort = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type CustomModelReasoning =
    | {
          mode: "openai";
          efforts: CustomReasoningEffort[];
          defaultEffort: CustomReasoningEffort;
      }
    | {
          mode: "deepseek";
          efforts: ("off" | "low" | "high" | "max")[];
          defaultEffort: "off" | "low" | "high" | "max";
      };
const OPENAI_LEVELS: readonly CustomReasoningEffort[] = [
    "off",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
];
const DEEPSEEK_LEVELS = ["off", "low", "high", "max"] as const;
const LEVEL_LABELS: Record<CustomReasoningEffort, string> = {
    off: "Off",
    minimal: "Minimal",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra High",
    max: "Maximum",
};

export interface CustomModelReasoningDialogProps {
    modelName: string;
    reasoning?: CustomModelReasoning | null;
    /** Omission restores automatic resolution; null explicitly uses service defaults. */
    allowAutomatic?: boolean;
    onSave(reasoning: CustomModelReasoning | null | undefined): Promise<void>;
    onClose(): void;
}

/** C-707. A transient, explicit capability declaration, never inferred from the model ID. */
export function CustomModelReasoningDialog(props: CustomModelReasoningDialogProps) {
    const [mode, setMode] = useState<"automatic" | "default" | "openai" | "deepseek">(
        props.reasoning?.mode ??
            (props.allowAutomatic && props.reasoning === undefined ? "automatic" : "default"),
    );
    const [efforts, setEfforts] = useState<readonly CustomReasoningEffort[]>(
        props.reasoning?.efforts ?? [],
    );
    const [defaultEffort, setDefaultEffort] = useState<CustomReasoningEffort>(
        props.reasoning?.defaultEffort ?? "high",
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();
    const levels = mode === "deepseek" ? DEEPSEEK_LEVELS : OPENAI_LEVELS;
    const explicit = mode === "openai" || mode === "deepseek";
    const invalid = explicit && (!efforts.length || !efforts.includes(defaultEffort));
    const save = async () => {
        if (saving || invalid) return;
        setSaving(true);
        setError(undefined);
        // Narrow to protocol-supported levels without manufacturing any extra capability.
        const reasoning: CustomModelReasoning | null | undefined =
            mode === "automatic"
                ? undefined
                : mode === "default"
                  ? null
                  : mode === "deepseek"
                    ? {
                          mode,
                          efforts: DEEPSEEK_LEVELS.filter((level) => efforts.includes(level)),
                          defaultEffort:
                              DEEPSEEK_LEVELS.find((level) => level === defaultEffort) ?? "high",
                      }
                    : { mode, efforts: [...efforts], defaultEffort };
        try {
            await props.onSave(reasoning);
            props.onClose();
        } catch (reason) {
            setError(
                t(
                    reason instanceof Error
                        ? reason.message
                        : "Unable to save reasoning settings. Try again.",
                ),
            );
            setSaving(false);
        }
    };
    return (
        <Modal
            title={t("Reasoning configuration")}
            size="medium"
            onClose={saving ? undefined : props.onClose}
            footer={
                <>
                    <Button variant="ghost" disabled={saving} onClick={props.onClose}>
                        {t("Cancel")}
                    </Button>
                    <Button loading={saving} disabled={invalid} onClick={() => void save()}>
                        {t("Save")}
                    </Button>
                </>
            }
        >
            <div className="kissopen-custom-provider">
                <strong className="kissopen-custom-reasoning__name">{props.modelName}</strong>
                <Select
                    label={t("Reasoning protocol")}
                    fullWidth
                    disabled={saving}
                    value={mode}
                    options={[
                        ...(props.allowAutomatic
                            ? [{ value: "automatic", label: t("Automatic (recommended)") }]
                            : []),
                        { value: "default", label: t("Service default") },
                        { value: "openai", label: "OpenAI · reasoning_effort" },
                        { value: "deepseek", label: "DeepSeek · thinking" },
                    ]}
                    onValueChange={(value) => {
                        if (
                            value !== "automatic" &&
                            value !== "default" &&
                            value !== "openai" &&
                            value !== "deepseek"
                        )
                            return;
                        setMode(value);
                        setEfforts([]);
                        setDefaultEffort("high");
                        setError(undefined);
                    }}
                />
                <p className="kissopen-custom-provider__hint">
                    {mode === "automatic"
                        ? t(
                              "Effort follows the model automatically. Unknown models use the service default.",
                          )
                        : mode === "default"
                          ? t(
                                "No reasoning parameters are sent. The model service chooses its own default.",
                            )
                          : t(
                                "Select only levels supported by this model's API. Unsupported levels may be rejected by the service.",
                            )}
                </p>
                {explicit ? (
                    <>
                        <span>{t("Supported reasoning levels")}</span>
                        <div className="kissopen-custom-reasoning__levels">
                            {levels.map((level) => (
                                <Checkbox
                                    key={level}
                                    disabled={saving}
                                    label={t(LEVEL_LABELS[level])}
                                    checked={efforts.includes(level)}
                                    onChange={(checked) => {
                                        const next = checked
                                            ? [...efforts, level]
                                            : efforts.filter((entry) => entry !== level);
                                        setEfforts(next);
                                        if (!next.includes(defaultEffort) && next[0])
                                            setDefaultEffort(next[0]);
                                    }}
                                />
                            ))}
                        </div>
                        <Select
                            fullWidth
                            label={t("Default reasoning effort")}
                            disabled={saving || !efforts.length}
                            value={defaultEffort}
                            options={levels
                                .filter((level) => efforts.includes(level))
                                .map((level) => ({ value: level, label: t(LEVEL_LABELS[level]) }))}
                            onValueChange={(value) => {
                                const level = levels.find((candidate) => candidate === value);
                                if (level) setDefaultEffort(level);
                            }}
                        />
                        {!efforts.length ? (
                            <span className="kissopen-custom-provider__hint">
                                {t("Select at least one supported reasoning level.")}
                            </span>
                        ) : null}
                    </>
                ) : null}
                {error ? (
                    <Banner title={t("Couldn't save")} tone="danger">
                        {error}
                    </Banner>
                ) : null}
            </div>
        </Modal>
    );
}
