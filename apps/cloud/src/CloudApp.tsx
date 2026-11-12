import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  Cloud,
  Component,
  FlaskConical,
  Menu as MenuIcon,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings2,
  Sun,
  Star,
  Terminal,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Dialog,
  IconButton,
  Input,
  Menu,
  Message,
  Select,
  SidebarNavigation,
  Tooltip,
  WorkspaceTabs,
  type SidebarItem,
} from '@basis/ui';
import { useDesign } from '../../playground/src/DesignContext';
import { CloudProvider } from './CloudContext';
import { ConsoleProvider, useVmConsole } from './ConsoleProvider';
import { useCloud } from './cloud-state';
import { LoadingPage, navigate } from './parts';
import { SettingsPage, EnvironmentDialog } from './WorkspacePages';
import { VmListPage, VmDetailPage } from './VmPages';
import { CreateVmPage } from './CreateVmPage';
import { platformEntity, platformGroups, topLevelEntities } from '../platform-catalog';
import {
  listPlatformRecords,
  visiblePlatformRecords,
  platformState,
  scopeLabel,
  scopeExists,
  recordVisible,
} from '../platform-model';
import { PlatformIcon } from './PlatformIcon';
import { PlatformPage } from './PlatformPage';
import { PlatformOverview, PlatformServicePage } from './PlatformOverview';
import './platform.css';
import {
  canonicalWorkspaceRoute,
  loadNavigationPreferences,
  navigationStorageKey,
  workspaceKey,
  reorderSavedWorkspaces,
  type SavedWorkspace,
} from './workspace-navigation';
import './navigation.css';
import './cloud.css';

