import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button, IconButton } from './Button';

export type TabItem = {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
  icon?: ReactNode;
};
export function Tabs({
  items,
  value,
  onValueChange,
  label = 'Разделы',
  accessory,
  children,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  /** Optional context beside the scrollable tab list; uses the same header surface. */
  accessory?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null);
  return (
    <div className="basis-tabs">
      <div className="basis-tabs__header">
        <div
          ref={root}
          className="basis-tabs__list"
          role="tablist"
          aria-label={label}
          onKeyDown={(event) => {
            if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const enabled = items.filter((item) => !item.disabled),
              index = enabled.findIndex((item) => item.id === value),
              next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? enabled.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) %
                      enabled.length;
            if (!enabled.length) return;
            onValueChange(enabled[next].id);
            root.current
              ?.querySelector<HTMLButtonElement>(`[data-tab="${enabled[next].id}"]`)
              ?.focus();
          }}
        >
          {items.map((item) => (
            <Button
              key={item.id}
              role="tab"
              variant="ghost"
              id={`${id}-${item.id}`}
              data-tab={item.id}
              aria-selected={value === item.id}
              aria-controls={children ? `${id}-panel` : undefined}
              aria-label={item.count === undefined ? undefined : `${item.label}, ${item.count}`}
              tabIndex={value === item.id ? 0 : -1}
              disabled={item.disabled}
              leadingIcon={item.icon}
              onClick={() => onValueChange(item.id)}
            >
              {item.label}
              {item.count !== undefined && <span className="basis-tabs__count">{item.count}</span>}
            </Button>
          ))}
        </div>
        {accessory && <div className="basis-tabs__accessory">{accessory}</div>}
      </div>
      {children && (
        <div
          className="basis-tabs__panel"
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-${value}`}
          tabIndex={0}
        >
          {children}
        </div>
      )}
    </div>
  );
}
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  tone = 'default',
  wide = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'danger';
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return createPortal(
    <dialog
      ref={ref}
      className="basis-dialog"
      data-wide={wide}
      data-tone={tone}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
      }}
    >
      <div className="basis-dialog__header">
        <h2 id={`${id}-title`}>{title}</h2>
        <IconButton
          size="sm"
          variant="ghost"
          aria-label="Закрыть диалог"
          icon={<X />}
          onClick={() => onOpenChange(false)}
        />
      </div>
      <div className="basis-dialog__body">
        {description && (
          <p className="basis-dialog__description" id={`${id}-description`}>
            {description}
          </p>
        )}
        {children}
      </div>
      {footer && <div className="basis-dialog__footer">{footer}</div>}
    </dialog>,
    document.body,
  );
}
