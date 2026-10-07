import { CustomProviderDialog } from "../../src/pages/settings/CustomProviderDialog";
import { ComponentPage, Specimen } from "../kit";
export const componentNumber = "C-706";
export function CustomProviderDialogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Custom models"
            summary="Optional provider display name, write-only credentials, bounded discovery and explicit multi-selection."
        >
            {["Models", "Empty", "Rejected key", "Loading", "Save error"].map((label) => (
                <Specimen
                    key={label}
                    number={label}
                    label={label}
                    stage="surface"
                    detail="Enter a URL and key to exercise discovery and selection"
                >
                    <CustomProviderDialog
                        onClose={() => {}}
                        onDiscover={async (_input, signal) => {
                            if (label === "Rejected key")
                                throw new Error(
                                    "The API Key was rejected. Check the key and its model access permissions.",
                                );
                            if (label === "Loading")
                                return await new Promise((_, reject) =>
                                    signal.addEventListener(
                                        "abort",
                                        () => reject(new Error("Cancelled")),
                                        { once: true },
                                    ),
                                );
                            return {
                                models:
                                    label === "Empty"
                                        ? []
                                        : [
                                              { id: "example-fast", name: "Example Fast" },
                                              { id: "example-pro", name: "Example Pro" },
                                          ],
                            };
                        }}
                        onSave={async () => {
                            if (label === "Save error")
                                throw new Error("Unable to save this provider. Try again.");
                        }}
                    />
                </Specimen>
            ))}
        </ComponentPage>
    );
}
