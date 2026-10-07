import { describe, expect, it } from "vitest";
import {
    kissopenAgentBoardCardId,
    kissopenAgentBoardCards,
    kissopenAgentBoardOverlay,
    kissopenAgentBoardParse,
    kissopenAgentBoardStateOf,
} from "./kissopenAgentBoard.js";
import {
    kissopenAgentProjectParse,
    kissopenCardAgentId,
    kissopenCardAgentResolve,
    kissopenCardFirstMessage,
} from "./kissopenAgentProjectState.js";

const board = JSON.stringify({
    version: 1,
    title: "发布会",
    blocks: [
        {
            type: "focus",
            id: "k7m2q9x",
            title: "生成周报",
            detail: "本周资料",
            state: "in_progress",
        },
        {
            type: "list",
            title: "下一步",
            items: [
                { title: "生成周报" },
                { id: "Bad Id", title: "  联系场地  ", state: "nonsense" },
                { id: "kdone01", title: "定预算", state: "done" },
            ],
        },
        { type: "note", title: "提醒", body: "别忘了" },
    ],
});

describe("card ids", () => {
    it("derives a missing or malformed id from the trimmed title", () => {
        expect(kissopenAgentBoardCardId(undefined, "a")).toBe("te40c292c");
        expect(kissopenAgentBoardCardId(undefined, "  生成周报 ")).toBe("td5ed981a");
        expect(kissopenAgentBoardCardId("UPPER", "生成周报")).toBe("td5ed981a");
        expect(kissopenAgentBoardCardId("w-abc", "x")).toBe("w-abc");
    });

    it("parses ids and states on focus blocks and list items", () => {
        const parsed = kissopenAgentBoardParse(board);
        if (!("document" in parsed)) throw new Error(parsed.reason);
        expect(
            kissopenAgentBoardCards(parsed.document).map((card) => [card.id, card.state]),
        ).toEqual([
            ["k7m2q9x", "in_progress"],
            ["td5ed981a", "todo"],
            [kissopenAgentBoardCardId(undefined, "联系场地"), "todo"],
            ["kdone01", "done"],
        ]);
    });
});

describe("project.json", () => {
    it("reads tolerantly", () => {
        const project = kissopenAgentProjectParse(
            JSON.stringify({
                version: 1,
                goal: "办好发布会",
                direction: "线下为主",
                decisions: Array.from({ length: 60 }, (_, index) => ({
                    at: "2026-09-28T10:00:00Z",
                    card: "k7m2q9x",
                    question: `问题 ${index}`,
                    choice: "A",
                })),
                cards: {
                    k7m2q9x: {
                        title: "生成周报",
                        agent: "kabc",
                        state: "needs_decision",
                        question: { text: "用哪个模板？", options: ["A", "B", "C", "D", "E"] },
                        files: [
                            "outputs/周报.docx",
                            "/etc/passwd",
                            "../up",
                            "a",
                            "b",
                            "c",
                            "d",
                            "e",
                        ],
                        verified: true,
                    },
                    "NOT VALID": { title: "x" },
                    "w-material": { title: "场地照片", state: "waiting_material", note: "请上传" },
                    kunknown: { title: "奇怪", state: "whatever" },
                },
            }),
        )!;
        expect(project.goal).toBe("办好发布会");
        expect(project.decisions).toHaveLength(50);
        expect(project.decisions[0]!.question).toBe("问题 10");
        expect(Object.keys(project.cards)).toEqual(["k7m2q9x", "w-material", "kunknown"]);
        const card = project.cards.k7m2q9x!;
        expect(card.question?.options).toEqual(["A", "B", "C", "D"]);
        expect(card.files).toEqual(["outputs/周报.docx", "a", "b", "c", "d", "e"]);
        expect(card.verified).toBe(true);
        expect(project.cards.kunknown!.state).toBeUndefined();
        expect(kissopenAgentProjectParse("nope")).toBeUndefined();
        expect(kissopenAgentProjectParse("[]")).toBeUndefined();
    });

    it("lays card states over the board and shows cards only project.json has", () => {
        const project = kissopenAgentProjectParse(
            JSON.stringify({
                cards: {
                    td5ed981a: { state: "done" },
                    k7m2q9x: { agent: "kagent" },
                    "w-material": { title: "场地照片", state: "waiting_material", note: "请上传" },
                    "w-decide": {
                        title: "选日期",
                        state: "needs_decision",
                        question: { text: "10 月还是 11 月？" },
                    },
                    "w-quiet": { title: "已做完", state: "done" },
                },
            }),
        );
        const parsed = kissopenAgentBoardParse(board);
        if (!("document" in parsed)) throw new Error(parsed.reason);
        const overlaid = kissopenAgentBoardOverlay(parsed.document, project);
        const cards = kissopenAgentBoardCards(overlaid);
        expect(cards.map((card) => [card.id, card.state])).toEqual([
            ["k7m2q9x", "in_progress"],
            ["w-decide", "needs_decision"],
            ["w-material", "waiting_material"],
            ["td5ed981a", "done"],
            [kissopenAgentBoardCardId(undefined, "联系场地"), "todo"],
            ["kdone01", "done"],
        ]);
        expect(overlaid.blocks[1]!.type).toBe("list");
        expect(cards[1]!.detail).toBe("10 月还是 11 月？");

        const state = kissopenAgentBoardStateOf(undefined, JSON.stringify({ cards: {} }));
        expect(state).toEqual({
            status: "missing",
            project: { goal: "", direction: "", decisions: [], cards: {} },
        });
        expect(kissopenAgentBoardStateOf(board, "not json").status).toBe("ready");
    });
});

describe("card conversations", () => {
    it("derives the same id the phone and the server do", async () => {
        const id = await kissopenCardAgentId("/Users/me/launch", "k7m2q9x");
        expect(id).toBe("k8158a31162b205dab62b652");
        expect(id).toHaveLength(24);
        expect(await kissopenCardAgentId("/Users/me/launch///", "k7m2q9x")).toBe(id);
        expect(
            await kissopenCardAgentResolve("/Users/me/launch", "k7m2q9x", {
                goal: "",
                direction: "",
                decisions: [],
                cards: {
                    k7m2q9x: {
                        title: "",
                        agent: "kother",
                        note: "",
                        files: [],
                        verified: false,
                        updated: "",
                    },
                },
            }),
        ).toBe("kother");
    });

    it("words the first message exactly", () => {
        expect(kissopenCardFirstMessage("生成周报", "把本周资料整理成周报")).toBe(
            "请处理看板上的「生成周报」：把本周资料整理成周报",
        );
        expect(kissopenCardFirstMessage("生成周报", "生成周报")).toBe(
            "请处理看板上的「生成周报」。",
        );
    });
});
