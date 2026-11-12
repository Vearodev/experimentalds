import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Braces,
  Check,
  CircleDot,
  GitBranch,
  Layers3,
  Link2,
  Moon,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { Button, ButtonGroup, Input } from '@basis/ui';
import { chainOf, impactOf, resolveGraph, type TokenMap } from '@basis/tokens/engine';
import { baseTokens, tokenManifest, useDesign, type Theme } from './DesignContext';
import { TokenValue } from './TokenPanel';
import { SectionHeading } from './PageParts';

const examples = [
  {
    id: 'success',
    title: 'Тон успеха',
    path: 'comp.button.tone.success.solid.background.default',
    text: 'Палитра общая со статусами, но у действия свои роли: сплошная и мягкая поверхность, контур и интерактивные состояния.',
  },
  {
    id: 'color',
    title: 'Цвет действия',
    path: 'comp.button.primary.background.default',
    text: 'Компонент хранит ссылку на роль. Роль выбирает цвет текущей темы.',
  },
  {
    id: 'radius',
    title: 'Радиус контрола',
    path: 'comp.button.radius',
    text: 'Одна смысловая роль объединяет форму кнопок, полей и селектов. Их связи можно изменять независимо.',
  },
  {
    id: 'table',
    title: 'Строка таблицы',
    path: 'comp.table.row-height',
    text: 'Высота строки — собственный параметр таблицы. Она не связана с размером кнопки только потому, что числа близки.',
  },
];
const layerTitles: Record<string, [string, string]> = {
  ref: ['Исходное значение', 'Палитра и независимые шкалы'],
  sys: ['Смысловая роль', 'Назначение в интерфейсе'],
  comp: ['Параметр компонента', 'Визуальный контракт'],
};
const families: Record<string, string> = {
  button: 'Кнопка',
  input: 'Поле',
  select: 'Селект',
  table: 'Таблица',
  'table-select': 'Табличный выбор',
  'context-panel': 'Контекстная панель',
  dialog: 'Диалог',
  checkbox: 'Чекбокс',
  tooltip: 'Подсказка',
  status: 'Статус',
  badge: 'Счётчик',
  'cascade-select': 'Каскадный выбор',
  radio: 'Радиокнопка',
  'code-input': 'Код подтверждения',
  tag: 'Метка',
  'input-tag': 'Ввод меток',
  'input-mask': 'Маска ввода',
  accordion: 'Аккордеон',
  breadcrumb: 'Путь',
  menu: 'Меню',
  message: 'Сообщение',
  toast: 'Уведомление',
  chip: 'Чип',
  avatar: 'Аватар',
  tabs: 'Вкладки',
  slider: 'Слайдер',
  progress: 'Прогресс',
  switch: 'Переключатель',
  skeleton: 'Скелетон',
};

