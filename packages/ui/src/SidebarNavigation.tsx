import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { Menu, type MenuItem } from './Disclosure';
import { Tooltip } from './Tooltip';

export type SidebarItem = {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  count?: number;
  children?: SidebarItem[];
};
const contains = (item: SidebarItem, id: string): boolean =>
  item.id === id || Boolean(item.children?.some((child) => contains(child, id)));
function revealNavigationItem(root: HTMLElement, compact: boolean) {
  const current = root.querySelector<HTMLElement>(
    compact ? '[data-active="true"], a[aria-current="page"]' : 'a[aria-current="page"]',
  );
  if (!current || !current.getBoundingClientRect().height) return false;
  let viewport = root.parentElement;
  while (viewport && !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY))
    viewport = viewport.parentElement;
  if (viewport) {
    const item = current.getBoundingClientRect(),
      bounds = viewport.getBoundingClientRect();
    if (item.bottom > bounds.bottom) viewport.scrollTop += item.bottom - bounds.bottom;
    else if (item.top < bounds.top) viewport.scrollTop -= bounds.top - item.top;
  }
  return true;
}
export function SidebarNavigation({
  items,
  activeId,
  compact = false,
  expanded,
  onExpandedChange,
  onNavigate,
  label = 'Навигация',
}: {
  items: SidebarItem[];
  activeId: string;
  compact?: boolean;
  expanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  onNavigate: (item: SidebarItem) => void;
  label?: string;
}) {
  const uid = useId();
  const navigation = useRef<HTMLElement>(null);
  const reveal = useRef({ key: '', pending: false });
  const [localExpanded, setLocalExpanded] = useState(() =>
    items.filter((item) => item.children).map((item) => item.id),
  );
  const opened = expanded ?? localExpanded;
  useLayoutEffect(() => {
    const key = `${activeId}:${compact}`;
    if (reveal.current.key !== key) reveal.current = { key, pending: true };
    if (!reveal.current.pending || !navigation.current) return;
    if (!revealNavigationItem(navigation.current, compact)) return;
    // Opening unrelated groups must not pull the user back to the active item.
    reveal.current.pending = false;
  }, [activeId, compact, opened.join('|')]);
  useEffect(() => {
    const resized = () => {
      if (navigation.current) revealNavigationItem(navigation.current, compact);
    };
    window.addEventListener('resize', resized);
    return () => window.removeEventListener('resize', resized);
  }, [compact]);
  const update = (ids: string[]) => {
    setLocalExpanded(ids);
    onExpandedChange?.(ids);
  };
  useEffect(() => {
    const ancestors: string[] = [];
    const visit = (nodes: SidebarItem[]) =>
      nodes.forEach((item) => {
        if (item.children && contains(item, activeId)) {
          ancestors.push(item.id);
          visit(item.children);
        }
      });
    visit(items);
    if (ancestors.some((id) => !opened.includes(id)))
      update([...new Set([...opened, ...ancestors])]);
  }, [activeId]);
  const menuItems = (nodes: SidebarItem[]): MenuItem[] =>
    nodes.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      description: activeId === item.id ? 'Текущий раздел' : undefined,
      children: item.children ? menuItems(item.children) : undefined,
      onSelect: () => onNavigate(item),
    }));
  const link = (item: SidebarItem) => (
    <a
      href={item.href || '#'}
      aria-label={compact ? item.label : undefined}
      aria-current={activeId === item.id ? 'page' : undefined}
      onClick={(event) => {
        if (item.href && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
        event.preventDefault();
        onNavigate(item);
      }}
    >
      {item.icon}
      {!compact && (
        <>
          <span>{item.label}</span>
          {item.count !== undefined && <small>{item.count}</small>}
        </>
      )}
    </a>
  );
  const render = (nodes: SidebarItem[], depth = 0) => (
    <ul>
      {nodes.map((item) => (
        <li key={item.id}>
          {item.children?.length ? (
            compact && depth === 0 ? (
              <div
                className="basis-sidebar-nav__compact-group"
                data-active={contains(item, activeId)}
              >
                <Menu
                  compact
                  openOnHover
                  placement="right"
                  label={item.label}
                  icon={item.icon}
                  items={menuItems(item.children)}
                />
                <ChevronRight className="basis-sidebar-nav__submenu-indicator" aria-hidden="true" />
              </div>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="basis-sidebar-nav__group"
                  leadingIcon={item.icon}
                  trailingIcon={<ChevronDown />}
                  aria-expanded={opened.includes(item.id)}
                  aria-controls={`${uid}-${item.id}`}
                  data-active={contains(item, activeId)}
                  onClick={() =>
                    update(
                      opened.includes(item.id)
                        ? opened.filter((id) => id !== item.id)
                        : [...opened, item.id],
                    )
                  }
                >
                  {item.label}
                </Button>
                <div
                  id={`${uid}-${item.id}`}
                  className="basis-sidebar-nav__children"
                  hidden={!opened.includes(item.id)}
                >
                  {render(item.children, depth + 1)}
                </div>
              </>
            )
          ) : compact ? (
            <Tooltip content={item.label}>{link(item)}</Tooltip>
          ) : (
            link(item)
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <nav ref={navigation} className="basis-sidebar-nav" data-compact={compact} aria-label={label}>
      {render(items)}
    </nav>
  );
}
