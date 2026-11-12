import { readFile, readdir } from 'node:fs/promises';

async function styles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) result.push(...(await styles(path)));
    else if (entry.name.endsWith('.css')) result.push(path);
  }
  return result;
}

const failures = [];
for (const file of await styles(new URL('../apps/', import.meta.url))) {
  const css = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (
      !/\.basis-(?:tabs|data-table|table-tools|context-panel|sidebar-nav|workspace-tabs|console)(?:\b|__)/.test(
        selector,
      )
    )
      continue;
    const names = [...body.matchAll(/(?:^|;)\s*([\w-]+)\s*:/g)].map((match) => match[1]);
    // A page may limit the resource viewport; it may not restyle its contents.
    const viewportOnly =
      selector.trim().endsWith('.basis-data-table__scroll') &&
      names.length > 0 &&
      names.every((name) => ['max-height', 'min-height'].includes(name));
    if (!viewportOnly) failures.push(`${file.pathname}: ${selector.trim()}`);
  }
}
if (failures.length)
  throw new Error(
    'Component appearance belongs in packages/ui, not app CSS:\n' + failures.join('\n'),
  );
console.log(
  'Component boundaries: tabs, tables, table tools and workspace navigation have no application style overrides.',
);
