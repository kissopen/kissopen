import { t } from "kissopen-desktop-state";
import { useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { ModalOverlay } from "./ModalOverlay";
import { TextField } from "./TextField";

export type ProjectCreateDialogProps = {
    /** The first project reads as the first; later ones are just projects. */
    first?: boolean;
    /**
     * Asks the machine for a folder; undefined when none was chosen. Absent
     * where projects have no folder here to choose — in the web client they are
     * made in the cloud workspace — and then the dialog asks only for the name.
     */
    onFolderPick?: () => Promise<string | undefined>;
    /** Resolves once the project exists and is being opened; a rejection's message is shown. */
    onCreate: (name: string, folder?: string) => Promise<void>;
    onCancel: () => void;
};

/**
 * C-301 ProjectCreateDialog — a project's name, and where its files go.
 *
 * The folder is a choice, not a step: left alone, the project gets a new folder
 * of its own name, which is what a person who has never kept one wants. Someone
 * with a folder already picks it and the project is made there. The name and
 * the chosen folder are this dialog's own until Create; a refusal keeps both,
 * with the reason.
 */
export function ProjectCreateDialog(props: ProjectCreateDialogProps) {
    const [name, setName] = useState("");
    const [folder, setFolder] = useState<string | undefined>(undefined);
    const [picking, setPicking] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const folderName = folder?.split(/[\\/]/u).filter(Boolean).at(-1) ?? "";
    const create = async () => {
        if (creating || (!name.trim() && !folder)) return;
        setCreating(true);
        setError("");
        try {
            await props.onCreate(name.trim(), folder);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : t("项目没有创建成功"));
            setCreating(false);
        }
    };
    const pick = async () => {
        setPicking(true);
        try {
            const chosen = await props.onFolderPick?.();
            if (chosen) {
                setFolder(chosen);
                if (!name.trim()) setName(chosen.split(/[\\/]/u).filter(Boolean).at(-1) ?? "");
            }
        } finally {
            setPicking(false);
        }
    };
    return (
        <ModalOverlay onDismiss={creating ? undefined : props.onCancel}>
            <Modal
                className="kissopen-project-create"
                closeLabel={t("取消")}
                footer={
                    <>
                        {error && (
                            <span className="kissopen-project-create__error" role="alert">
                                {error}
                            </span>
                        )}
                        <Button
                            disabled={creating}
                            onClick={props.onCancel}
                            size="medium"
                            variant="ghost"
                        >
                            {t("取消")}
                        </Button>
                        <Button
                            disabled={!name.trim() && !folder}
                            loading={creating}
                            onClick={() => void create()}
                            size="medium"
                            variant="primary"
                        >
                            {t("创建")}
                        </Button>
                    </>
                }
                onClose={props.onCancel}
                size="medium"
                title={props.first ? t("创建第一个项目") : t("创建项目")}
            >
                <div className="kissopen-project-create__body">
                    <div className="kissopen-project-create__field">
                        <label
                            className="kissopen-project-create__label"
                            htmlFor="kissopen-project-create-name"
                        >
                            {t("项目名称")}
                        </label>
                        <TextField
                            autoFocus
                            id="kissopen-project-create-name"
                            onSubmit={() => void create()}
                            onValueChange={setName}
                            placeholder={t("例如：我想开一个餐厅")}
                            value={name}
                        />
                    </div>
                    {props.onFolderPick ? (
                        <div className="kissopen-project-create__field">
                            <span className="kissopen-project-create__label">
                                {t("资料文件夹（可选）")}
                            </span>
                            <div className="kissopen-project-create__folder">
                                <Icon name="folder" size={16} />
                                <span className="kissopen-project-create__path" title={folder}>
                                    {folder
                                        ? folderName
                                        : t(
                                              "不选的话，会在 KISSOPEN/Projects 里新建一个同名文件夹",
                                          )}
                                </span>
                                {folder ? (
                                    <Button
                                        disabled={creating}
                                        onClick={() => setFolder(undefined)}
                                        size="small"
                                        variant="ghost"
                                    >
                                        {t("不用这个")}
                                    </Button>
                                ) : null}
                                <Button
                                    disabled={creating}
                                    loading={picking}
                                    onClick={() => void pick()}
                                    size="small"
                                    variant="secondary"
                                >
                                    {folder ? t("换一个") : t("选择文件夹")}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="kissopen-project-create__hint">
                            {t("项目建在云端工作空间，手机和电脑都能打开。")}
                        </p>
                    )}
                </div>
            </Modal>
        </ModalOverlay>
    );
}
