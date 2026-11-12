import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { List, X } from 'lucide-react';
import { Button, IconButton } from './Button';
import { Menu } from './Disclosure';
import { Tooltip } from './Tooltip';
import { useWorkspaceTabReorder } from './useWorkspaceTabReorder';

export type WorkspaceTab = {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};
export function WorkspaceTabs({
  items,
  value,
  onSelect,
  onRemove,
  onReorder,
  onEmptyFocus,
  label = 'Избранные вкладки',
  marker = false,
  overflowLabel = 'Все избранные вкладки',
  removeLabel = 'Убрать из избранного',
  overflowMenu = 'always',
  scrollWithWheel = false,
}: {
  items: WorkspaceTab[];
  value?: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder?: (ids: string[]) => void;
  onEmptyFocus?: () => void;
  label?: string;
  marker?: ReactNode | false;
  overflowLabel?: string;
  removeLabel?: string;
  overflowMenu?: 'always' | 'auto';
  scrollWithWheel?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const measureOverflow = () => {
    const element = root.current;
    if (element) setOverflowing(element.scrollWidth > element.clientWidth + 1);
  };
  const revealActive = () => {
    const list = root.current;
    const active = list?.querySelector('[data-active="true"]');
    if (!list || !active) return;
    const viewport = list.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    if (tab.right > viewport.right) list.scrollLeft += tab.right - viewport.right;
    else if (tab.left < viewport.left) list.scrollLeft -= viewport.left - tab.left;
  };
  useLayoutEffect(measureOverflow, [items]);
  useLayoutEffect(() => {
    if (overflowMenu !== 'auto' || !root.current) return;
    const observer = new ResizeObserver(() => {
      measureOverflow();
      revealActive();
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [overflowMenu]);
  useEffect(() => {
    const list = root.current;
    if (!scrollWithWheel || !list) return;
    const scroll = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY) ||
        list.scrollWidth <= list.clientWidth + 1
      )
        return;
      const unit =
        event.deltaMode === 1
          ? parseFloat(getComputedStyle(list).lineHeight) || 16
          : event.deltaMode === 2
            ? list.clientWidth
            : 1;
      event.preventDefault();
      list.scrollLeft += event.deltaY * unit;
    };
    list.addEventListener('wheel', scroll, { passive: false });
    return () => list.removeEventListener('wheel', scroll);
  }, [scrollWithWheel]);
  const reorder = useWorkspaceTabReorder(root, items, onReorder),
    reorderHint = useId();
  const draggedItem = items.find((item) => item.id === reorder.drag?.id);
  const buttons = () =>
    Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') || []);
  const enabled = items.filter((item) => !item.disabled);
  const focusId = enabled.some((item) => item.id === value) ? value : enabled[0]?.id;
  useEffect(revealActive, [value]);
  const remove = (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    const next =
      items.slice(index + 1).find((item) => !item.disabled) ||
      [...items.slice(0, index)].reverse().find((item) => !item.disabled);
    if (next)
      buttons()
        .find((button) => button.dataset.workspaceTab === next.id)
        ?.focus({ preventScroll: true });
    else onEmptyFocus?.();
    onRemove(id);
  };
  return (
    <div
      className="basis-workspace-tabs"
      data-reorderable={reorder.canReorder}
      data-dragging={Boolean(reorder.drag)}
    >
      <span id={reorderHint} className="basis-visually-hidden">
        Перетащите вкладку, чтобы изменить порядок. С клавиатуры: Alt + Shift + стрелки влево или
        вправо.
      </span>
      <span className="basis-visually-hidden" role="status" aria-live="polite">
        {reorder.announcement}
      </span>
      {marker && (
        <Tooltip content={label}>
          <span className="basis-workspace-tabs__mark" tabIndex={0} aria-label={label}>
            {marker}
          </span>
        </Tooltip>
      )}
      <div
        ref={root}
        className="basis-workspace-tabs__list"
        role="tablist"
        aria-label={label}
        onPointerDown={reorder.pointerDown}
        onPointerMove={reorder.pointerMove}
        onPointerUp={reorder.pointerUp}
        onPointerCancel={reorder.cancel}
        onLostPointerCapture={reorder.cancel}
        onClickCapture={(event) => {
          if (reorder.suppressClick.current && event.detail > 0) {
            event.preventDefault();
            event.stopPropagation();
            reorder.suppressClick.current = false;
          }
        }}
        onKeyDown={(event) => {
          const focused = (event.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
          if (!focused) return;
          const id = focused.dataset.workspaceTab!;
          if (
            reorder.canReorder &&
            event.altKey &&
            event.shiftKey &&
            ['ArrowLeft', 'ArrowRight'].includes(event.key)
          ) {
            event.preventDefault();
            reorder.moveWithKeyboard(id, event.key === 'ArrowLeft' ? -1 : 1);
            return;
          }
          if (event.key === 'Delete') {
            event.preventDefault();
            remove(id);
            return;
          }
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !enabled.length)
            return;
          event.preventDefault();
          const index = enabled.findIndex((item) => item.id === id);
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? enabled.length - 1
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
          buttons()
            .find((button) => button.dataset.workspaceTab === enabled[next].id)
            ?.focus();
          onSelect(enabled[next].id);
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="basis-workspace-tabs__tab"
            data-active={item.id === value}
            data-disabled={item.disabled}
            data-favorite-id={item.id}
            data-drag-source={reorder.drag?.id === item.id}
          >
            <Tooltip
              disabled={Boolean(reorder.drag)}
              content={[
                item.label,
                item.description,
                reorder.canReorder ? 'Перетащите, чтобы изменить порядок' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              <Button
                role="tab"
                size="sm"
                variant="ghost"
                className="basis-workspace-tabs__open"
                data-workspace-tab={item.id}
                aria-selected={item.id === value}
                tabIndex={item.id === focusId ? 0 : -1}
                aria-disabled={item.disabled}
                aria-describedby={reorder.canReorder ? reorderHint : undefined}
                aria-keyshortcuts={
                  reorder.canReorder ? 'Alt+Shift+ArrowLeft Alt+Shift+ArrowRight' : undefined
                }
                leadingIcon={item.icon}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </Button>
            </Tooltip>
            <IconButton
              data-workspace-remove
              size="sm"
              variant="ghost"
              aria-label={`${removeLabel}: ${item.label}`}
              icon={<X />}
              tabIndex={item.id === focusId || item.disabled ? 0 : -1}
              onClick={() => remove(item.id)}
            />
          </div>
        ))}
        {reorder.drag?.valid && (
          <span
            className="basis-workspace-tabs__drop-marker"
            aria-hidden="true"
            style={{ left: reorder.drag.marker }}
          />
        )}
      </div>
      {reorder.drag &&
        draggedItem &&
        createPortal(
          <div
            className="basis-workspace-tabs__drag-preview"
            aria-hidden="true"
            style={{
              left: reorder.drag.x,
              top: reorder.drag.y,
              width: reorder.drag.width,
              height: reorder.drag.height,
            }}
          >
            {draggedItem.icon}
            <span>{draggedItem.label}</span>
          </div>,
          root.current?.closest('dialog') || document.body,
        )}
      {(overflowMenu === 'always' || overflowing) && (
        <Menu
          compact
          label={overflowLabel}
          icon={<List />}
          items={items.map((item) => ({
            id: item.id,
            label: item.label,
            description: item.description,
            icon: item.icon,
            disabled: item.disabled,
            onSelect: () => onSelect(item.id),
          }))}
        />
      )}
    </div>
  );
}
