import { TableSelectPage } from './TableSelectPage';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Cloud,
  CloudCog,
  Copy,
  Cpu,
  Database,
  Eye,
  FileClock,
  Folder,
  HardDrive,
  Info,
  KeyRound,
  Layers3,
  ListFilter,
  LockKeyhole,
  MemoryStick,
  Monitor,
  Network,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Table2,
  Trash2,
  Upload,
  Users,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import {
  Button,
  ButtonGroup,
  Checkbox,
  Dialog,
  IconButton,
  Input,
  NumberInput,
  PasswordInput,
  Progress,
  Select,
  Skeleton,
  Slider,
  StatusBadge,
  Switch,
  Tabs,
  Textarea,
  Tooltip,
  type SelectOption,
  type StatusTone,
} from '@basis/ui';
import { PageHeading, SectionHeading } from './PageParts';
import { ComponentTokens } from './TokenPanel';
import { useDesign } from './DesignContext';

export type CatalogPage =
  | 'inputs'
  | 'selects'
  | 'sliders'
  | 'progress'
  | 'icons'
  | 'skeletons'
  | 'checkboxes'
  | 'switches'
  | 'statuses'
  | 'tooltips'
  | 'tabs'
  | 'dialogs'
  | 'table-select';
export const catalog = [
  { id: 'table-select', label: 'Табличный выбор', icon: Table2, component: 'table-select' },
  { id: 'inputs', label: 'Поля ввода', icon: TextIcon, component: 'input' },
  { id: 'selects', label: 'Селекты', icon: ChevronDown, component: 'select' },
  { id: 'checkboxes', label: 'Чекбоксы', icon: CheckCheck, component: 'checkbox' },
  { id: 'switches', label: 'Переключатели', icon: Settings2, component: 'switch' },
  { id: 'sliders', label: 'Слайдеры', icon: SlidersHorizontal, component: 'slider' },
  { id: 'progress', label: 'Прогресс', icon: RefreshCw, component: 'progress' },
  { id: 'statuses', label: 'Статусы', icon: ShieldCheck, component: 'status' },
  { id: 'icons', label: 'Иконки', icon: Waypoints, component: 'icon' },
  { id: 'skeletons', label: 'Скелетоны', icon: Layers3, component: 'skeleton' },
  { id: 'tooltips', label: 'Подсказки', icon: CircleHelp, component: 'tooltip' },
  { id: 'tabs', label: 'Вкладки', icon: Folder, component: 'tabs' },
  { id: 'dialogs', label: 'Диалоги', icon: Monitor, component: 'dialog' },
] as const;
function TextIcon({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="M5 4h14M12 4v16M8 20h8" />
    </svg>
  );
}
function Page({
  title,
  component,
  description,
  children,
}: {
  title: string;
  component: string;
  description: string;
  children: ReactNode;
}) {
  const design = useDesign();
  return (
    <>
      <PageHeading
        category={`${['tabs', 'dialog'].includes(component) ? 'Составной' : 'Базовый'} компонент`}
        title={title}
        description={description}
      >
        <Button
          size="sm"
          leadingIcon={<SlidersHorizontal />}
          onClick={() => design.openComponent(component)}
        >
          Токены компонента
        </Button>
      </PageHeading>
      {children}
      <section className="ds-section">
        <SectionHeading
          number="03"
          title="Параметры дизайна"
          note="Измените связь и сравните результат"
        />
        <ComponentTokens component={component} />
      </section>
    </>
  );
}
function Lab({
  children,
  controls,
  caption = 'Живой образец',
  metric,
}: {
  children: ReactNode;
  controls: ReactNode;
  caption?: string;
  metric: string;
}) {
  return (
    <section className="component-lab">
      <div className="specimen-stage">
        <div className="stage-top">
          <span>
            <i className="live-dot" />
            {caption}
          </span>
          <span>{metric}</span>
        </div>
        <div className="specimen-stage__content">{children}</div>
        <div className="stage-bottom">
          <span className="stage-axis">
            <i />
            Ресурс / взаимодействие / обратная связь
          </span>
          <Cloud size={15} />
        </div>
      </div>
      <div className="specimen-notes">{controls}</div>
    </section>
  );
}
function Example({
  title,
  note,
  children,
  wide = false,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={`specimen-card ${wide ? 'specimen-card--wide' : ''}`}>
      <div className="specimen-card__heading">
        <h3>{title}</h3>
        {note && <p>{note}</p>}
      </div>
      <div className="specimen-card__body">{children}</div>
    </article>
  );
}
function Rules({ items }: { items: [string, string][] }) {
  return (
    <div className="design-rules">
      {items.map(([title, body], index) => (
        <div key={title}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
function SizeNote({ component = 'input' }: { component?: string }) {
  const { resolved } = useDesign();
  return (
    <div className="metric-strip">
      <span>
        Высота<strong>{resolved[`comp.${component}.height`]?.cssValue || '36px'}</strong>
      </span>
      <span>
        Радиус<strong>{resolved[`comp.${component}.radius`]?.cssValue || '8px'}</strong>
      </span>
      <span>
        Внутри<strong>{resolved[`comp.${component}.padding`]?.cssValue || '12px'}</strong>
      </span>
    </div>
  );
}

function InputsPage() {
  const [name, setName] = useState('vm-production-01'),
    [touched, setTouched] = useState(false),
    [cpu, setCpu] = useState(4),
    [description, setDescription] = useState('Сервис обработки запросов'),
    [password, setPassword] = useState('basis-cloud-2026');
  const error = touched
    ? !name.trim()
      ? 'Укажите имя виртуальной машины.'
      : !/^[a-z0-9-]+$/.test(name)
        ? 'Используйте латиницу, цифры и дефис.'
        : undefined
    : undefined;
  return (
    <Page
      title="Поля ввода"
      component="input"
      description="Читаемая структура, точные единицы и помощь в нужный момент. Текст, числа, пароли и длинные значения."
    >
      <Lab
        metric="M / единый ритм"
        controls={
          <>
            <span className="eyebrow">Анатомия поля</span>
            <h3>
              Смысл над полем.
              <br />
              Обратная связь под ним.
            </h3>
            <p>
              Подпись остаётся видимой после ввода. Ошибка объясняет, как исправить значение, и
              занимает место подсказки.
            </p>
            <SizeNote />
            <Button
              size="sm"
              onClick={() => {
                setName('');
                setTouched(true);
              }}
            >
              Проверить пустое поле
            </Button>
          </>
        }
      >
        <div className="field-demo">
          <Input
            label="Имя виртуальной машины"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched(true)}
            leadingIcon={<Server />}
            onClear={() => setName('')}
            error={error}
            hint="Латиница, цифры и дефис. До 63 символов."
            maxLength={63}
          />
          <div className="field-demo__footer">
            <span>{name.length} / 63</span>
            <StatusBadge tone={error ? 'danger' : 'neutral'} subtle>
              {error ? 'Нужна проверка' : 'Идентификатор ресурса'}
            </StatusBadge>
          </div>
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading
          number="01"
          title="Состояния"
          note="Граница, фокус и текст работают вместе"
        />
        <div className="specimen-grid three">
          <Example title="Пустое">
            <Input label="Имя ресурса" placeholder="Например, vm-web-01" />
          </Example>
          <Example title="Наведение">
            <Input label="Имя ресурса" defaultValue="vm-web-01" previewState="hover" />
          </Example>
          <Example title="Фокус">
            <Input label="Имя ресурса" defaultValue="vm-web-01" previewState="focus" />
          </Example>
          <Example title="Ошибка">
            <Input
              label="Имя ресурса"
              defaultValue="vm web 01"
              error="Замените пробелы дефисами."
            />
          </Example>
          <Example title="Недоступное">
            <Input label="Кластер" value="cluster-east-01" disabled />
          </Example>
          <Example title="Только чтение">
            <Input
              label="Идентификатор"
              value="vm-7f9a2c"
              readOnly
              hint="Можно выделить и скопировать."
            />
          </Example>
          <Example title="Проверка значения">
            <Input
              label="Имя ресурса"
              defaultValue="vm-api-02"
              loading
              hint="Проверяем доступность имени…"
            />
          </Example>
          <Example title="Префикс и единица">
            <Input label="Адрес диска" prefix="/data/" defaultValue="volume-01" suffix=".qcow2" />
          </Example>
          <Example title="Поиск">
            <Input
              aria-label="Поиск ресурсов"
              placeholder="Найти ресурс"
              leadingIcon={<Search />}
            />
          </Example>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Разные типы данных" note="Единая конструкция поля" />
        <div className="specimen-grid">
          <Example title="Числовое значение" note="Кнопки и клавиши ↑ / ↓. Шаг 2, диапазон 2–32.">
            <NumberInput
              label="Процессоры"
              value={cpu}
              onValueChange={setCpu}
              min={2}
              max={32}
              step={2}
              unit="vCPU"
            />
          </Example>
          <Example title="Пароль" note="Показать значение — отдельное действие.">
            <PasswordInput
              label="Пароль администратора"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Example>
          <Example title="Многострочный текст">
            <Textarea
              label="Описание"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={240}
              hint={`${description.length} из 240 символов`}
            />
          </Example>
          <Example title="Размеры">
            <div className="stack">
              <Input
                size="sm"
                aria-label="Малое поле"
                placeholder="S · 32 px — компактные панели"
              />
              <Input aria-label="Среднее поле" placeholder="M · 36 px — основной размер" />
              <Input
                size="lg"
                aria-label="Крупное поле"
                placeholder="L · 44 px — отдельный сценарий"
              />
            </div>
          </Example>
        </div>
        <Rules
          items={[
            [
              'Не терять введённое',
              'Ошибка и загрузка не очищают значение. При недоступности объясняем причину рядом.',
            ],
            [
              'Согласованный размер',
              'Иконки и кнопки внутри поля используют размеры общих базовых компонентов.',
            ],
          ]}
        />
      </section>
    </Page>
  );
}
const regions: SelectOption[] = [
  {
    value: 'msk',
    label: 'Москва',
    description: 'ru-msk-1 · 3 доступных кластера',
    icon: <Cloud />,
    group: 'Доступны',
  },
  {
    value: 'spb',
    label: 'Санкт-Петербург',
    description: 'ru-spb-1 · 2 доступных кластера',
    icon: <Cloud />,
    group: 'Доступны',
  },
  {
    value: 'kzn',
    label: 'Казань',
    description: 'ru-kzn-1 · техническое обслуживание',
    icon: <LockKeyhole />,
    disabled: true,
    group: 'Недоступны',
  },
];
const projectOptions: SelectOption[] = [
  'Production',
  'Staging',
  'Development',
  'Analytics',
  'Infrastructure',
].map((label) => ({ label, value: label, icon: <Folder /> }));
function SelectsPage() {
  const [region, setRegion] = useState('msk'),
    [projects, setProjects] = useState<string[]>(['Production', 'Staging']),
    [empty, setEmpty] = useState('');
  return (
    <Page
      title="Селекты"
      component="select"
      description="От короткого выбора до большого списка ресурсов. Поиск, группы и множественный выбор без смены привычного поведения."
    >
      <Lab
        metric="36 px / меню поверх контента"
        controls={
          <>
            <span className="eyebrow">Взаимодействие</span>
            <h3>Выбор с контекстом</h3>
            <p>
              Название — на первой строке, полезное уточнение — на второй. Поиск сокращает список,
              группы помогают ориентироваться.
            </p>
            <SizeNote component="select" />
            <div className="keyboard-hint">
              <kbd>↑</kbd>
              <kbd>↓</kbd>навигация<kbd>Enter</kbd>выбор<kbd>Esc</kbd>закрыть
            </div>
          </>
        }
      >
        <div className="field-demo">
          <Select
            label="Регион размещения"
            options={regions}
            value={region}
            onValueChange={setRegion}
            searchable
            hint="Откройте список и попробуйте поиск."
          />
          <Select
            label="Проекты"
            options={projectOptions}
            value={projects}
            onValueChange={setProjects}
            multiple
            searchable
            hint="Выбранные проекты объединяются условием «ИЛИ»."
          />
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading number="01" title="Состояния и содержимое" />
        <div className="specimen-grid three">
          <Example title="Без значения">
            <Select
              label="Проект"
              value={empty}
              onValueChange={setEmpty}
              options={projectOptions}
            />
          </Example>
          <Example title="Ошибка">
            <Select
              label="Сеть"
              value=""
              onValueChange={() => {}}
              options={[{ value: 'private', label: 'Private network' }]}
              error="Выберите сеть для подключения."
            />
          </Example>
          <Example title="Недоступный">
            <Select
              label="Регион"
              value="msk"
              onValueChange={() => {}}
              options={regions}
              disabled
              hint="Регион закреплён за проектом."
            />
          </Example>
          <Example title="Получение списка">
            <Select
              label="Хранилище"
              value=""
              onValueChange={() => {}}
              options={[]}
              loading
              placeholder="Загружаем хранилища…"
            />
          </Example>
          <Example title="Пустой список">
            <Select
              label="Доступные образы"
              value=""
              onValueChange={() => {}}
              options={[]}
              searchable
              hint="Состояние видно при открытии списка."
            />
          </Example>
          <Example title="Длинные названия">
            <Select
              label="Хранилище"
              value="long"
              onValueChange={() => {}}
              options={[
                {
                  value: 'long',
                  label: 'storage-production-moscow-availability-zone-03',
                  description: 'NVMe · 12 TiB свободно',
                },
              ]}
            />
          </Example>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Правила выбора" />
        <Rules
          items={[
            ['Одиночный выбор', 'Применяется сразу. Меню закрывается, фокус возвращается на поле.'],
            [
              'Множественный выбор',
              'Меню остаётся открытым. Выбранные значения отмечены, есть сброс и кнопка «Готово».',
            ],
            [
              'Нет результатов',
              'Сохраняем поисковый запрос. Пустой результат не превращается в ошибку поля.',
            ],
          ]}
        />
      </section>
    </Page>
  );
}
function SlidersPage() {
  const [cpu, setCpu] = useState(8),
    [range, setRange] = useState<number[]>([20, 80]),
    [ram, setRam] = useState(32);
  return (
    <Page
      title="Слайдеры"
      component="slider"
      description="Видимый диапазон и точное значение. Быстрое распределение ресурсов с возможностью числового ввода."
    >
      <Lab
        metric="Дорожка 4 px / маркер 20 px"
        controls={
          <>
            <span className="eyebrow">Точный контроль</span>
            <h3>Оценить и уточнить</h3>
            <p>
              Слайдер показывает соотношение с доступным ресурсом. Числовое поле позволяет задать
              точное значение.
            </p>
            <NumberInput
              label="Количество процессоров"
              min={2}
              max={32}
              step={2}
              value={cpu}
              onValueChange={setCpu}
              unit="vCPU"
            />
            <p className="keyboard-hint">
              <kbd>←</kbd>
              <kbd>→</kbd>шаг 2<kbd>Home</kbd>минимум
            </p>
          </>
        }
      >
        <div className="field-demo">
          <div className="resource-heading">
            <Cpu />
            <div>
              <strong>Вычислительная мощность</strong>
              <span>Распределение ресурсов ВМ</span>
            </div>
            <StatusBadge tone="info" subtle>
              В пределах квоты
            </StatusBadge>
          </div>
          <Slider
            label="Процессоры"
            min={2}
            max={32}
            step={2}
            value={cpu}
            onValueChange={setCpu}
            unit="vCPU"
            marks={[2, 8, 16, 24, 32]}
          />
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading number="01" title="Сценарии" />
        <div className="specimen-grid">
          <Example
            title="Диапазон"
            note="Маркеры не пересекаются. Клавиша Tab переключает активный маркер."
          >
            <Slider
              label="Загрузка CPU"
              value={range}
              onValueChange={setRange}
              range
              unit="%"
              marks={[0, 25, 50, 75, 100]}
            />
          </Example>
          <Example title="Дискретный шаг" note="Память выделяется шагами по 8 GiB.">
            <Slider
              label="Оперативная память"
              value={ram}
              onValueChange={setRam}
              min={8}
              max={128}
              step={8}
              unit="GiB"
              marks={[8, 32, 64, 96, 128]}
            />
          </Example>
          <Example title="Недоступен">
            <Slider label="Лимит проекта" value={50} onValueChange={() => {}} disabled unit="%" />
          </Example>
          <Example title="Граничное значение">
            <Slider label="Использовано" value={100} onValueChange={() => {}} unit="%" />
          </Example>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Ритм и доступность" />
        <Rules
          items={[
            [
              'Значение всегда видно',
              'Единица измерения расположена рядом с числом. Положение маркера не единственный источник информации.',
            ],
            [
              'Зона взаимодействия',
              'Дорожка тонкая визуально, но область захвата выше. Фокус повторяет общий паттерн контролов.',
            ],
          ]}
        />
      </section>
    </Page>
  );
}
function ProgressPage() {
  const [value, setValue] = useState(42),
    [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setValue((current) => Math.min(100, current + 1)), 160);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (value === 100) setRunning(false);
  }, [value]);
  return (
    <Page
      title="Прогресс"
      component="progress"
      description="Понятное ожидание: что происходит, сколько завершено и можно ли остановить операцию."
    >
      <Lab
        metric="8 px / спокойное движение"
        controls={
          <>
            <span className="eyebrow">Состояние операции</span>
            <h3>Процесс остаётся понятным</h3>
            <p>
              Процент используем только при известном объёме работы. Неизмеримое ожидание получает
              отдельный индикатор.
            </p>
            <div className="inline-buttons">
              <Button
                variant="primary"
                size="sm"
                leadingIcon={running ? <Pause /> : <Play />}
                disabled={value === 100}
                onClick={() => setRunning(!running)}
              >
                {running ? 'Приостановить' : 'Продолжить'}
              </Button>
              <IconButton
                size="sm"
                aria-label="Сбросить прогресс"
                icon={<RefreshCw />}
                onClick={() => {
                  setValue(0);
                  setRunning(true);
                }}
              />
            </div>
          </>
        }
      >
        <div className="field-demo">
          <div className="resource-heading">
            <HardDrive />
            <div>
              <strong>ubuntu-24.04.qcow2</strong>
              <span>Загрузка образа · 4,2 GiB</span>
            </div>
          </div>
          <Progress
            label={
              value === 100
                ? 'Образ загружен'
                : running
                  ? 'Загрузка образа'
                  : 'Загрузка приостановлена'
            }
            value={value}
            status={value === 100 ? 'success' : running ? 'active' : 'paused'}
            description={
              value === 100
                ? 'Образ доступен для создания виртуальных машин.'
                : `${((value * 4.2) / 100).toFixed(1).replace('.', ',')} из 4,2 GiB`
            }
          />
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading number="01" title="Состояния" />
        <div className="specimen-grid">
          <Example title="Известный объём">
            <Progress label="Перенос диска" value={64} description="Осталось около 2 минут" />
          </Example>
          <Example title="Неизвестное время">
            <Progress label="Подготовка узла" description="Проверяем доступность ресурсов" />
          </Example>
          <Example title="Завершено">
            <Progress label="Резервная копия создана" value={100} status="success" />
          </Example>
          <Example title="Ошибка">
            <Progress
              label="Соединение прервано"
              value={37}
              status="error"
              description="Проверьте подключение и повторите загрузку."
            />
          </Example>
          <Example title="Пауза">
            <Progress label="Ожидание подтверждения" value={72} status="paused" />
          </Example>
          <Example title="Компактный">
            <Progress label="Использование квоты" value={58} compact />
          </Example>
          <Example title="Внутри карточки ресурса">
            <div className="ds-inline-metric">
              <span>Процессоры</span>
              <strong>8 / 16 vCPU · 50%</strong>
            </div>
            <Progress label="Выделено процессоров" value={50} compact hideLabel />
          </Example>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Обратная связь" />
        <Rules
          items={[
            [
              'Сохраняем контекст',
              'При ошибке оставляем достигнутый прогресс и называем следующее действие.',
            ],
            [
              'Уважаем спокойный режим',
              'При уменьшении анимаций индикаторы сохраняют смысл и подпись без постоянного движения.',
            ],
            [
              'Встраиваем без повторов',
              'Если название и значение уже показаны в карточке, оставляем только шкалу. Её доступное имя и числовое значение сохраняются для скринридера.',
            ],
          ]}
        />
      </section>
    </Page>
  );
}
const iconItems: [string, LucideIcon][] = [
  ['Облако', Cloud],
  ['Виртуальная машина', Monitor],
  ['Сервер', Server],
  ['Процессор', Cpu],
  ['Память', MemoryStick],
  ['Диск', HardDrive],
  ['Хранилище', Database],
  ['Сеть', Network],
  ['Кластер', Layers3],
  ['Топология', Waypoints],
  ['Проект', Folder],
  ['Пользователи', Users],
  ['Настройки', Settings2],
  ['Управление облаком', CloudCog],
  ['Доступ', KeyRound],
  ['Защита', ShieldCheck],
  ['История', FileClock],
  ['Запуск', Play],
  ['Остановка', Square],
  ['Добавить', Plus],
  ['Удалить', Trash2],
  ['Поиск', Search],
  ['Фильтры', ListFilter],
  ['Обновить', RefreshCw],
  ['Просмотр', Eye],
  ['Копировать', Copy],
  ['Загрузить', Upload],
  ['Скачать', ArrowDownToLine],
  ['Помощь', CircleHelp],
  ['Информация', Info],
  ['Ошибка', AlertCircle],
  ['Готово', Check],
];
function IconsPage() {
  const [query, setQuery] = useState(''),
    [size, setSize] = useState(20),
    [picked, setPicked] = useState('Облако');
  const Icon = iconItems.find(([label]) => label === picked)?.[1] || Cloud;
  return (
    <Page
      title="Иконки"
      component="icon"
      description="Один графический язык для ресурсов, действий и состояний. Чёткий силуэт и согласованная толщина штриха."
    >
      <Lab
        metric="Сетка 24 / штрих 1,75"
        controls={
          <>
            <span className="eyebrow">Размер в контексте</span>
            <h3>{picked}</h3>
            <ButtonGroup aria-label="Размер иконок">
              {[14, 16, 20, 24].map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={size === value ? 'tonal' : 'ghost'}
                  aria-pressed={size === value}
                  onClick={() => setSize(value)}
                >
                  {value}
                </Button>
              ))}
            </ButtonGroup>
            <p>
              14 — компактные действия, 16 — основной контрол, 20 — навигация, 24 — самостоятельная
              иллюстрация ресурса.
            </p>
            <span className="specimen-source">Семейство Lucide · единая геометрия</span>
          </>
        }
      >
        <div className="icon-study">
          <div className="icon-study__grid">
            <Icon size={80} strokeWidth={1.75} />
          </div>
          <div className="inline-buttons">
            <Button leadingIcon={<Icon />}>Ресурс</Button>
            <Tooltip content={picked}>
              <IconButton icon={<Icon />} aria-label={picked} />
            </Tooltip>
            <StatusBadge tone="info">Доступен</StatusBadge>
          </div>
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading number="01" title="Каталог" note={`${iconItems.length} смысловых ролей`} />
        <Input
          className="icon-search"
          aria-label="Поиск иконок"
          placeholder="Найти по назначению"
          leadingIcon={<Search />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery('')}
        />
        <div className="icon-catalog">
          {iconItems
            .filter(([name]) => name.toLowerCase().includes(query.toLowerCase()))
            .map(([name, Item]) => (
              <button
                key={name}
                className={picked === name ? 'is-selected' : ''}
                onClick={() => setPicked(name)}
                aria-pressed={picked === name}
              >
                <Item size={size} />
                <span>{name}</span>
              </button>
            ))}
        </div>
        {!iconItems.some(([name]) => name.toLowerCase().includes(query.toLowerCase())) && (
          <p className="catalog-empty">Такой роли пока нет в каталоге.</p>
        )}
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Использование" />
        <Rules
          items={[
            [
              'Смысл важнее декора',
              'Одна сущность получает одну иконку во всём интерфейсе. Иконки действий сохраняют стандартное значение.',
            ],
            [
              'Кнопка без текста',
              'Всегда имеет доступное имя и подсказку. Цвет иконки наследуется от состояния кнопки.',
            ],
          ]}
        />
      </section>
    </Page>
  );
}
function SkeletonsPage() {
  const [loaded, setLoaded] = useState(false);
  return (
    <Page
      title="Скелетоны"
      component="skeleton"
      description="Предсказуемое появление данных. Заглушка повторяет будущую структуру и сохраняет её геометрию."
    >
      <Lab
        metric="Одинаковый размер до и после"
        controls={
          <>
            <span className="eyebrow">Стабильная композиция</span>
            <h3>Данные занимают своё место</h3>
            <p>
              Повторяем структуру реального содержимого. Короткие и длинные линии помогают считать
              будущую иерархию.
            </p>
            <Switch label="Данные загружены" checked={loaded} onCheckedChange={setLoaded} />
          </>
        }
      >
        <div
          className="skeleton-resource"
          aria-busy={!loaded}
          aria-label={loaded ? 'Виртуальная машина загружена' : 'Загружаем виртуальную машину'}
        >
          <div className="skeleton-resource__head">
            {loaded ? (
              <span className="resource-symbol">
                <Server />
              </span>
            ) : (
              <Skeleton width={40} height={40} shape="block" />
            )}
            <div>
              {loaded ? (
                <>
                  <strong>vm-production-01</strong>
                  <span>Production / cluster-east</span>
                </>
              ) : (
                <>
                  <Skeleton width="74%" height={16} />
                  <Skeleton width="92%" height={12} />
                </>
              )}
            </div>
            {loaded ? (
              <StatusBadge tone="success">Работает</StatusBadge>
            ) : (
              <Skeleton width={82} height={24} shape="block" />
            )}
          </div>
          <div className="skeleton-resource__stats">
            {[
              ['CPU', '4 vCPU'],
              ['Память', '16 GiB'],
              ['Диск', '120 GiB'],
            ].map(([label, value]) => (
              <div key={label}>
                {loaded ? (
                  <>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </>
                ) : (
                  <>
                    <Skeleton width={38} height={12} />
                    <Skeleton width={64} height={20} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading number="01" title="Базовые формы" />
        <div className="specimen-grid three">
          <Example title="Текст">
            <div className="stack">
              <Skeleton width="70%" />
              <Skeleton />
              <Skeleton width="46%" />
            </div>
          </Example>
          <Example title="Иконка и описание">
            <div className="skeleton-inline">
              <Skeleton shape="circle" width={36} height={36} />
              <div className="stack">
                <Skeleton />
                <Skeleton width="60%" />
              </div>
            </div>
          </Example>
          <Example title="Без анимации">
            <div className="stack">
              <Skeleton animate={false} />
              <Skeleton width="65%" animate={false} />
            </div>
          </Example>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="02"
          title="В составе таблицы"
          note="Те же границы и высота строки"
        />
        <div className="skeleton-table" aria-label="Пример загружающейся таблицы" aria-busy="true">
          <div>
            <strong>Имя</strong>
            <strong>Статус</strong>
            <strong>CPU</strong>
            <strong>Память</strong>
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row}>
              <span>
                <Skeleton width={`${65 + row * 8}%`} />
              </span>
              <span>
                <Skeleton width={74} />
              </span>
              <span>
                <Skeleton width={40} />
              </span>
              <span>
                <Skeleton width={46} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}
function CheckboxesPage() {
  const [selected, setSelected] = useState(['Снимки']),
    [simple, setSimple] = useState(false);
  const items = ['Снимки', 'Диски', 'Сетевые настройки'];
  return (
    <Page
      title="Чекбоксы"
      component="checkbox"
      description="Независимый выбор одного или нескольких значений. Частичный выбор явно отличим от полного."
    >
      <Lab
        metric="Маркер 16 px / радиус 4 px"
        controls={
          <>
            <span className="eyebrow">Иерархия выбора</span>
            <h3>Один, несколько или все</h3>
            <p>
              Родительский чекбокс показывает частичный выбор, когда отмечена только часть связанных
              пунктов.
            </p>
            <StatusBadge tone="info">Выбрано {selected.length} из 3</StatusBadge>
          </>
        }
      >
        <div className="field-demo choice-demo">
          <Checkbox
            label="Состав резервной копии"
            checked={selected.length === 3}
            indeterminate={selected.length > 0 && selected.length < 3}
            onCheckedChange={(value) => setSelected(value ? items : [])}
          />
          <div className="choice-children">
            {items.map((item) => (
              <Checkbox
                key={item}
                label={item}
                checked={selected.includes(item)}
                onCheckedChange={(checked) =>
                  setSelected(
                    checked ? [...selected, item] : selected.filter((value) => value !== item),
                  )
                }
              />
            ))}
          </div>
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading number="01" title="Состояния" />
        <div className="specimen-grid three">
          <Example title="Не выбран">
            <Checkbox
              label="Включить резервирование"
              checked={simple}
              onCheckedChange={setSimple}
            />
          </Example>
          <Example title="Выбран">
            <Checkbox label="Сохранять снимки" checked onCheckedChange={() => {}} />
          </Example>
          <Example title="Частичный">
            <Checkbox
              label="Выбрана часть ресурсов"
              checked={false}
              indeterminate
              onCheckedChange={() => {}}
            />
          </Example>
          <Example title="Недоступен">
            <Checkbox label="Настройка организации" checked disabled onCheckedChange={() => {}} />
          </Example>
          <Example title="Ошибка">
            <Checkbox
              label="Подтвердить удаление"
              checked={false}
              error
              onCheckedChange={() => {}}
              description="Подтверждение обязательно."
            />
          </Example>
          <Example title="С пояснением">
            <Checkbox
              label="Удалять связанные диски"
              checked={simple}
              onCheckedChange={setSimple}
              description="Будут удалены только диски, созданные вместе с ВМ."
            />
          </Example>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Поведение" />
        <Rules
          items={[
            [
              'Подпись тоже активна',
              'Нажатие на текст переключает чекбокс. Область взаимодействия не ограничена маленьким квадратом.',
            ],
            [
              'Применение формы',
              'Чекбокс задаёт выбор. Если есть общая кнопка сохранения, изменение вступает в силу после неё.',
            ],
          ]}
        />
      </section>
    </Page>
  );
}
function SwitchesPage() {
  const [enabled, setEnabled] = useState(true),
    [backup, setBackup] = useState(false);
  return (
    <Page
      title="Переключатели"
      component="switch"
      description="Включить или выключить функцию. Два состояния с ясной связью между намерением и результатом."
    >
      <Lab
        metric="Дорожка 36 × 20 / маркер 16"
        controls={
          <>
            <span className="eyebrow">Понятное состояние</span>
            <h3>Включено — значит работает</h3>
            <p>
              Переключатель обозначает состояние функции. Подпись называет саму функцию и остаётся
              одинаковой в обоих положениях.
            </p>
            <StatusBadge tone={enabled ? 'success' : 'neutral'}>
              {enabled ? 'Защита включена' : 'Защита выключена'}
            </StatusBadge>
          </>
        }
      >
        <div className="field-demo choice-demo">
          <Switch
            label="Защита от удаления"
            description="Предотвращает случайное удаление виртуальной машины."
            checked={enabled}
            onCheckedChange={setEnabled}
          />
          <Switch
            label="Автоматическое резервирование"
            description="Ежедневно в 03:00 по времени проекта."
            checked={backup}
            onCheckedChange={setBackup}
          />
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading number="01" title="Состояния" />
        <div className="specimen-grid">
          <Example title="Включён">
            <Switch label="Мониторинг ресурсов" checked onCheckedChange={() => {}} />
          </Example>
          <Example title="Выключен">
            <Switch label="Уведомления по почте" checked={false} onCheckedChange={() => {}} />
          </Example>
          <Example title="Недоступен · включён">
            <Switch
              label="Системный аудит"
              description="Управляется администратором."
              checked
              disabled
              onCheckedChange={() => {}}
            />
          </Example>
          <Example title="Недоступен · выключен">
            <Switch
              label="Внешняя сеть"
              description="Недостаточно прав."
              checked={false}
              disabled
              onCheckedChange={() => {}}
            />
          </Example>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Применение" />
        <Rules
          items={[
            [
              'Мгновенное действие',
              'В настройке с немедленным применением показываем результат рядом. Не оставляем пользователя гадать, сохранилось ли изменение.',
            ],
            [
              'Безопасное решение',
              'Опасные операции требуют отдельного подтверждения. Для выбора нескольких сущностей используем чекбоксы.',
            ],
          ]}
        />
      </section>
    </Page>
  );
}
function StatusesPage() {
  const tones: [StatusTone, string, string][] = [
    ['success', 'Работает', 'Штатное состояние'],
    ['warning', 'Высокая нагрузка', 'Требует внимания'],
    ['danger', 'Ошибка запуска', 'Нужны действия'],
    ['info', 'Миграция', 'Выполняется операция'],
    ['neutral', 'Выключена', 'Нейтральное состояние'],
  ];
  return (
    <Page
      title="Статусы"
      component="status"
      description="Быстро различимые состояния без цветового шума. Текст, знак и тон работают вместе."
    >
      <Lab
        metric="Мягкий фон / смысловой цвет"
        controls={
          <>
            <span className="eyebrow">Приоритет внимания</span>
            <h3>Цвет имеет значение</h3>
            <p>
              Голубой относится к процессу и информации. Успех, предупреждение и ошибка сохраняют
              собственные смысловые цвета в обеих темах.
            </p>
            <p>Статус не выглядит как действие и не заменяет кнопку.</p>
          </>
        }
      >
        <div className="status-stack">
          {tones.map(([tone, label, description]) => (
            <div key={tone}>
              <StatusBadge tone={tone}>{label}</StatusBadge>
              <span>{description}</span>
            </div>
          ))}
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading number="01" title="Варианты представления" />
        <div className="specimen-grid">
          <Example title="На поверхности">
            <div className="wrap">
              {tones.map(([tone, label]) => (
                <StatusBadge key={tone} tone={tone}>
                  {label}
                </StatusBadge>
              ))}
            </div>
          </Example>
          <Example title="В плотной строке">
            <div className="wrap">
              {tones.map(([tone, label]) => (
                <StatusBadge key={tone} tone={tone} subtle>
                  {label}
                </StatusBadge>
              ))}
            </div>
          </Example>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="02"
          title="Контекст строки"
          note="Маркер сохраняет смысл при выделении"
        />
        <div className="status-row-demo">
          <div data-tone="danger">
            <Server size={17} />
            <strong>vm-api-03</strong>
            <StatusBadge tone="danger" subtle>
              Ошибка запуска
            </StatusBadge>
            <span>Недостаточно памяти на узле</span>
          </div>
          <div data-tone="warning">
            <Server size={17} />
            <strong>vm-worker-02</strong>
            <StatusBadge tone="warning" subtle>
              Высокая нагрузка
            </StatusBadge>
            <span>CPU 92%</span>
          </div>
        </div>
      </section>
    </Page>
  );
}
function TooltipsPage() {
  return (
    <Page
      title="Подсказки"
      component="tooltip"
      description="Короткое пояснение по наведению и клавиатурному фокусу. Помощь остаётся рядом с тем, что она объясняет."
    >
      <Lab
        metric="Отступ 8 px / ширина по содержимому"
        controls={
          <>
            <span className="eyebrow">Дополнительный смысл</span>
            <h3>Пояснить, не перегрузить</h3>
            <p>
              Подсказка раскрывает сокращение, назначение иконки или смысл столбца. Важную
              инструкцию оставляем видимой на странице.
            </p>
            <div className="keyboard-hint">
              <kbd>Tab</kbd>показать<kbd>Esc</kbd>закрыть
            </div>
          </>
        }
      >
        <div className="tooltip-study">
          <span>Наведите курсор или перейдите клавишей Tab</span>
          <div className="inline-buttons">
            <Tooltip content="Быстрый просмотр виртуальной машины">
              <IconButton icon={<Eye />} aria-label="Быстрый просмотр виртуальной машины" />
            </Tooltip>
            <Tooltip content="Скопировать идентификатор ресурса">
              <IconButton icon={<Copy />} aria-label="Скопировать идентификатор ресурса" />
            </Tooltip>
            <Tooltip content="Объём оперативной памяти, выделенный виртуальной машине, в гибибайтах.">
              <Button variant="ghost" trailingIcon={<Info />}>
                RAM, GiB
              </Button>
            </Tooltip>
          </div>
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading number="01" title="Содержание" />
        <div className="specimen-grid">
          <Example title="Короткая подпись">
            <div className="tooltip-static" role="presentation">
              Обновить данные
            </div>
          </Example>
          <Example title="Пояснение поля">
            <div className="tooltip-static" role="presentation">
              Средняя загрузка всех виртуальных процессоров за последнюю минуту.
            </div>
          </Example>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Правила" />
        <Rules
          items={[
            [
              'Без интерактивного содержимого',
              'Ссылки, кнопки и формы требуют отдельного всплывающего окна. Подсказка содержит только текст.',
            ],
            [
              'Границы окна',
              'Позиция подстраивается под свободное место. Подсказка не обрезается контейнером таблицы.',
            ],
          ]}
        />
      </section>
    </Page>
  );
}
function TabsPage() {
  const [tab, setTab] = useState('overview');
  const [view, setView] = useState('all');
  const content: Record<string, ReactNode> = {
    overview: (
      <div className="tab-resource-grid">
        <div>
          <span>Процессоры</span>
          <strong>4 vCPU</strong>
        </div>
        <div>
          <span>Память</span>
          <strong>16 GiB</strong>
        </div>
        <div>
          <span>Диски</span>
          <strong>240 GiB</strong>
        </div>
      </div>
    ),
    disks: (
      <div className="resource-line">
        <HardDrive />
        <div>
          <strong>system-disk-01</strong>
          <span>NVMe · 120 GiB · подключён</span>
        </div>
        <Button size="sm">Настроить</Button>
      </div>
    ),
    network: (
      <div className="resource-line">
        <Network />
        <div>
          <strong>private-net</strong>
          <span>192.168.10.24 / 24</span>
        </div>
        <StatusBadge tone="success">Подключена</StatusBadge>
      </div>
    ),
    events: (
      <div className="resource-line">
        <FileClock />
        <div>
          <strong>Виртуальная машина запущена</strong>
          <span>Сегодня, 14:32 · Администратор</span>
        </div>
        <Check size={18} />
      </div>
    ),
  };
  return (
    <Page
      title="Вкладки"
      component="tabs"
      description="Внутренняя навигация сущности. Контекст остаётся на месте, пространство по горизонтали сохраняется."
    >
      <div className="entity-preview">
        <div className="resource-heading">
          <Server />
          <div>
            <strong>vm-production-01</strong>
            <span>Production / cluster-east</span>
          </div>
          <StatusBadge tone="success">Работает</StatusBadge>
        </div>
        <Tabs
          label="Разделы виртуальной машины"
          value={tab}
          onValueChange={setTab}
          items={[
            { id: 'overview', label: 'Обзор' },
            { id: 'disks', label: 'Диски', count: 2 },
            { id: 'network', label: 'Сети', count: 1 },
            { id: 'events', label: 'События', count: 12 },
            { id: 'backup', label: 'Резервные копии', disabled: true },
          ]}
        >
          {content[tab]}
        </Tabs>
      </div>
      <section className="ds-section">
        <SectionHeading number="01" title="Навигация по состояниям" />
        <Rules
          items={[
            [
              'Один активный раздел',
              'Полоса и цвет подписи отмечают текущую страницу. Счётчик дополняет название, не заменяя его.',
            ],
            [
              'Клавиатура',
              'Стрелки перемещают выбор; Home и End переходят к первой и последней доступной вкладке.',
            ],
            [
              'Узкое окно',
              'Вкладки прокручиваются в своей строке. Второе боковое меню не появляется.',
            ],
          ]}
        />
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Состав" />
        <div className="specimen-grid">
          <Example title="С иконками">
            <Tabs
              value="resources"
              onValueChange={() => {}}
              items={[
                { id: 'resources', label: 'Ресурсы', icon: <Layers3 /> },
                { id: 'access', label: 'Доступ', icon: <Users /> },
              ]}
            />
          </Example>
          <Example title="Без счётчиков">
            <Tabs
              value="base"
              onValueChange={() => {}}
              items={[
                { id: 'base', label: 'Основное' },
                { id: 'extra', label: 'Дополнительно' },
              ]}
            />
          </Example>
        </div>
        <Example title="Представления реестра">
          <Tabs
            label="Представления реестра"
            value={view}
            onValueChange={setView}
            items={[
              { id: 'all', label: 'Все', count: 16 },
              { id: 'running', label: 'Работают', count: 12 },
              { id: 'stopped', label: 'Выключены', count: 3 },
              { id: 'error', label: 'С ошибкой', count: 1 },
            ]}
            accessory="16 машин в облаке"
          >
            <p>
              {view === 'all'
                ? 'Все 16 машин'
                : view === 'running'
                  ? '12 работающих машин'
                  : view === 'stopped'
                    ? '3 выключенные машины'
                    : '1 машина с ошибкой'}
              . Поиск сохраняется при переключении представления. Произвольный набор фильтров
              получает вкладку «По условиям». Цвет статуса остаётся в строках таблицы.
            </p>
          </Tabs>
        </Example>
      </section>
    </Page>
  );
}
function DialogsPage() {
  const [kind, setKind] = useState<'form' | 'danger' | null>(null),
    [name, setName] = useState('vm-production-01'),
    [region, setRegion] = useState('msk'),
    [confirmed, setConfirmed] = useState(false),
    [message, setMessage] = useState('Выберите сценарий, чтобы открыть диалог.');
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <Page
      title="Диалоги"
      component="dialog"
      description="Одна завершённая задача поверх текущего контекста. Ясная иерархия, видимый выход и устойчивый футер."
    >
      <Lab
        metric="480 px / внутренний отступ 24 px"
        controls={
          <>
            <span className="eyebrow">Составной компонент</span>
            <h3>Форма, решение, результат</h3>
            <p>
              Заголовок называет задачу. Поля используют общие компоненты. Главная кнопка объясняет
              результат нажатия.
            </p>
            <p className="keyboard-hint">
              <kbd>Tab</kbd>внутри окна<kbd>Esc</kbd>закрыть
            </p>
          </>
        }
      >
        <div className="dialog-study">
          <div className="mini-dialog">
            <div />
            <div />
            <div />
            <span />
          </div>
          <div className="inline-buttons">
            <Button
              ref={trigger}
              variant="primary"
              leadingIcon={<Plus />}
              onClick={() => setKind('form')}
            >
              Создать ВМ
            </Button>
            <Button
              leadingIcon={<Trash2 />}
              onClick={() => {
                setConfirmed(false);
                setKind('danger');
              }}
            >
              Удаление
            </Button>
          </div>
          <p role="status">{message}</p>
        </div>
      </Lab>
      <section className="ds-section">
        <SectionHeading number="01" title="Анатомия" />
        <div className="anatomy-list">
          <div>
            <span>01</span>
            <strong>Заголовок</strong>
            <p>Название задачи и доступное закрытие.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Содержимое</strong>
            <p>Отступ 24 px, интервалы между полями 16 px. Длинное содержимое прокручивается.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Действия</strong>
            <p>Отмена рядом с основной кнопкой. Опасное действие получает собственный цвет.</p>
          </div>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Поведение" />
        <Rules
          items={[
            [
              'Фокус внутри задачи',
              'При открытии фокус переходит в диалог. После закрытия возвращается к вызвавшему его элементу.',
            ],
            [
              'Сохранность данных',
              'Нажатие на затемнение не закрывает форму. Отмена и закрытие остаются явными действиями.',
            ],
          ]}
        />
      </section>
      <Dialog
        open={kind === 'form'}
        onOpenChange={(open) => {
          if (!open) setKind(null);
        }}
        title="Создание виртуальной машины"
        description="Задайте имя и выберите регион размещения."
        footer={
          <>
            <Button onClick={() => setKind(null)}>Отмена</Button>
            <Button
              variant="primary"
              leadingIcon={<Plus />}
              disabled={!name.trim()}
              onClick={() => {
                setKind(null);
                setMessage(`Пример: ${name} создана в выбранном регионе.`);
              }}
            >
              Создать ВМ
            </Button>
          </>
        }
      >
        <div className="stack">
          <Input
            label="Имя"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={63}
          />
          <Select label="Регион" value={region} onValueChange={setRegion} options={regions} />
        </div>
      </Dialog>
      <Dialog
        open={kind === 'danger'}
        onOpenChange={(open) => {
          if (!open) setKind(null);
        }}
        tone="danger"
        title="Удалить виртуальную машину?"
        description="vm-production-01 будет удалена. Восстановить её можно только из резервной копии."
        footer={
          <>
            <Button onClick={() => setKind(null)}>Отмена</Button>
            <Button
              variant="danger"
              disabled={!confirmed}
              leadingIcon={<Trash2 />}
              onClick={() => {
                setKind(null);
                setMessage('Пример удаления завершён. Реальные ресурсы не изменялись.');
              }}
            >
              Удалить ВМ
            </Button>
          </>
        }
      >
        <Checkbox
          label="Я понимаю, что машина будет удалена"
          checked={confirmed}
          onCheckedChange={setConfirmed}
        />
      </Dialog>
    </Page>
  );
}
export function CatalogPages({ page }: { page: CatalogPage }) {
  const pages = {
    inputs: InputsPage,
    selects: SelectsPage,
    sliders: SlidersPage,
    progress: ProgressPage,
    icons: IconsPage,
    skeletons: SkeletonsPage,
    checkboxes: CheckboxesPage,
    switches: SwitchesPage,
    statuses: StatusesPage,
    tooltips: TooltipsPage,
    tabs: TabsPage,
    dialogs: DialogsPage,
    'table-select': TableSelectPage,
  };
  const Component = pages[page];
  return <Component />;
}
