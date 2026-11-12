import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Cloud,
  Component,
  Menu,
  Moon,
  MousePointer2,
  Palette,
  Pause,
  Play,
  Search,
  SlidersHorizontal,
  Sun,
  Table2,
  Terminal,
  PanelLeft,
  Star,
  X,
} from 'lucide-react';
import { Button, IconButton, Input, Tooltip } from '@basis/ui';
import { ButtonsPage } from './ButtonsPage';
import { FoundationsPage } from './FoundationsPage';
import { TablePage } from './TablePage';
import { ConsolePage } from './ConsolePage';
import { MainNavigationPage, WorkspaceTabsPage } from './WorkspaceNavigationPages';
import { CatalogPages, catalog, type CatalogPage } from './CatalogPages';
import { useDesign } from './DesignContext';
import { TokenPanel } from './TokenPanel';
import { ExtendedPages, extendedCatalog, isExtendedPage, type ExtendedPage } from './ExtendedPages';
import { CloudApp } from '../../cloud/src/CloudApp';

type Page =
  | 'buttons'
  | 'foundations'
  | 'table'
  | 'console'
  | 'sidebar-navigation'
  | 'workspace-tabs'
  | CatalogPage
  | ExtendedPage;
const allCatalog = [...catalog, ...extendedCatalog];
const pages = [
  'buttons',
  'foundations',
  'table',
  'console',
  'sidebar-navigation',
  'workspace-tabs',
  ...allCatalog.map((item) => item.id),
];
const route = (): Page => {
  const page = location.hash.slice(1).split('?')[0];
  return pages.includes(page) ? (page as Page) : 'buttons';
};
export function App() {
  const [cloud, setCloud] = useState(location.hash.startsWith('#cloud/'));
  useEffect(() => {
    const update = () => setCloud(location.hash.startsWith('#cloud/'));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return cloud ? <CloudApp /> : <PlaygroundApp />;
}
function PlaygroundApp() {
  const design = useDesign(),
    navigation = useRef<HTMLElement>(null),
    menuTrigger = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState<Page>(route),
    [menu, setMenu] = useState(false),
    [paused, setPaused] = useState(false),
    [query, setQuery] = useState('');
  useEffect(() => {
    const update = () => {
      setPage(route());
      setMenu(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const drawer = navigation.current;
    const controls = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>('a,button:not(:disabled),input:not(:disabled)') || [],
      );
    controls()[0]?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false);
      }
      if (event.key === 'Tab') {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const viewport = matchMedia('(min-width:781px)');
    const close = () => {
      if (viewport.matches) setMenu(false);
    };
    document.addEventListener('keydown', keys);
    viewport.addEventListener('change', close);
    return () => {
      document.removeEventListener('keydown', keys);
      viewport.removeEventListener('change', close);
      menuTrigger.current?.focus({ preventScroll: true });
    };
  }, [menu]);
  const nav = (id: Page, label: string, icon: ReactNode) =>
    `${label} ${id} ${extendedCatalog.find((item) => item.id === id)?.name || ''}`
      .toLowerCase()
      .includes(query.toLowerCase()) ? (
      <a
        key={id}
        href={`#${id}`}
        aria-current={page === id ? 'page' : undefined}
        className="sidebar-link"
        onClick={() => setMenu(false)}
      >
        {icon}
        <span>{label}</span>
        {page === id && <i className="nav-active-mark" />}
      </a>
    ) : null;
  const title =
    page === 'console'
      ? 'Консоли виртуальных машин'
      : page === 'buttons'
        ? 'Кнопки'
        : page === 'foundations'
          ? 'Основа системы'
          : page === 'table'
            ? 'Таблицы'
            : page === 'sidebar-navigation'
              ? 'Основное меню'
              : page === 'workspace-tabs'
                ? 'Избранные вкладки'
                : allCatalog.find((item) => item.id === page)?.label;
  return (
    <div className="playground" data-motion={paused ? 'paused' : 'running'}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        К содержимому
      </a>
      {menu && (
        <button className="nav-backdrop" aria-label="Закрыть меню" onClick={() => setMenu(false)} />
      )}
      <aside
        ref={navigation}
        role={menu ? 'dialog' : undefined}
        aria-modal={menu || undefined}
        className={`sidebar ${menu ? 'is-open' : ''}`}
        aria-label="Навигация дизайн-системы"
      >
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}basis-logo.png`} alt="BASIS" />
          <IconButton
            className="mobile-close"
            variant="ghost"
            size="sm"
            aria-label="Закрыть меню"
            icon={<X />}
            onClick={() => setMenu(false)}
          />
        </div>
        <div className="brand-subtitle">
          Дизайн-система<span>0.7.5</span>
        </div>
        <Input
          className="nav-search"
          size="sm"
          aria-label="Найти компонент"
          placeholder="Найти компонент"
          leadingIcon={<Search />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="sidebar-scroll">
          <div className="sidebar-label">Основа</div>
          <nav>{nav('foundations', 'Токены и система', <Palette size={17} />)}</nav>
          <div className="sidebar-label">Действия и ввод</div>
          <nav>
            {nav('buttons', 'Кнопки', <MousePointer2 size={17} />)}
            {catalog
              .filter((item) =>
                ['inputs', 'selects', 'checkboxes', 'switches', 'sliders'].includes(item.id),
              )
              .map((item) => nav(item.id, item.label, <item.icon size={17} />))}
            {extendedCatalog
              .filter((item) => item.group === 'input')
              .map((item) => nav(item.id, item.label, <item.icon size={17} />))}
          </nav>
          <div className="sidebar-label">Навигация и структура</div>
          <nav>
            {nav('sidebar-navigation', 'Основное меню', <PanelLeft size={17} />)}
            {nav('workspace-tabs', 'Избранные вкладки', <Star size={17} />)}
            {catalog
              .filter((item) => ['tabs', 'dialogs'].includes(item.id))
              .map((item) => nav(item.id, item.label, <item.icon size={17} />))}
            {extendedCatalog
              .filter((item) => item.group === 'navigation')
              .map((item) => nav(item.id, item.label, <item.icon size={17} />))}
          </nav>
          <div className="sidebar-label">Информация и отклик</div>
          <nav>
            {catalog
              .filter((item) =>
                ['progress', 'statuses', 'icons', 'skeletons', 'tooltips'].includes(item.id),
              )
              .map((item) => nav(item.id, item.label, <item.icon size={17} />))}
            {extendedCatalog
              .filter((item) => item.group === 'feedback')
              .map((item) => nav(item.id, item.label, <item.icon size={17} />))}
          </nav>
          <div className="sidebar-label">Данные и композиции</div>
          <nav>
            {catalog
              .filter((item) => ['table-select'].includes(item.id))
              .map((item) => nav(item.id, item.label, <item.icon size={17} />))}
            {nav('table', 'Таблицы', <Table2 size={17} />)}
            {nav('console', 'Консоли ВМ', <Terminal size={17} />)}
          </nav>
        </div>
        <div className="sidebar-footer">
          <a href="#cloud/overview" className="playground-demo-link">
            <Cloud size={16} /> Демо облачной платформы
          </a>
          <span className="local-dot" />
          Мастерская дизайна
          <span className="sidebar-version">
            {design.changed
              ? `${design.changed} изменений в эксперименте`
              : 'Локально · общие токены'}
          </span>
        </div>
      </aside>
      <main className="main" id="main-content" tabIndex={-1} inert={menu}>
        <div className="topbar">
          <div>
            <IconButton
              ref={menuTrigger}
              className="mobile-menu"
              variant="ghost"
              size="sm"
              aria-label="Открыть навигацию"
              icon={<Menu />}
              onClick={() => setMenu(true)}
            />
            <Component size={15} />
            <span className="breadcrumb-root">Система</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <div className="theme-switch" role="group" aria-label="Тема интерфейса">
              <Tooltip content="Светлая тема">
                <IconButton
                  size="sm"
                  variant={design.theme === 'light' ? 'secondary' : 'ghost'}
                  aria-label="Светлая тема"
                  aria-pressed={design.theme === 'light'}
                  icon={<Sun />}
                  onClick={() => design.setTheme('light')}
                />
              </Tooltip>
              <Tooltip content="Тёмная тема">
                <IconButton
                  size="sm"
                  variant={design.theme === 'dark' ? 'secondary' : 'ghost'}
                  aria-label="Тёмная тема"
                  aria-pressed={design.theme === 'dark'}
                  icon={<Moon />}
                  onClick={() => design.setTheme('dark')}
                />
              </Tooltip>
            </div>
            <Tooltip content={paused ? 'Включить анимации' : 'Пауза анимаций'}>
              <IconButton
                size="sm"
                variant="ghost"
                aria-label={paused ? 'Включить анимации' : 'Пауза анимаций'}
                aria-pressed={paused}
                icon={paused ? <Play /> : <Pause />}
                onClick={() => setPaused(!paused)}
              />
            </Tooltip>
            <Button
              size="sm"
              className="system-settings-button"
              leadingIcon={<SlidersHorizontal />}
              onClick={design.openSystem}
            >
              Настроить систему
              {design.changed > 0 && <span className="edit-count">{design.changed}</span>}
            </Button>
            <IconButton
              className="system-settings-icon"
              size="sm"
              icon={<SlidersHorizontal />}
              aria-label="Настроить систему"
              onClick={design.openSystem}
            />
          </div>
        </div>
        {page === 'console' ? (
          <ConsolePage />
        ) : page === 'buttons' ? (
          <ButtonsPage />
        ) : page === 'foundations' ? (
          <FoundationsPage />
        ) : page === 'table' ? (
          <TablePage />
        ) : page === 'sidebar-navigation' ? (
          <MainNavigationPage />
        ) : page === 'workspace-tabs' ? (
          <WorkspaceTabsPage />
        ) : isExtendedPage(page) ? (
          <ExtendedPages key={page} page={page} />
        ) : (
          <CatalogPages key={page} page={page} />
        )}
        <footer className="page-footer">
          <span>
            <Cloud size={14} />
            BASIS · Облачная платформа
          </span>
          <span>Дизайн / состояния / связи</span>
        </footer>
      </main>
      <TokenPanel />
    </div>
  );
}
