import { useCallback, useState } from "react";
import { t } from "kissopen-desktop-state";
import { Banner } from "../../Banner";
import { Modal } from "../../Modal";
import { Spinner } from "../../Spinner";
import { CustomProviderDialog, type CustomProviderDialogProps } from "./CustomProviderDialog";

export interface CustomProviderEditDialogProps extends Omit<CustomProviderDialogProps, "initial"> {
    onRead(
        signal: AbortSignal,
    ): Promise<{ provider: NonNullable<CustomProviderDialogProps["initial"]> }>;
}

/** C-708. Read only safe connection metadata; a saved key never enters the form. */
export function CustomProviderEditDialog(props: CustomProviderEditDialogProps) {
    const [state, setState] = useState<
        | { type: "loading" }
        | { type: "error"; message: string }
        | { type: "ready"; initial: NonNullable<CustomProviderDialogProps["initial"]> }
    >({ type: "loading" });
    const read = props.onRead;
    const attach = useCallback(
        (element: HTMLDivElement | null) => {
            if (!element) return;
            const controller = new AbortController();
            void read(controller.signal).then(
                (result) => {
                    if (!controller.signal.aborted)
                        setState({ type: "ready", initial: result.provider });
                },
                (error) => {
                    if (!controller.signal.aborted)
                        setState({
                            type: "error",
                            message: t(
                                error instanceof Error
                                    ? error.message
                                    : "Unable to load this provider.",
                            ),
                        });
                },
            );
            return () => controller.abort();
        },
        [read],
    );
    // Keep the read host mounted across loading/ready so success does not cancel itself.
    return (
        <div ref={attach}>
            {state.type === "ready" ? (
                <CustomProviderDialog {...props} initial={state.initial} />
            ) : (
                <Modal title={t("Edit provider")} size="medium" onClose={props.onClose}>
                    {state.type === "loading" ? (
                        <Spinner size={16} />
                    ) : (
                        <Banner title={t("Provider unavailable")} tone="danger">
                            {state.message}
                        </Banner>
                    )}
                </Modal>
            )}
        </div>
    );
}
