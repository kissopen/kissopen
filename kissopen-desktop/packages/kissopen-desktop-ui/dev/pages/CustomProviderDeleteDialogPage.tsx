import { CustomProviderDeleteDialog } from "../../src/pages/settings/CustomProviderDeleteDialog";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-709";
export function CustomProviderDeleteDialogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Delete custom provider"
            summary="Explicit confirmation preserves conversation and usage history and explains active-work cancellation."
        >
            {["Confirmation", "Failure"].map((label) => (
                <Specimen
                    key={label}
                    number={label}
                    label={label}
                    detail="Confirm removal or inspect a friendly failure without losing history."
                    stage="surface"
                >
                    <CustomProviderDeleteDialog
                        name="My model service"
                        onClose={() => {}}
                        onDelete={async () => {
                            if (label === "Failure")
                                throw new Error("Unable to delete this provider.");
                        }}
                    />
                </Specimen>
            ))}
        </ComponentPage>
    );
}
