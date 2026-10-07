import { mkdir, writeFile, cp, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { render } from '../src/site.mjs';
import { locales } from '../src/locales.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const releases = JSON.parse(await readFile(root + 'releases.json', 'utf8'));
for (const locale of locales) {
  const directory = root + 'dist' + locale.path;
  await mkdir(directory, { recursive: true });
  await writeFile(directory + 'index.html', render(locale.id, releases));
}
await mkdir(root + 'dist/en', { recursive: true });
await writeFile(root + 'dist/en/index.html', render('en', releases));
await cp(root + 'assets', root + 'dist/assets', { recursive: true });
for (const name of ['style.css', 'main.js']) await cp(root + 'src/' + name, root + 'dist/' + name);
await writeFile(root + 'dist/robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://kissopen.com/sitemap.xml\n');
await writeFile(root + 'dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + locales.map(locale => `<url><loc>https://kissopen.com${locale.path}</loc></url>`).join('') + '</urlset>');
const files = ['index.html', 'en/index.html', ...locales.slice(1).map(locale => locale.path.slice(1) + 'index.html'), 'style.css', 'main.js', 'robots.txt', 'sitemap.xml', 'assets/logo.svg', 'assets/logo-light.svg', 'assets/mark.svg', 'assets/favicon.ico'];
const checksums = await Promise.all(files.map(async file => `${createHash('sha256').update(await readFile(root + 'dist/' + file)).digest('hex')}  ${file}`));
await writeFile(root + 'dist/SITE-SHA256SUMS', checksums.join('\n') + '\n');
console.log('Built six language pages in website/dist (English default; /en/ compatibility alias)');
