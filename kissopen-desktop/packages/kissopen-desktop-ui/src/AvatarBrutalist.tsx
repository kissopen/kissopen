import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type HTMLAttributes } from "react";

export type AvatarBrutalistProps = Omit<HTMLAttributes<HTMLSpanElement>, "style"> & {
    /**
     * The identity the mark stands for — a session id, a project id, a name.
     * The same string always yields the same tile and the same colors, which is
     * the whole point: the reader learns a shape rather than reading a label.
     */
    id: string;
    /** Box edge in pixels. The tile's ink is inset inside it. */
    size?: number;
    /** Drops the color pair for a gray tile, for a disabled or resting entity. */
    monochrome?: boolean;
    style?: CSSProperties;
};

/*
 * The generated tile set, vendored from KISSOPEN's brutalist avatars. Each PNG is a
 * 100×100 alpha silhouette, so the file supplies the shape and the CSS mask
 * supplies the color — the same relationship the native app gets from a tint.
 */
const tiles: readonly string[] = Object.entries(
    import.meta.glob<string>("./assets/brutalist/*.png", {
        eager: true,
        import: "default",
        query: "?url",
    }),
)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, url]) => url);

/** Tint over background, each pair legible on both themes at icon sizes. */
const colorPairs = [
    { tint: "#FFA617", background: "#0056B3" },
    { tint: "#59C9DF", background: "#DC2626" },
    { tint: "#C678FF", background: "#16A34A" },
    { tint: "#FF79D7", background: "#047857" },
    { tint: "#FFD800", background: "#4C1D95" },
    { tint: "#84E600", background: "#C026D3" },
] as const;

/** Stable across runs and machines, unlike anything derived from object order. */
function hashCode(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index);
        hash = hash & hash;
    }
    return Math.abs(hash);
}

/**
 * C-170 AvatarBrutalist — a generated identity mark: one of the vendored
 * brutalist tiles, tinted and set on a paired background, both chosen by hashing
 * `id`. It needs no image URL, no initials and no upload, so anything that has
 * an id can wear a recognizable face — which is what lets every tab carry one.
 */
export function AvatarBrutalist(props: AvatarBrutalistProps) {
    const [local, rest] = partitionComponentProps(props, [
        "className",
        "id",
        "monochrome",
        "size",
        "style",
    ]);
    const size = () => local.size ?? 32;
    const tile = () => tiles[hashCode(local.id) % tiles.length]!;
    const colors = () => colorPairs[hashCode(`${local.id}color`) % colorPairs.length]!;
    const tint = () => (local.monochrome ? "#999999" : colors().tint);
    const background = () => (local.monochrome ? "#F0F0F0" : colors().background);
    return (
        <span
            {...rest}
            aria-hidden={props["aria-label"] ? undefined : "true"}
            className={["kissopen-avatar-brutalist", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="avatar-brutalist"
            role={props["aria-label"] ? "img" : undefined}
            style={{
                width: `${size()}px`,
                height: `${size()}px`,
                borderRadius: "var(--kissopen-radius-pill)",
                background: background(),
                ...local.style,
            }}
        >
            <span
                className="kissopen-avatar-brutalist__ink"
                data-kissopen-desktop-ui="avatar-brutalist-ink"
                style={{
                    width: `${size() * 0.8}px`,
                    height: `${size() * 0.8}px`,
                    background: tint(),
                    maskImage: `url(${tile()})`,
                    WebkitMaskImage: `url(${tile()})`,
                }}
            />
        </span>
    );
}
