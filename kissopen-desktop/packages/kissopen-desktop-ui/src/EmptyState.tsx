import { partitionComponentProps } from "./componentProps";
import { type CSSProperties } from "react";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { KissopenLoader } from "./KissopenLoader";
import { KissopenMark } from "./KissopenMark";
import { LottieScene, type LottieSceneName, type LottieScenePlay } from "./LottieScene";
import { EmptyStateVideo } from "./emptyState/EmptyStateVideo";
import chiefOfStaffVideo from "./assets/animations/chief-of-staff.mp4?url";
import chiefOfStaffPoster from "./assets/animations/chief-of-staff.png?url";
import secretaryWavingVideo from "./assets/animations/secretary-waving.mp4?url";
import secretaryWavingPoster from "./assets/animations/secretary-waving.png?url";
import { thumbHashToDataURL } from "thumbhash";

// Generated from the bundled chief-of-staff.png poster at 100 × 100 RGBA.
const chiefOfStaffPreview = thumbHashToDataURL(
    new Uint8Array([
        152, 40, 10, 23, 4, 83, 167, 93, 143, 136, 153, 101, 139, 151, 118, 105, 121, 119, 104, 160,
        42, 7, 169, 3,
    ]),
);
// Generated from the bundled secretary-waving.png poster at 100 × 100 RGBA.
const secretaryWavingPreview = thumbHashToDataURL(
    new Uint8Array([
        216, 56, 14, 23, 4, 122, 141, 172, 159, 149, 88, 99, 136, 136, 167, 122, 120, 120, 119, 243,
        7, 40, 127, 1,
    ]),
);
export type EmptyStateSize = "panel" | "inline";
export type EmptyStateAction = {
    label: string;
    icon?: IconName;
    onClick: () => void;
};
export type EmptyStateProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    icon: IconName;
    title: string;
    description?: string;
    action?: EmptyStateAction;
    size?: EmptyStateSize;
    /** Larger, higher-contrast copy for an introduction that deserves attention. */
    emphasis?: "standard" | "prominent";
    /**
     * Replaces the icon medallion with a large animated scene: its own
     * transparent region above the words, with no card, medallion, or fill
     * behind it. Reserved for states a reader actually sits in — a screen
     * waiting to be started, something being read, a settled absence — and
     * chosen for what it says, not for decoration. See `LottieScene` for what
     * each name means.
     *
     * The secretary scene uses a rounded silent MP4 with a still poster.
     * Other scenes use Lottie. The glyph stays required and is drawn until Lottie
     * paints: it is what the reader sees while the runtime loads, and what they
     * keep if it cannot load at all.
     */
    /**
     * `chief-of-staff` is the secretary's portrait; `secretary-waving` is her
     * waving hello, for a conversation with nothing in it yet.
     *
     * `brand-loading` is the 卷 loading loop (`KissopenLoader`), for a panel
     * whose content is still being read. `brand-rest` is the still 卷 mark,
     * breathing slowly, for a settled absence that is the good outcome — calm,
     * so it cannot be mistaken for a wait.
     */
    animation?:
        | LottieSceneName
        | "chief-of-staff"
        | "secretary-waving"
        | "brand-loading"
        | "brand-rest";
    /**
     * When the animated scene takes its one play. Defaults to `on-appear`.
     * Fixtures that must photograph identically every time pass `on-demand`,
     * which holds a still frame from the start (the poster for MP4 scenes).
     */
    animationPlay?: LottieScenePlay;
};
/* Icon size for the medallion, per empty-state size. Both land the glyph box on
 * an integer inset inside the medallion (48→14, 40→11) so the composed icon
 * stays optically centered without a bespoke nudge. */
const mediaIconSize: Record<EmptyStateSize, 18 | 20> = { panel: 20, inline: 18 };
/* The scene's own region, on the 16px layout rhythm: 128 under a panel, 96 in
 * the tighter inline block. Large enough that the artwork is the first thing
 * read, small enough that a panel with a description and an action still fits
 * the 720x480 Electron minimum without clipping. */
const sceneSize: Record<EmptyStateSize, 96 | 128> = { panel: 128, inline: 96 };
/* The glyph held inside a scene region until the artwork paints is the same
 * glyph at the same size as the medallion's — it is a placeholder, not a second
 * illustration, and growing it to fill a 128px box would only make the swap
 * louder. */
