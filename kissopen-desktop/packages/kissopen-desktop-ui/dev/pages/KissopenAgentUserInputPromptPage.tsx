import { KissopenAgentUserInputPrompt } from "../../src/KissopenAgentUserInputPrompt";
import { ComponentPage, Specimen } from "../kit";
import type { KissopenAgentUserInputRequest } from "kissopen-desktop-state";
import { kissopenAgentUserInput } from "./kissopenAgentChatFixtures";

/**
 * Questions the agent asked without options: answered in the person's own
 * words. A card that showed only options could never be submitted for these.
 */
const writtenAnswers: KissopenAgentUserInputRequest = {
    requestId: "pricesrequest",
    questions: [
        {
            id: "trial",
            header: "体验课",
            question: "体验课多少钱？请注明是单人价还是双人价，以及是否有首次体验限制。",
            multiSelect: false,
            required: true,
            options: [],
        },
        {
            id: "private",
            header: "私教课",
            question: "一对一私教课怎么收费？请写单节价或各课包价格。",
            multiSelect: false,
            required: true,
            options: [],
        },
        {
            id: "group",
            header: "小班课",
            question: "小班课怎么收费？请写人数、单节价或各课包价格。",
            multiSelect: false,
            required: false,
            options: [],
        },
    ],
};

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-150";

export function KissopenAgentUserInputPromptPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="KISSOPEN Agent user-input request: single- and multi-select option pickers with a submit gated on required questions. Each question states its own selection rule beside its name."
            title="KissopenAgentUserInputPrompt"
        >
            <Specimen
                detail="single-select (required) + multi-select question, submit gated until required is answered"
                label="Question set"
                number="01"
                stage="surface"
            >
                <div style={{ width: "560px" }}>
                    <KissopenAgentUserInputPrompt
                        onAnswer={() => undefined}
                        request={kissopenAgentUserInput}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="questions asked without options take a written answer; submit waits for every required one"
                label="Written answers"
                number="04"
                stage="surface"
            >
                <div style={{ width: "560px" }}>
                    <KissopenAgentUserInputPrompt onAnswer={() => undefined} request={writtenAnswers} />
                </div>
            </Specimen>

            <Specimen
                detail="no container of its own, for a host that already gives the question one (the inbox)"
                label="Flat"
                number="02"
                stage="surface"
            >
                <div style={{ width: "560px" }}>
                    <KissopenAgentUserInputPrompt
                        onAnswer={() => undefined}
                        request={kissopenAgentUserInput}
                        variant="flat"
                    />
                </div>
            </Specimen>

            <Specimen
                detail="an answer in flight: the options freeze rather than disappear, so a failed send can be retried with the same selections"
                label="Sending"
                number="03"
                stage="surface"
            >
                <div style={{ width: "560px" }}>
                    <KissopenAgentUserInputPrompt
                        onAnswer={() => undefined}
                        pending
                        request={kissopenAgentUserInput}
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
