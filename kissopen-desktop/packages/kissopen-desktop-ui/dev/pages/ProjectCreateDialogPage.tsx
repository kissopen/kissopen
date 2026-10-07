import { ProjectCreateDialog } from "../../src/ProjectCreateDialog";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-301";

const noop = () => {};
const pick = () => Promise.resolve("/Users/me/Documents/餐厅筹备");
const create = () => Promise.resolve();
const stage: Record<string, string> = { position: "relative", width: "720px", height: "420px" };

export function ProjectCreateDialogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A project's name and, if the person has one, the folder its files are kept in. Left alone, the folder is made for them."
            title="ProjectCreateDialog"
        >
            <Specimen
                label="First project"
                number="01"
                stage="app"
                detail="name field · optional folder"
            >
                <div style={stage}>
                    <ProjectCreateDialog
                        first
                        onCancel={noop}
                        onCreate={create}
                        onFolderPick={pick}
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
