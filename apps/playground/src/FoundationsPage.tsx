import { useState } from 'react';
import { TokenArchitecture, TokenWorkflow } from './TokenArchitecture';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Cloud,
  Layers3,
  Link2,
  Moon,
  Plus,
  Server,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { Button, Input, StatusBadge, Tabs } from '@basis/ui';
import { contrastRatio } from '@basis/tokens/engine';
import { PageHeading, SectionHeading } from './PageParts';
import { useDesign, tokenManifest } from './DesignContext';
import { ComponentTokens, TokenValue } from './TokenPanel';

const roles = [
  ['sys.color.surface.canvas', 'Холст'],
  ['sys.color.surface.base', 'Поверхность'],
  ['sys.color.surface.subtle', 'Вложенная область'],
  ['sys.color.text.primary', 'Основной текст'],
  ['sys.color.text.secondary', 'Вторичный текст'],
  ['sys.color.text.muted', 'Пояснение'],
  ['sys.color.border.default', 'Разделитель'],
  ['sys.color.border.control', 'Граница контрола'],
  ['sys.color.border.focus', 'Фокус'],
  ['sys.color.status.success.fg', 'Успех'],
  ['sys.color.status.warning.fg', 'Внимание'],
  ['sys.color.status.danger.fg', 'Ошибка'],
];
function VisualFoundations() {
  const design = useDesign();
  const inspect = (path: string) => {
    design.openSystem();
    design.inspect(path);
  };
  const ratio = (foreground: string, background: string) =>
    contrastRatio(design.resolved[foreground].value, design.resolved[background].value);
  const pairs = [
    ['Основной текст', 'sys.color.text.primary', 'sys.color.surface.base'],
    ['Пояснение', 'sys.color.text.muted', 'sys.color.surface.base'],
    ['Основная кнопка', 'comp.button.primary.foreground', 'comp.button.primary.background.default'],
    ['Опасное действие', 'comp.button.danger.foreground', 'comp.button.danger.background.default'],
  ];
  return (
    <>
      <div className="foundation-hero">
        <div>
          <span className="eyebrow">Архитектура визуального языка</span>
          <h2>
            Точность инфраструктуры.
            <br />
            <span>Лёгкость управления.</span>
          </h2>
          <p>
            Глубокий синий задаёт опору. Голубой отмечает движение и действие. Мягкие поверхности
            удерживают сложную информацию в ясной структуре.
          </p>
          <div className="foundation-stats">
            <span>
              <strong>03</strong>слоя токенов
            </span>
            <span>
              <strong>02</strong>темы
            </span>
            <span>
              <strong>{Object.keys(tokenManifest.tokens).length}</strong>связанных параметров
            </span>
          </div>
        </div>
        <div className="resource-planes" aria-hidden="true">
          <div className="resource-plane plane-back">
            <i />
            <i />
            <i />
          </div>
          <div className="resource-plane plane-mid">
            <i />
            <i />
            <i />
          </div>
          <div className="resource-plane plane-front">
            <Cloud size={44} />
            <span>BASIS</span>
            <i />
          </div>
          <div className="resource-trace" />
          <span className="plane-caption">ОБЩАЯ ОСНОВА / СВЯЗАННЫЕ РЕСУРСЫ</span>
        </div>
      </div>
      <section className="ds-section">
        <SectionHeading
          number="01"
          title="Одна система. Два режима."
          note="Цвет меняется, структура сохраняется"
        />
        <div className="theme-comparison">
          {(['light', 'dark'] as const).map((theme) => (
            <div key={theme} className="basis-theme-scope theme-specimen" data-basis-theme={theme}>
              <div className="theme-specimen__header">
                <span>
                  {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}{' '}
                  {theme === 'light' ? 'Светлая' : 'Тёмная'}
                </span>
                <span>Одинаковые связи</span>
              </div>
              <div className="theme-specimen__body">
                <div className="resource-heading">
                  <Server />
                  <div>
                    <strong>vm-production-01</strong>
                    <span>Виртуальная машина</span>
                  </div>
                  <StatusBadge tone="success">Работает</StatusBadge>
                </div>
                <Input label="Имя ресурса" defaultValue="vm-production-01" />
                <div className="inline-buttons">
                  <Button variant="primary" leadingIcon={<Plus />}>
                    Создать ВМ
                  </Button>
                  <Button>Настроить</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="foundation-note">
          Геометрия, типографика и поведение общие. Цветовые роли переключаются между режимами.
          Изменение исходного значения обновляет все связанные компоненты.
        </p>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="02"
          title="От решения к компоненту"
          note="Нажмите на уровень, чтобы изучить связь"
        />
        <div className="token-architecture">
          {[
            {
              layer: '01 / Исходное значение',
              title: 'Палитра и шкалы',
              path: 'ref.color.navy.800',
              text: 'Фирменные цвета, независимые шкалы размеров, интервалов и радиусов.',
            },
            {
              layer: '02 / Смысловая роль',
              title: 'Назначение в интерфейсе',
              path: 'sys.color.action.primary.bg.default',
              text: 'Фон основного действия. Своя связь для каждой темы.',
            },
            {
              layer: '03 / Компонент',
              title: 'Конкретное решение',
              path: 'comp.button.primary.background.default',
              text: 'Кнопка наследует роль. Таблица использует эту же кнопку.',
            },
          ].map((item, index) => (
            <div key={item.path}>
              <button className="architecture-node" onClick={() => inspect(item.path)}>
                <span className="eyebrow">{item.layer}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <div>
                  <Link2 size={13} />
                  <span>{item.path}</span>
                </div>
                <TokenValue token={design.resolved[item.path]} />
              </button>
              {index < 2 && <ArrowRight className="architecture-arrow" size={18} />}
            </div>
          ))}
        </div>
        <div className="foundation-callout">
          <Layers3 size={18} />
          <p>
            Одинаковое число не означает одинаковый смысл. Радиус 8 px, отступ 8 px и размер иконки
            используют разные шкалы, чтобы изменение одного решения не затрагивало остальные.
          </p>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="03"
          title="Семантическая палитра"
          note={design.theme === 'light' ? 'Светлая тема' : 'Тёмная тема'}
        />
        <div className="role-palette">
          {roles.map(([path, label]) => (
            <button key={path} onClick={() => inspect(path)}>
              <i style={{ background: design.resolved[path].cssValue }} />
              <strong>{label}</strong>
              <span>{design.resolved[path].cssValue.toUpperCase()}</span>
              <small>{path.replace('sys.color.', '')}</small>
            </button>
          ))}
        </div>
        <div className="contrast-grid">
          {pairs.map(([label, fg, bg]) => {
            const result = ratio(fg, bg);
            return (
              <div key={label} data-pass={result >= 4.5}>
                <span>{label}</span>
                <strong>{result.toFixed(2)}:1</strong>
                <small>
                  {result >= 4.5 ? <Check size={13} /> : null}
                  {result >= 4.5 ? 'от 4,5:1' : 'ниже 4,5:1'}
                </small>
              </div>
            );
          })}
        </div>
        <p className="foundation-note">
          Контраст пересчитывается при изменении токенов. Здесь проверены указанные пары текста и
          фона; это не заменяет проверку всего интерфейса.
        </p>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="04"
          title="Типографика и ритм"
          note="Два семейства · три смысловые роли"
        />
        <div className="font-family-grid">
          <article className="font-family-spec" data-family="ui">
            <header>
              <div>
                <span>Интерфейс</span>
                <h3>{design.resolved['sys.type.family.ui'].value[0].replace(' Variable', '')}</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => inspect('sys.type.family.ui')}>
                Токен семейства
              </Button>
            </header>
            <div className="font-family-spec__sample">
              <strong>Виртуальные машины</strong>
              <span>Ресурсы под вашим управлением</span>
            </div>
            <p>
              Навигация, заголовки, описания, подписи полей и кнопки. Основной голос интерфейса.
            </p>
            <footer>Пропорциональный · 400 / 500 / 600 / 700</footer>
          </article>
          <article className="font-family-spec" data-family="mono">
            <header>
              <div>
                <span>Технические значения</span>
                <h3>{design.resolved['sys.type.family.mono'].value[0].replace(' Variable', '')}</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => inspect('sys.type.family.mono')}>
                Токен семейства
              </Button>
            </header>
            <div className="font-family-spec__sample">
              <div className="font-data-sample">
                <strong>
                  16 <small>vCPU</small>
                </strong>
                <strong>
                  64 <small>GiB</small>
                </strong>
              </div>
              <span>10.21.0.20 · vm-prod-01</span>
            </div>
            <p>
              Ресурсные показатели — 600, адреса и идентификаторы — 500, консоль — 400. Единицы
              измерения и пояснения остаются в Onest.
            </p>
            <footer className="font-role-actions">
              <Button size="sm" variant="ghost" onClick={() => inspect('sys.type.family.data')}>
                Семейство метрик
              </Button>
              <Button size="sm" variant="ghost" onClick={() => inspect('sys.type.weight.data')}>
                Насыщенность метрик
              </Button>
            </footer>
          </article>
        </div>
        <p className="foundation-note">
          Семейство определяется назначением текста и не меняется при переключении темы. Роли data и
          mono наследуют одно второе семейство, но управляются независимо: метрики можно менять
          отдельно от консоли. Используются табличные цифры без лигатур. Оба семейства поставляются
          локально; изменение токена сразу видно в примерах.
        </p>
        <div className="foundation-grid">
          <div className="type-spec">
            {[
              ['title', 'leading.title', 'Виртуальные машины'],
              ['subtitle', 'leading.relaxed', 'Вычислительные ресурсы'],
              ['body', 'leading.body', 'Инфраструктура под вашим управлением'],
              ['caption', 'leading.caption', 'Обновлено только что · vm-production-01'],
            ].map(([size, leading, text]) => (
              <button key={size} onClick={() => inspect(`sys.type.size.${size}`)}>
                <span>
                  {design.resolved[`sys.type.size.${size}`].cssValue} /{' '}
                  {design.resolved[`sys.type.${leading}`].cssValue}
                </span>
                <strong
                  style={{
                    fontSize: `var(--basis-sys-type-size-${size})`,
                    lineHeight: `var(--basis-sys-type-${leading.replace('.', '-')})`,
                  }}
                >
                  {text}
                </strong>
              </button>
            ))}
          </div>
          <div className="rhythm-spec">
            <h3>Согласованный ритм</h3>
            <p>Плотность поддерживается интервалами, а не уменьшением всего интерфейса.</p>
            <div className="spacing-bars">
              {['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map((role) => {
                const token = design.resolved[`sys.space.${role}`];
                return (
                  <button key={role} onClick={() => inspect(`sys.space.${role}`)}>
                    <span>{token.value.value}</span>
                    <i style={{ width: `calc(var(--basis-sys-space-${role}) * 4)` }} />
                    <small>px</small>
                  </button>
                );
              })}
            </div>
            <div className="rhythm-bottom">
              <span>
                Контролы<strong>32 / 36 / 44</strong>
              </span>
              <span>
                Строка таблицы<strong>{design.resolved['sys.table.row.height'].cssValue}</strong>
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="05"
          title="Компоновка облака"
          note="Шапка · навигация · рабочая область"
        />
        <p className="foundation-note">
          Самостоятельные поверхности со скруглением 20 px, промежутками 12 px и лёгкой тенью.
          Всплывающее окно повторяет этот радиус, сохраняя 16 px до краёв экрана. Внешняя компоновка
          не изменяет размеры строк таблицы и базовых контролов.
        </p>
        <ComponentTokens component="shell" />
        <p className="foundation-note">
          Движение локально: при переходе меняется только содержимое внутренней вкладки или сводка
          обзора. Заголовок, навигация и геометрия карточек остаются неподвижными. Первичная
          загрузка, обновление данных и быстрый перебор вкладок обходятся без повторного появления.
          При системном ограничении анимации переход отключается.
        </p>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="06"
          title="Рабочий процесс дизайнера"
          note="Эксперимент → сравнение → согласование"
        />
        <div className="handoff-panel">
          <div>
            <h3>Связи видимы и обратимы</h3>
            <p>
              Редактор показывает источник, зависимые параметры и область действия. Эксперименты
              сохраняются в браузере; можно отменять шаги и возвращаться к основе.
            </p>
            <p>
              Подготовлены токены DTCG и карта коллекций, режимов и привязок для Figma. Подключение
              к конкретному файлу и проверка импорта — отдельный следующий этап.
            </p>
          </div>
          <div>
            <Button leadingIcon={<SlidersHorizontal />} onClick={design.openSystem}>
              Открыть мастерскую
            </Button>
            <Button leadingIcon={<ArrowDownToLine />} onClick={design.exportTheme}>
              Экспорт текущей темы
            </Button>
            <Button variant="ghost" onClick={design.exportExperiment}>
              Экспорт обеих тем и изменений
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

export function FoundationsPage() {
  const [view, setView] = useState('architecture');
  return (
    <>
      <PageHeading
        category="Основа / BASIS"
        title="Токены и устройство системы"
        description="Как устроены решения, как они наследуются и как дизайнер управляет их изменениями."
      />
      <div className="foundation-tabs">
        <Tabs
          label="Разделы основы дизайн-системы"
          items={[
            { id: 'architecture', label: 'Архитектура токенов' },
            { id: 'visual', label: 'Визуальные основы' },
            { id: 'workflow', label: 'Работа с системой' },
          ]}
          value={view}
          onValueChange={setView}
        >
          {view === 'architecture' ? (
            <TokenArchitecture />
          ) : view === 'visual' ? (
            <VisualFoundations />
          ) : (
            <TokenWorkflow />
          )}
        </Tabs>
      </div>
    </>
  );
}
