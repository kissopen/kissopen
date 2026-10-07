import { expect, it } from "vitest";
import "./theme.css";
import "./styles/icon.css";
import "./styles/button.css";
import "./styles/composer.css";
import { Composer } from "./Composer";
import { createRenderer } from "./testing";

it("withholds composer contribution triggers so attachment remains the leftmost control", async () => {
    const view = createRenderer().render(
        () => (
            <Composer
                contributions={
                    <button data-testid="composer-trigger" type="button">
                        Insert
                    </button>
                }
                onAttachFile={() => undefined}
                onSend={() => undefined}
                onValueChange={() => undefined}
                value=""
            />
        ),
        { width: 640, height: 200, padding: 16 },
    );
    expect(
        view.container.querySelector('[data-kissopen-desktop-ui="composer-contributions"]'),
    ).toBeNull();
    expect(view.container.querySelector('[data-testid="composer-trigger"]')).toBeNull();
    const leading = view.$('[data-kissopen-desktop-ui="composer-leading"]').element;
    const attachment = view.$('[aria-label="Attach file"]').element;
    expect(leading.firstElementChild).toBe(attachment);
    await view.screenshot("ChatContributionSlots.composer.test");
}, 120000);
