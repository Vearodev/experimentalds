import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button, IconButton, type ButtonSize, type ButtonTone, type ButtonVariant } from './Button';

export type SplitAction = { id: string; label: string; icon?: ReactNode; disabled?: boolean };
export function SplitButton({
  actions,
  value,
  onValueChange,
  onAction,
  disabled,
  size = 'md',
  tone = 'brand',
  variant = 'primary',
}: {
  actions: SplitAction[];
  value: string;
  onValueChange: (value: string) => void;
  onAction: (value: string) => void;
  disabled?: boolean;
  size?: ButtonSize;
  tone?: ButtonTone;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const id = useId(),
    selected = actions.find((action) => action.id === value) || actions[0];
  const items = () =>
    Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]:not(:disabled)') ||
        [],
    );
  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  if (!selected) return null;
  return (
    <div
      ref={root}
      className="basis-split"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="basis-split__buttons">
        <Button
          variant={variant}
          tone={tone}
          size={size}
          leadingIcon={selected.icon}
          disabled={disabled || selected.disabled}
          onClick={() => onAction(selected.id)}
        >
          {selected.label}
        </Button>
        <IconButton
          ref={trigger}
          variant={variant}
          tone={tone}
          size={size}
          icon={<ChevronDown />}
          aria-label="Выбрать действие"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          disabled={disabled}
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
            }
          }}
        />
      </div>
      {open && (
        <div
          id={id}
          className="basis-split__menu"
          role="menu"
          aria-label="Действие"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              trigger.current?.focus();
            }
            const enabled = items(),
              index = enabled.indexOf(document.activeElement as HTMLButtonElement);
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? enabled.length - 1
                    : (index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) %
                      enabled.length;
              enabled[next]?.focus();
            }
          }}
        >
          {actions.map((action) => (
            <button
              type="button"
              key={action.id}
              role="menuitemradio"
              aria-checked={action.id === selected.id}
              disabled={action.disabled}
              tabIndex={-1}
              onClick={() => {
                onValueChange(action.id);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <span aria-hidden="true">{action.icon}</span>
              <span>{action.label}</span>
              {action.id === selected.id && <Check aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
