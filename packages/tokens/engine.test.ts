import { describe, it, expect } from 'vitest';
import {
  flatten,
  resolveGraph,
  toCss,
  impactOf,
  chainOf,
  nest,
  colorFromHex,
  contrastRatio,
  type TokenMap,
} from './engine.mjs';
import manifest from './manifest.json';
const metric = (value: unknown) => ({
  $type: 'dimension' as const,
  $value: value,
  $description: 'Метрика',
});
const graph: TokenMap = {
  'ref.radius.control': metric({ value: 8, unit: 'px' }),
  'sys.radius.control': metric('{ref.radius.control}'),
  'comp.button.radius': metric('{sys.radius.control}'),
};
describe('Design token graph', () => {
  it('preserves aliases in CSS and resolves transitive changes', () => {
    expect(toCss('dimension', graph['comp.button.radius'].$value)).toBe(
      'var(--basis-sys-radius-control)',
    );
    expect(resolveGraph(graph)['comp.button.radius'].value.value).toBe(8);
    const changed = { ...graph, 'ref.radius.control': metric({ value: 12, unit: 'px' }) };
    expect(resolveGraph(changed)['comp.button.radius'].cssValue).toBe('12px');
    expect(impactOf(graph, 'ref.radius.control')).toEqual([
      'sys.radius.control',
      'comp.button.radius',
    ]);
    expect(chainOf(graph, 'comp.button.radius')).toEqual([
      'comp.button.radius',
      'sys.radius.control',
      'ref.radius.control',
    ]);
  });
  it('rejects broken references, cycles and incompatible types', () => {
    expect(() =>
      resolveGraph({ ...graph, 'sys.radius.control': metric('{ref.radius.missing}') }),
    ).toThrow(/Разорванная/);
    expect(() =>
      resolveGraph({ ...graph, 'ref.radius.control': metric('{ref.radius.control}') }),
    ).toThrow(/Цикл/);
    expect(() =>
      resolveGraph({
        ...graph,
        'ref.radius.control': { $type: 'number', $value: 8, $description: 'Число' },
      }),
    ).toThrow(/Несовместимые/);
  });
  it('enforces layer direction and unique CSS names', () => {
    expect(() =>
      resolveGraph({ ...graph, 'comp.button.radius': metric('{ref.radius.control}') }),
    ).toThrow(/через семантическую/);
    expect(() =>
      resolveGraph({ ...graph, 'sys.radius.control': metric('{comp.button.radius}') }),
    ).toThrow(/не может зависеть/);
    expect(() =>
      resolveGraph({
        'ref.a.b': metric({ value: 1, unit: 'px' }),
        'ref.a-b': metric({ value: 2, unit: 'px' }),
      }),
    ).toThrow(/Коллизия/);
  });
  it('round trips the supported DTCG subset and rejects unsafe keys', () => {
    expect(resolveGraph(flatten(nest(graph)))['comp.button.radius'].cssValue).toBe('8px');
    expect(() =>
      flatten(JSON.parse('{"ref":{"__proto__":{"$type":"number","$value":1}}}')),
    ).toThrow(/Недопустимое/);
  });
  it('resolves both complete themes and keeps geometry shared', () => {
    for (const mode of ['light', 'dark'] as const) {
      const source = Object.fromEntries(
        Object.entries(manifest.tokens).map(([path, token]) => [
          path,
          { $type: token.type, $value: token.modes[mode].raw, $description: token.description },
        ]),
      ) as TokenMap;
      const resolved = resolveGraph(source);
      expect(resolved['comp.button.size.md.height'].cssValue).toBe('36px');
      expect(resolved['comp.table.row-height'].cssValue).toBe('40px');
      expect(resolved['comp.button.primary.background.default'].cssValue).toBe(
        mode === 'light' ? '#1c2a60' : '#44b6fb',
      );
    }
    expect(manifest.contrast.every((pair) => pair.passes)).toBe(true);
  });
  it('calculates contrast and validates invalid colors and durations', () => {
    expect(contrastRatio(colorFromHex('#000000'), colorFromHex('#ffffff'))).toBe(21);
    expect(() => colorFromHex('blue')).toThrow();
    expect(() =>
      resolveGraph({
        'ref.motion.duration': {
          $type: 'duration',
          $description: 'Длительность',
          $value: { value: -1, unit: 'ms' },
        },
      }),
    ).toThrow(/неотрицательная/);
  });
});
