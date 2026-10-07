import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './parseMarkdown';

const item = (spans: { styles: string[]; text: string; url: string | null }[]) => ({
    depth: 0,
    spans,
});

describe('parseMarkdown', () => {
    it('parses unordered lists across common markdown bullet markers and preserves clickable links', () => {
        const blocks = parseMarkdown([
            '* first item',
            '+ second item with [docs](https://example.com/docs)',
            '- third item with https://example.com/raw.',
        ].join('\n'));

        expect(blocks).toHaveLength(1);
        expect(blocks[0]?.type).toBe('list');

        if (blocks[0]?.type !== 'list') {
            throw new Error('Expected markdown list block');
        }

        expect(blocks[0].items).toHaveLength(3);
        expect(blocks[0].items[1]).toEqual(item([
            { styles: [], text: 'second item with ', url: null },
            { styles: [], text: 'docs', url: 'https://example.com/docs' },
        ]));
        expect(blocks[0].items[2]).toEqual(item([
            { styles: [], text: 'third item with ', url: null },
            { styles: [], text: 'https://example.com/raw', url: 'https://example.com/raw' },
            { styles: [], text: '.', url: null },
        ]));
    });

    it('parses standalone markdown image blocks', () => {
        const blocks = parseMarkdown('![Markdown renderable image](data:image/png;base64,abc123)');

        expect(blocks).toEqual([
            {
                type: 'image',
                alt: 'Markdown renderable image',
                url: 'data:image/png;base64,abc123',
            },
        ]);
    });

    it('auto-linkifies bare URLs in text blocks', () => {
        const blocks = parseMarkdown('Visit https://example.com/docs for more.');

        expect(blocks).toHaveLength(1);
        expect(blocks[0]?.type).toBe('text');

        if (blocks[0]?.type !== 'text') {
            throw new Error('Expected markdown text block');
        }

        expect(blocks[0].content).toEqual([
            { styles: [], text: 'Visit ', url: null },
            { styles: [], text: 'https://example.com/docs', url: 'https://example.com/docs' },
            { styles: [], text: ' for more.', url: null },
        ]);
    });

    it('reads a link destination written in angle brackets, spaces and all', () => {
        const path = '/Users/steve/Library/Application Support/KISSOPEN/Bots/secretary/outputs/商业提案.pptx';
        const blocks = parseMarkdown(`[下载 ppt](<${path}>) · [说明](docs/plan.md)`);
        expect(blocks[0]?.type).toBe('text');
        if (blocks[0]?.type !== 'text') return;
        const links = blocks[0].content.filter((span) => span.url !== null);
        expect(links.map((span) => span.url)).toEqual([path, 'docs/plan.md']);
    });

    it('links a delivered file named in backticks, and nothing else in backticks', () => {
        const blocks = parseMarkdown('文件：`outputs/超级简单的狗狗PPT.pptx`，运行 `npm run build`，见 `package.json` 和 `report final.pdf`');
        expect(blocks[0]?.type).toBe('text');
        if (blocks[0]?.type !== 'text') return;
        const links = blocks[0].content.filter((span) => span.url !== null);
        expect(links.map((span) => span.url)).toEqual(['outputs/超级简单的狗狗PPT.pptx', 'report final.pdf']);
        expect(links[0]?.styles).toEqual(['code']);
    });
});
