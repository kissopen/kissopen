import { useSyncExternalStore } from "react";
import { t, type KissopenStore, type LocalLibraryStore } from "kissopen-desktop-state";
import { EmptyState, FileLibrary } from "kissopen-desktop-ui";

export function LocalLibraryView(props: {
    readonly store: LocalLibraryStore;
    readonly account: KissopenStore;
}) {
    const library = useSyncExternalStore(props.store.subscribe, props.store.get, props.store.get);
    const account = useSyncExternalStore(
        props.account.subscribe,
        props.account.get,
        props.account.get,
    );
    if (library.loading && library.files.length === 0 && !library.error)
        return (
            <EmptyState
                icon="folder"
                title={t("正在读取本机资料库")}
                description={t("正在连接本地 Agent，文件不会上传到账号服务器。")}
                size="panel"
            />
        );
    return (
        <FileLibrary
            items={library.files}
            description={t(
                "本机项目根目录、uploads 与 outputs 中的文件。添加资料请使用项目的文件面板；文件不会上传到账号服务器。",
            )}
            filter={account.libraryFilter}
            onFilterChange={props.account.libraryFilterSelect}
            search={account.librarySearch}
            onSearchChange={props.account.librarySearchUpdate}
            view={account.libraryView}
            onViewChange={props.account.libraryViewSelect}
            now={library.loadedAt}
            error={library.error}
            onItemOpen={props.store.fileOpen}
            onItemPreviewRequest={props.store.filePreviewRequest}
        />
    );
}
