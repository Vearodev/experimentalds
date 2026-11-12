import { useEffect, useState, type ReactNode } from 'react';
import { Check, UserRound, X } from 'lucide-react';
import { Button, IconButton } from './Button';
import type { StatusTone } from './Feedback';

export function Tag({
  children,
  tone = 'neutral',
  icon,
  onRemove,
  disabled,
  outlined = false,
}: {
  children: string;
  tone?: StatusTone;
  icon?: ReactNode;
  onRemove?: () => void;
  disabled?: boolean;
  outlined?: boolean;
}) {
  return (
    <span className="basis-tag" data-tone={tone} data-outlined={outlined} data-disabled={disabled}>
      {icon && (
        <span className="basis-tag__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="basis-tag__label" title={children}>
        {children}
      </span>
      {onRemove && (
        <IconButton
          variant="ghost"
          size="sm"
          icon={<X />}
          aria-label={`Удалить метку ${children}`}
          disabled={disabled}
          onClick={onRemove}
        />
      )}
    </span>
  );
}

export function Chip({
  children,
  selected = false,
  onSelectedChange,
  onClick,
  onRemove,
  disabled,
  icon,
}: {
  children: string;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  onClick?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <span className="basis-chip" data-selected={selected} data-disabled={disabled}>
      {onSelectedChange || onClick ? (
        <Button
          variant="ghost"
          size="sm"
          className="basis-chip__action"
          aria-pressed={onSelectedChange ? selected : undefined}
          disabled={disabled}
          onClick={() => {
            onSelectedChange?.(!selected);
            onClick?.();
          }}
          leadingIcon={selected ? <Check /> : icon}
        >
          {children}
        </Button>
      ) : (
        <span className="basis-chip__text">
          {selected ? <Check aria-hidden="true" /> : icon}
          {children}
        </span>
      )}
      {onRemove && (
        <IconButton
          variant="ghost"
          size="sm"
          icon={<X />}
          aria-label={`Убрать фильтр ${children}`}
          disabled={disabled}
          onClick={onRemove}
        />
      )}
    </span>
  );
}

export function Badge({
  count,
  max = 99,
  dot = false,
  showZero = false,
  tone = 'info',
  label,
  children,
}: {
  count?: number;
  max?: number;
  dot?: boolean;
  showZero?: boolean;
  tone?: StatusTone;
  label?: string;
  children?: ReactNode;
}) {
  const amount = Math.max(0, Math.floor(count ?? 0));
  const visible = dot || amount > 0 || showZero;
  const text = amount > max ? `${max}+` : String(amount);
  const mark = visible && (
    <span
      className="basis-badge"
      data-tone={tone}
      data-dot={dot}
      role="img"
      aria-label={label || (dot ? 'Есть новые события' : `Количество: ${amount}`)}
    >
      {dot ? null : text}
    </span>
  );
  return children ? (
    <span className="basis-badge-anchor">
      {children}
      {mark}
    </span>
  ) : (
    mark
  );
}

export function Avatar({
  name,
  src,
  size = 'md',
  shape = 'round',
  status,
  icon,
  tone = 'brand',
}: {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'round' | 'square';
  status?: 'online' | 'offline' | 'busy';
  icon?: ReactNode;
  tone?: 'brand' | 'neutral' | 'success';
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toLocaleUpperCase();
  const statusText =
    status === 'online' ? 'в сети' : status === 'busy' ? 'не беспокоить' : 'не в сети';
  return (
    <span
      className="basis-avatar"
      data-size={size}
      data-shape={shape}
      data-tone={tone}
      role="img"
      aria-label={`${name || 'Неизвестный пользователь'}${status ? `, ${statusText}` : ''}`}
      title={name}
    >
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{icon || initials || <UserRound />}</span>
      )}
      {status && <i className="basis-avatar__status" data-status={status} aria-hidden="true" />}
    </span>
  );
}

export function AvatarGroup({
  members,
  max = 4,
}: {
  members: { name: string; src?: string }[];
  max?: number;
}) {
  const visible = members.slice(0, Math.max(1, max));
  return (
    <div
      className="basis-avatar-group"
      role="group"
      aria-label={`Участники: ${members.map((m) => m.name).join(', ')}`}
    >
      {visible.map((m) => (
        <Avatar key={m.name} {...m} size="sm" />
      ))}
      {members.length > visible.length && (
        <span
          className="basis-avatar-group__overflow"
          title={members
            .slice(visible.length)
            .map((m) => m.name)
            .join(', ')}
        >
          +{members.length - visible.length}
        </span>
      )}
    </div>
  );
}
