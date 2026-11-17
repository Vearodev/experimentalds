import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bookmark,
  BookmarkPlus,
  Check,
  Copy,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from './Button';
import { Input } from './Fields';
import { Menu } from './Disclosure';
import { Tabs } from './Navigation';
import { Message } from './Notifications';
import { filterPresetKey, type TableFilterPresetLibrary } from './table-filter-presets';
import type { TableFilterRule } from './TableTools';

/** Internal part of the existing filter panel, built from shared DS controls. */
export function FilterPresetSettings<F extends string>({
  library,
  rules,
  describe,
  validate,
  section,
  onSectionChange,
  initialSave,
  onApply,
  children,
}: {
  library: TableFilterPresetLibrary<F>;
  rules: TableFilterRule<F>[];
  describe: (rule: TableFilterRule<F>) => string;
  validate: (rule: TableFilterRule<F>) => string;
  section: 'conditions' | 'saved';
  onSectionChange: (section: 'conditions' | 'saved') => void;
  initialSave?: boolean;
  onApply: (rules: TableFilterRule<F>[]) => void;
  children: ReactNode;
}) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null),
    restoreFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    const target = restoreFocus.current;
    if (!target) return;
    restoreFocus.current = null;
    const node =
      target === 'save'
        ? root.current?.querySelector<HTMLButtonElement>('.basis-filter-preset-save button') ||
          root.current?.querySelector<HTMLElement>('[role="tab"][data-tab="conditions"]')
        : target === 'list'
          ? root.current?.querySelector<HTMLElement>('[role="tab"][data-tab="saved"]')
          : Array.from(root.current?.querySelectorAll<HTMLElement>('[data-preset-id]') || [])
              .find((e) => e.dataset.presetId === target)
              ?.querySelector<HTMLElement>('button');
    node?.focus({ preventScroll: true });
  });
  const matches = (p: (typeof library.items)[number]) =>
    filterPresetKey(p.rules) === filterPresetKey(rules);
  const match =
    library.items.find((p) => p.id === library.currentId && matches(p)) ||
    library.items.find((p) => p.id === library.defaultId && matches(p)) ||
    library.items.find(matches);
  const [editing, setEditing] = useState<string | null>(initialSave ? 'new' : null);
  const [copySource, setCopySource] = useState<TableFilterRule<F>[] | null>(null);
  const [name, setName] = useState(''),
    [error, setError] = useState(''),
    [query, setQuery] = useState('');
  const canSave = rules.length > 0 && !rules.some(validate);
  const finishEditing = () => {
    restoreFocus.current = editing === 'new' ? (section === 'saved' ? 'list' : 'save') : editing;
    setEditing(null);
    setCopySource(null);
  };
  const edit = (id: string, name: string, source?: TableFilterRule<F>[]) => {
    library.dismiss();
    setEditing(id);
    setName(name);
    setError('');
    setCopySource(source ? source.map((r) => ({ ...r, values: [...r.values] })) : null);
  };
  const form = (id: string) => (
    <form
      className="basis-filter-preset-form"
      onSubmit={(e) => {
        e.preventDefault();
        const result =
          id === 'new' ? library.save(name, copySource || rules) : library.rename(id, name);
        if (result.ok) {
          finishEditing();
          setName('');
        } else setError(result.error);
      }}
    >
      <Input
        autoFocus
        label={
          id === 'new'
            ? copySource
              ? 'Название копии набора'
              : 'Название нового набора'
            : 'Название набора'
        }
        value={name}
        maxLength={64}
        placeholder="Например, Production · Linux"
        error={error}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
          library.dismiss();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            finishEditing();
          }
        }}
      />
      <div>
        <Button size="sm" variant="ghost" onClick={finishEditing}>
          Отменить
        </Button>
        <Button size="sm" type="submit" variant="primary">
          {id === 'new' ? (copySource ? 'Создать копию' : 'Сохранить набор') : 'Сохранить название'}
        </Button>
      </div>
    </form>
  );
  const shown = library.items.filter((p) =>
    `${p.name} ${p.rules.map(describe).join(' ')}`
      .toLocaleLowerCase('ru')
      .includes(query.trim().toLocaleLowerCase('ru')),
  );
  return (
    <div ref={root} className="basis-filter-presets">
      <Tabs
        label="Настройка фильтров"
        value={section}
        onValueChange={(value) => {
          setEditing(null);
          onSectionChange(value as 'conditions' | 'saved');
        }}
        items={[
          { id: 'conditions', label: 'Условия', count: rules.length },
          { id: 'saved', label: 'Мои наборы', count: library.items.length },
        ]}
      >
        {library.notice && !(editing && error) && (
          <Message
            compact
            announce
            tone={library.notice.error ? 'danger' : 'success'}
            title={library.notice.text}
            onDismiss={library.dismiss}
            action={
              library.notice.undo
                ? {
                    label: 'Отменить изменение',
                    onClick: () => {
                      restoreFocus.current = 'list';
                      library.undo();
                    },
                  }
                : undefined
            }
          />
        )}
        {section === 'conditions' ? (
          <>
            {rules.length > 0 && (
              <div className="basis-filter-preset-save">
                <Bookmark aria-hidden="true" />
                <div>
                  <strong>{match?.name || 'Текущие условия'}</strong>
                  <small>
                    {match ? 'Совпадают с сохранённым набором' : 'Сохраните для быстрого доступа'}
                  </small>
                </div>
                {!match && (
                  <Button
                    size="sm"
                    variant="ghost"
                    leadingIcon={<BookmarkPlus />}
                    disabled={!canSave}
                    onClick={() => edit('new', '')}
                  >
                    Сохранить
                  </Button>
                )}
              </div>
            )}
            {editing === 'new' && form('new')}
            {children}
          </>
        ) : (
          <>
            <p className="basis-tt-tool-note">
              Применение набора заменяет текущие условия. Поиск и настройки таблицы сохраняются.
            </p>
            {editing === 'new' && form('new')}
            {library.items.length > 0 && (
              <Input
                size="md"
                leadingIcon={<Search />}
                aria-label="Найти набор фильтров"
                placeholder="Найти набор…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery('')}
              />
            )}
            {!shown.length ? (
              <div className="basis-filter-preset-empty">
                <Bookmark aria-hidden="true" />
                <strong>{query ? 'Наборы не найдены' : 'Ваши фильтры — под рукой'}</strong>
                <p>
                  {query
                    ? 'Попробуйте другое название или значение.'
                    : 'Настройте условия и сохраните их под понятным названием. В следующий раз примените набор из шапки таблицы.'}
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    onSectionChange('conditions');
                  }}
                >
                  Настроить условия
                </Button>
              </div>
            ) : (
              <ul className="basis-filter-preset-list">
                {shown.map((p, index) => {
                  const invalid = p.rules.some(validate),
                    selected = match?.id === p.id;
                  return (
                    <li
                      key={p.id}
                      data-current={selected}
                      data-preset-id={p.id}
                      aria-label={`Набор «${p.name}»`}
                    >
                      {editing === p.id ? (
                        form(p.id)
                      ) : (
                        <>
                          <Button
                            className="basis-filter-preset-apply"
                            variant="ghost"
                            leadingIcon={<Bookmark />}
                            trailingIcon={selected ? <Check /> : undefined}
                            aria-label={`Применить набор «${p.name}»`}
                            aria-describedby={`${uid}-${index}-description`}
                            disabled={invalid}
                            onClick={() => {
                              library.select(p.id);
                              onApply(p.rules.map((r) => ({ ...r, values: [...r.values] })));
                            }}
                          >
                            <strong>
                              {p.name}
                              {p.id === library.defaultId && (
                                <span className="basis-filter-preset-default-mark">
                                  По умолчанию
                                </span>
                              )}
                            </strong>
                            <span>{p.rules.map(describe).join(' · ')}</span>
                            {invalid && <small>Поля изменились. Создайте новый набор.</small>}
                          </Button>
                          <span
                            className="basis-visually-hidden"
                            id={`${uid}-${index}-description`}
                          >
                            {p.rules.map(describe).join(' · ')}
                          </span>
                          <Menu
                            compact
                            label={`Действия с набором «${p.name}»`}
                            align="end"
                            items={[
                              {
                                id: 'rename',
                                label: 'Переименовать',
                                icon: <Pencil />,
                                onSelect: () => edit(p.id, p.name),
                              },
                              {
                                id: 'copy',
                                label: 'Создать копию набора',
                                icon: <Copy />,
                                disabled: invalid,
                                onSelect: () =>
                                  edit('new', `${p.name.slice(0, 56)} · копия`, p.rules),
                              },
                              {
                                id: 'update',
                                label: 'Обновить текущими условиями',
                                icon: <RefreshCw />,
                                disabled: !canSave || selected,
                                onSelect: () => library.save(p.name, rules, p.id),
                              },
                              {
                                id: 'delete',
                                label: 'Удалить набор',
                                icon: <Trash2 />,
                                danger: true,
                                onSelect: () => {
                                  restoreFocus.current = 'list';
                                  library.remove(p.id);
                                },
                              },
                            ]}
                          />
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}
