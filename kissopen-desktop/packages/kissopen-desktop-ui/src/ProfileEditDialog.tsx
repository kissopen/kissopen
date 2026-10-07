import { t } from "kissopen-desktop-state";
import { useState } from "react";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { TextField } from "./TextField";

export type ProfileEditValues = { displayName: string; username: string };
export type ProfileEditDialogProps = {
    displayName: string;
    username: string;
    usernameEditable?: boolean;
    initials: string;
    imageUrl?: string;
    /** Resolves once saved; a rejection's message is shown in the dialog. */
    onSave: (values: ProfileEditValues) => Promise<void>;
    onCancel: () => void;
    /** Starts choosing a new picture; the owner frames and saves it. */
    onAvatarChange: () => void;
};

/**
 * C-289 ProfileEditDialog — the account's name, username and picture.
 *
 * The fields start from what is saved and nothing is written until Save; the
 * picture is the exception, because it has its own framing step and is saved
 * the moment it is framed. A refused save — a username someone else has, say —
 * leaves the dialog open with the reason, so the reader corrects rather than
 * retypes.
 */
export function ProfileEditDialog(props: ProfileEditDialogProps) {
    const [displayName, setDisplayName] = useState(props.displayName);
    const [username, setUsername] = useState(props.username);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const save = async () => {
        setSaving(true);
        setError("");
        try {
            await props.onSave({ displayName: displayName.trim(), username: username.trim() });
        } catch (failure) {
            setError(failure instanceof Error ? t(failure.message) : t("资料没有保存成功"));
        } finally {
            setSaving(false);
        }
    };
    return (
        <Modal
            className="kissopen-profile-edit"
            closeLabel={t("取消")}
            footer={
                <>
                    {error && (
                        <span className="kissopen-profile-edit__error" role="alert">
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
            size="medium"
            title={t("编辑个人资料")}
        >
            <div className="kissopen-profile-edit__body">
                <button
                    aria-label={t("更换头像")}
                    className="kissopen-profile-avatar"
                    data-size="large"
                    onClick={props.onAvatarChange}
                    type="button"
                >
                    <Avatar
                        {...(props.imageUrl ? { imageUrl: props.imageUrl } : {})}
                        initials={props.initials}
                        size="lg"
                        tone="ocean"
                    />
                    <span className="kissopen-profile-avatar__pencil" aria-hidden="true">
                        <Icon name="edit" size={16} />
                    </span>
                </button>
                <div className="kissopen-profile-edit__fields">
                    <div className="kissopen-profile-edit__row">
                        <label
                            className="kissopen-profile-edit__label"
                            htmlFor="kissopen-profile-edit-name"
                        >
                            {t("昵称")}
                        </label>
                        <TextField
                            id="kissopen-profile-edit-name"
                            onSubmit={() => void save()}
                            onValueChange={setDisplayName}
                            placeholder={t("你希望别人怎么称呼你")}
                            value={displayName}
                        />
                    </div>
                    <div className="kissopen-profile-edit__row">
                        <label
                            className="kissopen-profile-edit__label"
                            htmlFor="kissopen-profile-edit-username"
                        >
                            {t("用户名")}
                        </label>
                        <TextField
                            id="kissopen-profile-edit-username"
                            disabled={props.usernameEditable === false}
                            hint={
                                props.usernameEditable === false
                                    ? t("Change your sign-in username in Settings → Security")
                                    : undefined
                            }
                            // The @ belongs to the field, so both fields line up
                            // at the same width.
                            leadingIcon="at"
                            onSubmit={() => void save()}
                            onValueChange={(value) =>
                                setUsername(
                                    value
                                        .toLowerCase()
                                        .replace(/[^a-z0-9_]/g, "")
                                        .slice(0, 20),
                                )
                            }
                            placeholder={t("3–20 位小写字母、数字或下划线")}
                            value={username}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
