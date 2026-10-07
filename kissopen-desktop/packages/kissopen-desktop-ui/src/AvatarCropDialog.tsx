import { t } from "kissopen-desktop-state";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export type AvatarCropDialogProps = {
    /** An address for the chosen picture, such as an object URL. */
    imageUrl: string;
    /** Resolves once the new avatar is saved; a rejection's message is shown. */
    onSave: (data: string, mime: "image/jpeg") => Promise<void>;
    onCancel: () => void;
};

/** The square the picture is framed in, and the square it is saved as. */
const STAGE = 320;
const OUTPUT = 512;
const ZOOM_MAX = 3;

/**
 * C-288 AvatarCropDialog — frame a picture as an avatar before it is saved.
 *
 * The picture starts covering the square, as large as it needs to be and no
 * larger; zoom enlarges it, dragging moves it, and it can never be dragged far
 * enough to leave a gap. The circle shows what the avatar will show. Saving
 * draws exactly that square into a 512px JPEG in the browser, so what is
 * uploaded is what was framed, and a phone photo does not travel whole.
 */
export function AvatarCropDialog(props: AvatarCropDialogProps) {
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [natural, setNatural] = useState<{ w: number; h: number }>();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const image = useRef<HTMLImageElement | null>(null);
    const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | undefined>(
        undefined,
    );

    // Scale at zoom 1: the picture just covers the square.
    const base = natural ? Math.max(STAGE / natural.w, STAGE / natural.h) : 1;
    const clamp = (next: { x: number; y: number }, z = zoom) => {
        if (!natural) return next;
        const maxX = Math.max(0, (natural.w * base * z - STAGE) / 2);
        const maxY = Math.max(0, (natural.h * base * z - STAGE) / 2);
        return {
            x: Math.min(maxX, Math.max(-maxX, next.x)),
            y: Math.min(maxY, Math.max(-maxY, next.y)),
        };
    };
    const zoomTo = (z: number) => {
        setZoom(z);
        setOffset((current) => clamp(current, z));
    };
    const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, from: offset };
    };
    const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const start = drag.current;
        if (!start) return;
        setOffset(
            clamp({
                x: start.from.x + event.clientX - start.x,
                y: start.from.y + event.clientY - start.y,
            }),
        );
    };
    const pointerUp = () => {
        drag.current = undefined;
    };
    const save = async () => {
        const img = image.current;
        if (!img || !natural || saving) return;
        const canvas = document.createElement("canvas");
        canvas.width = OUTPUT;
        canvas.height = OUTPUT;
        const context = canvas.getContext("2d");
        if (!context) return;
        const k = OUTPUT / STAGE;
        context.translate(OUTPUT / 2 + offset.x * k, OUTPUT / 2 + offset.y * k);
        context.scale(base * zoom * k, base * zoom * k);
        context.drawImage(img, -natural.w / 2, -natural.h / 2);
        const data = canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "";
        setSaving(true);
        setError("");
        try {
            await props.onSave(data, "image/jpeg");
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : t("头像没有保存成功"));
        } finally {
            setSaving(false);
        }
    };
    return (
        <Modal
            className="kissopen-avatar-crop"
            closeLabel={t("取消")}
            footer={
                <>
                    {error && (
                        <span className="kissopen-avatar-crop__error" role="alert">
                            {error}
                        </span>
                    )}
                    <Button
                        disabled={saving}
                        onClick={props.onCancel}
                        size="medium"
                        variant="ghost"
                    >
                        {t("取消")}
                    </Button>
                    <Button
                        disabled={!natural}
                        loading={saving}
                        onClick={() => void save()}
                        size="medium"
                        variant="primary"
                    >
                        {t("保存")}
                    </Button>
                </>
            }
            onClose={props.onCancel}
            size="large"
            title={t("调整头像")}
        >
            <div className="kissopen-avatar-crop__body">
                <div
                    className="kissopen-avatar-crop__stage"
                    data-kissopen-desktop-ui="avatar-crop-stage"
                    onPointerCancel={pointerUp}
                    onPointerDown={pointerDown}
                    onPointerMove={pointerMove}
                    onPointerUp={pointerUp}
                    style={{ width: STAGE, height: STAGE }}
                >
                    <img
                        alt=""
                        className="kissopen-avatar-crop__image"
                        draggable={false}
                        onLoad={(event) =>
                            setNatural({
                                w: event.currentTarget.naturalWidth,
                                h: event.currentTarget.naturalHeight,
                            })
                        }
                        ref={image}
                        src={props.imageUrl}
                        style={
                            natural
                                ? {
                                      width: natural.w * base * zoom,
                                      height: natural.h * base * zoom,
                                      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                                  }
                                : { opacity: 0 }
                        }
                    />
                    <span className="kissopen-avatar-crop__mask" aria-hidden="true" />
                </div>
                <label className="kissopen-avatar-crop__zoom">
                    <span aria-hidden="true">−</span>
                    <input
                        aria-label={t("缩放")}
                        max={ZOOM_MAX}
                        min={1}
                        onChange={(event) => zoomTo(Number(event.currentTarget.value))}
                        step={0.01}
                        type="range"
                        value={zoom}
                    />
                    <span aria-hidden="true">+</span>
                </label>
            </div>
        </Modal>
    );
}
