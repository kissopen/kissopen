import { AvatarBrutalist } from "../../src/AvatarBrutalist";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-170";

const IDS = [
    "ses_9f2a",
    "ses_1b74",
    "prj_kissopen",
    "prj_kissopen_agent",
    "alex@example.com",
    "Claude",
    "Codex",
    "worktree/main",
];

const SIZES = [14, 16, 18, 24, 32, 44];

const row: Record<string, string> = {
    display: "flex",
    alignItems: "flex-end",
    gap: "16px",
    flexWrap: "wrap",
};

const cell: Record<string, string> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
};

export function AvatarBrutalistPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Avatar brutalist"
            summary="Generated identity mark: a vendored brutalist tile tinted over a paired background, both chosen by hashing an id. Needs no upload and no initials, so anything with an id can wear a face."
        >
            <Specimen
                number="01"
                label="Distinct identities"
                detail="Same size · tile and color pair derived from the id"
                stage="app"
            >
                <div style={row}>
                    {IDS.map((id) => (
                        <div key={id} style={cell}>
                            <AvatarBrutalist id={id} size={32} />
                        </div>
                    ))}
                </div>
            </Specimen>

            <Specimen
                number="02"
                label="Sizes"
                detail="14 / 16 / 18 tab lane · 24 / 32 / 44 list and header"
                stage="app"
            >
                <div style={row}>
                    {SIZES.map((size) => (
                        <div key={size} style={cell}>
                            <AvatarBrutalist id="ses_9f2a" size={size} />
                            <DimensionRule label={`${size}`} />
                        </div>
                    ))}
                </div>
            </Specimen>

            <Specimen
                number="03"
                label="Monochrome"
                detail="Gray tile for a resting or disabled entity"
                stage="app"
            >
                <div style={row}>
                    {IDS.slice(0, 5).map((id) => (
                        <AvatarBrutalist key={id} id={id} monochrome size={32} />
                    ))}
                </div>
            </Specimen>

            <Specimen
                number="04"
                label="Stability"
                detail="The same id always renders the same mark, across mounts and machines"
                stage="app"
            >
                <div style={row}>
                    {[0, 1, 2].map((index) => (
                        <AvatarBrutalist key={index} id="prj_kissopen" size={32} />
                    ))}
                </div>
            </Specimen>
        </ComponentPage>
    );
}