export function TokenArchitecture() {
  const design = useDesign(),
    [exampleId, setExampleId] = useState('color'),
    [selectedLevel, setSelectedLevel] = useState('sys');
  const example = examples.find((item) => item.id === exampleId)!;
  const chain = chainOf(design.tokens, example.path).reverse();
  const selectedPath = chain.find((path) => path.startsWith(`${selectedLevel}.`)) || example.path;
  const selected = design.resolved[selectedPath];
  const dependencies = impactOf(design.tokens, selectedPath);
  const componentPaths = dependencies.filter((path) => path.startsWith('comp.'));
  const componentNames = [
    ...new Set(componentPaths.map((path) => families[path.split('.')[1]] || path.split('.')[1])),
  ];
  const modes = useMemo(
    () =>
      Object.fromEntries(
        (['light', 'dark'] as Theme[]).map((mode) => {
          const tokens: TokenMap = baseTokens(mode);
          for (const [path, value] of Object.entries({
            ...design.edits.shared,
            ...design.edits[mode],
          }))
            if (tokens[path]) tokens[path] = { ...tokens[path], $value: value };
          return [mode, resolveGraph(tokens)];
        }),
      ),
    [design.edits],
  );
  const inspect = (path: string) => {
    design.openSystem();
    design.inspect(path);
  };
  return (
    <div className="architecture-page">
      <div className="architecture-intro">
        <div>
          <span className="eyebrow">Устройство BASIS</span>
          <h2>Значение. Роль. Компонент.</h2>
          <p>
            Токен — именованное решение о дизайне. Ссылки между решениями позволяют менять систему
            целиком и сохранять осмысленные различия между компонентами.
          </p>
        </div>
        <div className="architecture-facts">
          <span>
            <strong>3</strong>уровня
          </span>
          <span>
            <strong>2</strong>темы
          </span>
          <span>
            <strong>{Object.keys(tokenManifest.tokens).length}</strong>токенов
          </span>
        </div>
      </div>
      <section className="inheritance-lab" aria-label="Интерактивная схема наследования токенов">
        <header>
          <div>
            <GitBranch size={18} />
            <strong>Как решение доходит до интерфейса</strong>
          </div>
          <span>Живой граф системы</span>
        </header>
        <div className="inheritance-lab__controls">
          <ButtonGroup aria-label="Пример наследования">
            {examples.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={exampleId === item.id ? 'tonal' : 'ghost'}
                aria-pressed={exampleId === item.id}
                onClick={() => setExampleId(item.id)}
              >
                {item.title}
              </Button>
            ))}
          </ButtonGroup>
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={design.theme === 'light' ? <Sun /> : <Moon />}
            onClick={() => design.setTheme(design.theme === 'light' ? 'dark' : 'light')}
          >
            {design.theme === 'light' ? 'Светлая тема' : 'Тёмная тема'}
          </Button>
        </div>
        <p className="inheritance-caption">
          {example.text} Выберите узел, чтобы увидеть область его влияния.
        </p>
        <ol className="inheritance-graph">
          {chain.map((path, index) => {
            const layer = path.split('.')[0],
              token = design.resolved[path];
            return (
              <li key={path}>
                <button
                  className="inheritance-node"
                  data-layer={layer}
                  aria-pressed={selectedPath === path}
                  onClick={() => setSelectedLevel(layer)}
                >
                  <span className="inheritance-node__level">
                    <b>{String(index + 1).padStart(2, '0')}</b>
                    {layer}
                  </span>
                  <h3>{layerTitles[layer][0]}</h3>
                  <p>{layerTitles[layer][1]}</p>
                  <span className="inheritance-node__path">{path}</span>
                  <TokenValue token={token} />
                </button>
                {index < chain.length - 1 && (
                  <span className="inheritance-edge" aria-label="используется по ссылке">
                    <ArrowRight size={18} />
                    <small>ссылка</small>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <div className="inheritance-impact">
          <div className="inheritance-impact__copy">
            <span className="eyebrow">Область изменения</span>
            <h3>
              {selectedLevel === 'ref'
                ? 'Меняется исходное решение'
                : selectedLevel === 'sys'
                  ? 'Меняется назначение'
                  : 'Меняется один компонент'}
            </h3>
            <p>
              {selectedLevel === 'ref'
                ? 'Новое значение получат все роли и компоненты, которые ссылаются на этот источник.'
                : selectedLevel === 'sys'
                  ? selectedPath.startsWith('sys.color.')
                    ? 'Связь цветовой роли меняется только в выбранной теме. Остальные темы сохраняют своё назначение.'
                    : 'Метрика общая для двух тем. Изменение получат все связанные компоненты.'
                  : 'Меняется связь параметра у всех экземпляров компонента в обеих темах. Составные компоненты используют тот же экземпляр.'}
            </p>
            <Button
              size="sm"
              leadingIcon={<SlidersHorizontal />}
              onClick={() => inspect(selectedPath)}
            >
              Изучить и изменить
            </Button>
          </div>
          <div className="inheritance-impact__targets">
            <div>
              <span>Зависимых токенов</span>
              <strong>{dependencies.length}</strong>
            </div>
            <div className="dependency-tags">
              {componentNames.length ? (
                componentNames.map((name) => <span key={name}>{name}</span>)
              ) : (
                <span>{families[example.path.split('.')[1]]} · все экземпляры</span>
              )}
            </div>
            <p>
              {componentPaths.length
                ? `Связанных параметров компонентов: ${componentPaths.length}. Они наследуют выбранное решение.`
                : 'Параметр находится в конце цепочки. Его используют экземпляры компонента в интерфейсе.'}
            </p>
            <span className="resolved-value">
              Текущее значение <TokenValue token={selected} />
            </span>
          </div>
        </div>
        <div className="inheritance-previews">
          {(['light', 'dark'] as Theme[]).map((mode) => (
            <div
              key={mode}
              className="basis-theme-scope inheritance-preview"
              data-basis-theme={mode}
            >
              <div className="inheritance-preview__label">
                <span>
                  {mode === 'light' ? <Sun size={14} /> : <Moon size={14} />}
                  {mode === 'light' ? 'Светлая' : 'Тёмная'}
                </span>
                <TokenValue token={modes[mode][example.path]} />
              </div>
              {exampleId === 'table' ? (
                <div className="inheritance-table">
                  <div>
                    <span>prod-api-01</span>
                    <span>Работает</span>
                  </div>
                  <div>
                    <span>prod-api-02</span>
                    <span>Работает</span>
                  </div>
                </div>
              ) : (
                <div className="inheritance-actions">
                  <Button
                    variant="primary"
                    tone={exampleId === 'success' ? 'success' : 'brand'}
                    onClick={() => {
                      design.openComponent('button');
                      design.inspect(example.path);
                    }}
                  >
                    {exampleId === 'success' ? 'Подтвердить' : 'Создать ресурс'}
                  </Button>
                  {exampleId === 'radius' ? (
                    <Input
                      aria-label={`Пример поля в ${mode === 'light' ? 'светлой' : 'тёмной'} теме`}
                      placeholder="Имя ресурса"
                    />
                  ) : (
                    <Button
                      tone={exampleId === 'success' ? 'success' : 'brand'}
                      onClick={() => design.openComponent('button')}
                    >
                      {exampleId === 'success' ? 'Подтвердить' : 'Настроить'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="01" title="Как читать имя токена" note="Имя описывает назначение" />
        <div className="token-name-anatomy">
          {[
            ['comp', 'Уровень'],
            ['button', 'Компонент'],
            ['primary', 'Иерархия'],
            ['background', 'Свойство'],
            ['default', 'Состояние'],
          ].map(([part, title], index) => (
            <div key={part}>
              <span>{title}</span>
              <strong>{part}</strong>
              {index < 4 && <i>.</i>}
            </div>
          ))}
        </div>
        <p className="foundation-note">
          Тема хранится как режим значения. Поэтому при переключении темы имя и связь компонента
          остаются прежними. Размер, состояние и иерархия — независимые признаки.
        </p>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="02"
          title="Что общее, а что меняется"
          note="Режимы и область действия"
        />
        <div className="architecture-contract-scroll">
          <table className="architecture-contract">
            <thead>
              <tr>
                <th>Решение</th>
                <th>Светлая / тёмная</th>
                <th>Где менять</th>
                <th>Что получает изменение</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Исходная палитра и шкалы</td>
                <td>Общие значения</td>
                <td>Reference</td>
                <td>Все использующие источник роли</td>
              </tr>
              <tr>
                <td>Цветовые роли</td>
                <td>Разные связи</td>
                <td>Semantic · цвета</td>
                <td>Связанные компоненты выбранной темы</td>
              </tr>
              <tr>
                <td>Ритм, геометрия, типографика</td>
                <td>Общие значения</td>
                <td>Semantic · метрики</td>
                <td>Связанные компоненты обеих тем</td>
              </tr>
              <tr>
                <td>Параметры компонентов</td>
                <td>Общие связи</td>
                <td>Components</td>
                <td>Все экземпляры этого компонента</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="03"
          title="Правила, которые сохраняют систему"
          note="Дизайнерский контракт"
        />
        <div className="architecture-principles">
          <article>
            <Link2 />
            <h3>Наследование через ссылки</h3>
            <p>
              Компонент ссылается на роль, роль — на источник. Новое значение проходит по всей
              цепочке. В экспорт передаётся и сама связь.
            </p>
          </article>
          <article>
            <Layers3 />
            <h3>Композиция без копий</h3>
            <p>
              Таблица, TableSelect и панели используют общие Button, Input и Select. У таблицы есть
              свои строки и сетка, но нет собственной версии кнопки.
            </p>
          </article>
          <article>
            <CircleDot />
            <h3>Разные смыслы — разные шкалы</h3>
            <p>
              Радиус 8 px и отступ 8 px остаются независимыми. Совпадение значения не должно
              создавать случайную связь.
            </p>
          </article>
          <article>
            <Braces />
            <h3>Тип — часть решения</h3>
            <p>
              Цвет связывается с цветом, размер — с размером. Тень собирается из геометрии и
              цветовой роли; текстовый стиль — из атомарных параметров.
            </p>
          </article>
          <article>
            <Palette />
            <h3>Состояние не маскируется декором</h3>
            <p>
              Загрузка, выбор, ошибка и фокус имеют разные роли. Движение и прогресс появляются
              только тогда, когда есть соответствующее состояние.
            </p>
          </article>
          <article>
            <ShieldCheck />
            <h3>Изменения проверяются</h3>
            <p>
              Система проверяет ссылки, типы, циклы, направление слоёв и наличие обеих тем. Контраст
              контролируется для заданных пар текста и фона.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

export function TokenWorkflow() {
  const design = useDesign();
  return (
    <div className="architecture-page">
      <div className="architecture-intro">
        <div>
          <span className="eyebrow">Работа дизайнера</span>
          <h2>От эксперимента к общей системе</h2>
          <p>
            Плейграунд помогает исследовать влияние изменений. Согласованная версия должна сохранять
            связи, режимы, имена и историю миграций.
          </p>
        </div>
        <span className="architecture-status">
          <CircleDot size={14} />
          Локальный источник
        </span>
      </div>
      <section className="ds-section">
        <SectionHeading number="01" title="Как выбрать уровень изменения" />
        <div className="architecture-decisions">
          <article>
            <span>Меняем основу бренда</span>
            <h3>Исходное значение</h3>
            <p>
              Нужен новый базовый цвет или шкала радиусов. Сначала смотрим все зависимости: это
              изменение с широким влиянием.
            </p>
          </article>
          <article>
            <span>Меняем назначение</span>
            <h3>Смысловая роль</h3>
            <p>
              Меняем цвет основного действия в тёмной теме или общий радиус контролов. Компонентные
              связи сохраняются.
            </p>
          </article>
          <article>
            <span>Меняем отдельный компонент</span>
            <h3>Параметр компонента</h3>
            <p>
              Например, у диалога нужен другой радиус из существующей шкалы. Меняем ссылку этого
              параметра.
            </p>
          </article>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Коллекции для Figma" note="Подготовленный контракт" />
        <div className="figma-collections">
          {[
            ['Reference', 'Value', 'Палитра, размеры, радиусы, шрифты, движение'],
            ['Semantic colors', 'Light / Dark', 'Цветовые роли и состояния интерфейса'],
            ['Semantic metrics', 'Value', 'Ритм, геометрия, типографика, движение'],
            ['Components', 'Value', 'Ссылки на параметры базовых и составных компонентов'],
          ].map(([name, modes, text], i) => (
            <article key={name}>
              <span className="collection-number">0{i + 1}</span>
              <div>
                <h3>{name}</h3>
                <p>{text}</p>
              </div>
              <span className="collection-modes">{modes}</span>
            </article>
          ))}
        </div>
        <div className="architecture-notice">
          <Link2 size={18} />
          <p>
            <strong>Подключение к Figma ещё не выполнено.</strong> Сейчас источник — локальные файлы
            токенов. Экспорт и карта коллекций готовы; создание переменных, привязка компонентов и
            обратный импорт требуют проверки на рабочем Figma-файле.
          </p>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="03" title="Путь изменения" note="Контроль перед публикацией" />
        <ol className="token-lifecycle">
          {[
            ['Изменить', 'Выбрать исходное значение или связь.'],
            ['Посмотреть влияние', 'Проверить зависимые компоненты в двух темах.'],
            ['Проверить', 'Типы, ссылки, состояния, контраст и геометрию.'],
            ['Согласовать', 'Зафиксировать визуальные решения и изменения контракта.'],
            ['Опубликовать версию', 'Обновить общий источник и потребителей.'],
          ].map(([title, text], i) => (
            <li key={title}>
              <span>{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              {i < 4 && <ArrowRight size={16} />}
            </li>
          ))}
        </ol>
      </section>
      <section className="ds-section">
        <SectionHeading number="04" title="Эксперименты и версии" />
        <div className="token-governance">
          <div>
            <h3>Эксперимент обратим</h3>
            <p>
              Изменения сохраняются в этом браузере. Отмена и повтор работают по шагам; отдельный
              токен или весь эксперимент можно вернуть к исходному состоянию.
            </p>
            <p>
              Экспорт содержит обе темы, исходные ссылки, изменения и идентификатор базовой версии.
              Экспорт сам по себе не публикует новый дизайн.
            </p>
            <div className="inline-buttons">
              <Button leadingIcon={<SlidersHorizontal />} onClick={design.openSystem}>
                Открыть мастерскую
              </Button>
              <Button variant="primary" onClick={design.exportExperiment}>
                Экспорт эксперимента
              </Button>
            </div>
          </div>
          <div>
            <h3>Имя — стабильный контракт</h3>
            <ul>
              <li>
                <Check size={14} />
                Новый токен получает назначение, тип и пример применения.
              </li>
              <li>
                <Check size={14} />
                Цветовая роль добавляется в обе темы одновременно.
              </li>
              <li>
                <Check size={14} />
                Переименование сопровождается миграцией и временной ссылкой.
              </li>
              <li>
                <Check size={14} />
                Изменение фиксируется с версией и результатами проверки.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
