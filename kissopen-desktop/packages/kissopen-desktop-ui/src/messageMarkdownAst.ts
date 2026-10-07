import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

/**
 * Rendering and geometry share one Markdown syntax contract. ReactMarkdown
 * owns the render transform, while this parser exposes the same remark/GFM AST
 * to the row-height model without mounting anything.
 */
export const MESSAGE_MARKDOWN_REMARK_PLUGINS = [remarkGfm];

const messageMarkdownParser = unified().use(remarkParse).use(remarkGfm);

export type MessageMarkdownAst = ReturnType<typeof messageMarkdownParser.parse>;

/** Parses one message exactly once per text-layout cache lifetime. */
export function messageMarkdownParse(source: string): MessageMarkdownAst {
    return messageMarkdownParser.parse(source);
}
