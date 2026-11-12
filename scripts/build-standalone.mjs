import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A review copy that opens directly from disk, with no local server or network.
// Development still uses the workspace packages and Vite.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
const files = await readdir(resolve(output, 'assets'));
const scriptFile = files.find((file) => /^index-.*\.js$/.test(file));
const styleFile = files.find((file) => /^index-.*\.css$/.test(file));
if (!scriptFile || !styleFile)
  throw new Error('Run vite build before building the offline preview.');
let html = await readFile(resolve(output, 'index.html'), 'utf8');
let js = await readFile(resolve(output, 'assets', scriptFile), 'utf8');
let css = await readFile(resolve(output, 'assets', styleFile), 'utf8');
for (const name of files.filter((file) => file.endsWith('.woff2'))) {
  const data = await readFile(resolve(output, 'assets', name));
  css = css.replaceAll(`/assets/${name}`, `data:font/woff2;base64,${data.toString('base64')}`);
}
const logo = await readFile(resolve(output, 'basis-logo.png'));
css = css.replaceAll('/basis-logo.png', `data:image/png;base64,${logo.toString('base64')}`);
js = js.replaceAll('/basis-logo.png', `data:image/png;base64,${logo.toString('base64')}`);
html = html.replace(/<script\b[^>]*src="[^"]*"[^>]*><\/script>/g, '');
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, '');
html = html.replace(
  '</head>',
  () => `<meta name="basis-demo-transport" content="embedded"><style>${css}</style></head>`,
);
html = html.replace(
  '</body>',
  () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script></body>`,
);
await writeFile(resolve(root, 'playground.html'), html);
const cloudHtml = html.replace(
  '<head>',
  '<head><script>if (!location.hash) location.hash = "#cloud/overview";</script>',
);
await writeFile(resolve(root, 'cloud-demo.html'), cloudHtml);
await writeFile(resolve(output, 'cloud-demo.html'), cloudHtml);
console.log(
  `Standalone previews: playground.html, cloud-demo.html (${Math.round(Buffer.byteLength(html) / 1024)} KiB each)`,
);
