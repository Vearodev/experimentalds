import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

// A real static host: no API middleware, directory listing or SPA fallback.
export function createPagesPreview(directory, base) {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))
    throw new Error('Base must be / or a path such as /repository/.');
  const root = resolve(directory);
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      if (base !== '/' && pathname === base.slice(0, -1)) {
        res.writeHead(308, { Location: base + url.search }).end();
        return;
      }
      if (!pathname.startsWith(base)) {
        res.writeHead(404).end('Not found');
        return;
      }
      const file = resolve(root, pathname.slice(base.length) || 'index.html');
      const within = relative(root, file);
      if (isAbsolute(within) || within === '..' || within.startsWith(`..${sep}`)) {
        res.writeHead(404).end('Not found');
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Content-Length': data.length,
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      res.writeHead(error instanceof URIError ? 400 : 404).end('Not found');
    }
  });
}

export async function listenPagesPreview(server, port = 0) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}
