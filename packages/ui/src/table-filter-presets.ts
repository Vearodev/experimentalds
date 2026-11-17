import { useEffect, useRef, useState } from 'react';
import type { TableFilterRule } from './TableTools';

export type TableFilterPreset<F extends string = string> = {
  id: string;
  name: string;
  rules: TableFilterRule<F>[];
  updatedAt: number;
};
type Result = { ok: true } | { ok: false; error: string };
export type TableFilterPresetLibrary<F extends string = string> = {
  items: TableFilterPreset<F>[];
  defaultId: string | null;
  currentId: string | null;
  select: (id: string) => void;
  setDefault: (id: string | null) => Result;
  notice: { text: string; error?: boolean; undo?: boolean } | null;
  save: (name: string, rules: TableFilterRule<F>[], id?: string) => Result;
  rename: (id: string, name: string) => Result;
  remove: (id: string) => void;
  undo: () => void;
  dismiss: () => void;
};
const copyRules = <F extends string>(rules: TableFilterRule<F>[]) =>
  rules.map((rule) => ({ ...rule, values: [...rule.values] }));

/** Conditions are joined by AND; clause and enum-value ordering does not change a set. */
export function filterPresetKey(rules: TableFilterRule[]) {
  return JSON.stringify(
    rules
      .map((rule) =>
        JSON.stringify([
          rule.field,
          rule.operator,
          ['in', 'notIn'].includes(rule.operator) ? '' : rule.value.trim(),
          rule.operator === 'between' ? rule.to.trim() : '',
          ['in', 'notIn'].includes(rule.operator) ? [...new Set(rule.values)].sort() : [],
        ]),
      )
      .sort(),
  );
}

export function parseFilterPresetStore<F extends string = string>(raw: string | null) {
  const items = parseFilterPresets<F>(raw);
  let defaultId: string | null = null;
  try {
    const data = JSON.parse(raw || 'null');
    if (items.some((p) => p.id === data?.defaultId)) defaultId = data.defaultId;
  } catch {
    /* Invalid storage has no default. */
  }
  return { items, defaultId };
}
export function loadDefaultFilterRules<F extends string = string>(
  key: string,
  validate: (rule: TableFilterRule<F>) => string,
): TableFilterRule<F>[] | null {
  try {
    const data = parseFilterPresetStore<F>(localStorage.getItem(key)),
      preset = data.items.find((p) => p.id === data.defaultId);
    return preset && !preset.rules.some(validate) ? copyRules(preset.rules) : null;
  } catch {
    return null;
  }
}
export function parseFilterPresets<F extends string = string>(
  raw: string | null,
): TableFilterPreset<F>[] {
  try {
    const data = JSON.parse(raw || 'null');
    if (data?.version !== 1 || !Array.isArray(data.items)) return [];
    const ids = new Set<string>(),
      names = new Set<string>();
    return data.items
      .filter((item: TableFilterPreset<F>) => {
        if (
          !item ||
          typeof item.id !== 'string' ||
          !item.id ||
          typeof item.name !== 'string' ||
          !item.name.trim() ||
          item.name.length > 64 ||
          !Number.isFinite(item.updatedAt) ||
          !Array.isArray(item.rules) ||
          !item.rules.length ||
          !item.rules.every(
            (r) =>
              r &&
              typeof r.field === 'string' &&
              typeof r.operator === 'string' &&
              typeof r.value === 'string' &&
              typeof r.to === 'string' &&
              Array.isArray(r.values) &&
              r.values.every((v) => typeof v === 'string'),
          )
        )
          return false;
        const name = item.name.trim().toLocaleLowerCase('ru');
        if (ids.has(item.id) || names.has(name)) return false;
        ids.add(item.id);
        names.add(name);
        return true;
      })
      .map((item: TableFilterPreset<F>) => ({
        id: item.id,
        name: item.name.trim(),
        updatedAt: item.updatedAt,
        rules: copyRules(item.rules),
      }));
  } catch {
    return [];
  }
}

