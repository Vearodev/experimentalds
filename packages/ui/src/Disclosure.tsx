import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button, type ButtonVariant } from './Button';

export type AccordionItem = {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
};
export function Accordion({
  items,
  value,
  onValueChange,
  multiple = false,
  label = 'Разделы',
}: {
  items: AccordionItem[];
  value: string[];
  onValueChange: (value: string[]) => void;
  multiple?: boolean;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="basis-accordion" aria-label={label} role="group">
      {items.map((item) => {
        const expanded = value.includes(item.id);
        return (
          <section key={item.id} data-expanded={expanded}>
            <h3>
              <Button
                id={`${id}-${item.id}-trigger`}
                className="basis-accordion__trigger"
                variant="ghost"
                leadingIcon={item.icon}
                trailingIcon={<ChevronDown />}
                disabled={item.disabled}
                aria-expanded={expanded}
                aria-controls={`${id}-${item.id}-panel`}
                onClick={() =>
                  onValueChange(
                    expanded
                      ? value.filter((v) => v !== item.id)
                      : multiple
                        ? [...value, item.id]
                        : [item.id],
                  )
                }
              >
                <strong>{item.title}</strong>
                {item.description && <small>{item.description}</small>}
              </Button>
            </h3>
            <div
              id={`${id}-${item.id}-panel`}
              className="basis-accordion__panel"
              role="region"
              aria-labelledby={`${id}-${item.id}-trigger`}
              hidden={!expanded}
            >
              {item.content}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export type MenuItem = {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  current?: boolean;
  checked?: boolean;
  danger?: boolean;
  group?: string;
  onSelect?: () => void;
  children?: MenuItem[];
};
export function Menu({
  label = 'Действия',
  items,
  icon,
  disabled = false,
  compact = false,
  placement = 'bottom',
  openOnHover = false,
  size,
  variant,
  open: controlledOpen,
  onOpenChange,
  triggerContent,
  header,
  align = 'start',
}: {
  label?: string;
  items: MenuItem[];
  icon?: ReactNode;
  disabled?: boolean;
  compact?: boolean;
  placement?: 'bottom' | 'right';
  openOnHover?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: ButtonVariant;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerContent?: ReactNode;
  header?: ReactNode;
  align?: 'start' | 'end';
}) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null),
    startLast = useRef(false),
    returnItem = useRef<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    hoverOpened = useRef(false);
  const clearHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  useEffect(() => () => clearHover(), []);
  const [localOpen, setLocalOpen] = useState(false),
    [stack, setStack] = useState<MenuItem[]>([]),
    [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 400 });
  const open = controlledOpen ?? localOpen;
  const setOpen = (next: boolean) => {
    setLocalOpen(next);
    onOpenChange?.(next);
  };
  useEffect(() => {
    if (!open) {
      clearHover();
      hoverOpened.current = false;
    }
  }, [open]);
  const current = stack.at(-1)?.children || items;
  const close = (restore = true) => {
    clearHover();
    hoverOpened.current = false;
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  };
  const enabled = () =>
    Array.from(
      popup.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') || [],
    );
  useEffect(() => {
    if (!openOnHover) {
      clearHover();
      if (hoverOpened.current) close(false);
    }
  }, [openOnHover]);
  const hoverLeave = () => {
    clearHover();
    if (openOnHover && hoverOpened.current)
      hoverTimer.current = setTimeout(() => close(false), 240);
  };
  useLayoutEffect(() => {
    if (!open) return;
    // Navigation flyouts and utility menus share one interaction layer.
    const anotherMenuOpened = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) close(false);
    };
    document.dispatchEvent(new CustomEvent('basis:menu-open', { detail: id }));
    document.addEventListener('basis:menu-open', anotherMenuOpened);
    const place = () => {
      const r = trigger.current?.getBoundingClientRect(),
        panel = popup.current;
      if (!r || !panel) return;
      const inset = 12,
        gap =
          placement === 'right'
            ? parseFloat(
                getComputedStyle(trigger.current!).getPropertyValue(
                  '--basis-comp-menu-side-offset',
                ),
              ) || 24
            : 6,
        width = panel.getBoundingClientRect().width,
        height = panel.scrollHeight;
      const below = innerHeight - r.bottom - inset;
      const above = r.top - inset;
      const down = below >= Math.min(height, 240) || below >= above;
      if (placement === 'right') {
        setPosition({
          left: Math.max(
            inset,
            r.right + gap + width <= innerWidth - inset ? r.right + gap : r.left - width - gap,
          ),
          top: Math.max(inset, Math.min(r.top, innerHeight - height - inset)),
          maxHeight: innerHeight - inset * 2,
        });
        return;
      }
      setPosition({
        left: Math.max(
          inset,
          Math.min(align === 'end' ? r.right - width : r.left, innerWidth - width - inset),
        ),
        top: down ? r.bottom + gap : Math.max(inset, r.top - Math.min(height, above) - gap),
        maxHeight: Math.max(100, down ? below - gap : above - gap),
      });
    };
    place();
    const resize = new ResizeObserver(place);
    if (popup.current) resize.observe(popup.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const outside = (event: PointerEvent) => {
      if (
        !popup.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        close(false);
    };
    document.addEventListener('pointerdown', outside);
    const escapeHover = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && hoverOpened.current) close(false);
    };
    document.addEventListener('keydown', escapeHover);
    return () => {
      document.removeEventListener('basis:menu-open', anotherMenuOpened);
      resize.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escapeHover);
    };
  }, [open, placement, align]);
  useEffect(() => {
    if (!open || hoverOpened.current) return;
    const choices = enabled();
    const backTo = returnItem.current;
    returnItem.current = null;
    (
      choices.find((el) => el.dataset.item === backTo) ||
      (startLast.current ? choices.at(-1) : choices[0]) ||
      popup.current
    )?.focus();
    startLast.current = false;
  }, [open, stack]);
  const activate = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.children?.length) setStack([...stack, item]);
    else {
      close();
      item.onSelect?.();
    }
  };
  const back = () => {
    returnItem.current = stack.at(-1)?.id || null;
    setStack(stack.slice(0, -1));
  };
  return (
    <>
      <Button
        ref={trigger}
        size={size || (compact ? 'sm' : 'md')}
        variant={variant || (compact ? 'ghost' : 'secondary')}
        leadingIcon={icon || (compact ? <MoreHorizontal /> : undefined)}
        trailingIcon={!compact ? <ChevronDown /> : undefined}
        aria-label={compact || triggerContent ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onPointerEnter={(event) => {
          clearHover();
          if (!openOnHover || disabled || open || event.pointerType === 'touch') return;
          hoverTimer.current = setTimeout(() => {
            hoverOpened.current = true;
            setStack([]);
            setOpen(true);
          }, 180);
        }}
        onPointerLeave={hoverLeave}
        onClick={() => {
          clearHover();
          if (open && hoverOpened.current) {
            hoverOpened.current = false;
            enabled()[0]?.focus();
            return;
          }
          hoverOpened.current = false;
          setStack([]);
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (
            ['ArrowDown', 'ArrowUp'].includes(e.key) ||
            (placement === 'right' && e.key === 'ArrowRight')
          ) {
            e.preventDefault();
            clearHover();
            hoverOpened.current = false;
            startLast.current = e.key === 'ArrowUp';
            if (open) (startLast.current ? enabled().at(-1) : enabled()[0])?.focus();
            setStack([]);
            setOpen(true);
          }
        }}
      >
        {triggerContent ?? (compact ? null : label)}
      </Button>
      {open &&
        createPortal(
          <div
            className="basis-menu"
            ref={popup}
            tabIndex={-1}
            style={position}
            onPointerEnter={clearHover}
            onPointerLeave={hoverLeave}
            onKeyDown={(e) => {
              clearHover();
              hoverOpened.current = false;
              const items = enabled(),
                index = items.indexOf(document.activeElement as HTMLButtonElement);
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                items[
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? items.length - 1
                      : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
                ]?.focus();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
              if (e.key === 'Tab') {
                e.preventDefault();
                const controls = Array.from(
                  document.querySelectorAll<HTMLElement>(
                    'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
                  ),
                ).filter((el) => !popup.current?.contains(el) && el.getClientRects().length > 0);
                const at = controls.indexOf(trigger.current!),
                  next = controls[at + (e.shiftKey ? -1 : 1)];
                close(false);
                (next || trigger.current)?.focus();
              }
              if (e.key === 'ArrowLeft' && (stack.length || placement === 'right')) {
                e.preventDefault();
                if (stack.length) back();
                else close();
              }
              if (e.key === 'ArrowRight') {
                const item = current.find(
                  (i) => i.id === (document.activeElement as HTMLElement)?.dataset.item,
                );
                if (item?.children) {
                  e.preventDefault();
                  activate(item);
                }
              }
              if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== ' ') {
                const from = [...items.slice(index + 1), ...items.slice(0, index + 1)];
                from
                  .find((el) =>
                    el.textContent
                      ?.trim()
                      .toLocaleLowerCase()
                      .startsWith(e.key.toLocaleLowerCase()),
                  )
                  ?.focus();
              }
            }}
          >
            <div className="basis-menu__header">
              {stack.length ? (
                <Button size="sm" variant="ghost" leadingIcon={<ArrowLeft />} onClick={back}>
                  Назад · {stack.at(-1)!.label}
                </Button>
              ) : (
                (header ?? <span>{label}</span>)
              )}
            </div>
            <div role="menu" id={id} aria-label={stack.at(-1)?.label || label}>
              {current.map((item, index) => (
                <div role="none" key={item.id}>
                  {item.group && item.group !== current[index - 1]?.group && (
                    <div className="basis-menu__group" role="presentation">
                      {item.group}
                    </div>
                  )}
                  <Button
                    className="basis-menu__item"
                    role={item.checked !== undefined ? 'menuitemradio' : 'menuitem'}
                    aria-checked={item.checked}
                    aria-label={item.label}
                    aria-describedby={item.description ? `${id}-${index}-description` : undefined}
                    data-item={item.id}
                    aria-current={item.current ? 'page' : undefined}
                    tabIndex={-1}
                    variant="ghost"
                    tone={item.danger ? 'danger' : 'neutral'}
                    disabled={item.disabled}
                    leadingIcon={item.icon}
                    aria-haspopup={item.children?.length ? 'menu' : undefined}
                    onClick={() => activate(item)}
                    trailingIcon={
                      item.children?.length ? (
                        <ChevronRight />
                      ) : item.checked ? (
                        <Check />
                      ) : item.shortcut ? (
                        <kbd>{item.shortcut}</kbd>
                      ) : undefined
                    }
                  >
                    <strong>{item.label}</strong>
                    {item.description && (
                      <small id={`${id}-${index}-description`}>{item.description}</small>
                    )}
                  </Button>
                </div>
              ))}
            </div>
            {!current.length && <p className="basis-empty">Доступных действий нет.</p>}
          </div>,
          trigger.current?.closest('dialog, [data-overlay-root]') || document.body,
        )}
    </>
  );
}

