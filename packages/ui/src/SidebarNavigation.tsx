import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronDown, ChevronRight, Search, SearchX } from 'lucide-react';
import { Button, IconButton } from './Button';
import { Menu, type MenuItem } from './Disclosure';
import { Input } from './Fields';
import { Dialog } from './Navigation';
import { Tooltip } from './Tooltip';

export type SidebarItem = {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  count?: number;
  keywords?: string[];
  children?: SidebarItem[];
};
type SearchResult = { item: SidebarItem; path: string[]; terms: string };
const normalize = (value: string) => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim();
function searchEntries(
  items: SidebarItem[],
  path: string[] = [],
  keywords: string[] = [],
): SearchResult[] {
  return items.flatMap((item) => {
    const terms = [...keywords, item.id, item.label, ...(item.keywords || [])];
    return item.children?.length
      ? searchEntries(item.children, [...path, item.label], terms)
      : [{ item, path, terms: normalize(terms.join(' ')) }];
  });
}
function highlight(label: string, query: string) {
  const term = normalize(query),
    at = normalize(label).indexOf(term);
  return term && at >= 0 ? (
    <>
      {label.slice(0, at)}
      <mark>{label.slice(at, at + term.length)}</mark>
      {label.slice(at + term.length)}
    </>
  ) : (
    label
  );
}
const contains = (item: SidebarItem, id: string): boolean =>
  item.id === id || Boolean(item.children?.some((child) => contains(child, id)));
