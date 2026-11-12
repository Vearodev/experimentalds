import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import {
  mergeDocuments,
  resolveGraph,
  toCss,
  cssName,
  referencesIn,
  nest,
  contrastRatio,
} from '../packages/tokens/engine.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const tokenRoot = resolve(root, 'packages/tokens');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const config = await readJson(resolve(tokenRoot, 'config.json'));
const legacy = await readJson(resolve(tokenRoot, 'legacy-map.json'));
const base = await Promise.all(
  config.sources.map(async (name) => ({
    document: await readJson(resolve(tokenRoot, 'src', name)),
    source: name,
  })),
);
const modes = {},
  css = [],
  registry = {};
for (const [theme, file] of Object.entries(config.themes)) {
  const tokens = mergeDocuments([
    ...base,
    { document: await readJson(resolve(tokenRoot, 'src', file)), source: file },
  ]);
  const resolved = resolveGraph(tokens);
  modes[theme] = { tokens, resolved };
  if (
    Object.keys(registry).length &&
    JSON.stringify(Object.keys(registry).sort()) !== JSON.stringify(Object.keys(tokens).sort())
  )
    throw new Error('Набор токенов отличается между темами.');
  Object.assign(registry, tokens);
  const declarations = Object.entries(tokens).map(
    ([path, token]) => `  ${cssName(path)}: ${toCss(token.$type, token.$value)};`,
  );
  for (const [name, path] of Object.entries(legacy)) {
    if (!tokens[path]) throw new Error(`Неизвестный переходный токен: ${name} → ${path}`);
    declarations.push(`  --basis-${name}: var(${cssName(path)});`);
  }
  const selector =
    (theme === 'light' ? ':root, ' : '') +
    `:root[data-basis-theme="${theme}"], .basis-theme-scope[data-basis-theme="${theme}"]`;
  css.push(`${selector} {\n  color-scheme: ${theme};\n${declarations.join('\n')}\n}`);
}
const checksum = createHash('sha256')
  .update(
    JSON.stringify(
      Object.fromEntries(Object.entries(modes).map(([key, value]) => [key, value.tokens])),
    ),
  )
  .digest('hex')
  .slice(0, 16);
const manifest = {
  version: config.version,
  format: config.format,
  checksum,
  themes: Object.keys(modes),
  typography: config.typography,
  tokens: Object.fromEntries(
    Object.keys(registry).map((path) => [
      path,
      {
        type: registry[path].$type,
        description: registry[path].$description,
        layer: path.split('.')[0],
        css: cssName(path),
        source: registry[path].source,
        modes: Object.fromEntries(
          Object.entries(modes).map(([theme, { tokens, resolved }]) => [
            theme,
            {
              raw: tokens[path].$value,
              value: resolved[path].value,
              cssValue: resolved[path].cssValue,
              references: referencesIn(tokens[path].$value),
            },
          ]),
        ),
      },
    ]),
  ),
};
const contrast = [];
for (const [theme, { resolved }] of Object.entries(modes)) {
  const pairs = [
    ['Основной текст', 'sys.color.text.primary', 'sys.color.surface.base'],
    ['Вторичный текст', 'sys.color.text.secondary', 'sys.color.surface.base'],
    ['Подписи', 'sys.color.text.muted', 'sys.color.surface.base'],
    ['Navigation text', 'sys.color.navigation.foreground', 'sys.color.navigation.background'],
    ['Navigation muted', 'sys.color.navigation.muted', 'sys.color.navigation.background'],
    ['Navigation selected', 'sys.color.navigation.foreground', 'sys.color.navigation.selected'],
    ['Navigation hover', 'sys.color.navigation.foreground', 'sys.color.navigation.hover'],
    ['Navigation group', 'sys.color.navigation.group-color', 'sys.color.navigation.background'],
    ['Navigation count', 'sys.color.navigation.muted', 'sys.color.navigation.count-background'],
  ];
  for (const variant of ['primary', 'secondary', 'tonal', 'danger'])
    for (const state of ['default', 'hover', 'pressed'])
      pairs.push([
        `Button ${variant} ${state}`,
        `sys.color.action.${variant}.fg`,
        `sys.color.action.${variant}.bg.${state}`,
      ]);
  for (const tone of ['neutral', 'success', 'warning', 'danger', 'info']) {
    const prefix = `sys.color.intent.${tone}`;
    for (const state of ['default', 'hover', 'pressed']) {
      pairs.push([
        `Button ${tone} primary ${state}`,
        `${prefix}.solid.foreground`,
        `${prefix}.solid.background.${state}`,
      ]);
      pairs.push([
        `Button ${tone} tonal ${state}`,
        `${prefix}.soft.foreground`,
        `${prefix}.soft.background.${state}`,
      ]);
      pairs.push([
        `Button ${tone} secondary ${state}`,
        `${prefix}.soft.foreground`,
        state === 'default'
          ? 'sys.color.surface.base'
          : `${prefix}.soft.background.${state === 'hover' ? 'default' : 'hover'}`,
      ]);
      pairs.push([
        `Button ${tone} ghost ${state}`,
        `${prefix}.soft.foreground`,
        state === 'default' ? 'sys.color.surface.base' : `${prefix}.soft.background.${state}`,
      ]);
    }
  }
  for (const component of ['tag', 'badge', 'message'])
    for (const tone of ['neutral', 'info', 'success', 'warning', 'danger'])
      pairs.push([
        component + ' ' + tone,
        'comp.' + component + '.tone.' + tone + '.foreground',
        'comp.' + component + '.tone.' + tone + '.background',
      ]);
  pairs.push(
    ['Chip', 'comp.chip.foreground', 'comp.chip.background'],
    ['Chip selected', 'comp.chip.selected-foreground', 'comp.chip.selected-background'],
  );
  for (const role of ['foreground', 'muted', 'prompt', 'accent', 'error'])
    pairs.push([
      'Console ' + role,
      'comp.console.terminal-' + role,
      'comp.console.terminal-background',
    ]);
  for (const [label, foreground, background] of pairs) {
    const ratio = contrastRatio(resolved[foreground].value, resolved[background].value);
    contrast.push({
      theme,
      label,
      foreground,
      background,
      ratio: Number(ratio.toFixed(2)),
      passes: ratio >= 4.5,
    });
  }
}
const contrastFailures = contrast.filter((row) => !row.passes);
if (contrastFailures.length)
  throw new Error(
    `Недостаточный контраст текста:\n${contrastFailures.map((row) => `${row.theme}: ${row.label} = ${row.ratio}`).join('\n')}`,
  );
