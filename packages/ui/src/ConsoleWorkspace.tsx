import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  MoreHorizontal,
  CloudOff,
  CornerDownLeft,
  Scaling,
  KeyRound,
  Keyboard,
  Maximize2,
  Minus,
  Plus,
  Power,
  RefreshCw,
  Search,
  Server,
  Terminal,
  Unplug,
  X,
} from 'lucide-react';
import { Button, IconButton } from './Button';
import { Checkbox } from './Choice';
import { CloudLoader } from './CloudLoader';
import { Menu } from './Disclosure';
import { Input, PasswordInput } from './Fields';
import { Tooltip } from './Tooltip';
import { WorkspaceTabs } from './WorkspaceTabs';
import { consoleStatusLabels, type ConsoleResource, type ConsoleSession } from './console-types';
import { useFloatingWindow } from './useFloatingWindow';

export type ConsoleWorkspaceProps = {
  sessions: ConsoleSession[];
  activeId: string;
  activation?: number;
  resources: ConsoleResource[];
  embedded?: boolean;
  onDetach?: () => void;
  onSelect: (id: string) => void;
  onCloseSession: (id: string) => void;
  onClose: () => void;
  onOpenResource: (resource: ConsoleResource) => void;
  onReorder: (ids: string[]) => void;
  onCommand: (id: string, command: string) => void;
  onPassword: (id: string, value: string, enter: boolean) => void;
  onSignal: (id: string, signal: string) => void;
  onReconnect: (id: string) => void;
  onDisconnect: (id: string) => void;
};

