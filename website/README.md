# KissOpen website

Independent, multilingual project website. English is the default at `/`. The footer language dropdown offers English, Simplified Chinese (`/zh-cn/`), Traditional Chinese (`/zh-tw/`), Japanese (`/ja/`), Korean (`/ko/`), and Russian (`/ru/`). Existing `/en/` links remain compatible, with `/` as their canonical URL. This does not modify the existing desktop, mobile, Agent, or account service.

## Develop and build

Requires Node.js 22 or later. No npm dependencies or installation required.

```sh
npm run dev
# http://127.0.0.1:4322
npm run build
node scripts/check-locales.mjs
npm run preview
```

`dist/` is a static deployment artifact. The build prerenders all six languages, copies brand assets and creates robots.txt and sitemap.xml. `src/site.mjs` contains the renderer and original copy, `src/locales.mjs` the locale registry and additional translations, `src/style.css` the responsive design, and `src/main.js` the progressive enhancements. Locale selection is explicit, not inferred from browser language. Switching preserves the current section hash; without JavaScript, the footer provides language links.

The site includes an animated desktop/mobile handoff demo, pointer-reactive dot matrix, scroll reveals, model selection, theme previews, plugin switches and an illustrative scheduled-task run. These are demonstrations only; they do not call the real product API or require credentials. Motion can be paused or disabled, respects the system's reduced-motion preference, and stops while the page is hidden. Primary content and language navigation work without JavaScript.

## Release links and deployment

Downloads have a dedicated page at `/download/` and at each locale's `/download/` path (for example `/zh-cn/download/`). `/en/download/` remains an English alias and `/downloads/` redirects to `/download/`. Homepage download links navigate directly to this page without JavaScript. `src/download.mjs`, `download-copy.mjs`, `download.css`, and `download.js` provide its renderer, translations, responsive layout, and appearance/language controls. Keep `release-details.json` in sync with the verified versions, sizes and checksums in `releases.json`. The download page includes Windows, both Mac architectures, Android, the Web client, and an unavailable iOS status. Language switching stays on the download page. All download pages are included in the sitemap and deployment checksums.

Set verified HTTPS URLs in `releases.json` for each available platform and the public source repository. Null URLs display an honest unavailable status instead of linking to a nonexistent release. Do not publish unverified or private build artifacts. Replace the development-preview copy when public releases become available.

GitHub links open `https://github.com/kissopen/kissopen` directly in a new tab. Both page headers use the GitHub mark; homepage contribution, footer and mobile navigation links also point to the repository. The source dialog and its preparation copy were retired when the repository became public.

Homepage and download pages share `renderHeader` and `renderFooter` in `src/site.mjs`, including mobile navigation, theme controls, and the language selector. Download cards and buttons use the homepage classes and theme tokens in `style.css`; `download.css` only adds download content layout. Download-page navigation links return to the selected language's homepage sections, and language switching keeps the download route.

The project website is deployed at `https://kissopen.com/`, with English at the root and other locales at the paths above. The Web client lives at `https://app.kissopen.com/`. Header, mobile navigation, and download-dialog links use the client subdomain. Existing API and OAuth callback addresses remain on `kissopen.com`; both origins reach the same relay/account services. See `deploy/deployment-2026-10-06.md` for release paths and rollback notes.

Light/dark mode follows the system until manually selected, then persists across all language routes. Brand lockups use their supplied primary/inverse variants.

Brand SVGs are copied unchanged from `../brand/`. The optional Manrope font uses Google Fonts; a system font stack remains available when offline.
