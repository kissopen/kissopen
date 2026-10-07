import { SidebarPromoCard } from "../../src/SidebarPromoCard";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-308";

const stage: Record<string, string> = { width: "272px", padding: "8px 10px 10px" };
const none = () => undefined;

export function SidebarPromoCardPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="One offer pinned above the sidebar's footer: a glyph, a title and a quiet detail line; the card opens it and the close button hides it until the app is opened again."
            title="SidebarPromoCard"
        >
            <Specimen
                detail="gift · title · detail · close"
                label="Invite"
                number="01"
                stage="chrome"
            >
                <div style={stage}>
                    <SidebarPromoCard
                        detail="最高可得 1,200 点"
                        icon="gift"
                        onDismiss={none}
                        onOpen={none}
                        title="分享赢好礼"
                    />
                </div>
            </Specimen>
            <Specimen detail="no detail · long title" label="Title only" number="02" stage="chrome">
                <div style={stage}>
                    <SidebarPromoCard
                        icon="gift"
                        onDismiss={none}
                        onOpen={none}
                        title="邀请朋友一起卷，双方都得点数，越多越好"
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