const navigation = [
  { id: 'overview', label: 'Обзор', icon: 'LayoutDashboard' },
  ...topLevelEntities,
  { id: 'settings', label: 'Настройки профиля', icon: 'Settings2' },
];
export function CloudApp() {
  return (
    <CloudProvider>
      <ConsoleProvider>
        <CloudShell />
      </ConsoleProvider>
    </CloudProvider>
  );
}
function CloudShell() {
  const consoles = useVmConsole();
  const design = useDesign(),
    { data, loading, error, refresh, scope, setScope } = useCloud();
  const [route, setRoute] = useState(location.hash.slice('#cloud/'.length) || 'overview'),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(''),
    [environment, setEnvironment] = useState(false);
  const [navigationPreferences, setNavigationPreferences] = useState(loadNavigationPreferences);
  const favoriteTrigger = useRef<HTMLButtonElement>(null);
  const pageScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pageScroll.current?.scrollTo({ top: 0 });
  }, [route, scope]);
  const menuSizeTrigger = useRef<HTMLButtonElement>(null),
    restoreMenuFocus = useRef(false);
  const setCompactMenu = (compact: boolean) => {
    restoreMenuFocus.current = true;
    setNavigationPreferences((value) => ({ ...value, compact }));
  };
  useLayoutEffect(() => {
    if (restoreMenuFocus.current) {
      menuSizeTrigger.current?.focus({ preventScroll: true });
      restoreMenuFocus.current = false;
    }
  }, [navigationPreferences.compact]);
  useEffect(() => {
    try {
      localStorage.setItem(navigationStorageKey, JSON.stringify(navigationPreferences));
    } catch {
      /* Session still works when storage is unavailable. */
    }
  }, [navigationPreferences]);
  useEffect(() => {
    const update = () => {
      setRoute(location.hash.slice('#cloud/'.length) || 'overview');
      setMobile(false);
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const [page, id] = route.split('/'),
    active = page === 'create' ? 'vms' : page,
    title = navigation.find((n) => n.id === active)?.label || 'Облако';
  const activeTasks = data?.tasks.filter((t) => t.status === 'running').length || 0;
  useEffect(() => {
    document.title = `BASIS Cloud · ${page === 'create' ? 'Создание машины' : title}`;
    return () => {
      document.title = 'BASIS — дизайн-система';
    };
  }, [page, title]);
  const mode = data ? platformState(data).mode : 'admin';
  const allowedEntities = topLevelEntities.filter((entry) => mode === 'admin' || !entry.admin);
  const navItem = (section: string): SidebarItem => {
    const item = navigation.find((entry) => entry.id === section)!;
    return {
      id: item.id,
      label: item.label,
      icon: <PlatformIcon name={item.icon} />,
      href: '#cloud/' + item.id,
      count: section === 'tasks' && activeTasks ? activeTasks : undefined,
    };
  };
  const navItems: SidebarItem[] = [
    navItem('overview'),
    ...platformGroups.flatMap((group) => {
      const children = allowedEntities
        .filter((entry) => entry.group === group.id)
        .map((entry) => navItem(entry.id));
      return children.length
        ? [{ id: group.id, label: group.label, icon: <PlatformIcon name={group.icon} />, children }]
        : [];
    }),
  ];
  const scopeOptions = data
    ? [
        {
          value: 'all',
          label: mode === 'admin' ? 'Вся платформа' : 'Все ресурсы аккаунта',
          icon: <Cloud />,
          description: 'Общий реестр',
        },
        ...visiblePlatformRecords(data, 'accounts').flatMap((account) => [
          {
            value: account.id,
            label: account.name,
            icon: <PlatformIcon name="Building2" />,
            description: 'Аккаунт · все ресурсы',
          },
          ...visiblePlatformRecords(data, 'projects')
            .filter((r) => r.accountId === account.id)
            .map((rg) => ({
              value: rg.id,
              label: rg.name,
              icon: <PlatformIcon name="FolderKanban" />,
              description: account.name + ' · ресурсная группа',
            })),
        ]),
      ]
    : [];
  const changeScope = (value: string) => {
    setScope(value);
    if (id || page === 'create') navigate('overview');
  };
  const nav = (compact: boolean, isMobile = false) => (
    <>
      {data && (
        <div className="cloud-scope">
          {compact ? (
            <Tooltip content={'Рабочая область: ' + scopeLabel(data, scope)}>
              <Menu
                compact
                placement="right"
                label="Рабочая область"
                icon={<Cloud />}
                items={scopeOptions.map((option) => ({
                  id: option.value,
                  label: option.label,
                  icon: option.icon,
                  description:
                    option.value === scope ? 'Текущая рабочая область' : option.description,
                  onSelect: () => changeScope(option.value),
                }))}
              />
            </Tooltip>
          ) : (
            <Select
              label="Рабочая область"
              value={scope}
              onValueChange={changeScope}
              options={scopeOptions}
            />
          )}
        </div>
      )}
      <div className="cloud-navigation">
        <SidebarNavigation
          items={navItems}
          activeId={active}
          compact={compact}
          expanded={navigationPreferences.expanded}
          onExpandedChange={(expanded) =>
            setNavigationPreferences((value) => ({ ...value, expanded }))
          }
          onNavigate={(item) => {
            navigate(item.id);
            setMobile(false);
          }}
          label="Разделы облачной платформы"
        />
      </div>
      <div className="cloud-sidebar-bottom" data-compact={compact}>
        {compact ? (
          <Tooltip content="Среда демонстрации">
            <IconButton
              variant="ghost"
              size="sm"
              icon={<FlaskConical />}
              aria-label="Среда демонстрации"
              onClick={() => setEnvironment(true)}
            />
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<FlaskConical />}
            onClick={() => setEnvironment(true)}
          >
            Среда демонстрации
          </Button>
        )}
        {compact ? (
          <Tooltip content="Дизайн-система">
            <IconButton
              variant="ghost"
              size="sm"
              icon={<Component />}
              aria-label="Открыть дизайн-систему"
              onClick={() => {
                location.hash = '#foundations';
              }}
            />
          </Tooltip>
        ) : (
          <a href="#foundations">
            <Component size={16} />
            Дизайн-система
            <ArrowUpRight size={14} />
          </a>
        )}
        {!isMobile &&
          (compact ? (
            <Tooltip content="Развернуть меню">
              <IconButton
                ref={menuSizeTrigger}
                variant="ghost"
                size="sm"
                icon={<PanelLeftOpen />}
                aria-label="Развернуть меню"
                onClick={() => setCompactMenu(false)}
              />
            </Tooltip>
          ) : (
            <Button
              ref={menuSizeTrigger}
              variant="ghost"
              size="sm"
              leadingIcon={<PanelLeftClose />}
              onClick={() => setCompactMenu(true)}
            >
              Свернуть меню
            </Button>
          ))}
        {!compact && (
          <span>
            <i />
            Демо-режим
            <small>0.7.1</small>
          </span>
        )}
      </div>
    </>
  );
  const currentRoute = canonicalWorkspaceRoute(route);
  const currentKey = currentRoute ? workspaceKey({ route: currentRoute, scope }) : undefined;
  const isFavorite = navigationPreferences.favorites.some(
    (item) => workspaceKey(item) === currentKey,
  );
  const describeWorkspace = (item: SavedWorkspace) => {
    const [section, resourceId, tab] = item.route.split('/');
    const sectionMeta = navigation.find((entry) => entry.id === section) || platformEntity(section);
    const definition = platformEntity(section);
    const record =
      data && resourceId
        ? listPlatformRecords(data, section).find((row) => row.id === resourceId)
        : undefined;
    const unavailable = Boolean(
      data &&
      (!scopeExists(data, item.scope) ||
        (definition?.admin && mode !== 'admin') ||
        (resourceId && (!record || !recordVisible(data, section, record)))),
    );
    const scopeName = data ? scopeLabel(data, item.scope) : 'Загрузка…';
    const tabLabel =
      definition?.tabs?.find((t) => t.id === tab)?.label ||
      (
        {
          resources: 'Ресурсы',
          network: 'Сеть',
          snapshots: 'Снимки',
          activity: 'Операции',
          placement: 'Размещение',
          security: 'Безопасность',
        } as Record<string, string>
      )[tab || ''] ||
      tab;
    return {
      id: workspaceKey(item),
      label:
        ((!data || unavailable) && item.label) ||
        (resourceId
          ? (record?.name || 'Ресурс недоступен') + (tab ? ' / ' + tabLabel : '')
          : (sectionMeta?.label || section) + (item.scope === 'all' ? '' : ' / ' + scopeName)),
      description: unavailable
        ? 'Ресурс или рабочая область недоступны'
        : scopeName + ' · ' + (sectionMeta?.label || section),
      icon: <PlatformIcon name={sectionMeta?.icon || 'Box'} />,
      disabled: unavailable,
    };
  };
  const favoriteItems = navigationPreferences.favorites.map(describeWorkspace);
  const crumbs = [
    {
      label: 'Облако',
      icon: <Cloud />,
      href: '#cloud/overview',
      onNavigate: () => setScope('all'),
    },
    ...(scope !== 'all' && data
      ? [{ label: scopeLabel(data, scope), href: '#cloud/overview' }]
      : []),
    ...(page !== 'overview'
      ? [{ label: title, href: id || page === 'create' ? `#cloud/${active}` : undefined }]
      : []),
    ...(page === 'create'
      ? [{ label: 'Создание ВМ' }]
      : id && data
        ? [
            {
              label: listPlatformRecords(data, page).find((row) => row.id === id)?.name || 'Ресурс',
            },
          ]
        : []),
  ];
  const searchResults = data
    ? [
        ...allowedEntities.map((entry) => ({
          id: 'section:' + entry.id,
          title: entry.label,
          subtitle: platformGroups.find((group) => group.id === entry.group)?.label || 'Раздел',
          route: entry.id,
          scope,
          icon: entry.icon,
        })),
        ...allowedEntities.flatMap((entry) =>
          visiblePlatformRecords(data, entry.id).map((record) => ({
            id: entry.id + ':' + record.id,
            title: record.name,
            subtitle: [entry.singular, record.ip, record.id].filter(Boolean).join(' · '),
            route: entry.id + '/' + record.id,
            scope: 'all',
            icon: entry.icon,
          })),
        ),
      ]
        .filter((item) =>
          (item.title + ' ' + item.subtitle)
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
        )
        .slice(0, 14)
    : [];
  return (
    <div
      className="cloud-app"
      data-compact-nav={navigationPreferences.compact}
      data-favorites={favoriteItems.length > 0}
    >
      <a
        className="skip-link"
        href="#cloud-main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('cloud-main')?.focus();
        }}
      >
        К содержимому
      </a>
      <header className="cloud-topbar">
        <a className="cloud-brand" href="#cloud/overview" aria-label="BASIS Cloud — обзор">
          <img src={`${import.meta.env.BASE_URL}basis-logo.png`} alt="BASIS" />
          <span>Cloud</span>
        </a>
        <div>
          <IconButton
            className="cloud-mobile-toggle"
            variant="ghost"
            icon={<MenuIcon />}
            aria-label="Открыть меню платформы"
            onClick={() => setMobile(true)}
          />
          <Breadcrumb items={crumbs} maxItems={4} />
          {currentRoute && (
            <Tooltip
              content={
                isFavorite
                  ? 'Убрать текущую страницу из избранного'
                  : 'Сохранить страницу в избранных вкладках'
              }
            >
              <IconButton
                ref={favoriteTrigger}
                size="sm"
                variant="ghost"
                icon={<Star fill={isFavorite ? 'currentColor' : 'none'} />}
                aria-label={
                  isFavorite
                    ? 'Убрать текущую страницу из избранного'
                    : 'Сохранить страницу в избранных вкладках'
                }
                aria-pressed={isFavorite}
                onClick={() =>
                  setNavigationPreferences((value) => ({
                    ...value,
                    favorites: isFavorite
                      ? value.favorites.filter((item) => workspaceKey(item) !== currentKey)
                      : [
                          ...value.favorites,
                          {
                            route: currentRoute,
                            scope,
                            label: describeWorkspace({ route: currentRoute, scope }).label,
                          },
                        ],
                  }))
                }
              />
            </Tooltip>
          )}
        </div>
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="cloud-global-search"
            leadingIcon={<Search />}
            onClick={() => {
              setQuery('');
              setSearch(true);
            }}
          >
            Найти ресурс <kbd>Ctrl K</kbd>
          </Button>
          <Tooltip content={design.theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Переключить тему"
              icon={design.theme === 'light' ? <Moon /> : <Sun />}
              onClick={() => design.setTheme(design.theme === 'light' ? 'dark' : 'light')}
            />
          </Tooltip>
          {consoles.count > 0 && (
            <Tooltip content="Открытые консоли">
              <Badge count={consoles.count} tone="info">
                <IconButton
                  size="sm"
                  variant="ghost"
                  icon={<Terminal />}
                  aria-label="Показать открытые консоли"
                  onClick={consoles.restore}
                />
              </Badge>
            </Tooltip>
          )}
          <Tooltip content="Журнал задач">
            <Badge count={activeTasks} tone="info">
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Открыть журнал задач"
                icon={<Bell />}
                onClick={() => navigate('tasks')}
              />
            </Badge>
          </Tooltip>
          <Menu
            compact
            label="Меню профиля"
            icon={<Avatar name={data?.profile.name || 'Анна Смирнова'} size="sm" />}
            items={[
              {
                id: 'profile',
                label: data?.profile.name || 'Анна Смирнова',
                description: 'Профиль и уведомления',
                icon: <Settings2 />,
                onSelect: () => navigate('settings'),
              },
              {
                id: 'env',
                label: 'Среда демонстрации',
                icon: <FlaskConical />,
                onSelect: () => setEnvironment(true),
              },
              {
                id: 'ds',
                label: 'Открыть дизайн-систему',
                icon: <Component />,
                onSelect: () => {
                  location.hash = '#foundations';
                },
              },
            ]}
          />
        </div>
      </header>
      <aside className="cloud-sidebar">{nav(navigationPreferences.compact)}</aside>
      <div className="cloud-workspace">
        <main id="cloud-main" className="cloud-main" tabIndex={-1}>
          {favoriteItems.length > 0 && (
            <div className="cloud-favorites">
              <WorkspaceTabs
                items={favoriteItems}
                value={currentKey}
                onSelect={(key) => {
                  const item = navigationPreferences.favorites.find(
                    (item) => workspaceKey(item) === key,
                  );
                  if (item) {
                    setScope(item.scope);
                    navigate(item.route);
                  }
                }}
                onRemove={(key) =>
                  setNavigationPreferences((value) => ({
                    ...value,
                    favorites: value.favorites.filter((item) => workspaceKey(item) !== key),
                  }))
                }
                onReorder={(order) =>
                  setNavigationPreferences((value) => ({
                    ...value,
                    favorites: reorderSavedWorkspaces(value.favorites, order),
                  }))
                }
                onEmptyFocus={() =>
                  (favoriteTrigger.current || document.getElementById('cloud-main'))?.focus({
                    preventScroll: true,
                  })
                }
              />
            </div>
          )}
          <div
            ref={pageScroll}
            className="cloud-page-scroll"
            tabIndex={0}
            aria-label="Содержимое страницы"
          >
            {error && (
              <Message
                tone="danger"
                title="Данные временно недоступны"
                action={{ label: 'Повторить', onClick: () => void refresh(true) }}
              >
                {error}
              </Message>
            )}
            {loading ? (
              <LoadingPage />
            ) : data ? (
              page === 'overview' ? (
                <PlatformOverview />
              ) : page === 'create' ? (
                <CreateVmPage />
              ) : page === 'vms' ? (
                id ? (
                  <VmDetailPage key={id} id={id} tab={route.split('/')[2] || 'overview'} />
                ) : (
                  <VmListPage />
                )
              ) : ['health', 'statistics', 'api', 'support'].includes(page) ? (
                <PlatformServicePage key={page} section={page} />
              ) : platformEntity(page) ? (
                <PlatformPage
                  key={page + '/' + (id || '')}
                  entityId={page}
                  id={id}
                  tab={route.split('/')[2]}
                />
              ) : page === 'settings' ? (
                <SettingsPage />
              ) : (
                <Message
                  title="Страница не найдена"
                  action={{ label: 'Открыть обзор', onClick: () => navigate('overview') }}
                >
                  Выберите раздел в навигации.
                </Message>
              )
            ) : !error ? (
              <LoadingPage />
            ) : (
              <Button onClick={() => void refresh(true)} leadingIcon={<RefreshCw />}>
                Загрузить данные
              </Button>
            )}
          </div>
        </main>
      </div>
      <Dialog open={mobile} onOpenChange={setMobile} title="BASIS Cloud">
        <div className="cloud-mobile-nav">{nav(false, true)}</div>
      </Dialog>
      <Dialog
        open={search}
        onOpenChange={setSearch}
        title="Поиск в облаке"
        description="Разделы и ресурсы во всех доступных рабочих областях."
      >
        <div className="cloud-search-dialog">
          <Input
            label="Название раздела, имя, ID или IP ресурса"
            leadingIcon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Например, prod-api или 10.20"
            onClear={query ? () => setQuery('') : undefined}
          />
          {searchResults.length ? (
            <div className="cloud-search-results">
              {searchResults.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  leadingIcon={<PlatformIcon name={item.icon} />}
                  onClick={() => {
                    setScope(item.scope);
                    navigate(item.route);
                    setSearch(false);
                  }}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </Button>
              ))}
            </div>
          ) : (
            <p className="cloud-muted">Совпадений нет. Попробуйте другое имя.</p>
          )}
        </div>
      </Dialog>
      {environment && <EnvironmentDialog onClose={() => setEnvironment(false)} />}
    </div>
  );
}
