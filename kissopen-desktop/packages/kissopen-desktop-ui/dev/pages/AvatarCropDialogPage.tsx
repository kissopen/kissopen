import { AvatarCropDialog } from "../../src/AvatarCropDialog";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-288";

/* A drawn planet, wider than tall, so the specimen shows the picture covering
   the square with room to drag sideways. */
const sample =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><defs><radialGradient id="g" cx="40%" cy="40%"><stop offset="0" stop-color="%238aa6ff"/><stop offset="1" stop-color="%23101a3a"/></radialGradient></defs><rect width="900" height="600" fill="%23060914"/><circle cx="450" cy="300" r="220" fill="url(%23g)"/><circle cx="700" cy="140" r="40" fill="%23c9b8ff"/></svg>';

export function AvatarCropDialogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Frame a picture as an avatar before it is saved: it starts covering the square, zoom enlarges it, dragging moves it, and the circle shows what the avatar will show."
            title="AvatarCropDialog"
        >
            <Specimen
                detail="a landscape picture covering the square · zoom at its smallest"
                label="Framing"
                number="01"
                stage="app"
            >
                <AvatarCropDialog imageUrl={sample} onCancel={() => {}} onSave={async () => {}} />
                <DimensionRule label="stage 320px · saved as a 512px JPEG · zoom 1–3×" />
            </Specimen>
        </ComponentPage>
    );
}
