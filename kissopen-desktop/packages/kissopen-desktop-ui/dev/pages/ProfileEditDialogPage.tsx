import { ProfileEditDialog } from "../../src/ProfileEditDialog";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-289";

export function ProfileEditDialogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The account's name, username and picture. Nothing is written until Save, except the picture, which is saved once it is framed."
            title="ProfileEditDialog"
        >
            <Specimen
                detail="saved values filled in · the pencil changes the picture"
                label="Editing"
                number="01"
                stage="app"
            >
                <ProfileEditDialog
                    displayName="小明"
                    initials="小明"
                    onAvatarChange={() => {}}
                    onCancel={() => {}}
                    onSave={async () => {}}
                    username="xiaoming"
                />
            </Specimen>
            <Specimen
                detail="a refused save keeps the dialog open with the reason"
                label="Refused"
                number="02"
                stage="app"
            >
                <ProfileEditDialog
                    displayName="小明"
                    initials="小明"
                    onAvatarChange={() => {}}
                    onCancel={() => {}}
                    onSave={async () => {
                        throw new Error("这个用户名已被使用");
                    }}
                    username="admin"
                />
            </Specimen>
        </ComponentPage>
    );
}
