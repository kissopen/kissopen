import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { render } from '../src/site.mjs';
import { renderDownload } from '../src/download.mjs';
import { locales, localeForPath, downloadPath, downloadLocaleForPath } from '../src/locales.mjs';

const releases = JSON.parse(await readFile(new URL('../releases.json', import.meta.url), 'utf8'));
const details = JSON.parse(await readFile(new URL('../release-details.json', import.meta.url), 'utf8'));
let reference;
for (const locale of locales) {
  const html = render(locale.id, releases);
  const copy = JSON.parse(html.match(/id="page-copy">(.*?)<\/script>/s)[1]);
  const shape = Object.fromEntries(Object.entries(copy).map(([key, value]) => [key, Array.isArray(value) ? value.length : typeof value]));
  reference ??= shape;
  assert.deepEqual(shape, reference, locale.id + ' translation keys/array lengths');
  assert.equal(localeForPath(locale.path).id, locale.id);
  assert.equal(localeForPath(locale.path + 'index.html').id, locale.id);
  assert.ok(html.includes(`<html lang="${locale.tag}">`));
  assert.ok(html.includes(`<link rel="canonical" href="https://kissopen.com${locale.path}">`));
  assert.equal((html.match(/<option /g) || []).length, 6);
  assert.equal((html.match(/hreflang=/g) || []).length, 7);
  assert.ok(html.includes(`value="${locale.path}" lang="${locale.tag}" selected`));
  assert.ok(html.includes('class="footer-language"'));
  assert.match(html, /href="\/style\.css\?v=[a-f0-9]{12}"/);
  assert.match(html, /src="\/main\.js\?v=[a-f0-9]{12}"/);
  assert.ok(html.includes('<noscript><nav class="language-fallback"'));
  assert.ok(!html.includes('class="language"'));
  assert.ok(!html.includes('undefined'));
  assert.ok(html.includes(`href="${downloadPath(locale)}"`) && !html.includes('data-dialog="download"'));
  const downloads = renderDownload(locale.id, releases, details);
  assert.equal(downloadLocaleForPath(downloadPath(locale)).id,locale.id);
  assert.ok(downloads.includes(`href="https://kissopen.com${downloadPath(locale)}"`));
  for (const key of ['windows','macArm64','macIntel','android']) assert.ok(downloads.includes(`href="${releases[key]}"`) && downloads.includes(details[key].sha256));
  assert.equal(await readFile(new URL('../dist'+downloadPath(locale)+'index.html',import.meta.url),'utf8'),downloads);
  for (const [key, value] of Object.entries(copy)) {
    assert.ok(Array.isArray(value) ? value.every(text => typeof text === 'string' && text.length) : typeof value === 'string' && value.length, locale.id + ':' + key);
    if (['selected', 'pluginCount'].includes(key)) assert.ok(value.includes('{n}'));
  }
  assert.equal(await readFile(new URL('../dist' + locale.path + 'index.html', import.meta.url), 'utf8'), html);
  console.log(`${locale.tag}: translation, routing, metadata, footer and download links OK`);
}
assert.ok(render().startsWith('<!doctype html><html lang="en">'));
assert.equal(localeForPath('/en/').id, 'en');
assert.equal(localeForPath('/v1/community/auth/start'), undefined);
const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
assert.equal((sitemap.match(/<url>/g) || []).length, 12);
console.log('Default English and legacy /en/ compatibility verified.');
