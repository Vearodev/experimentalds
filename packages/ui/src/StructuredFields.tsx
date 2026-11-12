import { useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { CircleCheck, LockKeyhole } from 'lucide-react';
import { Field, Input, type InputProps } from './Fields';
import { Tag } from './Identity';
import { CloudLoader } from './CloudLoader';

export function RadioButton({
  label,
  description,
  error,
  card = false,
  icon,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  label: string;
  description?: string;
  error?: boolean;
  card?: boolean;
  icon?: ReactNode;
}) {
  return (
    <label
      className="basis-radio"
      data-disabled={props.disabled}
      data-invalid={error}
      data-card={card}
      data-checked={props.checked}
    >
      <span className="basis-radio__control">
        <input {...props} type="radio" aria-invalid={error || undefined} />
        <span aria-hidden="true">
          <i />
        </span>
      </span>
      {icon && (
        <span className="basis-radio__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="basis-choice-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}
export function RadioGroup({
  label,
  value,
  onValueChange,
  options,
  disabled,
  error,
  cards = false,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: {
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
    icon?: ReactNode;
  }[];
  disabled?: boolean;
  error?: string;
  cards?: boolean;
}) {
  const id = useId();
  return (
    <fieldset
      className="basis-radio-group"
      disabled={disabled}
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={Boolean(error) || undefined}
    >
      <legend>{label}</legend>
      <div data-cards={cards}>
        {options.map((o) => (
          <RadioButton
            key={o.value}
            name={id}
            value={o.value}
            label={o.label}
            description={o.description}
            icon={o.icon}
            checked={value === o.value}
            disabled={disabled || o.disabled}
            error={Boolean(error)}
            card={cards}
            onChange={() => onValueChange(o.value)}
          />
        ))}
      </div>
      {error && (
        <p className="basis-field__description" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** One real input preserves autofill, selection, paste and native editing. Cells are visual only. */
export function CodeInput({
  label = 'Код подтверждения',
  value,
  onValueChange,
  length = 6,
  disabled,
  readOnly,
  error,
  hint,
  loading,
  success,
}: {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  length?: 4 | 6;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  hint?: string;
  loading?: boolean;
  success?: boolean;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false),
    [caret, setCaret] = useState(0);
  const clean = (v: string) => v.replace(/[^0-9]/g, '').slice(0, length);
  return (
    <Field
      id={id}
      label={label}
      error={error}
      hint={hint || (!loading && !success && !readOnly ? '\u00a0' : undefined)}
    >
      <div
        className="basis-code-input"
        style={{ '--code-length': length } as React.CSSProperties}
        data-invalid={Boolean(error)}
        data-disabled={disabled}
        data-readonly={readOnly}
        data-focused={focused}
        data-success={success}
        aria-busy={loading || undefined}
      >
        <div
          className="basis-code-input__cells"
          aria-hidden="true"
          style={{ '--code-length': length } as React.CSSProperties}
        >
          {Array.from({ length }, (_, i) => (
            <span
              key={i}
              data-filled={Boolean(value[i])}
              data-active={focused && i === Math.min(caret, length - 1)}
            >
              {value[i] || <i />}
            </span>
          ))}
        </div>
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={value}
          disabled={disabled}
          readOnly={readOnly || loading || success}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={hint || error ? `${id}-description` : undefined}
          aria-label={`${label}, ${length} цифр`}
          maxLength={length * 3}
          onChange={(e) => {
            const next = clean(e.target.value);
            const position = Math.min(
              clean(e.target.value.slice(0, e.target.selectionStart ?? 0)).length,
              next.length,
            );
            onValueChange(next);
            setCaret(position);
            requestAnimationFrame(() => input.current?.setSelectionRange(position, position));
          }}
          onPaste={(e) => {
            if (disabled || readOnly || loading || success) return;
            const text = e.clipboardData.getData('text');
            if (text) {
              e.preventDefault();
              const next = clean(text);
              onValueChange(next);
              setCaret(next.length);
              requestAnimationFrame(() =>
                input.current?.setSelectionRange(next.length, next.length),
              );
            }
          }}
          onFocus={(e) => {
            setFocused(true);
            setCaret(e.target.selectionStart || 0);
          }}
          onBlur={() => setFocused(false)}
          onClick={(e) => {
            const cells = Array.from(e.currentTarget.previousElementSibling?.children || []);
            const clicked = cells.findIndex(
              (cell) => e.clientX <= cell.getBoundingClientRect().right,
            );
            const position = Math.min(clicked < 0 ? length - 1 : clicked, value.length);
            e.currentTarget.setSelectionRange(position, Math.min(position + 1, value.length));
            setCaret(position);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart || 0)}
        />
      </div>
      {(loading || success || readOnly) && (
        <span className="basis-code-status" role="status">
          {loading ? (
            <>
              <CloudLoader /> Проверяем код
            </>
          ) : success ? (
            <>
              <CircleCheck /> Код подтверждён
            </>
          ) : (
            <>
              <LockKeyhole /> Только чтение
            </>
          )}
        </span>
      )}
    </Field>
  );
}

export function InputTag({
  label,
  value,
  onValueChange,
  placeholder = 'Введите метку',
  hint,
  disabled,
  readOnly,
  error,
  max = 8,
  validate,
}: {
  label: string;
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  max?: number;
  validate?: (value: string) => string | undefined;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(''),
    [notice, setNotice] = useState('');
  const add = (raw: string) => {
    const incoming = raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!incoming.length) return;
    const next = [...value];
    const rejected: string[] = [];
    let reason = '';
    for (const item of incoming) {
      const invalid = validate?.(item);
      if (next.some((v) => v.toLocaleLowerCase() === item.toLocaleLowerCase())) {
        reason = 'Такая метка уже добавлена.';
        continue;
      }
      if (invalid || next.length >= max) {
        rejected.push(item);
        reason = invalid || `Не больше ${max} меток.`;
        continue;
      }
      next.push(item);
    }
    if (next.length !== value.length) onValueChange(next);
    setDraft(rejected.join(', '));
    setNotice(reason);
  };
  return (
    <Field id={id} label={label} hint={hint} error={error || notice}>
      <div
        className="basis-input-tag"
        data-invalid={Boolean(error || notice)}
        data-disabled={disabled}
        data-readonly={readOnly}
        onClick={(e) => {
          if (e.target === e.currentTarget) input.current?.focus();
        }}
      >
        {value.map((item, i) => (
          <Tag
            key={item}
            disabled={disabled}
            onRemove={
              readOnly
                ? undefined
                : () => {
                    onValueChange(value.filter((_, j) => j !== i));
                    setNotice('');
                    input.current?.focus();
                  }
            }
          >
            {item}
          </Tag>
        ))}
        <input
          id={id}
          ref={input}
          value={draft}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={value.length ? '' : placeholder}
          aria-invalid={Boolean(error || notice) || undefined}
          aria-describedby={error || notice || hint ? `${id}-description` : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setNotice('');
          }}
          onKeyDown={(e) => {
            if (readOnly || e.nativeEvent.isComposing) return;
            if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
              e.preventDefault();
              add(draft);
            }
            if (e.key === 'Backspace' && !draft && value.length) {
              e.preventDefault();
              onValueChange(value.slice(0, -1));
            }
          }}
          onBlur={(e) => {
            if (!readOnly && !disabled && !e.currentTarget.parentElement?.contains(e.relatedTarget))
              add(draft);
          }}
          onPaste={(e) => {
            if (readOnly || disabled) return;
            const text = e.clipboardData.getData('text');
            if (/[,;\n]/.test(text)) {
              e.preventDefault();
              add(draft + text);
            }
          }}
        />
      </div>
      <span className="basis-input-tag__count">
        {value.length} / {max}
      </span>
    </Field>
  );
}

export type MaskKind = 'phone' | 'mac' | 'date';
const masks = {
  phone: { pattern: '+7 (###) ###-##-##', hint: '+7 (999) 000-00-00', slots: 10 },
  mac: { pattern: 'HH:HH:HH:HH:HH:HH', hint: 'AA:BB:CC:DD:EE:FF', slots: 12 },
  date: { pattern: '##.##.####', hint: 'ДД.ММ.ГГГГ', slots: 8 },
};
export function maskRaw(value: string, kind: MaskKind) {
  let raw = value.replace(kind === 'mac' ? /[^a-fA-F0-9]/g : /\D/g, '').toUpperCase();
  if (
    kind === 'phone' &&
    (value.trim().startsWith('+7') || (raw.length === 11 && /^[78]/.test(raw)))
  )
    raw = raw.slice(1);
  return raw.slice(0, masks[kind].slots);
}
export function formatMask(raw: string, kind: MaskKind) {
  if (!raw) return '';
  let out = '',
    index = 0;
  for (const c of masks[kind].pattern) {
    if (c === '#' || c === 'H') {
      if (index === raw.length) break;
      out += raw[index++];
    } else out += c;
  }
  return out;
}
export function maskError(raw: string, kind: MaskKind) {
  if (!raw) return undefined;
  if (raw.length !== masks[kind].slots) return 'Заполните значение полностью.';
  if (kind === 'date') {
    const d = Number(raw.slice(0, 2)),
      m = Number(raw.slice(2, 4)),
      y = Number(raw.slice(4));
    const date = new Date(y, m - 1, d);
    if (y < 1900 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d)
      return 'Такой даты не существует.';
  }
  return undefined;
}
export function InputMask({
  kind,
  value,
  onValueChange,
  error,
  hint,
  ...props
}: Omit<InputProps, 'value' | 'onChange'> & {
  kind: MaskKind;
  value: string;
  onValueChange: (raw: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null),
    [touched, setTouched] = useState(false);
  return (
    <Input
      {...props}
      ref={ref}
      className={`basis-input-mask ${props.className || ''}`}
      value={formatMask(value, kind)}
      inputMode={kind === 'mac' ? 'text' : 'numeric'}
      placeholder={masks[kind].hint}
      hint={hint || masks[kind].hint}
      error={error || (touched ? maskError(value, kind) : undefined)}
      onChange={(e) => {
        const before = e.target.value.slice(0, e.target.selectionStart ?? e.target.value.length);
        const raw = maskRaw(e.target.value, kind),
          prefix = maskRaw(before, kind);
        onValueChange(raw);
        const pos = formatMask(prefix, kind).length;
        requestAnimationFrame(() => ref.current?.setSelectionRange(pos, pos));
      }}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (props.readOnly) return;
        const start = e.currentTarget.selectionStart || 0,
          end = e.currentTarget.selectionEnd || 0,
          display = formatMask(value, kind);
        if (
          start === end &&
          e.key === 'Backspace' &&
          start > 0 &&
          !/[0-9A-F]/.test(display[start - 1])
        ) {
          e.preventDefault();
          const before = maskRaw(display.slice(0, start), kind);
          const count = before.length;
          const next = value.slice(0, Math.max(0, count - 1)) + value.slice(count);
          onValueChange(next);
          const caret = formatMask(next.slice(0, Math.max(0, count - 1)), kind).length;
          requestAnimationFrame(() => ref.current?.setSelectionRange(caret, caret));
        }
      }}
      onBlur={(e) => {
        setTouched(true);
        props.onBlur?.(e);
      }}
    />
  );
}
