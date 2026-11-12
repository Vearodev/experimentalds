import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  Info,
  Link2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Undo2,
  Redo2,
  X,
} from 'lucide-react';
import { Button, ButtonGroup, IconButton } from '@basis/ui';
import { chainOf, impactOf, colorFromHex, type ResolvedToken } from '@basis/tokens/engine';
import { useDesign } from './DesignContext';

const layerNames: Record<string, string> = {
  ref: 'Исходное значение',
  sys: 'Смысловая роль',
  comp: 'Компонент',
};
const componentNames: Record<string, string> = {
  console: 'Консоли ВМ',
  'table-select': 'Табличный выбор',
  'context-panel': 'Контекстная панель',
  'table-tools': 'Инструменты таблицы',
  navigation: 'Навигация платформы',
  'workspace-tabs': 'Избранные вкладки',
  shell: 'Компоновка платформы',
  button: 'Кнопки',
  input: 'Поля',
  select: 'Селекты',
  slider: 'Слайдеры',
  progress: 'Прогресс',
  skeleton: 'Скелетоны',
  checkbox: 'Чекбоксы',
  switch: 'Переключатели',
  status: 'Статусы',
  badge: 'Счётчики',
  'cascade-select': 'Каскадный выбор',
  radio: 'Радиокнопки',
  'code-input': 'Код подтверждения',
  tag: 'Метки',
  'input-tag': 'Ввод меток',
  'input-mask': 'Маски ввода',
  accordion: 'Аккордеон',
  breadcrumb: 'Навигационный путь',
  menu: 'Меню действий',
  message: 'Сообщения',
  toast: 'Уведомления',
  chip: 'Чипы',
  avatar: 'Аватары',
  tooltip: 'Подсказки',
  tabs: 'Вкладки',
  dialog: 'Диалоги',
  table: 'Таблицы',
  icon: 'Иконки',
};
const words: Record<string, string> = {
  primary: 'Основная',
  tone: 'Смысловой тон',
  neutral: 'Нейтральный',
  success: 'Успех',
  warning: 'Внимание',
  info: 'Информация',
  solid: 'Сплошной акцент',
  soft: 'Мягкий акцент',
  outline: 'Контур',
  secondary: 'Вторичная',
  tonal: 'Акцентная',
  ghost: 'Тихая',
  danger: 'Опасная',
  background: 'Фон',
  foreground: 'Текст и иконки',
  border: 'Граница',
  default: 'Обычное',
  hover: 'Наведение',
  pressed: 'Нажатие',
  disabled: 'Недоступное',
  size: 'Размер',
  height: 'Высота',
  width: 'Ширина',
  placeholder: 'Подсказка в поле',
  'popup-background': 'Фон окна выбора',
  'popup-radius': 'Радиус окна выбора',
  'popup-padding': 'Отступ окна выбора',
  padding: 'Отступ',
  inset: 'Отступ от края',
  gap: 'Интервал',
  icon: 'Иконка',
  radius: 'Радиус',
  transition: 'Переход',
  elevation: 'Объём поверхности',
  shadow: 'Тень',
  wide: 'Ширина расширенной панели',
  'drawer-width': 'Ширина боковой панели',
  'drawer-backdrop': 'Затемнение за боковой панелью',
  'drawer-inset': 'Отступ окна от краёв экрана',
  'drawer-radius': 'Скругление бокового окна',
  canvas: 'Фон рабочего пространства',
  'surface-background': 'Фон секции',
  'surface-border': 'Граница секции',
  'content-padding': 'Отступы рабочей области',
  'group-background': 'Фон заголовка группы',
  'group-foreground': 'Текст группы',
  'group-height': 'Высота заголовка группы',
  'group-bar-background': 'Фон управления группами',
  'group-bar-height': 'Высота управления группами',
  'header-min-width': 'Минимум колонки с пояснением и действиями',
  'state-symbol-size': 'Значок пустого состояния и ошибки',
  'compact-width': 'Ширина компактного меню',
  'child-inset': 'Отступ вложенного пункта',
  'tab-max-width': 'Максимальная ширина вкладки',
  'drop-indicator': 'Цвет места вставки вкладки',
  'drop-indicator-width': 'Толщина указателя вставки',
  'drag-source-opacity': 'Прозрачность исходной вкладки при переносе',
  'drag-shadow': 'Тень перемещаемой вкладки',
  'item-padding-block': 'Вертикальный отступ пункта меню',
  'item-padding-inline': 'Горизонтальный отступ пункта меню',
  'label-gap': 'Расстояние между названием и описанием',
  'description-line-height': 'Высота строки описания',
  'footer-font-size': 'Текст счётчиков и пагинации',
  fill: 'Заполнение',
  track: 'Дорожка',
  duration: 'Длительность',
  highlight: 'Блик',
  'font-size': 'Текст',
  'font-weight': 'Насыщенность',
  'font-family': 'Шрифт',
  'cell-width': 'Ширина ячейки',
  'cell-height': 'Высота ячейки',
  'border-focus': 'Граница фокуса',
  'border-error': 'Граница ошибки',
  'checked-background': 'Фон выбранного',
  'checked-foreground': 'Маркер выбора',
  'card-radius': 'Радиус карточки',
  'card-padding': 'Отступ карточки',
  'column-width': 'Ширина уровня',
  'rule-padding': 'Отступ внутри условия',
  'rule-gap': 'Интервал между условиями',
  'column-padding-block': 'Отступ строки по вертикали',
  'column-padding-inline': 'Отступ строки по горизонтали',
  'group-color': 'Подписи групп',
  'icon-color': 'Цвет иконок',
  'count-background': 'Фон счётчика',
  'item-gap': 'Интервал между пунктами',
  'item-padding': 'Отступ внутри пункта',
  'column-background': 'Фон уровня',
  'column-border': 'Граница уровня',
  'selected-background': 'Фон выбора',
  'selected-foreground': 'Текст выбора',
  'selected-border': 'Граница выбора',
  'dot-size': 'Размер точки',
  'square-radius': 'Радиус квадратного варианта',
  'group-overlap': 'Перекрытие в группе',
  'ring-color': 'Цвет внешней границы',
  'tag-gap': 'Интервал между строками меток',
  'template-foreground': 'Цвет шаблона',
  'header-hover': 'Наведение на заголовок',
  'expanded-background': 'Фон раскрытого содержимого',
  'current-foreground': 'Текущий уровень',
  separator: 'Разделитель',
  'item-height': 'Высота пункта',
  'item-radius': 'Радиус пункта',
  'item-hover': 'Наведение на пункт',
  'muted-foreground': 'Вторичный текст',
  'icon-size': 'Размер иконки',
  'title-size': 'Размер заголовка',
  offset: 'Отступ от края экрана',
  'stack-gap': 'Интервал в очереди',
  'focus-color': 'Цвет фокуса',
  'focus-width': 'Толщина фокуса',
  'focus-offset': 'Отступ фокуса',
  'row-height': 'Высота строки',
  'header-height': 'Высота заголовка',
  'cell-padding': 'Отступ ячейки',
  grid: 'Сетка',
  selected: 'Выбрано',
  'header-background': 'Фон заголовка',
  sm: 'S',
  md: 'M',
  lg: 'L',
};
const label = (path: string) =>
  path
    .replace(/^comp\.[^.]+\./, '')
    .replace(/^sys\./, '')
    .split('.')
    .map((part) => words[part] || part)
    .join(' / ');
