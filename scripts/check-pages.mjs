import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createPagesPreview, listenPagesPreview } from './pages-preview-server.mjs';

const output = fileURLToPath(new URL('../dist-pages/', import.meta.url));
const entries = ['index.html', 'playground.html', 'cloud-demo.html'];
await access(resolve(output, '.nojekyll'));
const rootFiles = await readdir(output);
assert.deepEqual(
  rootFiles.sort(),
  [...entries, '.nojekyll', 'assets', 'basis-logo.png'].sort(),
  'Publish only the generated static site.',
);
const assets = await readdir(resolve(output, 'assets'));
assert(
  assets.some((name) => name.endsWith('.woff2')),
  'Onest must be bundled.',
);
assert(!assets.some((name) => name.endsWith('.map')), 'Do not publish source maps.');

for (const base of ['/', '/design-concepts/', '/nested/design-concepts/']) {
  const server = createPagesPreview(output, base);
  const origin = await listenPagesPreview(server);
  const checked = new Set();
  const checkAsset = async (reference, parent) => {
    if (reference.startsWith('data:')) return;
    assert(!/^(?:\/|[a-z]+:)/i.test(reference), `Expected a relative asset: ${reference}`);
    const url = new URL(reference, parent);
    assert(url.pathname.startsWith(base), `Asset escaped the deployment base: ${url}`);
    if (checked.has(url.href)) return;
    checked.add(url.href);
    const response = await fetch(url);
    assert.equal(response.status, 200, `Missing asset: ${url}`);
    if (url.pathname.endsWith('.css')) {
      assert(response.headers.get('content-type').startsWith('text/css'));
      const css = await response.text();
      for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g))
        await checkAsset(match[1], url);
    } else {
      if (url.pathname.endsWith('.js'))
        assert(response.headers.get('content-type').startsWith('text/javascript'));
      await response.arrayBuffer();
    }
  };
  try {
    for (const name of entries) {
      const url = `${origin}${base}${name}`;
      const response = await fetch(url);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert(html.includes('name="basis-demo-transport" content="embedded"'));
      for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g))
        await checkAsset(match[1], url);
      if (name === 'cloud-demo.html') assert(html.includes('"#cloud/overview"'));
    }
    await checkAsset('./basis-logo.png', `${origin}${base}`);
    const response = await fetch(`${origin}${base}`);
    assert.equal(response.status, 200, 'The site root must open the design system.');
    await response.arrayBuffer();
    for (const path of ['api/demo/state', 'cloud/vms', 'missing-file.js']) {
      const missing = await fetch(`${origin}${base}${path}`);
      assert.equal(
        missing.status,
        404,
        'The preview must not hide missing resources or serve an API.',
      );
      await missing.arrayBuffer();
    }
    console.log(`Pages verified at ${base}: 3 entry points, ${checked.size} local assets, no API`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const cloud = await readFile(resolve(output, 'cloud-demo.html'), 'utf8');
assert(cloud.includes('<title>BASIS Cloud</title>'));
