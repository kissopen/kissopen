import type { MarkdownSpan } from "./parseMarkdown";

// Updated pattern to handle nested markdown and asterisks
// A link's destination is either `<…>`, which may hold spaces and parentheses —
// how a path like `~/Library/Application Support/…` has to be written — or a
// plain run up to the closing parenthesis.
const pattern = /(\*\*(.*?)(?:\*\*|$))|(\*(.*?)(?:\*|$))|(\[([^\]]+)\](?:\((<[^>\n]*>|[^)]+)\))?)|(`(.*?)(?:`|$))/g;

/** The destination itself, without the angle brackets that may wrap it. */
function linkDestination(raw: string): string {
    const trimmed = raw.trim();
    return trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1) : trimmed;
}

/*
 * The kinds of file an agent delivers to a person: documents, sheets, decks,
 * pictures, media and archives. Source files are left out on purpose — a
 * `package.json` in a sentence about code is a name, not an offer to open it.
 */
const DELIVERABLE_EXTENSION = /\.(?:pptx?|pps|key|docx?|rtf|odt|od[ps]|wps|et|dps|pages|xlsx?|numbers|csv|tsv|pdf|md|txt|html?|png|jpe?g|gif|webp|svg|heic|bmp|mp4|mov|webm|mp3|m4a|wav|zip)$/i;

/**
 * A code span that names a delivered file, as a link to it.
 *
 * Agents are told to link every file they deliver, and usually do; when one
 * writes `outputs/周报.pptx` in backticks instead, the person should still be
 * able to tap it. Only a single path ending in a deliverable's extension
 * counts, never a command or a URL.
 */
export function deliverablePathOf(code: string): string | null {
    const text = code.trim();
    if (text === '' || text.length > 1024 || /[\n`<>|*?"]/.test(text) || text.includes('://')) return null;
    if (/^[-$]/.test(text) || /\s-{1,2}[A-Za-z]/.test(text)) return null;
    return DELIVERABLE_EXTENSION.test(text) ? text : null;
}

function pushTextWithAutoLinks(spans: MarkdownSpan[], text: string, styles: MarkdownSpan['styles']) {
    const urlPattern = /https?:\/\/[^\s<]+/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = urlPattern.exec(text)) !== null) {
        const plainText = text.slice(lastIndex, match.index);
        if (plainText) {
            spans.push({ styles, text: plainText, url: null });
        }

        let url = match[0];
        let trailing = '';
        while (/[),.;:!?]$/.test(url)) {
            trailing = url.slice(-1) + trailing;
            url = url.slice(0, -1);
        }

        if (url) {
            spans.push({ styles, text: url, url });
        }
        if (trailing) {
            spans.push({ styles, text: trailing, url: null });
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        spans.push({ styles, text: text.slice(lastIndex), url: null });
    }
}

export function parseMarkdownSpans(markdown: string, header: boolean) {
    const spans: MarkdownSpan[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(markdown)) !== null) {
        // Capture the text between the end of the last match and the start of this match as plain text
        const plainText = markdown.slice(lastIndex, match.index);
        if (plainText) {
            pushTextWithAutoLinks(spans, plainText, []);
        }

        if (match[1]) {
            // Bold
            if (header) {
                pushTextWithAutoLinks(spans, match[2], []);
            } else {
                pushTextWithAutoLinks(spans, match[2], ['bold']);
            }
        } else if (match[3]) {
            // Italic
            if (header) {
                pushTextWithAutoLinks(spans, match[4], []);
            } else {
                pushTextWithAutoLinks(spans, match[4], ['italic']);
            }
        } else if (match[5]) {
            // Link - handle incomplete links (no URL part)
            if (match[7]) {
                spans.push({ styles: [], text: match[6], url: linkDestination(match[7]) });
            } else {
                // If no URL part, treat as plain text with brackets
                pushTextWithAutoLinks(spans, `[${match[6]}]`, []);
            }
        } else if (match[8]) {
            // Inline code
            spans.push({ styles: ['code'], text: match[9], url: deliverablePathOf(match[9]) });
        }

        lastIndex = pattern.lastIndex;
    }

    // If there's any text remaining after the last match, treat it as plain
    if (lastIndex < markdown.length) {
        pushTextWithAutoLinks(spans, markdown.slice(lastIndex), []);
    }

    return spans;
}
