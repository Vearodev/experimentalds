import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';

/** A hint for a single focusable control. It never replaces its accessible name. */
export function Tooltip({
  children,
  content,
  disabled = false,
}: {
  children: ReactElement<{ 'aria-describedby'?: string }>;
  content: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ left: 0, top: 0 });
  const root = useRef<HTMLSpanElement>(null),
    bubble = useRef<HTMLDivElement>(null),
    id = useId();
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useLayoutEffect(() => {
    if (!open || disabled) return;
    const place = () => {
      const anchor = root.current?.getBoundingClientRect(),
        hint = bubble.current?.getBoundingClientRect();
      if (!anchor || !hint) return;
      setPosition({
        left: Math.max(
          8,
          Math.min(innerWidth - hint.width - 8, anchor.left + anchor.width / 2 - hint.width / 2),
        ),
        top: anchor.top > hint.height + 12 ? anchor.top - hint.height - 8 : anchor.bottom + 8,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, content, children, disabled]);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  return (
    <span
      ref={root}
      className="basis-tooltip-anchor"
      onMouseEnter={(event) =>
        !disabled && event.currentTarget.contains(event.target as Node) && setOpen(true)
      }
      onMouseLeave={() => setOpen(false)}
      onFocus={(event) => !disabled && event.currentTarget.contains(event.target) && setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {cloneElement(children, {
        'aria-describedby':
          open && !disabled
            ? [children.props['aria-describedby'], id].filter(Boolean).join(' ')
            : children.props['aria-describedby'],
      })}
      {open &&
        !disabled &&
        createPortal(
          <div ref={bubble} id={id} role="tooltip" className="basis-tooltip" style={position}>
            {content}
          </div>,
          root.current?.closest('dialog') || document.body,
        )}
    </span>
  );
}
