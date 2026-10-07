import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import {
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
} from "react";
import { Button } from "./Button";
import { ImageViewer } from "./ImageViewer";
import { ThemeScope } from "./ThemeScope";
import { VideoViewer } from "./VideoViewer";
import { Ionicon } from "./vectorIcons/VectorIcon";

type LightboxSharedProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    alt?: string;
    /** Primary label above the viewer — usually the file name. */
    caption?: string;
    /** Secondary meta above the frame — usually size / dimensions. */
    detail?: string;
    /** Trailing controls in the header, e.g. a download button. */
    actions?: ReactNode;
    /**
     * Where this media sits in the set it was opened from, counted from zero.
     * Given together with `onPrevious`/`onNext`, it is stated in the header so
     * the reader knows how much of the set is behind and ahead of them.
     */
    position?: { readonly index: number; readonly total: number };
    /** Wire both to step through a set; the header then carries its controls. */
    onPrevious?: () => void;
    onNext?: () => void;
    /** Singular noun used by the previous/next controls. Defaults to "image". */
    navigationLabel?: string;
    onClose?: () => void;
    closeLabel?: string;
};

export type LightboxProps = LightboxSharedProps &
    ({ imageUrl: string; videoUrl?: never } | { imageUrl?: never; videoUrl: string });
/**
 * C-046 Lightbox — full image or video preview shown inside a web modal (never
 * a new browser tab). It is not a card on a dim: hosted on `ModalOverlay`'s
 * `fill` placement it takes the whole app window and paints one flat dark over
 * it, so looking at media is a mode the window enters rather than a panel that
 * floats above a half-legible copy of the app. The root `.kissopen-lightbox`
 * still declares no scrim and no fixed position of its own, so it renders as a
 * screenshot-safe specimen in whatever box it is given; the measured surface
 * is the inner `data-kissopen-desktop-ui="lightbox-dialog"`: an optional
 * caption/detail + actions header above the shared viewer.
 *
 * The dark is the picture's own, not the appearance's: the surface is scoped to
 * the dark theme in either appearance, because a photograph is read against
 * black everywhere it is read seriously, and a white room around one is a lamp
 * pointed at the reader. Everything inside — the caption, the controls, the
 * viewer — takes its colours from that scope rather than from bespoke values.
 *
 * The media inside uses the same image and video viewers as file preview and
 * the separate preview window. Images keep the `immersive` tone because the
 * room is already this one; videos keep their own floating transport.
 *
 * A picture opened from a set is one of several: wire `onPrevious`/`onNext` and
 * the header carries controls for the set, its place in it, and the left and
 * right arrow keys. Those keys reach the viewer inside first, which keeps them
 * only while it has somewhere to pan — so an arrow moves within a magnified
 * picture and between pictures once the whole of one is on screen.
 */
