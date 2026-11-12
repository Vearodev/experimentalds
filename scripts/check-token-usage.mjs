import { readFile } from 'node:fs/promises';
const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const manifest = await readJson('../packages/tokens/manifest.json'),
  legacy = await readJson('../packages/tokens/legacy-map.json');
const names = new Set([
  ...Object.keys(manifest.tokens).map((path) => '--basis-' + path.replaceAll('.', '-')),
  ...Object.keys(legacy).map((name) => '--basis-' + name),
]);
const files = [
  'apps/cloud/src/cloud.css',
  'apps/cloud/src/navigation.css',
  'packages/ui/src/theme.css',
  'packages/ui/src/extended.css',
  'apps/playground/src/extended-pages.css',
  'packages/ui/src/button-tones.css',
  'packages/ui/src/table-select.css',
  'packages/ui/src/context-panel.css',
  'packages/ui/src/table-tools.css',
  'apps/playground/src/table-tools.css',
  'apps/playground/src/token-architecture.css',
  'apps/playground/src/playground.css',
  'apps/playground/src/design-workbench.css',
];
let failures = [];
for (const file of files) {
  const css = await readFile(new URL('../' + file, import.meta.url), 'utf8');
  for (const match of css.matchAll(/var\((--basis-[a-z0-9-]+)/g))
    if (!names.has(match[1])) failures.push(`${file}: ${match[1]}`);
  if (/#[\da-f]{3,8}\b/i.test(css)) failures.push(`${file}: raw color outside token source`);
}
if (failures.length) throw new Error([...new Set(failures)].join('\n'));
console.log('Token usage: all CSS references resolve; no raw colors in UI styles.');
