import { CustomModelReasoningDialog } from "../../src/pages/settings/CustomModelReasoningDialog";
import { ComponentPage, Specimen } from "../kit";
export const componentNumber = "C-707";
export function CustomModelReasoningDialogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Custom model reasoning"
            summary="Automatic model capabilities with advanced overrides for service defaults, protocol and levels."
        >
            {(["Automatic", "Default", "OpenAI", "DeepSeek", "Save error"] as const).map(
                (label) => (
                    <Specimen
                        key={label}
                        number={label}
                        label={label}
                        stage="surface"
                        detail="Automatic uses service metadata or an exact curated model ID. Explicit choices override it."
                    >
                        <CustomModelReasoningDialog
                            modelName="Example custom model"
                            reasoning={
                                label === "Automatic"
                                    ? undefined
                                    : label === "Default"
                                      ? null
                                      : label === "DeepSeek"
                                        ? {
                                              mode: "deepseek",
                                              efforts: ["off", "low", "high", "max"],
                                              defaultEffort: "high",
                                          }
                                        : {
                                              mode: "openai",
                                              efforts: ["low", "medium", "high"],
                                              defaultEffort: "low",
                                          }
                            }
                            allowAutomatic
                            onClose={() => {}}
                            onSave={async () => {
                                if (label === "Save error")
                                    throw new Error(
                                        "Unable to save reasoning settings. Try again.",
                                    );
                            }}
                        />
                    </Specimen>
                ),
            )}
        </ComponentPage>
    );
}