const actionSize: Record<EmptyStateSize, "small" | "medium"> = { panel: "medium", inline: "small" };
/* The 卷 mark inside the scene region: 96 wide under a panel (its full four
 * turns) and 72 in the inline block (one and a half), each leaving the mark's
 * glow room inside the square. */
const brandSize: Record<EmptyStateSize, 72 | 96> = { panel: 96, inline: 72 };
/**
 * C-024 EmptyState — centered icon medallion (or animated scene) + title +
 * optional description + optional action. Replaces the app's raw
 * `.feature-empty` markup. Props-only, desktop-only; the `panel` size fills and
 * vertically centers inside its host region, `inline` is a compact
 * content-sized block.
 */
export function EmptyState(props: EmptyStateProps) {
    const [local] = partitionComponentProps(props, [
        "action",
        "animation",
        "animationPlay",
        "className",
        "data-testid",
        "description",
        "emphasis",
        "icon",
        "size",
        "style",
        "title",
    ]);
    const size = () => local.size ?? "panel";
    return (
        <div
            className={["kissopen-empty-state", local.className].filter(Boolean).join(" ")}
            data-animated={local.animation === undefined ? undefined : ""}
            data-emphasis={local.emphasis}
            data-kissopen-desktop-ui="empty-state"
            data-size={size()}
            data-testid={local["data-testid"]}
            style={local.style}
        >
            {local.animation === "chief-of-staff" ? (
                <EmptyStateVideo
                    play={local.animationPlay ?? "on-appear"}
                    poster={chiefOfStaffPoster}
                    preview={chiefOfStaffPreview}
                    size={sceneSize[size()]}
                    src={chiefOfStaffVideo}
                />
            ) : local.animation === "secretary-waving" ? (
                <EmptyStateVideo
                    play={local.animationPlay ?? "on-appear"}
                    poster={secretaryWavingPoster}
                    preview={secretaryWavingPreview}
                    size={sceneSize[size()]}
                    src={secretaryWavingVideo}
                />
            ) : local.animation === "brand-loading" ? (
                <span
                    className="kissopen-empty-state__scene"
                    data-kissopen-desktop-ui="empty-state-scene"
                >
                    <KissopenLoader
                        label={local.title}
                        motion={local.animationPlay === "on-demand" ? "still" : "auto"}
                        size={brandSize[size()]}
                    />
                </span>
            ) : local.animation === "brand-rest" ? (
                <span
                    className="kissopen-empty-state__scene kissopen-empty-state__rest"
                    data-kissopen-desktop-ui="empty-state-scene"
                    data-motion={local.animationPlay === "on-demand" ? "still" : "auto"}
                >
                    <KissopenMark size={brandSize[size()]} />
                </span>
            ) : local.animation === undefined ? (
                <span
                    className="kissopen-empty-state__media"
                    data-kissopen-desktop-ui="empty-state-media"
                >
                    <Icon name={local.icon} size={mediaIconSize[size()]} />
                </span>
            ) : (
                <span
                    className="kissopen-empty-state__scene"
                    data-kissopen-desktop-ui="empty-state-scene"
                >
                    <Icon name={local.icon} size={mediaIconSize[size()]} />
                    <LottieScene
                        className="kissopen-empty-state__art"
                        name={local.animation}
                        {...(local.animationPlay ? { play: local.animationPlay } : {})}
                        replayLabel="Play the illustration again"
                        size={sceneSize[size()]}
                    />
                </span>
            )}
            <h2
                className="kissopen-empty-state__title"
                data-kissopen-desktop-ui="empty-state-title"
            >
                {local.title}
            </h2>
            {local.description ? (
                <p
                    className="kissopen-empty-state__description"
                    data-kissopen-desktop-ui="empty-state-description"
                >
                    {local.description}
                </p>
            ) : null}
            {local.action
                ? ((action) => (
                      <span
                          className="kissopen-empty-state__actions"
                          data-kissopen-desktop-ui="empty-state-actions"
                      >
                          <Button
                              icon={action.icon}
                              onClick={action.onClick}
                              size={actionSize[size()]}
                              variant="secondary"
                          >
                              {action.label}
                          </Button>
                      </span>
                  ))(local.action)
                : null}
        </div>
    );
}
