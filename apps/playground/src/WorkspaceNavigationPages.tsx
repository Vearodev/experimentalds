import { useRef, useState } from 'react';
import {
  Activity,
  Boxes,
  Cloud,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Settings2,
  SlidersHorizontal,
  Star,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Message,
  Select,
  SidebarNavigation,
  StatusBadge,
  Tooltip,
  WorkspaceTabs,
  type SidebarItem,
  type WorkspaceTab,
} from '@basis/ui';
import { PageHeading, SectionHeading } from './PageParts';
import { ComponentTokens } from './TokenPanel';
import { useDesign } from './DesignContext';
import './workspace-navigation-pages.css';

const menuItems: SidebarItem[] = [
  { id: 'overview', label: 'Обзор', icon: <LayoutDashboard /> },
  {
    id: 'compute',
    label: 'Вычисления',
    icon: <Server />,
    children: [
      {
        id: 'vms',
        label: 'Виртуальные машины',
        icon: <Server />,
        count: 16,
        keywords: ['ВМ', 'VM'],
      },
      { id: 'clusters', label: 'Кластеры и хосты', icon: <Boxes /> },
      { id: 'k8ci', label: 'Конфигурации Kubernetes', icon: <Boxes />, keywords: ['k8s'] },
    ],
  },
  { id: 'disks', label: 'Диски', icon: <HardDrive /> },
  { id: 'networks', label: 'Сети', icon: <Network /> },
  {
    id: 'management',
    label: 'Управление',
    icon: <Settings2 />,
    children: [
      { id: 'projects', label: 'Проекты', icon: <FolderKanban /> },
      { id: 'tasks', label: 'Журнал задач', icon: <Activity />, count: 2 },
    ],
  },
];
export function MainNavigationPage() {
  const design = useDesign();
  const [compact, setCompact] = useState(false),
    [active, setActive] = useState('vms');
  const activeLabel = menuItems
    .flatMap((item) => item.children || [item])
    .find((item) => item.id === active)?.label;
  return (
    <>
      <PageHeading
        category="Составной компонент · Навигация"
        title="Основное меню"
        description="Поиск, рабочие разделы и понятная иерархия. Прокручивается только список; длинные названия остаются читаемыми в обоих режимах."
      >
        <Button
          size="sm"
          leadingIcon={<SlidersHorizontal />}
          onClick={() => design.openComponent('navigation')}
        >
          Токены компонента
        </Button>
      </PageHeading>
      <section className="ds-section">
        <SectionHeading
          number="01"
          title="Иерархия без второй боковой панели"
          note="224 px → 64 px"
        />
        <div className="navigation-lab" data-compact={compact}>
          <aside className="navigation-lab__sidebar">
            <div className="navigation-lab__brand">
              <Cloud />
              {!compact && <strong>Basis statix</strong>}
            </div>
            <SidebarNavigation
              items={menuItems}
              activeId={active}
              compact={compact}
              searchable
              onNavigate={(item) => setActive(item.id)}
              label="Пример основного меню"
            />
            <Tooltip content={compact ? 'Развернуть меню' : 'Свернуть меню'}>
              <IconButton
                variant="ghost"
                size="sm"
                icon={compact ? <PanelLeftOpen /> : <PanelLeftClose />}
                aria-label={compact ? 'Развернуть меню' : 'Свернуть меню'}
                onClick={() => setCompact(!compact)}
              />
            </Tooltip>
          </aside>
          <div className="navigation-lab__workspace">
            <span className="eyebrow">Рабочая область / Production</span>
            <h2>{activeLabel}</h2>
            <p>
              Найдите «ВМ», «k8s» или «Управление». Поиск видит закрытые группы и сохраняет их
              состояние. В компактном режиме кнопка поиска открывает отдельное окно разделов.
            </p>
            <div className="navigation-lab__resource">
              <Server />
              <div>
                <strong>prod-api-01</strong>
                <span>Кластер msk-prod · 10.20.0.14</span>
              </div>
              <StatusBadge tone="success">Работает</StatusBadge>
            </div>
            <Message title="Контекст всегда виден" tone="info">
              Активный подпункт выделен цветом и маркером. При переходе в закрытую группу она
              раскрывается автоматически.
            </Message>
          </div>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Поведение и доступность" />
        <div className="navigation-rules">
          <article>
            <strong>Раскрытое меню</strong>
            <p>
              Отступ и направляющая показывают вложенность. Нажатие на группу меняет только её
              раскрытие; переход выполняет конечный пункт.
            </p>
          </article>
          <article>
            <strong>Компактное меню</strong>
            <p>
              Шеврон отличает группы от обычных ссылок. Наведение открывает подменю справа без смены
              фокуса; клик закрепляет его. Поддерживает стрелки и Escape, возвращает фокус к своей
              кнопке.
            </p>
          </article>
          <article>
            <strong>Поиск разделов</strong>
            <p>
              По названию, группе и синонимам. Стрелка вниз переводит фокус к результатам, Enter
              открывает раздел. Escape очищает запрос. Пустой результат объясняет, что делать
              дальше.
            </p>
          </article>
          <article>
            <strong>Малый экран</strong>
            <p>
              Полное меню доступно в отдельном окне. Выбранный на компьютере компактный режим не
              уменьшает мобильные пункты.
            </p>
          </article>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="03" title="Параметры дизайна" />
        <ComponentTokens component="navigation" />
      </section>
    </>
  );
}
const examples: WorkspaceTab[] = [
  { id: 'vms', label: 'Виртуальные машины', description: 'Всё облако · Реестр', icon: <Server /> },
  {
    id: 'vm',
    label: 'prod-api-01 / Снимки',
    description: 'Production · Виртуальная машина',
    icon: <Server />,
  },
  {
    id: 'network',
    label: 'Сети / Development',
    description: 'Development · Реестр',
    icon: <Network />,
  },
];
export function WorkspaceTabsPage() {
  const design = useDesign(),
    pin = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState(examples),
    [current, setCurrent] = useState(examples[1]),
    [scenario, setScenario] = useState('normal');
  const value = current.id;
  const saved = items.some((item) => item.id === value);
  const changeScenario = (mode: string) => {
    setScenario(mode);
    setCurrent(examples[1]);
    setItems(
      mode === 'empty'
        ? []
        : mode === 'overflow'
          ? [
              ...examples,
              ...Array.from({ length: 8 }, (_, index) => ({
                id: `resource-${index}`,
                label: `prod-worker-${String(index + 1).padStart(2, '0')}`,
                description: 'Production · Виртуальная машина',
                icon: <Server />,
              })),
            ]
          : mode === 'unavailable'
            ? [
                ...examples,
                {
                  id: 'deleted',
                  label: 'archive-db-02',
                  description: 'Ресурс недоступен · можно убрать из избранного',
                  icon: <HardDrive />,
                  disabled: true,
                },
              ]
            : examples,
    );
  };
  return (
    <>
      <PageHeading
        category="Составной компонент · Навигация"
        title="Избранные вкладки"
        description="Закреплённые рабочие контексты: ресурс, его внутренний раздел и проект. Располагаются над страницей, отдельно от вкладок сущности."
      >
        <Button
          size="sm"
          leadingIcon={<SlidersHorizontal />}
          onClick={() => design.openComponent('workspace-tabs')}
        >
          Токены компонента
        </Button>
      </PageHeading>
      <section className="ds-section">
        <SectionHeading number="01" title="Быстрый возврат к работе" note="Одна строка · 44 px" />
        <div className="workspace-lab-controls">
          <Select
            label="Сценарий"
            value={scenario}
            onValueChange={changeScenario}
            options={[
              { value: 'normal', label: 'Сохранённые страницы' },
              { value: 'empty', label: 'Пока нет избранного' },
              { value: 'overflow', label: 'Много вкладок' },
              { value: 'unavailable', label: 'Ресурс недоступен' },
            ]}
          />
          <Button size="sm" variant="ghost" onClick={() => changeScenario(scenario)}>
            Восстановить пример
          </Button>
        </div>
        <div className="workspace-lab">
          <div className="workspace-lab__header">
            <span>
              <Cloud /> Production / {current.label}
            </span>
            <Tooltip
              content={
                saved
                  ? 'Убрать текущую страницу из избранного'
                  : 'Сохранить страницу в избранных вкладках'
              }
            >
              <IconButton
                ref={pin}
                size="sm"
                variant="ghost"
                icon={<Star fill={saved ? 'currentColor' : 'none'} />}
                aria-label={
                  saved
                    ? 'Убрать текущую страницу из избранного'
                    : 'Сохранить страницу в избранных вкладках'
                }
                aria-pressed={saved}
                onClick={() =>
                  setItems(
                    saved
                      ? items.filter((item) => item.id !== value)
                      : [...items, { ...current, id: value }],
                  )
                }
              />
            </Tooltip>
          </div>
          {items.length > 0 && (
            <WorkspaceTabs
              items={items}
              value={value}
              onSelect={(id) => {
                const item = items.find((item) => item.id === id);
                if (item) setCurrent(item);
              }}
              onRemove={(id) => setItems(items.filter((item) => item.id !== id))}
              onReorder={(order) =>
                setItems((previous) =>
                  [...previous].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
                )
              }
              onEmptyFocus={() => pin.current?.focus()}
            />
          )}
          <div className="workspace-lab__content">
            <span className="eyebrow">Открытая страница</span>
            <h2>{current.label}</h2>
            <p>
              {items.length
                ? 'Нажмите на вкладку для перехода. Перетащите её за название, чтобы изменить порядок. Крестик убирает из избранного, сохраняя текущую страницу открытой.'
                : 'Нажмите звезду рядом с путём страницы. До первого сохранения полоса вкладок не занимает места.'}
            </p>
            <StatusBadge tone="success">Работает</StatusBadge>
          </div>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Сохранение и навигация" />
        <div className="navigation-rules">
          <article>
            <strong>Точная точка возврата</strong>
            <p>
              Сохраняются маршрут сущности, внутренний раздел и рабочая область. Страницы одного
              реестра в разных проектах — отдельные вкладки.
            </p>
          </article>
          <article>
            <strong>Переполнение</strong>
            <p>
              Вкладки остаются в одной строке с горизонтальной прокруткой. Меню справа показывает
              полные названия и проекты, активная вкладка появляется в видимой области.
            </p>
          </article>
          <article>
            <strong>Перемещение и клавиатура</strong>
            <p>
              Перетаскивание показывает место вставки; у краёв полоса прокручивается. Escape
              отменяет перенос. Alt + Shift + стрелки меняют порядок с клавиатуры. Обычные стрелки
              переключают страницы, Delete убирает из избранного.
            </p>
          </article>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="03" title="Параметры дизайна" />
        <ComponentTokens component="workspace-tabs" />
      </section>
    </>
  );
}