export function Lightbox(props: LightboxProps) {
    const [local, rest] = partitionComponentProps(props, [
        "className",
        "style",
        "imageUrl",
        "videoUrl",
        "alt",
        "caption",
        "detail",
        "actions",
        "position",
        "onPrevious",
        "onNext",
        "navigationLabel",
        "onClose",
        "closeLabel",
    ]);
    const stepping = Boolean(local.onPrevious && local.onNext);
    const navigationLabel = local.navigationLabel ?? "image";
    const mediaName = local.alt ?? local.caption ?? (local.videoUrl ? "Video" : "Image");
    const hasHeader = () =>
        Boolean(local.caption || local.detail || local.actions || local.onClose || stepping);
    /**
     * The dark around the picture is the way out, as it is in every viewer that
     * takes the window: with the overlay's gutter gone, this surface is what a
     * click outside the card used to land on. Only the viewer's own frame counts
     * — the picture, the caption, and the controls are not "outside" — and only
     * while it has nothing to pan, because then the same press is a grip on a
     * magnified picture rather than a click on the room around it.
     */
    const click = (event: ReactMouseEvent<HTMLDivElement>): void => {
        if (!(event.target instanceof HTMLElement)) return;
        if (event.target.dataset.kissopenDesktopUi !== "image-viewer-frame") return;
        if (event.target.hasAttribute("data-pannable")) return;
        local.onClose?.();
    };
    const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
        // Not the viewer's key, and not a shortcut of the window's: only a bare
        // arrow the picture underneath had no use for steps through the set.
        if (!stepping || event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        if (event.key === "ArrowLeft") local.onPrevious?.();
        else if (event.key === "ArrowRight") local.onNext?.();
        else return;
        event.preventDefault();
    };
    return (
        <div
            {...rest}
            className={["kissopen-lightbox", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="lightbox"
            style={local.style}
        >
            <ThemeScope mode="dark">
                <div
                    aria-label={local.caption ?? local.alt ?? `${mediaName} preview`}
                    aria-modal="true"
                    className="kissopen-lightbox__dialog"
                    data-kissopen-desktop-ui="lightbox-dialog"
                    onClick={click}
                    onKeyDown={keyDown}
                    role="dialog"
                >
                    {hasHeader() ? (
                        <header
                            className="kissopen-lightbox__header"
                            data-kissopen-desktop-ui="lightbox-header"
                        >
                            <div
                                className="kissopen-lightbox__caption"
                                data-kissopen-desktop-ui="lightbox-caption"
                            >
                                {local.caption ? (
                                    <span
                                        className="kissopen-lightbox__caption-title"
                                        data-kissopen-desktop-ui="lightbox-caption-title"
                                    >
                                        {local.caption}
                                    </span>
                                ) : null}
                                {local.detail ? (
                                    <span
                                        className="kissopen-lightbox__caption-detail"
                                        data-kissopen-desktop-ui="lightbox-caption-detail"
                                    >
                                        {local.detail}
                                    </span>
                                ) : null}
                            </div>
                            <div
                                className="kissopen-lightbox__tools"
                                data-kissopen-desktop-ui="lightbox-tools"
                            >
                                {stepping ? (
                                    <Button
                                        aria-label={t("Previous {label}", {
                                            label: t(navigationLabel),
                                        })}
                                        iconOnly
                                        onClick={() => local.onPrevious?.()}
                                        size="small"
                                        variant="ghost"
                                    >
                                        <Ionicon name="chevron-back-outline" size={14} />
                                    </Button>
                                ) : null}
                                {stepping && local.position ? (
                                    <span
                                        className="kissopen-lightbox__position"
                                        data-kissopen-desktop-ui="lightbox-position"
                                    >
                                        {`${String(local.position.index + 1)} of ${String(local.position.total)}`}
                                    </span>
                                ) : null}
                                {stepping ? (
                                    <Button
                                        aria-label={t("Next {label}", {
                                            label: t(navigationLabel),
                                        })}
                                        iconOnly
                                        onClick={() => local.onNext?.()}
                                        size="small"
                                        variant="ghost"
                                    >
                                        <Ionicon name="chevron-forward-outline" size={14} />
                                    </Button>
                                ) : null}
                                {local.actions}
                                {local.onClose ? (
                                    <Button
                                        aria-label={local.closeLabel ?? "Close"}
                                        icon="close"
                                        iconOnly
                                        onClick={() => local.onClose?.()}
                                        size="small"
                                        variant="ghost"
                                    />
                                ) : null}
                            </div>
                        </header>
                    ) : null}
                    <div
                        className="kissopen-lightbox__frame"
                        data-kissopen-desktop-ui="lightbox-frame"
                    >
                        {local.videoUrl ? (
                            <VideoViewer
                                content={{ type: "url", url: local.videoUrl }}
                                name={mediaName}
                            />
                        ) : local.imageUrl !== undefined ? (
                            <ImageViewer
                                content={{ type: "url", url: local.imageUrl }}
                                name={mediaName}
                                tone="immersive"
                            />
                        ) : null}
                    </div>
                </div>
            </ThemeScope>
        </div>
    );
}
