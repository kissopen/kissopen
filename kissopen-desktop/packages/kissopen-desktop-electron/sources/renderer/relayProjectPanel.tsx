/*
The window's panel, standing beside a project on another machine.

Nothing is drawn here. The panel is `KissopenAgentPanelBody` — the same
component, the same tabs, the same tree and the same chrome the local
workspace gets — and what this file does is supply its facts from the relay
instead of from the daemon next door. A second panel would have drifted from
that one the first time either was touched.

Which of its tabs are real here follows from what the other machine offers.
The changed files are read over the relay with the shared reader the phone
uses, so a change looks the same on both. All Files lists the other machine's
folders one at a time as they are opened, and a file opened from there is read
whole and shown by the same previewer a local file gets. The browser is Chromium on this
desk, with public addresses going out directly, which is why a link from the
conversation can open in it. A terminal is refused with a reason rather than
offered dead: a shell needs a stream that survives a dropped connection, and
that is not built.
*/
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import { KissopenAgentPanelBody } from "kissopen-desktop-app";
import {
    Button,
    ChangedFileDiff,
    EmptyState,
    FilePreview,
    filePreviewKind,
    type BrowserContentRenderer,
    type FilePreviewContent,
} from "kissopen-desktop-ui";
import {
    kissopenAgentFileUploadStoreCreate,
    t,
    type KissopenAgentDocumentConversionOpener,
    type KissopenAgentDocumentConversionStore,
    type KissopenAgentFileScope,
    type KissopenAgentWorkspaceFileTreeDirectory,
    type KissopenAgentFileLayout,
    type KissopenAgentFileTabSnapshot,
    type KissopenAgentGitChangedFile,
    type KissopenAgentGroupId,
    type KissopenAgentPanelStore,
} from "kissopen-desktop-state";
import type { KissopenDesktopBridge } from "../shared/desktopContract";
import type {
    KissopenAgentFileContent,
    KissopenAgentGitFile,
    KissopenAgentGitState,
} from "../shared/relayContract";

/** How often the checkout is read again while the panel is showing it. */
const CHANGES_INTERVAL_MS = 15_000;

type Changes =
    | { readonly phase: "loading" }
    | { readonly phase: "ready"; readonly git: KissopenAgentGitState }
    /*
     * Why there is nothing to show. Kept apart from an empty checkout: a
     * machine whose agent is too old to offer its files and a project with no
     * changes are different answers, and only one of them is worth acting on.
     */
    | { readonly phase: "unavailable"; readonly reason: string };

