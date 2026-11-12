import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Minus, Search, X } from 'lucide-react';
import { Button, IconButton } from './Button';
import { Field } from './Fields';
import { CloudLoader } from './CloudLoader';

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  error,
  indeterminate = false,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  error?: boolean;
  indeterminate?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="basis-checkbox" data-disabled={disabled} data-invalid={error}>
      <span className="basis-checkbox__control">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={error || undefined}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        <span aria-hidden="true">{indeterminate ? <Minus /> : checked ? <Check /> : null}</span>
      </span>
      <span className="basis-choice-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="basis-switch" data-disabled={disabled}>
      <span className="basis-switch__control">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        <span aria-hidden="true">
          <i />
        </span>
      </span>
      <span className="basis-choice-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}
export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  group?: string;
};
export function Select({
  value,
  onValueChange,
  options,
  label,
  required,
  placeholder = 'Выберите значение',
  hint,
  error,
  disabled,
  loading,
  searchable = false,
  multiple = false,
}: {
  value: string | string[];
  onValueChange: (value: any) => void;
  options: SelectOption[];
  label: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  searchable?: boolean;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [position, setPosition] = useState({ left: 0, top: 0, width: 280, maxHeight: 320 });
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    search = useRef<HTMLInputElement>(null);
  const selected = Array.isArray(value) ? value : value ? [value] : [],
    chosen = options.filter((option) => selected.includes(option.value));
  const shown = options.filter((option) =>
    `${option.label} ${option.description || ''}`.toLowerCase().includes(query.toLowerCase()),
  );
  const enabled = () =>
    Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role=option]:not([aria-disabled=true])') || [],
    );
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(240, rect.width),
        below = innerHeight - rect.bottom - 16,
        above = rect.top - 16;
      const height = Math.min(320, Math.max(below, above));
      setPosition({
        left: Math.max(8, Math.min(rect.left, innerWidth - width - 8)),
        top: below >= 200 ? rect.bottom + 6 : Math.max(8, rect.top - height - 6),
        width: Math.min(width, innerWidth - 16),
        maxHeight: height,
      });
    };
    place();
    const outside = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    if (searchable) search.current?.focus();
    else {
      const items = enabled();
      (
        items.find((element) => element.getAttribute('aria-selected') === 'true') || items[0]
      )?.focus();
    }
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, searchable]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const select = (option: SelectOption) => {
    if (option.disabled) return;
    if (multiple)
      onValueChange(
        selected.includes(option.value)
          ? selected.filter((item) => item !== option.value)
          : [...selected, option.value],
      );
    else {
      onValueChange(option.value);
      close();
    }
  };
  return (
    <Field label={label} id={id} hint={hint} error={error} required={required}>
      <div className="basis-select" data-invalid={Boolean(error)}>
        <Button
          ref={trigger}
          id={id}
          className="basis-select__trigger"
          fullWidth
          role="combobox"
          aria-required={required || undefined}
          aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined}
          aria-haspopup="listbox"
          aria-label={label}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error || hint ? `${id}-description` : undefined}
          disabled={disabled || loading}
          leadingIcon={chosen.length === 1 ? chosen[0].icon : undefined}
          trailingIcon={loading ? <CloudLoader /> : <ChevronDown />}
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span className={!selected.length ? 'basis-select__placeholder' : ''}>
            {chosen.length
              ? multiple
                ? `${chosen[0].label}${chosen.length > 1 ? ` +${chosen.length - 1}` : ''}`
                : chosen[0].label
              : placeholder}
          </span>
        </Button>
      </div>
      {open &&
        createPortal(
          <div
            ref={menu}
            className="basis-select__popup"
            style={position}
            onKeyDown={(event) => {
              const items = enabled(),
                index = items.indexOf(document.activeElement as HTMLElement);
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
              }
              if (event.key === 'Tab') close();
              if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
                event.preventDefault();
                items[
                  index < 0
                    ? event.key === 'ArrowDown'
                      ? 0
                      : items.length - 1
                    : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
                ]?.focus();
              }
              if (
                document.activeElement !== search.current &&
                ['Home', 'End'].includes(event.key)
              ) {
                event.preventDefault();
                (event.key === 'Home' ? items[0] : items.at(-1))?.focus();
              }
            }}
          >
            {searchable && (
              <label className="basis-select__search">
                <Search size={15} />
                <input
                  ref={search}
                  aria-label={`Поиск: ${label}`}
                  placeholder="Найти значение"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon={<X />}
                    aria-label="Очистить поиск значений"
                    onClick={() => {
                      setQuery('');
                      search.current?.focus();
                    }}
                  />
                )}
              </label>
            )}
            <div
              role="listbox"
              id={`${id}-list`}
              aria-label={label}
              aria-multiselectable={multiple || undefined}
            >
              {shown.map((option, index) => (
                <div key={option.value}>
                  {option.group && option.group !== shown[index - 1]?.group && (
                    <div className="basis-select__group">{option.group}</div>
                  )}
                  <div
                    className="basis-select__option"
                    role="option"
                    aria-selected={selected.includes(option.value)}
                    aria-disabled={option.disabled || undefined}
                    tabIndex={-1}
                    onClick={() => select(option)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        select(option);
                      }
                    }}
                  >
                    {option.icon && (
                      <span className="basis-select__option-icon">{option.icon}</span>
                    )}
                    <span>
                      <strong>{option.label}</strong>
                      {option.description && <small>{option.description}</small>}
                    </span>
                    {selected.includes(option.value) && <Check size={16} />}
                  </div>
                </div>
              ))}
              {!shown.length && <div className="basis-select__empty">Ничего не найдено</div>}
            </div>
            {multiple && (
              <div className="basis-select__footer">
                <span>Выбрано: {selected.length}</span>
                <Button size="sm" variant="ghost" onClick={() => onValueChange([])}>
                  Сбросить
                </Button>
                <Button size="sm" variant="primary" onClick={close}>
                  Готово
                </Button>
              </div>
            )}
          </div>,
          trigger.current?.closest('dialog') || document.body,
        )}
    </Field>
  );
}