/** Browser-local adapter for the demo/playground. The panel itself accepts a controlled library. */
export function useTableFilterPresets<F extends string = string>(
  storageKey: string,
  validate: (rule: TableFilterRule<F>) => string,
): TableFilterPresetLibrary<F> {
  const readStore = () => parseFilterPresetStore<F>(localStorage.getItem(storageKey));
  const read = () => readStore().items;
  const [defaultId, setDefaultId] = useState<string | null>(() => {
    try {
      return readStore().defaultId;
    } catch {
      return null;
    }
  });
  const [items, setItems] = useState<TableFilterPreset<F>[]>(() => {
    try {
      return read();
    } catch {
      return [];
    }
  });
  const [notice, setNotice] = useState<TableFilterPresetLibrary<F>['notice']>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const previous = useRef<{
    item: TableFilterPreset<F>;
    index: number;
    defaultId?: string | null;
  } | null>(null);
  const fail = (error: string): Result => {
    setNotice({ text: error, error: true });
    return { ok: false, error };
  };
  useEffect(() => {
    setCurrentId(null);
    try {
      setItems(read());
      setDefaultId(readStore().defaultId);
      previous.current = null;
      setNotice(null);
    } catch {
      /* Storage can be blocked. */
    }
    const sync = (event: StorageEvent | Event) => {
      if (event instanceof StorageEvent && event.key !== null && event.key !== storageKey) return;
      if (event instanceof CustomEvent && event.detail !== storageKey) return;
      try {
        setItems(read());
        setDefaultId(readStore().defaultId);
        previous.current = null;
        setNotice(null);
      } catch {
        /* Existing sets remain usable. */
      }
    };
    window.addEventListener('storage', sync);
    window.addEventListener('basis:filter-presets', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('basis:filter-presets', sync);
    };
  }, [storageKey]);
  const persist = (
    next: TableFilterPreset<F>[],
    text: string,
    undo?: { item: TableFilterPreset<F>; index: number },
    nextDefault?: string | null,
  ): Result => {
    try {
      const oldDefault = readStore().defaultId;
      const candidate = nextDefault === undefined ? oldDefault : nextDefault;
      const selectedDefault = next.some((p) => p.id === candidate) ? candidate : null;
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version: 1, items: next, defaultId: selectedDefault }),
      );
      window.dispatchEvent(new CustomEvent('basis:filter-presets', { detail: storageKey }));
      setItems(next);
      setDefaultId(selectedDefault);
      previous.current = undo ? { ...undo, defaultId: oldDefault } : null;
      setNotice({ text, undo: Boolean(undo) });
      return { ok: true };
    } catch {
      return fail('Не удалось сохранить в браузере. Проверьте доступность локального хранилища.');
    }
  };
  const save = (name: string, rules: TableFilterRule<F>[], id?: string): Result => {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return fail('Введите название набора.');
    if (clean.length > 64) return fail('Название должно быть не длиннее 64 символов.');
    if (!rules.length || rules.some(validate))
      return fail('Заполните все условия перед сохранением.');
    try {
      const latest = read();
      if (
        latest.some(
          (p) => p.id !== id && p.name.toLocaleLowerCase('ru') === clean.toLocaleLowerCase('ru'),
        )
      )
        return fail('Набор с таким названием уже есть.');
      const index = latest.findIndex((p) => p.id === id),
        old = latest[index];
      if (id && !old) return fail('Набор уже удалён. Сохраните условия как новый набор.');
      const item = {
        id: id || crypto.randomUUID(),
        name: clean,
        rules: copyRules(rules),
        updatedAt: Date.now(),
      };
      return persist(
        [item, ...latest.filter((p) => p.id !== id)],
        `Набор «${clean}» ${id ? 'обновлён' : 'сохранён'}.`,
        old ? { item: old, index } : undefined,
      );
    } catch {
      return fail('Не удалось сохранить набор в браузере.');
    }
  };
  return {
    items,
    defaultId,
    currentId,
    select: setCurrentId,
    setDefault: (id) => {
      try {
        const latest = read(),
          selected = latest.find((p) => p.id === id);
        if (id && (!selected || selected.rules.some(validate)))
          return fail('Этот набор сейчас недоступен. Выберите другой.');
        return persist(
          latest,
          id
            ? `«${selected!.name}» будет применяться при открытии таблицы.`
            : 'Автоматическое применение набора отключено.',
          undefined,
          id,
        );
      } catch {
        return fail('Не удалось сохранить настройку в браузере.');
      }
    },
    notice,
    save,
    rename: (id, name) => {
      const clean = name.trim().replace(/\s+/g, ' ');
      if (!clean || clean.length > 64) return fail('Введите название от 1 до 64 символов.');
      try {
        const latest = read(),
          index = latest.findIndex((p) => p.id === id),
          old = latest[index];
        if (!old) return fail('Набор уже удалён.');
        if (
          latest.some(
            (p) => p.id !== id && p.name.toLocaleLowerCase('ru') === clean.toLocaleLowerCase('ru'),
          )
        )
          return fail('Набор с таким названием уже есть.');
        return persist(
          latest.map((p) => (p.id === id ? { ...p, name: clean, updatedAt: Date.now() } : p)),
          `Набор переименован в «${clean}».`,
          { item: old, index },
        );
      } catch {
        return fail('Не удалось переименовать набор в браузере.');
      }
    },
    remove: (id) => {
      try {
        const latest = read(),
          index = latest.findIndex((p) => p.id === id),
          item = latest[index];
        if (item)
          persist(
            latest.filter((p) => p.id !== id),
            `Набор «${item.name}» удалён.`,
            { item, index },
          );
      } catch {
        fail('Не удалось удалить набор в браузере.');
      }
    },
    undo: () => {
      const undo = previous.current;
      if (!undo) return;
      try {
        const latest = read().filter((p) => p.id !== undo.item.id);
        if (
          latest.some(
            (p) => p.name.toLocaleLowerCase('ru') === undo.item.name.toLocaleLowerCase('ru'),
          )
        ) {
          fail('Это название уже занято. Сначала переименуйте новый набор.');
          return;
        }
        latest.splice(Math.min(undo.index, latest.length), 0, undo.item);
        persist(latest, 'Изменение отменено.', undefined, undo.defaultId);
      } catch {
        fail('Не удалось восстановить набор в браузере.');
      }
    },
    dismiss: () => {
      previous.current = null;
      setNotice(null);
    },
  };
}
