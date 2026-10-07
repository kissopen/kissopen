import { partitionComponentProps } from "./componentProps";
import type { CSSProperties } from "react";

export type FilePathLabelProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    path: string;
};

function splitPath(path: string): {
    name: string;
    directory: string;
    directoryHead: string;
    directoryTail: string;
} {
    const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
    const slash = trimmed.lastIndexOf("/");
    if (slash < 0) return { name: trimmed, directory: "", directoryHead: "", directoryTail: "" };
    const directory = trimmed.slice(0, slash + 1);
    const withoutTrailingSlash = directory.slice(0, -1);
    const directoryCut = withoutTrailingSlash.lastIndexOf("/");
    return {
        name: trimmed.slice(slash + 1),
        directory,
        directoryHead: directoryCut < 0 ? "" : withoutTrailingSlash.slice(0, directoryCut),
        directoryTail:
            directoryCut < 0 ? directory : `${withoutTrailingSlash.slice(directoryCut)}/`,
    };
}

/**
 * One compact file path. The nearby directory stays muted and yields from its
 * middle first, while the file name remains the bright, stable end of the path.
 */
export function FilePathLabel(props: FilePathLabelProps) {
    const [local] = partitionComponentProps(props, ["className", "data-testid", "path", "style"]);
    const parts = splitPath(local.path);
    return (
        <span
            className={["kissopen-file-path-label", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="file-path-label"
            data-testid={local["data-testid"]}
            style={local.style}
        >
            {parts.directory ? (
                <span
                    className="kissopen-file-path-label__directory"
                    data-kissopen-desktop-ui="file-path-label-directory"
                    title={parts.directory}
                >
                    {parts.directoryHead ? (
                        <span className="kissopen-file-path-label__directory-head">
                            {parts.directoryHead}
                        </span>
                    ) : null}
                    <span className="kissopen-file-path-label__directory-tail">
                        {parts.directoryTail}
                    </span>
                </span>
            ) : null}
            <span
                className="kissopen-file-path-label__name"
                data-kissopen-desktop-ui="file-path-label-name"
            >
                {parts.name}
            </span>
        </span>
    );
}
