import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const output = fileURLToPath(new URL('../dist-pages/', import.meta.url));
const html = await readFile(resolve(output, 'index.html'), 'utf8');
if (!html.includes('name="basis-demo-transport" content="embedded"'))
  throw new Error('Pages requires the embedded mock transport. Run vite build --mode pages.');

await writeFile(resolve(output, 'playground.html'), html);
await writeFile(
  resolve(output, 'cloud-demo.html'),
  html
    .replace(
      '<head>',
      '<head><script>if (!location.hash) location.hash = "#cloud/overview";</script>',
    )
    .replace('<title>BASIS — дизайн-система</title>', '<title>Basis statix</title>'),
);
await writeFile(resolve(output, '.nojekyll'), '');
console.log('Pages ready: dist-pages/ · design system + cloud demo · browser-local data');