export function TokenValue({ token }: { token: ResolvedToken }) {
  return (
    <span className="token-value">
      {token.$type === 'color' && <i style={{ background: token.cssValue }} />}
      <span>
        {token.$type === 'fontFamily'
          ? Array.isArray(token.value)
            ? token.value[0]
            : token.value
          : token.cssValue}
      </span>
    </span>
  );
}
export function ComponentTokens({
  component,
  compact = false,
}: {
  component: string;
  compact?: boolean;
}) {
  const design = useDesign();
  const entries = Object.entries(design.resolved).filter(([path]) =>
    component === 'icon' ? path.startsWith('sys.icon.') : path.startsWith(`comp.${component}.`),
  );
  return (
    <div className="component-tokens" id={`component-tokens-${component}`}>
      <div className="component-tokens__heading">
        <div>
          <span className="eyebrow">Визуальный контракт</span>
          <h3>
            Токены компонента <span>{entries.length}</span>
          </h3>
        </div>
        <Button
          size="sm"
          leadingIcon={<SlidersHorizontal />}
          onClick={() => design.openComponent(component)}
        >
          Настроить
        </Button>
      </div>
      <div className="token-table-scroll">
        <table className="token-table">
          <thead>
            <tr>
              <th>Параметр</th>
              <th>Связь</th>
              <th>Значение · {design.theme === 'light' ? 'светлая' : 'тёмная'}</th>
              <th>
                <span className="basis-visually-hidden">Изменить</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, compact ? 8 : 18).map(([path, token]) => (
              <tr key={path}>
                <td>
                  <span>{label(path)}</span>
                </td>
                <td>
                  <span className="token-reference">
                    <Link2 size={12} />
                    {token.references[0] || 'Исходное значение'}
                  </span>
                </td>
                <td>
                  <TokenValue token={token} />
                </td>
                <td>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon={<ChevronRight />}
                    aria-label={`Настроить ${path}`}
                    onClick={() => {
                      design.openComponent(component);
                      design.inspect(path);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length > (compact ? 8 : 18) && (
        <Button
          size="sm"
          variant="ghost"
          trailingIcon={<ArrowRight />}
          onClick={() => design.openComponent(component)}
        >
          Все {entries.length} параметров
        </Button>
      )}
    </div>
  );
}
function editableFamily(path: string) {
  if (/radius/.test(path)) return 'radius';
  if (/font-size|type.size|font.size/.test(path)) return 'type.size';
  if (/leading/.test(path)) return 'leading';
  if (/icon/.test(path) && !path.includes('stroke')) return 'icon';
  if (/padding|gap|space|cell.inset/.test(path)) return 'space';
  if (/height/.test(path)) return 'height';
  if (/width/.test(path)) return 'width';
  return '';
}
export function TokenPanel() {
  const design = useDesign(),
    [query, setQuery] = useState(''),
    [draft, setDraft] = useState(''),
    [alpha, setAlpha] = useState('100'),
    [validation, setValidation] = useState(''),
    [collection, setCollection] = useState<'sys' | 'ref'>('sys');
  const selected = design.inspector ? design.resolved[design.inspector] : null;
  const paths = useMemo(
    () =>
      Object.keys(design.tokens)
        .filter((path) =>
          design.panelScope === 'system'
            ? path.startsWith(`${collection}.`)
            : design.panelScope === 'icon'
              ? path.startsWith('sys.icon.')
              : path.startsWith(`comp.${design.panelScope}.`),
        )
        .filter((path) => `${path} ${label(path)}`.toLowerCase().includes(query.toLowerCase())),
    [design.tokens, design.panelScope, query, collection],
  );
  useEffect(() => {
    setQuery('');
    setCollection('sys');
  }, [design.panelScope]);
  useEffect(() => {
    setValidation('');
    if (!selected) return;
    if (selected.$type === 'color') {
      setDraft(
        '#' +
          selected.value.components
            .map((value: number) =>
              Math.round(value * 255)
                .toString(16)
                .padStart(2, '0'),
            )
            .join(''),
      );
      setAlpha(String(Math.round((selected.value.alpha ?? 1) * 100)));
    } else
      setDraft(
        selected.$type === 'dimension' || selected.$type === 'duration'
          ? String(selected.value.value)
          : selected.$type === 'fontFamily'
            ? Array.isArray(selected.value)
              ? selected.value.join(', ')
              : selected.value
            : JSON.stringify(selected.value),
      );
  }, [selected?.path, selected?.cssValue]);
  useEffect(() => {
    if (!design.panelOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') design.setPanelOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [design.panelOpen]);
  if (!design.panelOpen) return null;
  const chain = selected ? chainOf(design.tokens, selected.path) : [],
    source = chain.at(-1),
    impact = selected ? impactOf(design.tokens, selected.path) : [],
    composite = selected && selected.references.length > 1;
  const aliases = selected
    ? Object.entries(design.tokens).filter(
        ([path, token]) =>
          token.$type === selected.$type &&
          path !== selected.path &&
          (selected.path.startsWith('comp.') ? path.startsWith('sys.') : path.startsWith('ref.')) &&
          (selected.$type !== 'dimension' ||
            !editableFamily(selected.path) ||
            editableFamily(path) === editableFamily(selected.path)),
      )
    : [];
  const applyRaw = () => {
    if (!selected) return;
    try {
      if (!draft.trim()) throw new Error('Укажите значение.');
      const value =
        selected.$type === 'color'
          ? { ...colorFromHex(draft), alpha: Number(alpha) / 100 }
          : selected.$type === 'dimension' || selected.$type === 'duration'
            ? { ...selected.value, value: Number(draft) }
            : selected.$type === 'number' || selected.$type === 'fontWeight'
              ? Number(draft)
              : selected.$type === 'fontFamily'
                ? draft.split(',').map((value) => value.trim())
                : JSON.parse(draft);
      design.change(selected.path, value);
      setValidation('');
    } catch (cause) {
      setValidation(cause instanceof Error ? cause.message : 'Проверьте значение.');
    }
  };
  const buildOnly = selected?.path.includes('breakpoint');
  return (
    <aside className="token-panel" aria-label="Редактор дизайн-токенов">
      <div className="token-panel__header">
        <div>
          <span>Мастерская токенов</span>
          <h2>
            {selected
              ? 'Параметр дизайна'
              : design.panelScope === 'system'
                ? 'Вся система'
                : componentNames[design.panelScope] || design.panelScope}
          </h2>
        </div>
        <IconButton
          size="sm"
          variant="ghost"
          icon={<X />}
          aria-label="Закрыть редактор токенов"
          onClick={() => design.setPanelOpen(false)}
        />
      </div>
      <div className="token-panel__theme">
        <span className={`theme-pebble ${design.theme}`} />
        {design.theme === 'light' ? 'Светлая тема' : 'Тёмная тема'}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => design.setTheme(design.theme === 'light' ? 'dark' : 'light')}
        >
          Сменить
        </Button>
      </div>
      <div className="token-panel__body">
        {selected ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<ArrowLeft />}
              onClick={() => design.inspect(null)}
            >
              К списку параметров
            </Button>
            <div className="token-detail-title">
              <span>{layerNames[selected.path.split('.')[0]]}</span>
              <h3>{selected.path}</h3>
              <p>{selected.$description}</p>
            </div>
            <div className="token-detail-preview">
              <TokenValue token={selected} />
            </div>
            {buildOnly ? (
              <p className="token-panel-intro">
                Порог адаптации — параметр сборки. Его редактирование в живом эксперименте пока
                недоступно.
              </p>
            ) : selected.path.startsWith('ref.') ? (
              <div className="token-edit-field">
                <label htmlFor="token-value-input">Исходное значение</label>
                <div>
                  {selected.$type === 'color' && (
                    <input
                      type="color"
                      aria-label="Палитра цвета"
                      value={/^#[0-9a-f]{6}$/i.test(draft) ? draft : '#000000'}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                  )}
                  <input
                    id="token-value-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    type={
                      ['dimension', 'duration', 'number', 'fontWeight'].includes(selected.$type)
                        ? 'number'
                        : 'text'
                    }
                    step="any"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyRaw();
                    }}
                  />
                  {selected.value?.unit && <span>{selected.value.unit}</span>}
                </div>
                {selected.$type === 'color' && (
                  <label className="token-opacity">
                    Непрозрачность
                    <input
                      aria-label="Непрозрачность цвета"
                      type="number"
                      min={0}
                      max={100}
                      value={alpha}
                      onChange={(event) => setAlpha(event.target.value)}
                    />
                    <span>%</span>
                  </label>
                )}
                <Button variant="primary" size="sm" onClick={applyRaw}>
                  Применить значение
                </Button>
              </div>
            ) : composite ? (
              <div className="token-recipe">
                <h4>Составной рецепт</h4>
                {selected.references.map((path) => (
                  <button key={path} onClick={() => design.inspect(path)}>
                    <span>{path}</span>
                    <TokenValue token={design.resolved[path]} />
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="token-edit-field">
                <label htmlFor="token-alias-input">Использовать другую связь</label>
                <select
                  id="token-alias-input"
                  value={selected.references[0] || ''}
                  onChange={(event) => design.change(selected.path, `{${event.target.value}}`)}
                >
                  {!aliases.some(([path]) => path === selected.references[0]) && (
                    <option value={selected.references[0]}>{selected.references[0]}</option>
                  )}
                  {aliases.map(([path]) => (
                    <option key={path} value={path}>
                      {path} · {design.resolved[path].cssValue}
                    </option>
                  ))}
                </select>
                {source && source !== selected.path && (
                  <Button
                    size="sm"
                    leadingIcon={<SlidersHorizontal />}
                    onClick={() => design.inspect(source)}
                  >
                    Изменить исходное значение
                  </Button>
                )}
              </div>
            )}
            <details className="token-chain-details">
              {' '}
              <summary>Связи и исходное значение</summary>
              <div className="token-chain">
                {chain.map((path, index) => (
                  <div key={path}>
                    <button
                      type="button"
                      className={path === selected.path ? 'is-current' : ''}
                      onClick={() => design.inspect(path)}
                    >
                      <span>{layerNames[path.split('.')[0]]}</span>
                      <strong>{path}</strong>
                      <small>{design.resolved[path].cssValue}</small>
                    </button>
                    {index < chain.length - 1 && <ArrowRight size={13} />}
                  </div>
                ))}
              </div>
            </details>
            <div className="token-impact">
              <Info size={15} />
              <div>
                <strong>
                  {selected.path.startsWith('comp.') && !impact.length
                    ? 'Параметр всех экземпляров компонента'
                    : `${impact.length} зависимых параметров`}
                </strong>
                <p>
                  {selected.path.startsWith('sys.color.')
                    ? 'Эта связь меняется только в выбранной теме.'
                    : selected.path.startsWith('comp.')
                      ? 'Связь меняется у компонента в обеих темах.'
                      : 'Исходные шкалы и метрики общие для обеих тем.'}
                </p>
                <span>Все связанные примеры обновятся сразу.</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<RotateCcw />}
              onClick={() => design.resetToken(selected.path)}
            >
              Вернуть исходную связь / значение
            </Button>
          </>
        ) : (
          <>
            {design.panelScope === 'system' && (
              <ButtonGroup aria-label="Уровень токенов">
                <Button
                  size="sm"
                  variant={collection === 'sys' ? 'tonal' : 'ghost'}
                  aria-pressed={collection === 'sys'}
                  onClick={() => setCollection('sys')}
                >
                  Смысловые роли
                </Button>
                <Button
                  size="sm"
                  variant={collection === 'ref' ? 'tonal' : 'ghost'}
                  aria-pressed={collection === 'ref'}
                  onClick={() => setCollection('ref')}
                >
                  Исходные шкалы
                </Button>
              </ButtonGroup>
            )}
            <label className="token-panel-search">
              <Search size={15} />
              <input
                placeholder="Найти параметр"
                aria-label="Поиск токенов"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <p className="token-panel-intro">
              Выберите параметр, чтобы изучить его связи и влияние на дизайн. Изменения применяются
              к связанным примерам.
            </p>
            <div className="token-panel-list">
              {paths.map((path) => (
                <button key={path} type="button" onClick={() => design.inspect(path)}>
                  <span>{label(path)}</span>
                  <TokenValue token={design.resolved[path]} />
                  <ChevronRight size={13} />
                </button>
              ))}
              {!paths.length && (
                <p className="token-panel-intro">По этому запросу параметров нет.</p>
              )}
            </div>
          </>
        )}
        {(design.error || validation) && (
          <div className="token-edit-error" role="alert">
            {validation || design.error}
            <IconButton
              size="sm"
              variant="ghost"
              icon={<X />}
              aria-label="Закрыть сообщение"
              onClick={() => {
                setValidation('');
                design.clearError();
              }}
            />
          </div>
        )}
      </div>
      <div className="token-panel__footer">
        <div>
          <span>{design.changed ? `Изменено: ${design.changed}` : 'Исходный дизайн'}</span>
          <div>
            <IconButton
              size="sm"
              variant="ghost"
              icon={<Undo2 />}
              aria-label="Отменить изменение токенов"
              disabled={!design.canUndo}
              onClick={design.undo}
            />
            <IconButton
              size="sm"
              variant="ghost"
              icon={<Redo2 />}
              aria-label="Повторить изменение токенов"
              disabled={!design.canRedo}
              onClick={design.redo}
            />
          </div>
        </div>
        <div>
          <Button size="sm" variant="ghost" disabled={!design.changed} onClick={design.resetAll}>
            Сбросить всё
          </Button>
          <Button size="sm" leadingIcon={<Download />} onClick={design.exportExperiment}>
            Экспорт эксперимента
          </Button>
        </div>
        <p>
          <Check size={11} />
          Сохраняется в браузере · исходная ДС не меняется
        </p>
      </div>
    </aside>
  );
}
