import { useId, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Check, Clock, Pause } from 'lucide-react';

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit = '',
  disabled = false,
  marks = [],
  range = false,
}: {
  value: number | number[];
  onValueChange: (value: any) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  unit?: string;
  disabled?: boolean;
  marks?: number[];
  range?: boolean;
}) {
  const id = useId(),
    values = Array.isArray(value) ? value : [value],
    start = range ? ((values[0] - min) / (max - min)) * 100 : 0,
    end = (((range ? values[1] : values[0]) - min) / (max - min)) * 100;
  return (
    <div className="basis-slider" data-disabled={disabled}>
      <div className="basis-slider__heading">
        <label htmlFor={id}>{label}</label>
        <output>
          {range ? `${values[0]}–${values[1]}` : values[0]}
          {unit && <span> {unit}</span>}
        </output>
      </div>
      <div
        className="basis-slider__track"
        data-range={range}
        onPointerDown={(event) => {
          if (disabled || event.target instanceof HTMLInputElement) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const raw = min + ((event.clientX - rect.left) / rect.width) * (max - min);
          const next = Math.max(min, Math.min(max, Math.round((raw - min) / step) * step + min));
          if (range) {
            const target = Math.abs(next - values[0]) <= Math.abs(next - values[1]) ? 0 : 1;
            onValueChange(
              target === 0
                ? [Math.min(next, values[1]), values[1]]
                : [values[0], Math.max(next, values[0])],
            );
            event.currentTarget.querySelectorAll('input')[target]?.focus();
          } else {
            onValueChange(next);
            event.currentTarget.querySelector('input')?.focus();
          }
        }}
        style={{ '--range-start': `${start}%`, '--range-end': `${end}%` } as CSSProperties}
      >
        <span />
        <input
          id={id}
          type="range"
          aria-label={range ? `${label}: минимум` : label}
          min={min}
          max={max}
          step={step}
          value={values[0]}
          disabled={disabled}
          onChange={(event) =>
            onValueChange(
              range
                ? [Math.min(Number(event.target.value), values[1]), values[1]]
                : Number(event.target.value),
            )
          }
        />
        {range && (
          <input
            type="range"
            aria-label={`${label}: максимум`}
            min={min}
            max={max}
            step={step}
            value={values[1]}
            disabled={disabled}
            onChange={(event) =>
              onValueChange([values[0], Math.max(values[0], Number(event.target.value))])
            }
          />
        )}
      </div>
      <div className="basis-slider__marks">
        {(marks.length ? marks : [min, max]).map((mark) => (
          <span key={mark} style={{ left: `${((mark - min) / (max - min)) * 100}%` }}>
            {mark}
          </span>
        ))}
      </div>
    </div>
  );
}
export function Progress({
  value,
  label,
  status = 'active',
  compact = false,
  hideLabel = false,
  description,
}: {
  value?: number;
  label: string;
  status?: 'active' | 'success' | 'error' | 'paused';
  compact?: boolean;
  hideLabel?: boolean;
  description?: string;
}) {
  const progress = value === undefined ? undefined : Math.min(100, Math.max(0, value));
  return (
    <div
      className="basis-progress"
      data-status={status}
      data-compact={compact}
      data-indeterminate={value === undefined}
    >
      <div
        className={hideLabel ? 'basis-visually-hidden' : 'basis-progress__heading'}
        aria-hidden={hideLabel || undefined}
      >
        <span>
          {status === 'success' ? (
            <Check />
          ) : status === 'error' ? (
            <AlertCircle />
          ) : status === 'paused' ? (
            <Pause />
          ) : null}
          {label}
        </span>
        <strong>{progress === undefined ? 'В процессе' : `${Math.round(progress)}%`}</strong>
      </div>
      <div
        className="basis-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ width: progress === undefined ? undefined : `${progress}%` }} />
      </div>
      {description && <p>{description}</p>}
    </div>
  );
}
export function Skeleton({
  width = '100%',
  height,
  shape = 'line',
  animate = true,
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  width?: number | string;
  height?: number | string;
  shape?: 'line' | 'circle' | 'block';
  animate?: boolean;
}) {
  return (
    <span
      {...props}
      className={`basis-skeleton ${className}`}
      data-shape={shape}
      data-animate={animate}
      aria-hidden="true"
      style={{ width, height, ...props.style }}
    />
  );
}
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export function StatusBadge({
  tone = 'neutral',
  children,
  icon = true,
  subtle = false,
}: {
  tone?: StatusTone;
  children: ReactNode;
  icon?: boolean;
  subtle?: boolean;
}) {
  return (
    <span className="basis-status" data-tone={tone} data-subtle={subtle}>
      {icon &&
        (tone === 'danger' ? (
          <AlertCircle />
        ) : tone === 'warning' ? (
          <AlertTriangle />
        ) : tone === 'success' ? (
          <Check />
        ) : tone === 'info' ? (
          <Clock />
        ) : (
          <i />
        ))}
      {children}
    </span>
  );
}
