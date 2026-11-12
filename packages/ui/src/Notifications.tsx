import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Check, Info, X } from 'lucide-react';
import { Button, IconButton } from './Button';
import { CloudLoader } from './CloudLoader';
import type { StatusTone } from './Feedback';

export type MessageProps = {
  title: string;
  children?: ReactNode;
  tone?: StatusTone;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
  loading?: boolean;
  announce?: boolean;
  className?: string;
};
export function Message({
  title,
  children,
  tone = 'info',
  onDismiss,
  action,
  compact,
  loading,
  announce = false,
  className = '',
}: MessageProps) {
  const Icon =
    tone === 'danger'
      ? AlertCircle
      : tone === 'warning'
        ? AlertTriangle
        : tone === 'success'
          ? Check
          : Info;
  return (
    <div
      className={`basis-message ${className}`}
      data-tone={tone}
      data-compact={compact}
      role={announce ? (tone === 'danger' ? 'alert' : 'status') : undefined}
    >
      <span className="basis-message__icon" aria-hidden="true">
        {loading ? <CloudLoader /> : <Icon />}
      </span>
      <div className="basis-message__copy">
        <strong>{title}</strong>
        {children && <div className="basis-message__description">{children}</div>}
        {action && (
          <Button size="sm" variant="ghost" tone={tone} onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
      {onDismiss && (
        <IconButton
          size="sm"
          variant="ghost"
          icon={<X />}
          aria-label={`Закрыть сообщение: ${title}`}
          onClick={onDismiss}
        />
      )}
    </div>
  );
}

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: StatusTone;
  duration?: number;
  action?: { label: string; onClick: () => void };
  loading?: boolean;
};
function ToastCard({
  item,
  onDismiss,
  paused,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
  paused: boolean;
}) {
  const duration =
    item.duration ?? (item.tone === 'danger' || item.action || item.loading ? 0 : 6000);
  const remaining = useRef(duration),
    started = useRef(0),
    dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    remaining.current = duration;
  }, [duration]);
  useEffect(() => {
    if (paused || duration === 0) return;
    started.current = Date.now();
    const timer = setTimeout(() => dismiss.current(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started.current));
    };
  }, [paused, duration, item.id]);
  return (
    <Message
      className="basis-toast"
      title={item.title}
      tone={item.tone}
      loading={item.loading}
      onDismiss={() => onDismiss(item.id)}
      action={
        item.action
          ? {
              label: item.action.label,
              onClick: () => {
                item.action?.onClick();
                onDismiss(item.id);
              },
            }
          : undefined
      }
    >
      {item.description}
    </Message>
  );
}
export function ToastRegion({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const region = useRef<HTMLElement>(null),
    returnFocus = useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [hidden, setHidden] = useState(document.hidden);
  const [announcement, setAnnouncement] = useState(''),
    seen = useRef(new Set<string>());
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    const added = items.filter((i) => !seen.current.has(i.id));
    items.forEach((i) => seen.current.add(i.id));
    if (added.length)
      setAnnouncement(added.map((i) => `${i.title}. ${i.description || ''}`).join(' '));
  }, [items]);
  const dismiss = (id: string) => {
    const restore = region.current?.contains(document.activeElement);
    onDismiss(id);
    if (restore)
      requestAnimationFrame(() => {
        const next = region.current?.querySelector<HTMLElement>('button:not(:disabled)');
        if (next) next.focus();
        else if (returnFocus.current?.isConnected)
          returnFocus.current.focus({ preventScroll: true });
      });
  };
  return (
    <>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      {items.length > 0 && (
        <section
          ref={region}
          className="basis-toast-region"
          aria-label="Уведомления"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={(e) => {
            setFocused(true);
            if (!e.currentTarget.contains(e.relatedTarget))
              returnFocus.current = e.relatedTarget as HTMLElement | null;
          }}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
          }}
        >
          {items.slice(0, 3).map((item) => (
            <ToastCard
              key={item.id}
              item={item}
              onDismiss={dismiss}
              paused={hovered || focused || hidden}
            />
          ))}
          {items.length > 3 && (
            <span className="basis-toast-region__queue" role="status">
              В очереди: {items.length - 3}
            </span>
          )}
        </section>
      )}
    </>
  );
}