function revealNavigationItem(root: HTMLElement, compact: boolean) {
  const current = root.querySelector<HTMLElement>(
    compact ? '[data-active="true"], a[aria-current="page"]' : 'a[aria-current="page"]',
  );
  if (!current || !current.getBoundingClientRect().height) return false;
  let viewport = current.closest<HTMLElement>('.basis-sidebar-nav__scroll') || root.parentElement;
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
  searchable = false,
}: {
  items: SidebarItem[];
  activeId: string;
  compact?: boolean;
  expanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  onNavigate: (item: SidebarItem) => void;
  label?: string;
  /** Uses the same Input and Dialog in full and compact navigation. */
  searchable?: boolean;
}) {
  const uid = useId();
  const navigation = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const resultsRoot = useRef<HTMLDivElement>(null);
  const focusSelected = useRef(false);
  const scrollBeforeSearch = useRef<number | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [hoverPaused, setHoverPaused] = useState(false);
  const scrollPause = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (scrollPause.current) clearTimeout(scrollPause.current);
    },
    [],
  );
  const filtering = Boolean(query.trim());
  const results = searchEntries(items).filter(({ terms }) =>
    normalize(query)
      .split(/\s+/)
      .every((word) => terms.includes(word)),
  );
  const reveal = useRef({ key: '', pending: false });
  const [localExpanded, setLocalExpanded] = useState(() =>
    items.filter((item) => item.children).map((item) => item.id),
  );
  const opened = expanded ?? localExpanded;
  useEffect(() => {
    setSearchOpen(false);
    setQuery('');
    setOpenGroup(null);
  }, [compact]);
  useEffect(() => setOpenGroup(null), [activeId]);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus({ preventScroll: true });
  }, [searchOpen]);
  useLayoutEffect(() => {
    const viewport = navigation.current?.querySelector<HTMLElement>('.basis-sidebar-nav__scroll');
    if (filtering) {
      if (!compact && viewport) {
        scrollBeforeSearch.current ??= viewport.scrollTop;
        viewport.scrollTop = 0;
      }
      return;
    }
    if (viewport && scrollBeforeSearch.current !== undefined) {
      if (!focusSelected.current) viewport.scrollTop = scrollBeforeSearch.current;
      scrollBeforeSearch.current = undefined;
    }
    if (focusSelected.current) {
      const current = navigation.current?.querySelector<HTMLElement>('a[aria-current="page"]');
      if (current && !current.closest('[hidden]')) {
        current.focus({ preventScroll: true });
        focusSelected.current = false;
      }
    }
    const key = `${activeId}:${compact}:${filtering}`;
    if (reveal.current.key !== key) reveal.current = { key, pending: true };
    if (!reveal.current.pending || !navigation.current) return;
    if (!revealNavigationItem(navigation.current, compact)) return;
    // Opening unrelated groups must not pull the user back to the active item.
    reveal.current.pending = false;
  }, [activeId, compact, opened.join('|'), filtering, query]);
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
      current: activeId === item.id,
      children: item.children ? menuItems(item.children) : undefined,
      onSelect: () => onNavigate(item),
    }));
  const select = (item: SidebarItem) => {
    focusSelected.current = filtering && !compact;
    setQuery('');
    setSearchOpen(false);
    setOpenGroup(null);
    onNavigate(item);
  };
  const link = (item: SidebarItem, iconOnly = compact, result = false) => (
    <a
      className="basis-sidebar-nav__link"
      href={item.href || '#'}
      aria-label={iconOnly ? item.label : undefined}
      aria-current={activeId === item.id ? 'page' : undefined}
      onClick={(event) => {
        if (item.href && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
        event.preventDefault();
        select(item);
      }}
    >
      {item.icon}
      {!iconOnly && (
        <>
          <span>{result ? highlight(item.label, query) : item.label}</span>
          {item.count !== undefined && <small>{item.count}</small>}
        </>
      )}
    </a>
  );
  const render = (nodes: SidebarItem[], depth = 0) => (
    <ul>
      {nodes.map((item) => (
        <li key={item.id} data-group={Boolean(item.children?.length)}>
          {item.children?.length ? (
            compact && depth === 0 ? (
              <div
                className="basis-sidebar-nav__compact-group"
                data-active={contains(item, activeId)}
              >
                <Menu
                  compact
                  size="md"
                  openOnHover={!hoverPaused}
                  placement="right"
                  open={openGroup === item.id}
                  onOpenChange={(next) =>
                    setOpenGroup((current) =>
                      next ? item.id : current === item.id ? null : current,
                    )
                  }
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
                  <span>{item.label}</span>
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
  const clearSearch = () => {
    setQuery('');
    searchInput.current?.focus();
  };
  const resultLinks = () =>
    Array.from(resultsRoot.current?.querySelectorAll<HTMLAnchorElement>('a') || []);
  const searchKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && filtering) {
      event.preventDefault();
      event.stopPropagation();
      clearSearch();
    }
    const links = resultLinks();
    if (!links.length) return;
    if (event.target === searchInput.current) {
      if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key) && (filtering || compact)) {
        event.preventDefault();
        (event.key === 'ArrowUp' ? links.at(-1) : links[0])?.focus();
      }
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const index = links.indexOf(document.activeElement as HTMLAnchorElement);
      if (index < 0) return;
      event.preventDefault();
      if (event.key === 'ArrowUp' && index === 0) searchInput.current?.focus();
      else
        links[
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? links.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length
        ]?.focus();
    }
  };
  const searchField = (
    <Input
      ref={searchInput}
      type="search"
      leadingIcon={<Search />}
      aria-label="Найти раздел"
      placeholder="Найти раздел…"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      onClear={clearSearch}
      autoComplete="off"
      spellCheck={false}
      aria-controls={filtering || compact ? `${uid}-results` : undefined}
    />
  );
  const searchResults = (
    <div className="basis-sidebar-nav__results" id={`${uid}-results`} ref={resultsRoot}>
      <div className="basis-sidebar-nav__result-count" role="status">
        {filtering ? 'Найдено разделов' : 'Все разделы'} <span>{results.length}</span>
      </div>
      {results.length ? (
        <ul>
          {results.map(({ item, path }, index) => {
            const group = path.join(' / ');
            return (
              <li key={item.id}>
                {group && group !== results[index - 1]?.path.join(' / ') && (
                  <div className="basis-sidebar-nav__result-group">{highlight(group, query)}</div>
                )}
                {link(item, false, true)}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="basis-sidebar-nav__empty">
          <SearchX aria-hidden="true" />
          <strong>Ничего не найдено</strong>
          <p>Попробуйте другое название раздела.</p>
          <Button size="sm" variant="ghost" onClick={clearSearch}>
            Очистить поиск
          </Button>
        </div>
      )}
    </div>
  );
  return (
    <nav ref={navigation} className="basis-sidebar-nav" data-compact={compact} aria-label={label}>
      {searchable && (
        <div className="basis-sidebar-nav__search" onKeyDown={searchKeyboard}>
          {compact ? (
            <Tooltip content="Найти раздел">
              <IconButton
                icon={<Search />}
                variant="secondary"
                aria-label="Найти раздел"
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                onClick={() => {
                  setOpenGroup(null);
                  setSearchOpen(true);
                }}
              />
            </Tooltip>
          ) : (
            searchField
          )}
        </div>
      )}
      <div
        className="basis-sidebar-nav__scroll"
        onKeyDown={searchKeyboard}
        onScroll={() => {
          if (compact) {
            setOpenGroup(null);
            setHoverPaused(true);
            if (scrollPause.current) clearTimeout(scrollPause.current);
            scrollPause.current = setTimeout(() => setHoverPaused(false), 300);
          }
        }}
      >
        {searchable && filtering && !compact ? searchResults : render(items)}
      </div>
      {compact && searchable && (
        <Dialog open={searchOpen} onOpenChange={setSearchOpen} title="Перейти в раздел">
          <div className="basis-sidebar-nav__search-dialog" onKeyDown={searchKeyboard}>
            {searchField}
            {searchResults}
            <div className="basis-sidebar-nav__search-hint">
              <span>
                <kbd>↓</kbd> к результатам
              </span>
              <span>
                <kbd>Enter</kbd> открыть
              </span>
            </div>
          </div>
        </Dialog>
      )}
    </nav>
  );
}
