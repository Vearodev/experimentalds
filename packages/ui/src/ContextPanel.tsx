import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

/** Shared surface for resource previews and table tools; state belongs to its caller. */
export function ContextPanel({
  open,
  anchor,
  title,
  description,
  icon,
  wide = false,
  presentation = 'popover',
  align = 'end',
  children,
  footer,
  onClose,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  title: string;
  description?: string;
  icon: ReactNode;
  wide?: boolean;
  presentation?: 'popover' | 'drawer';
  align?: 'start' | 'end';
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId(),
    descriptionId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const returnFocus = anchor || (document.activeElement as HTMLElement);
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    if (presentation === 'drawer') {
      const scrollbar = Math.max(0, innerWidth - root.clientWidth);
      const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      root.style.overflow = 'hidden';
      document.body.style.paddingRight = `${padding + scrollbar}px`;
    }
    if (!element.open) element.showModal();
    let positionedTop: number | undefined;
    const place = () => {
      if (presentation === 'drawer') {
        element.style.removeProperty('left');
        element.style.removeProperty('top');
        return;
      }
      const rect = anchor?.getBoundingClientRect();
      const { width, height } = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const inset = parseFloat(style.getPropertyValue('--basis-sys-space-lg')) || 16;
      const gap = parseFloat(style.getPropertyValue('--basis-sys-space-sm')) || 8;
      const left = rect
        ? Math.min(align === 'start' ? rect.left : rect.right - width, innerWidth - width - inset)
        : (innerWidth - width) / 2;
      const below = rect ? rect.bottom + gap : inset;
      const above = rect ? rect.top - height - gap : -1;
      const preferredTop =
        below + height <= innerHeight - inset
          ? below
          : above >= inset
            ? above
            : Math.max(inset, innerHeight - height - inset);
      // Keep the search field in place as results shrink. Growing content may
      // move upward only as far as needed to keep the footer on screen.
      const top = Math.max(
        inset,
        Math.min(positionedTop ?? preferredTop, innerHeight - height - inset),
      );
      positionedTop = top;
      element.style.left = `${Math.max(inset, left)}px`;
      element.style.top = `${top}px`;
    };
    place();
    const observer = presentation === 'popover' ? new ResizeObserver(place) : null;
    observer?.observe(element);
    const resize = () => {
      positionedTop = undefined;
      place();
    };
    if (presentation === 'popover') window.addEventListener('resize', resize);
    (
      element.querySelector<HTMLElement>('[data-panel-autofocus]') ||
      element.querySelector<HTMLElement>(
        '.basis-context-panel__body input, .basis-context-panel__body [role="combobox"]',
      )
    )?.focus({ preventScroll: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      element.close();
      if (presentation === 'drawer') {
        root.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPadding;
      }
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [open, anchor, align, presentation]);
  if (!open) return null;
  return createPortal(
    <dialog
      ref={dialog}
      className="basis-context-panel"
      data-wide={wide}
      data-presentation={presentation}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            closeRef.current();
        }
      }}
    >
      <header className="basis-context-panel__header">
        <span className="basis-context-panel__symbol" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p id={descriptionId}>{description}</p>}
        </div>
        <IconButton
          size="sm"
          variant="ghost"
          aria-label={`Закрыть: ${title}`}
          icon={<X />}
          onClick={onClose}
        />
      </header>
      <div className="basis-context-panel__body">{children}</div>
      <footer className="basis-context-panel__footer">{footer}</footer>
    </dialog>,
    document.body,
  );
}
