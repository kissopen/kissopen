import { CustomProviderEditDialog } from "../../src/pages/settings/CustomProviderEditDialog";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-708";
export function CustomProviderEditDialogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Edit custom provider"
            summary="Safe metadata loading, write-only key replacement, preserved selection and collapsed advanced reasoning overrides."
        >
            {["Ready", "Loading", "Unavailable"].map((label) => (
                <Specimen
                    key={label}
                    number={label}
                    label={label}
                    detail="Loading and errors never expose saved credentials."
                    stage="surface"
                >
                    <CustomProviderEditDialog
                        onClose={() => {}}
                        onRead={async (signal) => {
                            if (label === "Unavailable")
                                throw new Error("This custom provider is no longer available.");
                            if (label === "Loading")
                                return await new Promise((_, reject) =>
                                    signal.addEventListener(
                                        "abort",
                                        () => reject(new Error("Cancelled")),
                                        { once: true },
                                    ),
                                );
                            return {
                                provider: {
                                    name: "My model service",
                                    baseUrl: "https://example.com/v1",
                                    models: [{ id: "example-fast", name: "Example Fast" }],
                                },
                            };
                        }}
                        onDiscover={async () => ({
                            models: [
                                { id: "example-fast", name: "Example Fast" },
                                { id: "example-pro", name: "Example Pro" },
                            ],
                        })}
                        onSave={async () => {}}
                    />
                </Specimen>
            ))}
        </ComponentPage>
    );
}