export function RelayProjectPanel(props: {
    readonly bridge: KissopenDesktopBridge;
    /** The conversation whose machine and checkout this panel reads. */
    readonly sessionId: string;
    /** The project it belongs to, which is what the panel files its tabs under. */
    readonly projectId: string;
    /**
     * Which tabs this project has open.
     *
     * Held above this component, because it outlives it: hiding the panel
     * must not close the pages in it, and a link followed while it is hidden
     * has to have somewhere to land.
     */
    readonly store: KissopenAgentPanelStore;
    /** Draws a browser tab; the window owns the guest, as it does locally. */
    readonly browserContent?: BrowserContentRenderer;
    /** Shows a document no viewer here reads as the PDF the server converts it to. */
    readonly documentConversion?: KissopenAgentDocumentConversionOpener;
    /** A file a conversation linked, to show now. */
    readonly fileRequest?: RelayPanelFileRequest;
    /** Asks the panel to show All Files; each new number is a new ask. */
    readonly filesRequest?: number;
    /** Whether the agent there can take files; without it the listing offers no upload. */
    readonly canUpload?: boolean;
    /** A batch of files has landed in the project's `uploads/` there. */
    readonly onUploaded?: (paths: readonly string[]) => void;
    readonly onClose: () => void;
}) {
    const { bridge, sessionId, store } = props;
    const panel = useSyncExternalStore(store.subscribe, store.get, store.get);

    const [changes, setChanges] = useState<Changes>({ phase: "loading" });
    const [layout, setLayout] = useState<KissopenAgentFileLayout>("tree");
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
    const [openPath, setOpenPath] = useState<string | undefined>(undefined);
    const [content, setContent] = useState<KissopenAgentFileContent | null>(null);
    const [reading, setReading] = useState(false);
    const [scope, setScope] = useState<KissopenAgentFileScope>("all");
    // Files handed to the project from this window, sent to the other machine
    // in parts; one store per conversation the panel reads through.
    const upload = useMemo(
        () =>
            kissopenAgentFileUploadStoreCreate({
                upload: async (file) => {
                    const sent = await bridge.relayFileUpload(
                        sessionId,
                        `uploads/${file.name}`,
                        file.bytes,
                    );
                    if (!sent.ok) throw new Error(sent.error);
                    return sent.path;
                },
            }),
        [bridge, sessionId],
    );
    const filesRequested = props.filesRequest;
    useEffect(() => {
        if (filesRequested !== undefined) setScope("all");
    }, [filesRequested]);
    const [directories, setDirectories] = useState<
        ReadonlyMap<string, KissopenAgentWorkspaceFileTreeDirectory>
    >(new Map());
    const [whole, setWhole] = useState<WholeFile | undefined>(undefined);
    // Which read of a whole file is the current one: a slower answer to an
    // earlier click must not replace the file the reader moved on to.
    const wholeRead = useRef(0);
    // The object URL the whole file is shown from, released when it is replaced.
    const wholeUrl = useRef<string | undefined>(undefined);
    const wholeRelease = useCallback(() => {
        if (wholeUrl.current !== undefined) URL.revokeObjectURL(wholeUrl.current);
        wholeUrl.current = undefined;
    }, []);
    useEffect(() => wholeRelease, [wholeRelease]);

    useEffect(() => {
        const signal = { cancelled: false };
        const read = async () => {
            /*
             * Caught, because the alternative is a lie that never ends. A
             * rejected call here — a host too old to know this request, a
             * window shutting down — left the state on "loading" for good,
             * and the tree said "Loading files…" forever with nothing on its
             * way. A reason the reader can act on beats a spinner that means
             * nothing.
             */
            try {
                const answer = await bridge.relayGitState(sessionId);
                if (signal.cancelled) return;
                setChanges(
                    answer.ok
                        ? { phase: "ready", git: answer.git }
                        : { phase: "unavailable", reason: answer.error },
                );
            } catch (thrown) {
                if (!signal.cancelled)
                    setChanges({ phase: "unavailable", reason: (thrown as Error).message });
            }
        };
        setChanges({ phase: "loading" });
        setOpenPath(undefined);
        setContent(null);
        setDirectories(new Map());
        setWhole(undefined);
        void read();
        const timer = setInterval(() => void read(), CHANGES_INTERVAL_MS);
        return () => {
            signal.cancelled = true;
            clearInterval(timer);
        };
    }, [bridge, sessionId]);

    const git = changes.phase === "ready" ? changes.git : undefined;

    /*
     * The relay's changed files, in the shape the panel already draws.
     *
     * The relay reports more kinds of change than the panel has words for, so
     * one it does not know is carried under the nearest thing that is true: a
     * copy is an addition, a conflict or a type change is a modification.
     * Calling a conflict "modified" is a smaller lie than dropping the row.
     */
    const changed: KissopenAgentGitChangedFile[] = useMemo(
        () =>
            (git?.files ?? []).map((file) => ({
                path: file.path,
                ...(file.previousPath === undefined ? {} : { previousPath: file.previousPath }),
                status: panelStatus(file.status),
                // The comparison base stands in for a per-file revision, which
                // the relay does not report: it is what both sides were read
                // against, so it changes exactly when the reading would.
                revision: git?.base ?? "",
                ...(file.insertions === undefined ? {} : { addedLines: file.insertions }),
                ...(file.deletions === undefined ? {} : { deletedLines: file.deletions }),
            })),
        [git],
    );

    /*
     * One folder of the other machine, listed once and kept. A folder that
     * failed is listed again when it is next opened: the tree marks it, and
     * reopening is the reader's way of asking again.
     */
    const directoryLoad = useCallback(
        (path: string, again = false) => {
            const held = directories.get(path);
            if (!again && held !== undefined && (held.loading || held.error !== true)) return;
            setDirectories((current) =>
                new Map(current).set(path, { entries: held?.entries ?? [], loading: true }),
            );
            void (async () => {
                let answer: Awaited<ReturnType<typeof bridge.relayDirectoryList>>;
                try {
                    answer = await bridge.relayDirectoryList(sessionId, path);
                } catch (thrown) {
                    answer = { ok: false, error: (thrown as Error).message };
                }
                setDirectories((current) =>
                    new Map(current).set(
                        path,
                        answer.ok
                            ? {
                                  entries: answer.entries.map((entry) => ({
                                      kind: entry.kind,
                                      name: entry.name,
                                      path: path === "" ? entry.name : `${path}/${entry.name}`,
                                  })),
                                  loading: false,
                              }
                            : { entries: [], loading: false, error: true },
                    ),
                );
            })();
        },
        [bridge, directories, sessionId],
    );

    // All Files opens on the workspace's own folder.
    useEffect(() => {
        if (scope === "all" && !directories.has("")) directoryLoad("");
    }, [scope, directories, directoryLoad]);

    /*
     * One file read whole and shown as itself.
     *
     * Text is decoded here; everything else is handed to the previewer as an
     * address, the way a local file is. A format only the server can draw is
     * converted there, and a deck the slide viewer cannot draw converts when
     * the viewer says so.
     */
    const openWhole = useCallback(
        async (path: string) => {
            const read = ++wholeRead.current;
            setOpenPath(path);
            setContent(null);
            setWhole({ path, content: { type: "loading" }, size: "" });
            store.fileViewOpen();
            let answer: Awaited<ReturnType<typeof bridge.relayFileRead>>;
            try {
                answer = await bridge.relayFileRead(sessionId, path);
            } catch (thrown) {
                answer = { ok: false, error: (thrown as Error).message };
            }
            if (read !== wholeRead.current) return;
            if (!answer.ok) {
                setWhole({ path, content: { type: "error", message: answer.error }, size: "" });
                return;
            }
            const bytes = Uint8Array.from(atob(answer.base64), (character) =>
                character.charCodeAt(0),
            );
            const size = sizeFormat(bytes.byteLength);
            const kind = filePreviewKind(path);
            wholeRelease();
            if (kind === "text" || kind === "markdown" || kind === "html") {
                setWhole({
                    path,
                    content: { type: "text", text: new TextDecoder().decode(bytes) },
                    size,
                });
                return;
            }
            if (kind === "binary") {
                setWhole({ path, content: { type: "unavailable" }, size });
                return;
            }
            // Typed by its extension: a picture is drawn from its bytes alone, but
            // an SVG or a video is only drawn when the address says what it is.
            const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
            const url = URL.createObjectURL(
                new Blob([bytes], { type: MEDIA_TYPES[extension] ?? "" }),
            );
            wholeUrl.current = url;
            const conversion =
                (kind === "converted" || kind === "presentation") && props.documentConversion
                    ? props.documentConversion({
                          key: `relay:${sessionId}:${path}:${String(read)}`,
                          name: path.slice(path.lastIndexOf("/") + 1),
                          url,
                          automatic: kind === "converted",
                      })
                    : undefined;
            setWhole({
                path,
                content: { type: "url", url },
                size,
                ...(conversion ? { conversion } : {}),
            });
        },
        [bridge, props, sessionId, store, wholeRelease],
    );

    // A linked file is shown as itself, whatever the tree's scope: the reader
    // asked for the file, not for its change.
    const requested = props.fileRequest;
    useEffect(() => {
        if (requested !== undefined) void openWhole(requested.path);
        // Only a new request opens a file; openWhole changing identity must not.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requested?.seq]);

    const open = useCallback(
        async (path: string) => {
            const file = git?.files.find((candidate) => candidate.path === path);
            const base = git?.base;
            // A changed file opens as its change, wherever it was clicked;
            // any other file opens as itself.
            if (!file || !base) {
                if (scope === "all") await openWhole(path);
                return;
            }
            wholeRead.current += 1;
            setWhole(undefined);
            setOpenPath(path);
            setContent(null);
            setReading(true);
            store.fileViewOpen();
            // Whatever comes back, the reading stops. The same rejection that
            // stranded the tree on "loading" would otherwise strand this file
            // on it too.
            try {
                const answer = await bridge.relayGitFile(
                    sessionId,
                    base,
                    file as KissopenAgentGitFile,
                );
                setContent(
                    answer.ok
                        ? answer.content
                        : // The failure takes the place of the file: the reader
                          // asked for this one, and an empty pane says nothing
                          // about why it is empty.
                          { kind: "message", message: answer.error },
                );
            } catch (thrown) {
                setContent({ kind: "message", message: (thrown as Error).message });
            } finally {
                setReading(false);
            }
        },
        [bridge, git, openWhole, scope, sessionId, store],
    );

    /*
     * The open file, as a tab.
     *
     * Enough of one for the strip to name it and mark it the replaceable
     * preview it is. Its body is drawn separately rather than read out of
     * this, because the document a local tab carries belongs to the
     * workspace's read-and-edit lifecycle, and nothing here edits anything.
     */
    const panelFile: KissopenAgentFileTabSnapshot | undefined = useMemo(() => {
        if (openPath === undefined) return undefined;
        return {
            id: `relay-file:${openPath}`,
            groupId: props.projectId as KissopenAgentGroupId,
            path: openPath,
            kind: whole?.path === openPath ? "media" : "diff",
            placement: "panel",
            preview: true,
            revision: git?.base ?? "",
            document: reading ? { state: "loading" } : { state: "ready", value: undefined },
            presentationId: `${openPath}:${git?.base ?? ""}`,
        } as unknown as KissopenAgentFileTabSnapshot;
    }, [openPath, props.projectId, git, reading, whole]);

    return (
        <KissopenAgentPanelBody
            changes={changed}
            changesStatus={
                changes.phase === "loading"
                    ? "loading"
                    : changes.phase === "unavailable"
                      ? "unavailable"
                      : "ready"
            }
            // The browser is this desk's; the shell is the other machine's.
            // Both are offered, because both are reachable from this window.
            canStartBrowser
            canStartTerminal
            /* No machine of ours is behind this browser: it is this desk's own
               Chromium going out directly, the same as a local project's. */
            browserConnectionId={null}
            {...(props.browserContent ? { browserContent: props.browserContent } : {})}
            collapsed={collapsed}
            expanded={expanded}
            fileBody={() =>
                whole !== undefined && whole.path === openPath ? (
                    <RelayWholeFile
                        file={whole}
                        onOpenDefault={() => void bridge.relayFileOpen(sessionId, whole.path)}
                    />
                ) : (
                    <RelayFileBody path={openPath ?? ""} content={content} />
                )
            }
            layout={layout}
            now={Date.now()}
            onActivityOpen={() => store.activitySelect()}
            onUsageOpen={() => store.usageSelect()}
            onDirectoryPrefetch={(path) => directoryLoad(path)}
            onFileOpen={(path) => void open(path)}
            onFilePreprocess={() => undefined}
            onFileSelect={(path) => void open(path)}
            onLayoutChange={setLayout}
            onLoadMore={() => undefined}
            onPanelClose={props.onClose}
            onPanelFileClose={() => {
                store.fileViewClose();
                wholeRead.current += 1;
                setOpenPath(undefined);
                setContent(null);
                setWhole(undefined);
            }}
            onScopeChange={setScope}
            onToggle={(path, isExpanded) => {
                setExpanded((current) => withPath(current, path, isExpanded));
                setCollapsed((current) => withPath(current, path, !isExpanded));
                if (isExpanded && scope === "all") directoryLoad(path);
            }}
            onViewClose={(viewId) => store.tabClose(viewId as Parameters<typeof store.tabClose>[0])}
            onViewTransfer={() => undefined}
            panel={panel}
            {...(panelFile ? { panelFile } : {})}
            scope={scope}
            {...(openPath === undefined ? {} : { selectedPath: openPath })}
            store={store}
            workspaceFiles={{ directories }}
            {...(props.canUpload
                ? {
                      upload,
                      onUploaded: (paths: readonly string[]) => {
                          // Shown where they landed: the root and uploads/ read again.
                          setScope("all");
                          directoryLoad("", true);
                          directoryLoad("uploads", true);
                          setExpanded((current) => withPath(current, "uploads", true));
                          setCollapsed((current) => withPath(current, "uploads", false));
                          props.onUploaded?.(paths);
                      },
                  }
                : {})}
            workspaceFilesLoading={directories.get("")?.loading ?? scope === "all"}
        />
    );
}

/** A file a conversation linked, asked to be shown; `seq` tells one click from the next. */
export interface RelayPanelFileRequest {
    readonly path: string;
    readonly seq: number;
}

/** A file from the other machine read whole, and what it is shown as. */
interface WholeFile {
    readonly path: string;
    readonly content: FilePreviewContent;
    readonly size: string;
    /** Its conversion to a PDF, for a format only the server can draw. */
    readonly conversion?: KissopenAgentDocumentConversionStore;
}

/** One file from the other machine, in the previewer a local file gets. */
function RelayWholeFile(props: { readonly file: WholeFile; readonly onOpenDefault: () => void }) {
    const { file } = props;
    const actions = (
        <Button onClick={props.onOpenDefault} size="small" variant="ghost">
            {t("Open in default app")}
        </Button>
    );
    if (file.conversion)
        return (
            <RelayConvertedFile
                conversion={file.conversion}
                file={file}
                actions={actions}
                onOpenDefault={props.onOpenDefault}
            />
        );
    return (
        <FilePreview
            actions={actions}
            content={file.content}
            onOpenDefault={props.onOpenDefault}
            path={file.path}
            size={file.size}
        />
    );
}

function RelayConvertedFile(props: {
    readonly conversion: KissopenAgentDocumentConversionStore;
    readonly file: WholeFile;
    readonly actions: ReactNode;
    readonly onOpenDefault: () => void;
}) {
    const { conversion, file } = props;
    const state = useSyncExternalStore(conversion.subscribe, conversion.get, conversion.get);
    if (filePreviewKind(file.path) === "presentation" && state.pdf.type === "unloaded")
        return (
            <FilePreview
                actions={props.actions}
                content={file.content}
                onPresentationFailed={() => conversion.conversionRequest()}
                path={file.path}
                size={file.size}
            />
        );
    return (
        <FilePreview
            actions={props.actions}
            content={
                state.pdf.type === "ready"
                    ? { type: "url", url: state.pdf.value }
                    : state.pdf.type === "error"
                      ? { type: "error", message: state.pdf.error.message }
                      : { type: "loading" }
            }
            kind="converted"
            onOpenDefault={props.onOpenDefault}
            path={file.path}
            size={file.size}
        />
    );
}

/** The media types an address must carry for the previewer to draw the file. */
const MEDIA_TYPES: Readonly<Record<string, string>> = {
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    bmp: "image/bmp",
    ico: "image/x-icon",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    pdf: "application/pdf",
};

/** A byte count as a person reads it. */
function sizeFormat(size: number): string {
    if (size < 1024) return `${String(size)} B`;
    if (size < 1024 * 1024) return `${String(Math.round(size / 102.4) / 10)} KB`;
    return `${String(Math.round(size / (102.4 * 1024)) / 10)} MB`;
}

/** One path added to or removed from a set, without disturbing the rest. */
function withPath(current: ReadonlySet<string>, path: string, member: boolean): Set<string> {
    const next = new Set(current);
    if (member) next.add(path);
    else next.delete(path);
    return next;
}

/*
The relay's own vocabulary for a change, in the five words the panel has.

Every status the relay can report is mapped, because a row the panel cannot
name is a row it would not draw, and a file missing from the list is worse
than one filed under a neighbouring word.
*/
function panelStatus(status: string): KissopenAgentGitChangedFile["status"] {
    switch (status) {
        case "added":
        case "copied":
            return "added";
        case "deleted":
            return "deleted";
        case "renamed":
            return "renamed";
        case "untracked":
            return "untracked";
        default:
            return "modified";
    }
}

/*
One file, in whichever of the three ways it can be shown.

A change is not always a diff: a picture is two pictures, and a file that is
too large, binary, or has no readable side at all is a sentence saying so. The
shared reader decides which of the three this is, so a phone and this window
never disagree about it.
*/
function RelayFileBody(props: {
    readonly path: string;
    readonly content: KissopenAgentFileContent | null;
}) {
    const content = props.content;
    if (!content)
        return (
            <EmptyState
                icon="doc"
                title={props.path || t("Pick a file")}
                description={t("Its two sides are read from that machine.")}
            />
        );
    if (content.kind === "message")
        return <EmptyState icon="doc" title={props.path} description={content.message} />;
    if (content.kind === "image")
        return (
            <div className="kissopen-relay-image">
                {content.before ? <img src={content.before} alt={t("Before")} /> : null}
                {content.after ? <img src={content.after} alt={t("After")} /> : null}
            </div>
        );
    return (
        <ChangedFileDiff
            appearance="dark"
            path={props.path}
            oldContent={content.oldText}
            newContent={content.newText}
        />
    );
}
