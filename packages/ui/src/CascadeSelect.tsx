import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, GitBranch, Search, Server, X } from 'lucide-react';
import { Button, IconButton } from './Button';
import { Field, Input } from './Fields';
import { ContextPanel } from './ContextPanel';
import { CloudLoader } from './CloudLoader';

export type CascadeOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  children?: CascadeOption[];
};
export function cascadePaths(
  options: CascadeOption[],
  parents: CascadeOption[] = [],
): CascadeOption[][] {
  return options.flatMap((option) =>
    option.children?.length
      ? cascadePaths(option.children, [...parents, option])
      : [[...parents, option]],
  );
}
export function CascadeSelect({
  label,
  value,
  onValueChange,
  options,
  levels = ['Регион', 'Кластер', 'Хост'],
  disabled,
  loading,
  error,
  hint,
  readOnly,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: CascadeOption[];
  levels?: string[];
  disabled?: boolean;
  loading?: boolean;
  readOnly?: boolean;
  error?: string;
  hint?: string;
}) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    columnsRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [path, setPath] = useState<CascadeOption[]>([]);
  const paths = cascadePaths(options),
    selected = paths.find((p) => p.at(-1)?.value === value);
  const leaf = path.at(-1),
    ready = Boolean(leaf && !leaf.children?.length && !path.some((p) => p.disabled));
  const columns = [options];
  for (const node of path) {
    if (node.children?.length) columns.push(node.children);
    else break;
  }
  const results = paths.filter((p) =>
    p
      .map((n) => n.label)
      .join(' / ')
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const show = () => {
    if (disabled || loading || readOnly) return;
    setPath(selected || []);
    setQuery('');
    setOpen(true);
  };
  const focusColumn = (level: number) =>
    requestAnimationFrame(() =>
      columnsRef.current
        ?.querySelectorAll<HTMLElement>('[role="listbox"]')
        [level]?.querySelector<HTMLElement>(
          '[role="option"][aria-selected="true"], [role="option"]:not(:disabled)',
        )
        ?.focus(),
    );
  return (
    <>
      <Field id={id} label={label} error={error} hint={hint}>
        <div className="basis-select basis-cascade-trigger" data-invalid={Boolean(error)}>
          <Button
            ref={trigger}
            id={id}
            className="basis-select__trigger"
            fullWidth
            role="combobox"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-readonly={readOnly || undefined}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={hint || error ? `${id}-description` : undefined}
            disabled={disabled || loading}
            leadingIcon={<GitBranch />}
            trailingIcon={loading ? <CloudLoader /> : <ChevronDown />}
            onClick={show}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                show();
              }
            }}
          >
            <span
              className={value ? '' : 'basis-select__placeholder'}
              title={selected?.map((n) => n.label).join(' / ')}
            >
              {selected?.map((n) => n.label).join(' / ') || 'Выберите расположение'}
            </span>
          </Button>
          {value && !readOnly && (
            <IconButton
              size="sm"
              variant="ghost"
              icon={<X />}
              aria-label={`Очистить ${label}`}
              disabled={disabled || loading}
              onClick={() => onValueChange('')}
            />
          )}
        </div>
      </Field>
      <ContextPanel
        open={open}
        anchor={trigger.current}
        align="start"
        wide
        title={label}
        description="Выберите конечный ресурс в иерархии"
        icon={<GitBranch />}
        onClose={() => setOpen(false)}
        footer={
          <>
            <span className="basis-cascade-summary">
              {ready ? path.map((p) => p.label).join(' / ') : 'Выберите конечный ресурс'}
            </span>
            <div className="basis-cascade-footer-actions">
              <Button onClick={() => setOpen(false)}>Отмена</Button>
              <Button
                variant="primary"
                disabled={!ready}
                onClick={() => {
                  if (ready) {
                    onValueChange(leaf!.value);
                    setOpen(false);
                  }
                }}
              >
                Выбрать
              </Button>
            </div>
          </>
        }
      >
        <Input
          label="Поиск в иерархии"
          placeholder="Регион, кластер или хост"
          leadingIcon={<Search />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
        />
        {query ? (
          <div className="basis-cascade-results" role="listbox" aria-label="Результаты поиска">
            {results.map((p) => (
              <Button
                key={p.at(-1)!.value}
                role="option"
                aria-selected={leaf?.value === p.at(-1)!.value}
                disabled={p.some((n) => n.disabled)}
                className="basis-cascade-option"
                variant="ghost"
                leadingIcon={<Server />}
                trailingIcon={leaf?.value === p.at(-1)!.value ? <Check /> : undefined}
                onClick={() => setPath(p)}
              >
                {p.map((n) => n.label).join(' / ')}
              </Button>
            ))}
            {!results.length && (
              <p className="basis-empty">Ничего не найдено. Попробуйте другую часть имени.</p>
            )}
          </div>
        ) : (
          <>
            <nav className="basis-cascade-breadcrumb" aria-label="Уровень выбора">
              <Button size="sm" variant="ghost" onClick={() => setPath([])}>
                {levels[0] || 'Начало'}
              </Button>
              {path
                .filter((n) => n.children?.length)
                .map((n, i) => (
                  <Button
                    key={n.value}
                    size="sm"
                    variant="ghost"
                    leadingIcon={<ChevronRight />}
                    onClick={() => setPath(path.slice(0, i + 1))}
                  >
                    {n.label}
                  </Button>
                ))}
            </nav>
            <div className="basis-cascade-columns" ref={columnsRef}>
              {columns.map((nodes, level) => (
                <div className="basis-cascade-column" key={level}>
                  <h3>{levels[level] || `Уровень ${level + 1}`}</h3>
                  <div
                    role="listbox"
                    aria-label={levels[level] || `Уровень ${level + 1}`}
                    onKeyDown={(e) => {
                      const items = Array.from(
                          e.currentTarget.querySelectorAll<HTMLButtonElement>(
                            '[role="option"]:not(:disabled)',
                          ),
                        ),
                        index = items.indexOf(document.activeElement as HTMLButtonElement);
                      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                        e.preventDefault();
                        items[
                          e.key === 'Home'
                            ? 0
                            : e.key === 'End'
                              ? items.length - 1
                              : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) %
                                items.length
                        ]?.focus();
                      }
                      if (e.key === 'ArrowRight' && index >= 0) {
                        e.preventDefault();
                        items[index].click();
                        focusColumn(level + 1);
                      }
                      if (e.key === 'ArrowLeft' && level > 0) {
                        e.preventDefault();
                        focusColumn(level - 1);
                      }
                    }}
                  >
                    {nodes.map((node) => (
                      <Button
                        key={node.value}
                        className="basis-cascade-option"
                        role="option"
                        variant="ghost"
                        aria-selected={path[level]?.value === node.value}
                        disabled={node.disabled}
                        trailingIcon={
                          node.children?.length ? (
                            <ChevronRight />
                          ) : path[level]?.value === node.value ? (
                            <Check />
                          ) : undefined
                        }
                        onClick={() => setPath([...path.slice(0, level), node])}
                      >
                        <strong>{node.label}</strong>
                        {node.description && <small>{node.description}</small>}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {!options.length && <p className="basis-empty">Доступных ресурсов пока нет.</p>}
            </div>
          </>
        )}
      </ContextPanel>
    </>
  );
}
