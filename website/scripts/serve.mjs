import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { render } from '../src/site.mjs';
import { renderDownload } from '../src/download.mjs';
import { localeForPath, downloadLocaleForPath, downloadPath } from '../src/locales.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const built = process.argv.includes('--built');
const base = resolve(root, built ? 'dist' : '.');
const port = Number(process.env.PORT || 4322);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.xml':'application/xml', '.txt':'text/plain', '.woff2':'font/woff2' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let body, type;
    const locale = localeForPath(pathname);
    const downloadLocale = downloadLocaleForPath(pathname);
    if (['/downloads', '/downloads/'].includes(pathname)) { res.writeHead(308, {Location:'/download/'}); res.end(); return; }
    if (downloadLocale) {
      if (!pathname.endsWith('/') && !pathname.endsWith('/index.html')) { res.writeHead(308,{Location:pathname+'/'}); res.end(); return; }
      body = built ? await readFile(resolve(base,'.'+downloadPath(downloadLocale)+'index.html')) : renderDownload(downloadLocale.id,JSON.parse(await readFile(root+'releases.json','utf8')),JSON.parse(await readFile(root+'release-details.json','utf8')));
      type = types['.html'];
    } else if (locale) {
      if (pathname !== '/' && !pathname.endsWith('/') && !pathname.endsWith('/index.html')) {
        res.writeHead(308, { Location: pathname + '/' }); res.end(); return;
      }
      body = built ? await readFile(resolve(base, '.' + locale.path + 'index.html')) : render(locale.id, JSON.parse(await readFile(root + 'releases.json', 'utf8')));
      type = types['.html'];
    } else {
      if (pathname === '/install') {
        body = await readFile(resolve(base, 'install/install.sh'));
        res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-cache'});
        res.end(req.method === 'HEAD' ? undefined : body);
        return;
      }
      if (!/^\/(assets\/[^?]+|install\/(install\.sh|PKGBUILD|kissopen\.rb)|style\.css|main\.js|download\.css|download\.js|cli\.js|robots\.txt|sitemap\.xml)$/.test(pathname)) throw Error('not found');
      const file = resolve(base, !built && ['/style.css', '/main.js', '/download.css', '/download.js', '/cli.js'].includes(pathname) ? 'src' + pathname : '.' + pathname);
      if (!file.startsWith(base + sep)) throw Error('not found');
      body = await readFile(file); type = pathname.startsWith('/install/') ? 'text/plain; charset=utf-8' : types[extname(file)] || 'application/octet-stream';
    }
    res.writeHead(200, {'Content-Type':type, 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`KissOpen website: http://127.0.0.1:${port}${built ? ' (production build)' : ''}`));
