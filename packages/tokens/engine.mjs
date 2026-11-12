/** Pure token graph engine. Shared by the build, design playground and import validation. */
export const supportedTypes = [
  'color',
  'dimension',
  'number',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'shadow',
];
const reference = /^\{([^{}]+)\}$/;
export const cssName = (path) => `--basis-${path.replaceAll('.', '-')}`;
export function referencesIn(value) {
  if (typeof value === 'string') {
    const match = value.match(reference);
    return match ? [match[1]] : [];
  }
  if (Array.isArray(value)) return value.flatMap(referencesIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(referencesIn);
  return [];
}
export function flatten(document, source = '') {
  const result = {};
  function walk(node, path = [], inheritedType) {
    if (!node || typeof node !== 'object' || Array.isArray(node))
      throw new Error(`Ожидается группа токенов: ${path.join('.')}`);
    const type = node.$type || inheritedType;
    if ('$value' in node) {
      if (!path.length) throw new Error('Токен не может быть корневым документом.');
      if (!supportedTypes.includes(type))
        throw new Error(`Неподдерживаемый тип ${type}: ${path.join('.')}`);
      result[path.join('.')] = { ...node, $type: type, source };
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (['__proto__', 'prototype', 'constructor'].includes(key) || !/^[a-zA-Z0-9_-]+$/.test(key))
        throw new Error(`Недопустимое имя группы/токена: ${key}`);
      walk(value, [...path, key], type);
    }
  }
  walk(document);
  return result;
}
export function mergeDocuments(documents) {
  const tokens = {};
  for (const { document, source = '' } of documents)
    for (const [path, token] of Object.entries(flatten(document, source))) {
      if (tokens[path])
        throw new Error(`Повторное определение ${path}: ${tokens[path].source} / ${source}`);
      tokens[path] = token;
    }
  return tokens;
}
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
function validateValue(type, value, path) {
  const invalid = (reason) => {
    throw new Error(`${path}: ${reason}`);
  };
  if (type === 'color') {
    if (
      !value ||
      value.colorSpace !== 'srgb' ||
      !Array.isArray(value.components) ||
      value.components.length !== 3 ||
      !value.components.every((n) => finite(n) && n >= 0 && n <= 1)
    )
      invalid('ожидается цвет sRGB с тремя компонентами 0…1.');
    if (value.alpha !== undefined && (!finite(value.alpha) || value.alpha < 0 || value.alpha > 1))
      invalid('alpha должен быть в диапазоне 0…1.');
  } else if (type === 'dimension') {
    if (!value || !finite(value.value) || !['px', 'rem'].includes(value.unit))
      invalid('ожидается dimension { value, unit: px | rem }.');
    if (value.value < 0 && !/offset|spread/.test(path))
      invalid('размер не может быть отрицательным.');
    if (value.value === 0 && /height|width|font.size|font.leading/.test(path))
      invalid('размер должен быть больше нуля.');
  } else if (type === 'duration') {
    if (!value || !finite(value.value) || value.value < 0 || !['ms', 's'].includes(value.unit))
      invalid('ожидается неотрицательная duration { value, unit: ms | s }.');
  } else if (type === 'fontFamily') {
    if (
      !(typeof value === 'string' && value.trim()) &&
      !(
        Array.isArray(value) &&
        value.length &&
        value.every((v) => typeof v === 'string' && v.trim())
      )
    )
      invalid('ожидается имя шрифта или непустой список имён.');
  } else if (type === 'fontWeight') {
    if (!finite(value) || value < 1 || value > 1000) invalid('ожидается fontWeight 1…1000.');
  } else if (type === 'number') {
    if (!finite(value)) invalid('ожидается конечное число.');
  } else if (type === 'cubicBezier') {
    if (
      !Array.isArray(value) ||
      value.length !== 4 ||
      !value.every(finite) ||
      value[0] < 0 ||
      value[0] > 1 ||
      value[2] < 0 ||
      value[2] > 1
    )
      invalid('некорректная кривая cubicBezier.');
  } else if (type === 'shadow') {
    if (!value || Array.isArray(value) || typeof value !== 'object')
      invalid('ожидается объект shadow.');
    validateValue('color', value.color, `${path}.color`);
    for (const name of ['offsetX', 'offsetY', 'blur', 'spread'])
      validateValue('dimension', value[name], `${path}.${name}`);
    if (value.blur.value < 0) invalid('blur не может быть отрицательным.');
  }
}
export function resolveGraph(tokens, { enforceLayers = true } = {}) {
  const cache = new Map(),
    visiting = [],
    names = new Map();
  for (const [path, token] of Object.entries(tokens)) {
    if (
      path
        .split('.')
        .some(
          (key) =>
            ['__proto__', 'prototype', 'constructor'].includes(key) ||
            !/^[a-zA-Z0-9_-]+$/.test(key),
        )
    )
      throw new Error(`Недопустимое имя токена: ${path}`);
    const name = cssName(path);
    if (names.has(name)) throw new Error(`Коллизия CSS-имён: ${path} / ${names.get(name)}.`);
    names.set(name, path);
    if (!token.$description?.trim()) throw new Error(`У токена ${path} нет описания.`);
    const dependencies = referencesIn(token.$value),
      layer = path.split('.')[0];
    if (enforceLayers) {
      if (!['ref', 'sys', 'comp'].includes(layer)) throw new Error(`Неизвестный слой ${path}.`);
      if (layer !== 'ref' && !dependencies.length)
        throw new Error(`Токен ${path} должен ссылаться на смысловой или исходный уровень.`);
      for (const dep of dependencies) {
        const targetLayer = dep.split('.')[0];
        if (layer === 'ref' && targetLayer !== 'ref')
          throw new Error(`Исходный токен ${path} не может зависеть от ${dep}.`);
        if (layer === 'sys' && targetLayer === 'comp')
          throw new Error(`Семантика ${path} не может зависеть от компонента ${dep}.`);
        if (layer === 'comp' && targetLayer === 'ref')
          throw new Error(
            `Компонент ${path} должен обращаться к исходному значению через семантическую роль.`,
          );
      }
    }
  }
  function resolve(path) {
    if (cache.has(path)) return cache.get(path);
    const token = tokens[path];
    if (!token) throw new Error(`Разорванная ссылка: ${[...visiting, path].join(' → ')}`);
    if (visiting.includes(path)) throw new Error(`Цикл ссылок: ${[...visiting, path].join(' → ')}`);
    visiting.push(path);
    function expand(value, expectedType) {
      if (typeof value === 'string' && reference.test(value)) {
        const target = value.match(reference)[1],
          resolved = resolve(target);
        if (expectedType && tokens[target].$type !== expectedType)
          throw new Error(
            `Несовместимые типы: ${path} (${expectedType}) → ${target} (${tokens[target].$type}).`,
          );
        return resolved;
      }
      if (Array.isArray(value)) return value.map((item) => expand(item));
      if (value && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [
            key,
            expand(
              item,
              token.$type === 'shadow'
                ? key === 'color'
                  ? 'color'
                  : ['offsetX', 'offsetY', 'blur', 'spread'].includes(key)
                    ? 'dimension'
                    : undefined
                : undefined,
            ),
          ]),
        );
      return value;
    }
    const value = expand(token.$value, token.$type);
    validateValue(token.$type, value, path);
    visiting.pop();
    cache.set(path, value);
    return value;
  }
  Object.keys(tokens).forEach(resolve);
  return Object.fromEntries(
    Object.entries(tokens).map(([path, token]) => [
      path,
      {
        ...token,
        path,
        value: cache.get(path),
        references: referencesIn(token.$value),
        css: cssName(path),
        cssValue: toCss(token.$type, cache.get(path)),
      },
    ]),
  );
}
export function toCss(type, value) {
  const alias = typeof value === 'string' && value.match(reference);
  if (alias) return `var(${cssName(alias[1])})`;
  if (type === 'color') {
    const rgb = value.components.map((n) => Math.round(n * 255)),
      alpha = value.alpha ?? 1;
    return alpha === 1
      ? '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('')
      : `rgb(${rgb.join(' ')} / ${alpha})`;
  }
  if (type === 'dimension' || type === 'duration') return `${value.value}${value.unit}`;
  if (type === 'fontFamily')
    return (Array.isArray(value) ? value : [value])
      .map((name) =>
        ['system-ui', 'sans-serif', 'serif', 'monospace'].includes(name)
          ? name
          : JSON.stringify(name),
      )
      .join(', ');
  if (type === 'cubicBezier') return `cubic-bezier(${value.join(', ')})`;
  if (type === 'shadow')
    return ['offsetX', 'offsetY', 'blur', 'spread']
      .map((key) => toCss('dimension', value[key]))
      .concat(toCss('color', value.color))
      .join(' ');
  return String(value);
}
export function impactOf(tokens, path) {
  const impacted = new Set(),
    queue = [path];
  while (queue.length) {
    const current = queue.shift();
    for (const [key, token] of Object.entries(tokens))
      if (!impacted.has(key) && referencesIn(token.$value).includes(current)) {
        impacted.add(key);
        queue.push(key);
      }
  }
  return [...impacted];
}
export function chainOf(tokens, path) {
  const chain = [],
    seen = new Set();
  let current = path;
  while (current && tokens[current] && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    const refs = referencesIn(tokens[current].$value);
    current = refs.length === 1 ? refs[0] : null;
  }
  return chain;
}
export function nest(tokens) {
  const document = {};
  for (const [path, token] of Object.entries(tokens)) {
    let node = document;
    const keys = path.split('.');
    for (const key of keys.slice(0, -1)) node = node[key] ??= {};
    const { $type, $value, $description, $extensions } = token;
    node[keys.at(-1)] = { $type, $value, $description, ...($extensions ? { $extensions } : {}) };
  }
  return document;
}
export function colorFromHex(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('Используйте цвет в формате #RRGGBB.');
  return {
    colorSpace: 'srgb',
    components: [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16) / 255),
    alpha: 1,
  };
}
export function contrastRatio(a, b) {
  const luminance = (value) =>
    value.components
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