export type BreadcrumbItem = {
  label: string;
  href?: string;
  onNavigate?: () => void;
  icon?: ReactNode;
};
export function Breadcrumb({
  items,
  maxItems = 4,
  label = 'Путь к ресурсу',
}: {
  items: BreadcrumbItem[];
  maxItems?: number;
  label?: string;
}) {
  const limit = Math.max(3, maxItems),
    collapsed = items.length > limit,
    tail = collapsed ? items.slice(-(limit - 2)) : items.slice(1),
    hidden = collapsed ? items.slice(1, items.length - tail.length) : [];
  const render = (item: BreadcrumbItem, last: boolean) =>
    last ? (
      <span aria-current="page" title={item.label}>
        {item.icon}
        {item.label}
      </span>
    ) : (
      <a
        href={item.href || '#'}
        onClick={
          item.onNavigate
            ? (e) => {
                e.preventDefault();
                item.onNavigate?.();
              }
            : undefined
        }
        title={item.label}
      >
        {item.icon}
        {item.label}
      </a>
    );
  return (
    <nav className="basis-breadcrumb" aria-label={label}>
      <ol>
        {items[0] && <li>{render(items[0], items.length === 1)}</li>}
        {collapsed && (
          <li>
            <ChevronRight aria-hidden="true" />
            <Menu
              compact
              label="Скрытые уровни"
              icon={<MoreHorizontal />}
              items={hidden.map((item, i) => ({
                id: String(i),
                label: item.label,
                onSelect: () => {
                  if (item.onNavigate) item.onNavigate();
                  else if (item.href) location.href = item.href;
                },
              }))}
            />
          </li>
        )}
        {tail.map((item, i) => (
          <li key={`${item.label}-${i}`}>
            <ChevronRight aria-hidden="true" />
            {render(item, i === tail.length - 1)}
          </li>
        ))}
      </ol>
    </nav>
  );
}
