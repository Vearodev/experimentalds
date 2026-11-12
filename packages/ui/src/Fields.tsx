import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Eye, EyeOff, Minus, Plus, X } from 'lucide-react';
import { IconButton, type ButtonSize } from './Button';
import { CloudLoader } from './CloudLoader';

export type FieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  required?: boolean;
  children: ReactNode;
  id?: string;
  className?: string;
};
export function Field({
  label,
  hint,
  error,
  optional,
  required,
  children,
  id,
  className = '',
}: FieldProps) {
  return (
    <div className={`basis-field ${className}`} data-invalid={Boolean(error)}>
      {label && (
        <label className="basis-field__label" htmlFor={id}>
          {label}
          {required && <span aria-label="обязательное поле">*</span>}
          {optional && <small>Необязательно</small>}
        </label>
      )}
      {children}
      {(error || hint) && (
        <p
          id={id ? `${id}-description` : undefined}
          className="basis-field__description"
          role={error ? 'alert' : undefined}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> & {
  size?: ButtonSize;
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  loading?: boolean;
  onClear?: () => void;
  previewState?: 'hover' | 'focus';
};
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'md',
    label,
    hint,
    error,
    leadingIcon,
    prefix,
    suffix,
    loading,
    onClear,
    previewState,
    id: givenId,
    className = '',
    ...props
  },
  ref,
) {
  const fallback = useId(),
    id = givenId || fallback;
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      className={className}
    >
      <div
        className="basis-input"
        data-size={size}
        data-invalid={Boolean(error)}
        data-disabled={props.disabled}
        data-readonly={props.readOnly}
        data-preview-state={previewState}
        data-clearable={Boolean(onClear)}
      >
        {leadingIcon && (
          <span className="basis-input__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        {prefix && <span className="basis-input__affix">{prefix}</span>}
        <input
          {...props}
          ref={ref}
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error || hint ? `${id}-description` : props['aria-describedby']}
        />
        {loading ? (
          <CloudLoader />
        ) : onClear && props.value ? (
          <IconButton
            size="sm"
            variant="ghost"
            icon={<X />}
            aria-label={`Очистить ${label || 'поле'}`}
            disabled={props.disabled || props.readOnly}
            onClick={onClear}
          />
        ) : null}
        {suffix && <span className="basis-input__affix">{suffix}</span>}
      </div>
    </Field>
  );
});
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'suffix'>>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <Input
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        suffix={
          <IconButton
            size="sm"
            variant="ghost"
            icon={visible ? <EyeOff /> : <Eye />}
            aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
            disabled={props.disabled}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          />
        }
      />
    );
  },
);
export function NumberInput({
  value,
  onValueChange,
  min = 0,
  max = 128,
  step = 1,
  label,
  required,
  hint,
  error,
  unit,
  disabled,
  readOnly,
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  unit?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const change = (next: number) => {
    if (!Number.isFinite(next)) return;
    const clamped = Math.max(min, Math.min(max, min + Math.round((next - min) / step) * step));
    setDraft(String(clamped));
    onValueChange(clamped);
  };
  return (
    <Field label={label} id={id} hint={hint} error={error} required={required}>
      <div className="basis-number-input" data-disabled={disabled} data-invalid={Boolean(error)}>
        <IconButton
          size="sm"
          variant="ghost"
          icon={<Minus />}
          aria-label={`Уменьшить ${label || 'значение'}`}
          disabled={disabled || readOnly || value <= min}
          onClick={() => change(value - step)}
        />
        <input
          id={id}
          type="number"
          required={required}
          min={min}
          max={max}
          step={step}
          value={draft}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={hint || error ? `${id}-description` : undefined}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
            const next = Number(raw);
            if (
              raw !== '' &&
              Number.isFinite(next) &&
              next >= min &&
              next <= max &&
              Math.abs((next - min) / step - Math.round((next - min) / step)) < 1e-8
            )
              onValueChange(next);
          }}
          onBlur={() => change(draft === '' ? min : Number(draft))}
        />
        {unit && <span>{unit}</span>}
        <IconButton
          size="sm"
          variant="ghost"
          icon={<Plus />}
          aria-label={`Увеличить ${label || 'значение'}`}
          disabled={disabled || readOnly || value >= max}
          onClick={() => change(value + step)}
        />
      </div>
    </Field>
  );
}
export function Textarea({
  label,
  hint,
  error,
  id: givenId,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
}) {
  const fallback = useId(),
    id = givenId || fallback;
  return (
    <Field label={label} id={id} hint={hint} error={error} required={props.required}>
      <textarea
        {...props}
        id={id}
        className="basis-textarea"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={hint || error ? `${id}-description` : undefined}
      />
    </Field>
  );
}