manifest.contrast = contrast;
function scopes(path, type) {
  if (path.startsWith('ref.')) return [];
  if (type === 'color')
    return /border|grid|focus/.test(path)
      ? ['STROKE_COLOR']
      : /foreground|\.fg$|\.text\./.test(path)
        ? ['TEXT_FILL', 'SHAPE_FILL']
        : ['FRAME_FILL', 'SHAPE_FILL'];
  if (type === 'fontFamily') return ['FONT_FAMILY'];
  if (type === 'fontWeight') return ['FONT_WEIGHT'];
  if (type !== 'dimension') return [];
  return /radius/.test(path)
    ? ['CORNER_RADIUS']
    : /type\.size|font-size/.test(path)
      ? ['FONT_SIZE']
      : /leading/.test(path)
        ? ['LINE_HEIGHT']
        : /height|width|size|icon/.test(path)
          ? ['WIDTH_HEIGHT']
          : ['GAP'];
}
const figma = {
  version: config.version,
  checksum,
  description:
    'План коллекций и связей. Это контракт импорта, не подтверждение синхронизации с Figma.',
  collections: [
    { key: 'ref', name: '01 · Reference', modes: ['Value'] },
    { key: 'sys.color', name: '02 · Semantic colors', modes: ['Light', 'Dark'] },
    { key: 'sys.metrics', name: '03 · Semantic metrics', modes: ['Value'] },
    { key: 'comp', name: '04 · Components', modes: ['Value'] },
  ],
  variables: [],
  textStyles: config.typography,
  effectStyles: [],
};
for (const [path, token] of Object.entries(modes.light.tokens)) {
  if (token.$type === 'shadow') {
    figma.effectStyles.push({ name: path.replaceAll('.', '/'), tokens: token.$value });
    continue;
  }
  const collection = path.startsWith('sys.color.')
    ? 'sys.color'
    : path.startsWith('sys.')
      ? 'sys.metrics'
      : path.split('.')[0];
  figma.variables.push({
    path,
    name: path.replaceAll('.', '/'),
    collection,
    type:
      token.$type === 'color'
        ? 'COLOR'
        : token.$type === 'fontFamily' || token.$type === 'cubicBezier'
          ? 'STRING'
          : 'FLOAT',
    tokenType: token.$type,
    scopes: scopes(path, token.$type),
    web: `var(${cssName(path)})`,
    description: token.$description,
    figmaFamily: token.$extensions?.basis?.figmaFamily,
    values:
      collection === 'sys.color'
        ? { Light: modes.light.tokens[path].$value, Dark: modes.dark.tokens[path].$value }
        : { Value: token.$value },
  });
}
const outputs = new Map([
  [
    resolve(tokenRoot, 'styles.css'),
    '/* GENERATED: source is packages/tokens/src. Do not edit. */\n' + css.join('\n\n') + '\n',
  ],
  [resolve(tokenRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n'],
  [
    resolve(tokenRoot, 'tokens.json'),
    JSON.stringify(
      Object.fromEntries(
        Object.entries(legacy).map(([key, path]) => [key, modes.light.resolved[path].cssValue]),
      ),
      null,
      2,
    ) + '\n',
  ],
  [resolve(tokenRoot, 'figma-contract.json'), JSON.stringify(figma, null, 2) + '\n'],
  [
    resolve(tokenRoot, 'tokens.d.ts'),
    '// GENERATED\nexport type TokenName =\n' +
      Object.keys(registry)
        .map((path) => `  | '${path}'`)
        .join('\n') +
      ';\n',
  ],
]);
for (const [theme, { tokens }] of Object.entries(modes))
  outputs.set(
    resolve(tokenRoot, `exports/basis.${theme}.tokens.json`),
    JSON.stringify(
      { $description: `BASIS · ${theme} · ${config.version}`, ...nest(tokens) },
      null,
      2,
    ) + '\n',
  );
if (process.argv.includes('--check')) {
  for (const [file, content] of outputs) {
    let previous;
    try {
      previous = await readFile(file, 'utf8');
    } catch {}
    if (previous !== content)
      throw new Error(
        `Артефакт неактуален: ${relative(root, file)}. Запустите npm run tokens:build.`,
      );
  }
} else {
  await mkdir(resolve(tokenRoot, 'exports'), { recursive: true });
  for (const [file, content] of outputs) await writeFile(file, content);
}
console.log(
  `${Object.keys(registry).length} typed tokens · ${Object.keys(modes).length} themes · ${contrast.length} contrast pairs passed · ${checksum}`,
);
