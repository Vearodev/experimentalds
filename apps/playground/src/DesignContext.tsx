import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import manifestJson from '@basis/tokens/manifest.json';
import legacy from '@basis/tokens/legacy-map.json';
import {
  resolveGraph,
  toCss,
  cssName,
  nest,
  type TokenMap,
  type ResolvedToken,
  type TokenType,
} from '@basis/tokens/engine';

export type Theme = 'light' | 'dark';
type Edits = {
  shared: Record<string, unknown>;
  light: Record<string, unknown>;
  dark: Record<string, unknown>;
};
type ManifestToken = {
  type: TokenType;
  description: string;
  layer: string;
  css: string;
  source: string;
  modes: Record<Theme, { raw: any; value: any; cssValue: string; references: string[] }>;
};
export const tokenManifest = manifestJson as unknown as {
  version: string;
  checksum: string;
  tokens: Record<string, ManifestToken>;
  contrast: { theme: string; label: string; ratio: number; passes: boolean }[];
};
const empty = (): Edits => ({ shared: {}, light: {}, dark: {} });
const key = 'basis.design-experiment.v2';
const initial = () => {
  try {
    const raw = localStorage.getItem(key),
      saved = JSON.parse(raw || 'null');
    if (!saved?.edits) return empty();
    const next = empty();
    for (const group of ['shared', 'light', 'dark'] as const) {
      if (!saved.edits[group] || typeof saved.edits[group] !== 'object')
        throw new Error('Invalid experiment');
      for (const [path, value] of Object.entries(saved.edits[group])) {
        // 0.3 retires the decorative button mark; preserve every unrelated experiment.
        if (path === 'comp.button.signature') {
          if (raw) localStorage.setItem(`${key}.recovery`, raw);
          continue;
        }
        if (!tokenManifest.tokens[path]) throw new Error('Unknown token');
        const migrated =
          !saved.version && /^comp\.badge\.(radius|gap|padding)$/.test(path)
            ? path.replace('comp.badge.', 'comp.status.')
            : path;
        next[group][migrated] = value;
      }
    }
    resolveGraph(withEdits('light', next));
    resolveGraph(withEdits('dark', next));
    return next;
  } catch {
    try {
      const raw = localStorage.getItem(key);
      if (raw) localStorage.setItem(`${key}.recovery`, raw);
    } catch {}
    return empty();
  }
};
export function baseTokens(theme: Theme): TokenMap {
  return Object.fromEntries(
    Object.entries(tokenManifest.tokens).map(([path, entry]) => [
      path,
      { $type: entry.type, $description: entry.description, $value: entry.modes[theme].raw },
    ]),
  );
}
function withEdits(theme: Theme, edits: Edits): TokenMap {
  const tokens = baseTokens(theme);
  for (const [path, value] of Object.entries({ ...edits.shared, ...edits[theme] })) {
    if (!tokens[path]) throw new Error(`Неизвестный токен ${path}`);
    tokens[path] = { ...tokens[path], $value: value };
  }
  return tokens;
}
type DesignState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  tokens: TokenMap;
  resolved: Record<string, ResolvedToken>;
  edits: Edits;
  change: (path: string, value: unknown) => void;
  resetToken: (path: string) => void;
  resetAll: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  changed: number;
  inspector: string | null;
  inspect: (path: string | null) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  panelScope: string;
  openSystem: () => void;
  openComponent: (component: string) => void;
  error: string;
  clearError: () => void;
  exportTheme: () => void;
  exportExperiment: () => void;
};
const Context = createContext<DesignState | null>(null);
// Context identity must stay aligned with its provider during token/schema edits.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
export const useDesign = () => {
  const value = useContext(Context);
  if (!value) throw new Error('DesignProvider is required.');
  return value;
};
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DesignProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return localStorage.getItem('basis.design-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [edits, setEdits] = useState<Edits>(initial),
    [past, setPast] = useState<Edits[]>([]),
    [future, setFuture] = useState<Edits[]>([]);
  const [inspector, inspect] = useState<string | null>(null),
    [panelOpen, setPanelOpen] = useState(false),
    [panelScope, setPanelScope] = useState('system'),
    [error, setError] = useState('');
  const tokens = useMemo(() => withEdits(theme, edits), [theme, edits]);
  const resolved = useMemo(() => resolveGraph(tokens), [tokens]);
  const styleText = useMemo(() => {
    return (['light', 'dark'] as Theme[])
      .map((mode) => {
        const source = withEdits(mode, edits);
        const declarations = Object.entries(source).map(
          ([path, token]) => `${cssName(path)}:${toCss(token.$type, token.$value)};`,
        );
        for (const [name, path] of Object.entries(legacy))
          declarations.push(`--basis-${name}:var(${cssName(path)});`);
        return `:root[data-basis-theme="${mode}"],.basis-theme-scope[data-basis-theme="${mode}"]{color-scheme:${mode};${declarations.join('')}}`;
      })
      .join('\n');
  }, [edits]);
  useEffect(() => {
    document.documentElement.dataset.basisTheme = theme;
    try {
      localStorage.setItem('basis.design-theme', theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ version: tokenManifest.version, checksum: tokenManifest.checksum, edits }),
      );
    } catch {}
  }, [edits]);
  const commit = (next: Edits) => {
    try {
      resolveGraph(withEdits('light', next));
      resolveGraph(withEdits('dark', next));
      setPast((current) => [...current.slice(-29), edits]);
      setFuture([]);
      setEdits(next);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось применить значение.');
    }
  };
  const bucket = (path: string): keyof Edits => (path.startsWith('sys.color.') ? theme : 'shared');
  const change = (path: string, value: unknown) => {
    const group = bucket(path);
    const next = { ...edits, [group]: { ...edits[group], [path]: value } };
    if (JSON.stringify(value) === JSON.stringify(baseTokens(theme)[path]?.$value))
      delete next[group][path];
    commit(next);
  };
  const resetToken = (path: string) => {
    const group = bucket(path),
      next = { ...edits, [group]: { ...edits[group] } };
    delete next[group][path];
    commit(next);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture((current) => [edits, ...current]);
    setEdits(past[past.length - 1]);
    setPast((current) => current.slice(0, -1));
    setError('');
  };
  const redo = () => {
    if (!future.length) return;
    setPast((current) => [...current, edits]);
    setEdits(future[0]);
    setFuture((current) => current.slice(1));
    setError('');
  };
  const openSystem = () => {
    setPanelScope('system');
    inspect(null);
    setPanelOpen(true);
  };
  const openComponent = (component: string) => {
    setPanelScope(component);
    inspect(null);
    setPanelOpen(true);
  };
  const value: DesignState = {
    theme,
    setTheme: setThemeState,
    tokens,
    resolved,
    edits,
    change,
    resetToken,
    resetAll: () => commit(empty()),
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    changed: Object.values(edits).reduce((count, group) => count + Object.keys(group).length, 0),
    inspector,
    inspect,
    panelOpen,
    setPanelOpen,
    panelScope,
    openSystem,
    openComponent,
    error,
    clearError: () => setError(''),
    exportTheme: () =>
      download(`basis.${theme}.tokens.json`, {
        $description: `BASIS ${theme} · дизайн-эксперимент`,
        ...nest(tokens),
      }),
    exportExperiment: () =>
      download('basis.design-experiment.json', {
        version: tokenManifest.version,
        base: tokenManifest.checksum,
        themes: { light: nest(withEdits('light', edits)), dark: nest(withEdits('dark', edits)) },
        edits,
      }),
  };
  return (
    <Context.Provider value={value}>
      <style>{styleText}</style>
      {children}
    </Context.Provider>
  );
}
