import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { ScrollArea } from "./Scrollbar";
export type ModalSize = "small" | "medium" | "large";
export type ModalTone = "default" | "danger";
export type ModalProps = {
    className?: string;
    closeLabel?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    onClose?: () => void;
    size?: ModalSize;
    tone?: ModalTone;
    icon?: IconName;
};
/**
 * C-028 Modal — dialog card with header / body / footer on a raised surface.
 *
 * The root `.kissopen-modal` is a transparent centering layer (no scrim, no fixed
 * positioning) so the dialog renders as a screenshot-safe specimen; a consuming
 * app portals it over its own backdrop. The measured card is the inner
 * `data-kissopen-desktop-ui="modal-dialog"`: three fixed widths (360 / 480 / 640), a 14px
 * shell radius, header (optional leading icon chip + title + close), a scrollable
 * body slot, and an optional right-aligned footer action row.
 */
export function Modal(props: ModalProps) {
    const [local, rest] = partitionComponentProps(props, [
        "className",
        "closeLabel",
        "style",
        "title",
        "children",
        "footer",
        "onClose",
        "size",
        "tone",
        "icon",
    ]);
    const size = () => local.size ?? "medium";
    const tone = () => local.tone ?? "default";
    return (
        <div
            {...rest}
            className={["kissopen-modal", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="modal"
            style={local.style}
        >
            <div
                aria-label={local.title}
                aria-modal="true"
                className="kissopen-modal__dialog"
                data-kissopen-desktop-ui="modal-dialog"
                data-size={size()}
                data-tone={tone()}
                role="dialog"
            >
                <header className="kissopen-modal__header" data-kissopen-desktop-ui="modal-header">
                    {local.icon
                        ? ((name) => (
                              <span
                                  className="kissopen-modal__icon"
                                  data-kissopen-desktop-ui="modal-icon"
                              >
                                  <Icon name={name} size={16} />
                              </span>
                          ))(local.icon)
                        : null}
                    <h2 className="kissopen-modal__title" data-kissopen-desktop-ui="modal-title">
                        {local.title}
                    </h2>
                    {local.onClose ? (
                        <Button
                            aria-label={local.closeLabel ?? "Close"}
                            className="kissopen-modal__close"
                            icon="close"
                            iconOnly
                            onClick={() => local.onClose?.()}
                            size="small"
                            variant="ghost"
                        />
                    ) : null}
                </header>
                <ScrollArea
                    axes="both"
                    className="kissopen-modal__body"
                    data-kissopen-desktop-ui="modal-body"
                    viewportClassName="kissopen-modal__body-viewport"
                >
                    <div
                        className="kissopen-modal__body-content"
                        data-kissopen-desktop-ui="modal-body-content"
                    >
                        {local.children}
                    </div>
                </ScrollArea>
                {local.footer ? (
                    <footer
                        className="kissopen-modal__footer"
                        data-kissopen-desktop-ui="modal-footer"
                    >
                        {local.footer}
                    </footer>
                ) : null}
            </div>
        </div>
    );
}