export function ConsoleWorkspace({
  sessions,
  activeId,
  activation,
  resources,
  embedded = false,
  onDetach,
  onSelect,
  onCloseSession,
  onClose,
  onOpenResource,
  onReorder,
  onCommand,
  onPassword,
  onSignal,
  onReconnect,
  onDisconnect,
}: ConsoleWorkspaceProps) {
  const [minimized, setMinimized] = useState(false),
    [panel, setPanel] = useState<'add' | 'password' | null>(null),
    [query, setQuery] = useState(''),
    [password, setPassword] = useState(''),
    [sendEnter, setSendEnter] = useState(true),
    [notice, setNotice] = useState('');
  const floating = useFloatingWindow(
    !sessions.length || minimized ? 'hidden' : embedded ? 'embedded' : 'floating',
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({}),
    [fontStep, setFontStep] = useState(0),
    [scrolledBack, setScrolledBack] = useState(false);
  const commandInput = useRef<HTMLInputElement>(null),
    passwordInput = useRef<HTMLInputElement>(null),
    searchInput = useRef<HTMLInputElement>(null),
    screen = useRef<HTMLDivElement>(null),
    dock = useRef<HTMLButtonElement>(null),
    addButton = useRef<HTMLButtonElement>(null),
    passwordButton = useRef<HTMLButtonElement>(null),
    opener = useRef<HTMLElement | null>(null);
  const panelRoot = useRef<HTMLDivElement>(null),
    historyIndex = useRef(-1),
    historyDraft = useRef('');
  const uid = useId();
  const active = sessions.find((s) => s.resource.id === activeId) || sessions[0];
  const live = active?.status === 'connected';
  const draft = drafts[activeId] || '';
  const setDraft = (value: string) => setDrafts((all) => ({ ...all, [activeId]: value }));
  const closePanel = (restore = false) => {
    setPanel(null);
    setPassword('');
    setQuery('');
    if (restore)
      (panel === 'password' ? passwordButton : addButton).current?.focus({ preventScroll: true });
  };
  const openPanel = (kind: 'add' | 'password') => {
    setPassword('');
    setQuery('');
    setNotice('');
    setPanel(panel === kind ? null : kind);
  };
  const minimize = () => {
    closePanel();
    setMinimized(true);
  };
  const restoreWindow = () => {
    setMinimized(false);
    requestAnimationFrame(() =>
      (commandInput.current || floating.root.current)?.focus({ preventScroll: true }),
    );
  };
  const closeAll = () => {
    closePanel();
    setDrafts({});
    onClose();
    opener.current?.isConnected && opener.current.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!sessions.length) {
      setDrafts({});
      setMinimized(false);
      closePanel();
      return;
    }
    setDrafts((all) =>
      Object.fromEntries(
        Object.entries(all).filter(([id]) => sessions.some((s) => s.resource.id === id)),
      ),
    );
  }, [sessions.length]);
  useEffect(() => {
    if (!sessions.length) return;
    if (
      document.activeElement !== document.body &&
      !floating.root.current?.contains(document.activeElement)
    )
      opener.current = document.activeElement as HTMLElement;
    setMinimized(false);
    closePanel();
    const frame = requestAnimationFrame(() => {
      if (!embedded)
        (commandInput.current || floating.root.current)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activation]);
  useLayoutEffect(() => {
    closePanel();
    setNotice('');
    setScrolledBack(false);
    historyIndex.current = -1;
    if (screen.current) screen.current.scrollTop = screen.current.scrollHeight;
  }, [activeId]);
  useEffect(() => {
    if (!live && panel === 'password') closePanel();
    if (
      live &&
      !embedded &&
      !minimized &&
      !panel &&
      floating.root.current?.contains(document.activeElement)
    )
      commandInput.current?.focus({ preventScroll: true });
  }, [live]);
  useEffect(() => {
    if (panel === 'password') passwordInput.current?.focus({ preventScroll: true });
    if (panel === 'add') searchInput.current?.focus({ preventScroll: true });
    if (!panel) return;
    const dismiss = (event: PointerEvent) => {
      if (
        !panelRoot.current?.contains(event.target as Node) &&
        !addButton.current?.contains(event.target as Node) &&
        !passwordButton.current?.contains(event.target as Node)
      )
        closePanel();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [panel]);
  useLayoutEffect(() => {
    if (minimized) dock.current?.focus({ preventScroll: true });
    else if (!embedded && active)
      (commandInput.current || floating.root.current)?.focus({ preventScroll: true });
  }, [minimized]);
  useLayoutEffect(() => {
    if (!scrolledBack && screen.current) screen.current.scrollTop = screen.current.scrollHeight;
  }, [active?.lines, active?.status, minimized, floating.measured.width, floating.measured.height]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const run = (value = draft) => {
    if (!active || !live) return;
    onCommand(active.resource.id, value);
    setDraft('');
    historyIndex.current = -1;
    setScrolledBack(false);
    commandInput.current?.focus({ preventScroll: true });
  };
  if (!active) return null;
  const r = active.resource;
  const statusDot = (session: ConsoleSession) => (
    <span
      className="basis-console__status-dot"
      data-status={session.status}
      aria-label={consoleStatusLabels[session.status]}
    />
  );
  if (minimized && !embedded)
    return createPortal(
      <div className="basis-console-dock">
        <Button
          ref={dock}
          variant="secondary"
          size="md"
          leadingIcon={<Terminal />}
          trailingIcon={<Maximize2 />}
          onClick={restoreWindow}
          aria-label={`Развернуть консоли · ${sessions.length} · ${r.name}`}
        >
          <span>{r.name}</span>
          <span className="basis-console-dock__count">{sessions.length}</span>
        </Button>
      </div>,
      document.body,
    );
  const rectStyle: CSSProperties =
    !embedded && !floating.maximized && floating.rect
      ? {
          left: floating.rect.x,
          top: floating.rect.y,
          width: floating.rect.width,
          height: floating.rect.height,
        }
      : {};
  const rendered = (
    <section
      ref={floating.root}
      tabIndex={-1}
      role={embedded ? 'region' : 'dialog'}
      aria-modal={embedded ? undefined : false}
      aria-label="Консоли виртуальных машин"
      className="basis-console"
      data-overlay-root
      data-embedded={embedded}
      data-maximized={floating.maximized}
      data-moving={floating.moving}
      data-compact={floating.measured.width > 0 && floating.measured.width < 760}
      style={rectStyle}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey) event.stopPropagation();
        if (event.key === 'Escape') {
          if (panel) {
            event.preventDefault();
            closePanel(true);
          } else floating.cancel();
        }
      }}
    >
      <header
        className="basis-console__header"
        onPointerDown={(event) => !embedded && floating.start(event, 'move')}
        onPointerMove={floating.move}
        onPointerUp={floating.end}
        onPointerCancel={floating.cancel}
        onLostPointerCapture={floating.end}
        onDoubleClick={(event) => {
          if (!embedded && !(event.target as Element).closest('button')) floating.toggleMaximize();
        }}
      >
        <span
          className="basis-console__drag-handle"
          tabIndex={embedded ? undefined : 0}
          role="group"
          aria-label="Переместить окно консолей: используйте стрелки"
          title="Переместить окно · двойной клик — развернуть"
          onKeyDown={(event) => floating.keyboard(event, 'move')}
        >
          <Terminal />
        </span>
        <WorkspaceTabs
          marker={false}
          label="Открытые консоли"
          overflowLabel="Все консоли"
          overflowMenu="auto"
          scrollWithWheel
          removeLabel="Закрыть консоль"
          items={sessions.map((session) => ({
            id: session.resource.id,
            label: session.resource.name,
            description: `${session.resource.project} · ${session.resource.host} · ${session.resource.address} · ${consoleStatusLabels[session.status]}`,
            icon: statusDot(session),
          }))}
          value={r.id}
          onSelect={onSelect}
          onRemove={(id) => {
            closePanel();
            onCloseSession(id);
          }}
          onReorder={onReorder}
          onEmptyFocus={() => opener.current?.focus({ preventScroll: true })}
        />
        <Tooltip content="Подключить ещё одну машину">
          <IconButton
            ref={addButton}
            size="sm"
            variant="ghost"
            icon={<Plus />}
            aria-label="Добавить консоль"
            aria-expanded={panel === 'add'}
            aria-controls={panel === 'add' ? `${uid}-panel` : undefined}
            onClick={() => openPanel('add')}
          />
        </Tooltip>
        <div className="basis-console__window-actions">
          {embedded ? (
            <Tooltip content="Открыть поверх страницы">
              <IconButton
                size="sm"
                variant="ghost"
                icon={<ArrowUpRight />}
                aria-label="Поверх страницы"
                onClick={onDetach}
              />
            </Tooltip>
          ) : (
            <Tooltip content="Свернуть · сессии сохранятся">
              <IconButton
                size="sm"
                variant="ghost"
                icon={<Minus />}
                aria-label="Свернуть консоли"
                onClick={minimize}
              />
            </Tooltip>
          )}
          <Menu
            compact
            label="Параметры окна консоли"
            icon={<MoreHorizontal />}
            items={[
              ...(!embedded
                ? [
                    {
                      id: 'compact',
                      label: 'Компактное окно',
                      description: 'Больше места для портала',
                      group: 'Размер окна',
                      onSelect: () => floating.setPreset('compact'),
                    },
                    {
                      id: 'default',
                      label: 'Рабочее окно',
                      description: 'Исходный размер',
                      onSelect: () => floating.setPreset('default'),
                    },
                    {
                      id: 'maximize',
                      label: floating.maximized ? 'Восстановить размер' : 'Развернуть окно',
                      onSelect: floating.toggleMaximize,
                    },
                  ]
                : []),
              {
                id: 'larger',
                label: 'Увеличить текст',
                group: 'Терминал',
                disabled: fontStep >= 3,
                onSelect: () => setFontStep(fontStep + 1),
              },
              {
                id: 'smaller',
                label: 'Уменьшить текст',
                disabled: fontStep <= -1,
                onSelect: () => setFontStep(fontStep - 1),
              },
              {
                id: 'reset',
                label: 'Исходный размер текста',
                disabled: fontStep === 0,
                onSelect: () => setFontStep(0),
              },
              {
                id: 'disconnect',
                label: 'Отключить сессию',
                description: 'Машина продолжит работать',
                icon: <Unplug />,
                group: 'Подключение',
                disabled: !live,
                onSelect: () => onDisconnect(r.id),
              },
            ]}
          />
          {!embedded && (
            <Tooltip content="Закрыть все консоли · питание ВМ не изменится">
              <IconButton
                size="sm"
                variant="ghost"
                icon={<X />}
                aria-label="Закрыть все консоли"
                onClick={closeAll}
              />
            </Tooltip>
          )}
        </div>
      </header>
      <div
        className="basis-console__display"
        style={{ '--console-font-step': `${fontStep}px` } as CSSProperties}
      >
        <div
          ref={screen}
          className="basis-console__screen"
          tabIndex={0}
          aria-label={`Вывод консоли ${r.name}`}
          onScroll={(event) => {
            const el = event.currentTarget;
            setScrolledBack(el.scrollHeight - el.scrollTop - el.clientHeight > 48);
          }}
        >
          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={`Журнал консоли ${r.name}`}
          >
            {active.lines.map((line, index) => (
              <pre key={`${r.id}-${index}`} data-kind={line.kind}>
                {line.text}
              </pre>
            ))}
          </div>
          {live && (
            <form
              className="basis-console__prompt"
              onSubmit={(event) => {
                event.preventDefault();
                run();
              }}
            >
              <label htmlFor={`${uid}-command`}>root@{r.name}:~#</label>
              <input
                ref={commandInput}
                id={`${uid}-command`}
                aria-label={`Команда для ${r.name}`}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  historyIndex.current = -1;
                }}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={1024}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.ctrlKey && event.key.toLowerCase() === 'l') {
                    event.preventDefault();
                    onCommand(r.id, 'clear');
                    return;
                  }
                  if (
                    event.ctrlKey &&
                    event.key.toLowerCase() === 'c' &&
                    event.currentTarget.selectionStart === event.currentTarget.selectionEnd
                  ) {
                    event.preventDefault();
                    setDraft('');
                    onSignal(r.id, 'Ctrl+C');
                    return;
                  }
                  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    if (!active.history.length) return;
                    if (historyIndex.current < 0) historyDraft.current = draft;
                    historyIndex.current = Math.min(
                      active.history.length - 1,
                      Math.max(-1, historyIndex.current + (event.key === 'ArrowUp' ? 1 : -1)),
                    );
                    setDraft(
                      historyIndex.current < 0
                        ? historyDraft.current
                        : active.history[active.history.length - 1 - historyIndex.current],
                    );
                  }
                }}
              />
              <button type="submit" className="basis-visually-hidden" tabIndex={-1}>
                Выполнить команду
              </button>
            </form>
          )}
        </div>
        {!live && (
          <div className="basis-console__connection-state" role="status">
            <span className="basis-console__state-icon">
              {active.status === 'connecting' ? (
                <CloudLoader />
              ) : active.status === 'stopped' ? (
                <Power />
              ) : (
                <CloudOff />
              )}
            </span>
            <strong>{consoleStatusLabels[active.status]}</strong>
            <p>
              {active.status === 'connecting'
                ? `Устанавливаем соединение с ${r.name}…`
                : active.status === 'stopped'
                  ? 'Запустите машину на её странице, затем подключитесь снова.'
                  : active.status === 'error'
                    ? 'Не удалось связаться с машиной. Проверьте её доступность и повторите подключение.'
                    : 'Вывод сохранён. Можно продолжить работу в этой же вкладке.'}
            </p>
            {active.status !== 'connecting' && active.status !== 'stopped' && r.available && (
              <Button
                size="sm"
                variant="primary"
                leadingIcon={<RefreshCw />}
                onClick={() => onReconnect(r.id)}
              >
                Подключиться снова
              </Button>
            )}
          </div>
        )}
        {scrolledBack && live && (
          <Button
            className="basis-console__to-bottom"
            size="sm"
            leadingIcon={<ArrowDown />}
            onClick={() => {
              setScrolledBack(false);
              if (screen.current) screen.current.scrollTop = screen.current.scrollHeight;
            }}
          >
            К последней строке
          </Button>
        )}
        {notice && (
          <div className="basis-console__notice" role="status">
            <Check />
            {notice}
          </div>
        )}
      </div>
      <footer className="basis-console__footer">
        <span className="basis-console__connection">
          {statusDot(active)}
          <span>{consoleStatusLabels[active.status]}</span>
          <small title="Локальная демонстрация без подключения к гипервизору">Демо</small>
        </span>
        <div className="basis-console__quick-actions">
          <Tooltip content="Ввести пароль в активную ВМ">
            <Button
              ref={passwordButton}
              size="sm"
              variant="ghost"
              leadingIcon={<KeyRound />}
              aria-label="Ввести пароль"
              disabled={!live}
              aria-expanded={panel === 'password'}
              onClick={() => openPanel('password')}
            >
              {floating.measured.width > 0 && floating.measured.width < 520 ? null : 'Пароль'}
            </Button>
          </Tooltip>
          <Menu
            size="sm"
            compact={floating.measured.width > 0 && floating.measured.width < 520}
            variant="ghost"
            label="Команды"
            icon={<Keyboard />}
            disabled={!live}
            items={[
              {
                id: 'ip',
                label: 'Сетевые интерфейсы',
                description: 'ip a',
                icon: <Terminal />,
                onSelect: () => run('ip a'),
              },
              {
                id: 'memory',
                label: 'Использование памяти',
                description: 'free -h',
                icon: <Terminal />,
                onSelect: () => run('free -h'),
              },
              {
                id: 'uptime',
                label: 'Время работы',
                description: 'uptime',
                icon: <Terminal />,
                onSelect: () => run('uptime'),
              },
              {
                id: 'keys',
                label: 'Сочетания клавиш',
                group: 'Клавиатура гостевой ОС',
                icon: <Keyboard />,
                children: ['Ctrl+Alt+Delete', 'Ctrl+C', 'Escape', 'Tab', 'Enter'].map((signal) => ({
                  id: signal,
                  label: signal,
                  onSelect: () => {
                    onSignal(r.id, signal);
                    commandInput.current?.focus({ preventScroll: true });
                  },
                })),
              },
              {
                id: 'clear',
                label: 'Очистить экран',
                description: 'История команд сохранится',
                group: 'Терминал',
                onSelect: () => run('clear'),
              },
            ]}
          />

          <Tooltip content="Переподключить активную консоль">
            <IconButton
              size="sm"
              variant="ghost"
              icon={<RefreshCw />}
              aria-label="Переподключить консоль"
              disabled={!r.available || active.status === 'connecting'}
              onClick={() => onReconnect(r.id)}
            />
          </Tooltip>
        </div>
      </footer>
      {floating.moving && (
        <output className="basis-console__geometry" aria-live="off">
          {floating.measured.width} × {floating.measured.height}
        </output>
      )}
      {panel && (
        <div
          ref={panelRoot}
          id={`${uid}-panel`}
          className="basis-console__panel"
          data-panel={panel}
          role="dialog"
          aria-label={panel === 'password' ? 'Ввести пароль в консоль' : 'Добавить консоль'}
        >
          <header>
            <span className="basis-console__panel-icon">
              {panel === 'password' ? <KeyRound /> : <Server />}
            </span>
            <div>
              <strong>{panel === 'password' ? 'Ввести пароль' : 'Подключить машину'}</strong>
              <small>{panel === 'password' ? r.name : 'Отдельная сессия в новой вкладке'}</small>
            </div>
            <IconButton
              size="sm"
              variant="ghost"
              icon={<X />}
              aria-label="Закрыть панель консоли"
              onClick={() => closePanel(true)}
            />
          </header>
          {panel === 'password' ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!password || !live) return;
                onPassword(r.id, password, sendEnter);
                setPassword('');
                setPanel(null);
                setNotice(`Пароль передан в ${r.name}`);
                commandInput.current?.focus({ preventScroll: true });
              }}
            >
              <PasswordInput
                ref={passwordInput}
                label="Пароль гостевой ОС"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                hint="Ввод без отображения в консоли и истории команд."
              />
              <Checkbox
                checked={sendEnter}
                onCheckedChange={setSendEnter}
                label="Нажать Enter после ввода"
              />
              <div className="basis-console__panel-actions">
                <Button size="sm" onClick={() => closePanel(true)}>
                  Отмена
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  variant="primary"
                  leadingIcon={<CornerDownLeft />}
                  disabled={!password || !live}
                >
                  Ввести
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="basis-console__picker-search">
                <Input
                  ref={searchInput}
                  label="Поиск машины"
                  leadingIcon={<Search />}
                  placeholder="Имя, IP-адрес или проект"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="basis-console__picker-list">
                {resources
                  .filter((item) =>
                    `${item.name} ${item.address} ${item.project}`
                      .toLocaleLowerCase()
                      .includes(query.toLocaleLowerCase()),
                  )
                  .map((item) => {
                    const opened = sessions.some((s) => s.resource.id === item.id);
                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        className="basis-console__picker-item"
                        leadingIcon={<Server />}
                        trailingIcon={opened ? <Check /> : <Plus />}
                        onClick={() => {
                          closePanel();
                          onOpenResource(item);
                        }}
                      >
                        <strong>{item.name}</strong>
                        <small>
                          {item.project} ·{' '}
                          {opened
                            ? 'Консоль уже открыта'
                            : item.available
                              ? item.address
                              : 'Машина выключена'}
                        </small>
                      </Button>
                    );
                  })}
                {!resources.some((item) =>
                  `${item.name} ${item.address} ${item.project}`
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
                ) && (
                  <p className="basis-console__panel-note">Машины не найдены. Измените запрос.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {!embedded && !floating.maximized && (
        <>
          {['n', 'e', 's', 'w', 'ne', 'nw', 'sw'].map((edge) => (
            <span
              key={edge}
              className="basis-console__resize"
              data-edge={edge}
              aria-hidden="true"
              onPointerDown={(event) => floating.start(event, edge)}
              onPointerMove={floating.move}
              onPointerUp={floating.end}
              onPointerCancel={floating.cancel}
              onLostPointerCapture={floating.end}
            />
          ))}
          <IconButton
            className="basis-console__resize"
            data-edge="se"
            size="sm"
            variant="ghost"
            icon={<Scaling />}
            title="Потяните за угол, чтобы изменить размер. С клавиатуры — стрелки."
            aria-label="Изменить размер окна: используйте стрелки"
            onPointerDown={(event) => floating.start(event, 'se')}
            onPointerMove={floating.move}
            onPointerUp={floating.end}
            onPointerCancel={floating.cancel}
            onLostPointerCapture={floating.end}
            onKeyDown={(event) => floating.keyboard(event, 'se')}
          />
        </>
      )}
    </section>
  );
  return embedded ? rendered : createPortal(rendered, document.body);
}
