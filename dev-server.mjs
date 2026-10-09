// Local preview: `npm run dev` → http://localhost:3000 (booking) and /admin (PIN 1234).
// Serves /public and runs /api/*.js exactly like Vercel does. Data is kept in .data/db.json.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (pathname.startsWith('/api/')) {
      const file = path.join(root, pathname.replace(/\/$/, '') + '.js');
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    }
    let p = pathname === '/booking' ? '/index.html' : pathname;
    let file = path.join(root, 'public', p);
    const st = await fs.stat(file).catch(() => null);
    if (st?.isDirectory()) file = path.join(file, 'index.html');
    else if (!st) file += '.html';
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'ERR_MODULE_NOT_FOUND') console.error(e);
    res.writeHead(404); res.end('Not found');
  }
}).listen(process.env.PORT || 3000, () => console.log(`http://localhost:${process.env.PORT || 3000}`));
