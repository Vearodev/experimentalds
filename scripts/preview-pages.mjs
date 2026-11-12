import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createPagesPreview, listenPagesPreview } from './pages-preview-server.mjs';

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: '/basis-preview/' },
    port: { type: 'string', default: '4174' },
  },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
const output = fileURLToPath(new URL('../dist-pages/', import.meta.url));
await access(new URL('../dist-pages/index.html', import.meta.url)).catch(() => {
  throw new Error('Build the static site first: npm run build:pages');
});
const server = createPagesPreview(output, values.base);
const origin = await listenPagesPreview(server, port);
console.log(`Design system: ${origin}${values.base}`);
console.log(`Cloud demo:    ${origin}${values.base}cloud-demo.html`);
console.log('Static Pages preview · no server API · Ctrl+C to stop');
