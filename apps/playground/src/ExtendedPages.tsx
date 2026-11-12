import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  Bell,
  ChevronRight,
  CircleDot,
  Cloud,
  Copy,
  Cpu,
  Database,
  Fingerprint,
  GitBranch,
  HardDrive,
  Home,
  KeyRound,
  Layers3,
  ListCollapse,
  MapPin,
  Menu as MenuIcon,
  MessageSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Tag as TagIcon,
  Tags,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import {
  Accordion,
  Avatar,
  AvatarGroup,
  Badge,
  Breadcrumb,
  Button,
  CascadeSelect,
  Chip,
  CodeInput,
  IconButton,
  Input,
  InputMask,
  InputTag,
  Menu,
  Message,
  RadioButton,
  RadioGroup,
  Select,
  Switch,
  Tag,
  ToastRegion,
  type CascadeOption,
  type MaskKind,
  type MenuItem,
  type StatusTone,
  type ToastItem,
} from '@basis/ui';
import { PageHeading, SectionHeading } from './PageParts';
import { ComponentTokens } from './TokenPanel';
import { useDesign } from './DesignContext';

export const extendedCatalog = [
  {
    id: 'cascade-select',
    label: 'Каскадный выбор',
    name: 'CascadeSelect',
    icon: GitBranch,
    component: 'cascade-select',
    group: 'input',
  },
  {
    id: 'radio',
    label: 'Радиокнопки',
    name: 'RadioButton',
    icon: CircleDot,
    component: 'radio',
    group: 'input',
  },
  {
    id: 'code-input',
    label: 'Код подтверждения',
    name: 'CodeInput',
    icon: Fingerprint,
    component: 'code-input',
    group: 'input',
  },
  { id: 'tag', label: 'Метки', name: 'Tag', icon: TagIcon, component: 'tag', group: 'feedback' },
  {
    id: 'input-tag',
    label: 'Ввод меток',
    name: 'InputTag',
    icon: Tags,
    component: 'input-tag',
    group: 'input',
  },
  {
    id: 'input-mask',
    label: 'Маски ввода',
    name: 'InputMask',
    icon: KeyRound,
    component: 'input-mask',
    group: 'input',
  },
  {
    id: 'accordion',
    label: 'Аккордеон',
    name: 'Accordion',
    icon: ListCollapse,
    component: 'accordion',
    group: 'navigation',
  },
  {
    id: 'breadcrumb',
    label: 'Навигационный путь',
    name: 'Breadcrumb',
    icon: ChevronRight,
    component: 'breadcrumb',
    group: 'navigation',
  },
  {
    id: 'menu',
    label: 'Меню действий',
    name: 'Menu',
    icon: MenuIcon,
    component: 'menu',
    group: 'navigation',
  },
  {
    id: 'message',
    label: 'Сообщения',
    name: 'Message',
    icon: MessageSquare,
    component: 'message',
    group: 'feedback',
  },
  {
    id: 'toast',
    label: 'Уведомления',
    name: 'Toast',
    icon: Bell,
    component: 'toast',
    group: 'feedback',
  },
  {
    id: 'badge',
    label: 'Счётчики',
    name: 'Badge',
    icon: Activity,
    component: 'badge',
    group: 'feedback',
  },
  { id: 'chip', label: 'Чипы', name: 'Chip', icon: Layers3, component: 'chip', group: 'input' },
  {
    id: 'avatar',
    label: 'Аватары',
    name: 'Avatar',
    icon: UserRound,
    component: 'avatar',
    group: 'feedback',
  },
] as const;
export type ExtendedPage = (typeof extendedCatalog)[number]['id'];
export const isExtendedPage = (page: string): page is ExtendedPage =>
  extendedCatalog.some((item) => item.id === page);
const tones: StatusTone[] = ['neutral', 'info', 'success', 'warning', 'danger'];
const toneLabel: Record<StatusTone, string> = {
  neutral: 'Нейтральный',
  info: 'Информация',
  success: 'Успех',
  warning: 'Внимание',
  danger: 'Ошибка',
};
const noChange = () => {};

function DesignPage({
  id,
  description,
  children,
  rules,
}: {
  id: ExtendedPage;
  description: string;
  children: ReactNode;
  rules: [string, string][];
}) {
  const meta = extendedCatalog.find((item) => item.id === id)!,
    design = useDesign();
  const bases: Partial<Record<ExtendedPage, [string, string][]>> = {
    'cascade-select': [
      ['Поле поиска', 'inputs'],
      ['Кнопка', 'buttons'],
      ['Панель', 'table'],
    ],
    tag: [['Кнопка удаления', 'buttons']],
    'input-tag': [
      ['Метка', 'tag'],
      ['Поле', 'inputs'],
    ],
    'input-mask': [['Базовое поле', 'inputs']],
    accordion: [['Кнопка заголовка', 'buttons']],
    breadcrumb: [['Меню уровней', 'menu']],
    menu: [['Кнопка', 'buttons']],
    message: [['Кнопка действия', 'buttons']],
    toast: [
      ['Сообщение', 'message'],
      ['Кнопка', 'buttons'],
    ],
    chip: [['Кнопка', 'buttons']],
  };
  return (
    <>
      <PageHeading
        category={`Компоненты / ${meta.name}`}
        title={meta.label}
        description={description}
      >
        <Button
          size="sm"
          leadingIcon={<SlidersHorizontal />}
          onClick={() => design.openComponent(meta.component)}
        >
          Токены компонента
        </Button>
      </PageHeading>
      {children}
      <section className="ds-section">
        <SectionHeading number="03" title="Правила и поведение" note="Контракт дизайна" />
        <div className="extended-rules">
          {rules.map(([title, text], i) => (
            <article key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="04" title="Токены и связи" note="Один источник · две темы" />
        {bases[id] && (
          <div className="extended-composition">
            <span>Наследует общие компоненты</span>
            {bases[id]!.map(([label, route]) => (
              <a href={`#${route}`} key={label}>
                {label}
                <ChevronRight size={13} />
              </a>
            ))}
          </div>
        )}
        <ComponentTokens component={meta.component} />
      </section>
    </>
  );
}
function Lab({
  name,
  children,
  controls,
  foot,
}: {
  name: string;
  children: ReactNode;
  controls: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <section className="extended-lab" aria-label={`Живой пример: ${name}`}>
      <div className="extended-lab__main">
        <header>
          <span>
            <i /> Живой образец
          </span>
          <span>{name}</span>
        </header>
        <div className="extended-lab__canvas">{children}</div>
        <footer>{foot || 'Демонстрационные данные · можно взаимодействовать'}</footer>
      </div>
      <aside>
        <span className="eyebrow">Исследовать компонент</span>
        {controls}
      </aside>
    </section>
  );
}
function States({
  children,
  note = 'Состояния не меняют смысл компонента',
}: {
  children: ReactNode;
  note?: string;
}) {
  return (
    <section className="ds-section">
      <SectionHeading number="02" title="Состояния и варианты" note={note} />
      <div className="extended-states">{children}</div>
    </section>
  );
}
function Spec({
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
    <article className="extended-spec" data-wide={wide}>
      <header>
        <h3>{title}</h3>
        {note && <p>{note}</p>}
      </header>
      <div>{children}</div>
    </article>
  );
}
function ToneControl({
  value,
  onChange,
}: {
  value: StatusTone;
  onChange: (tone: StatusTone) => void;
}) {
  return (
    <Select
      label="Смысловой тон"
      value={value}
      onValueChange={onChange}
      options={tones.map((t) => ({ value: t, label: toneLabel[t] }))}
    />
  );
}
function Resource({
  title = 'prod-api-01',
  subtitle = 'Виртуальная машина · Production',
  icon = <Server />,
  children,
}: {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="resource-example">
      <header>
        <span className="resource-example__icon">{icon}</span>
        <div>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </div>
      </header>
      <div className="resource-example__body">{children}</div>
    </div>
  );
}

const locations: CascadeOption[] = [
  {
    value: 'msk',
    label: 'Москва',
    description: '2 кластера',
    children: [
      {
        value: 'msk-prod',
        label: 'Production',
        description: 'Основная площадка',
        children: [
          { value: 'msk-01', label: 'msk-esx-01', description: '24 vCPU · 128 GiB' },
          { value: 'msk-02', label: 'msk-esx-02', description: '32 vCPU · 256 GiB' },
          {
            value: 'msk-03',
            label: 'msk-esx-03',
            description: 'Техническое обслуживание',
            disabled: true,
          },
        ],
      },
      {
        value: 'msk-dev',
        label: 'Development',
        children: [{ value: 'dev-01', label: 'dev-esx-01', description: '16 vCPU · 64 GiB' }],
      },
    ],
  },
  {
    value: 'spb',
    label: 'Санкт-Петербург',
    description: 'Резервная площадка',
    children: [
      {
        value: 'spb-dr',
        label: 'Disaster Recovery',
        children: [{ value: 'spb-01', label: 'spb-esx-01', description: '32 vCPU · 256 GiB' }],
      },
    ],
  },
  {
    value: 'kzn',
    label: 'Казань',
    description: 'Нет доступа',
    disabled: true,
    children: [
      {
        value: 'kzn-prod',
        label: 'Production',
        children: [{ value: 'kzn-01', label: 'kzn-esx-01' }],
      },
    ],
  },
];
function CascadePage() {
  const [value, setValue] = useState(''),
    [disabled, setDisabled] = useState(false);
  return (
    <DesignPage
      id="cascade-select"
      description="Выбор конечного ресурса с сохранением всей цепочки: регион → кластер → хост."
      rules={[
        [
          'Контекст сохраняется',
          'Поле показывает полный путь. Поиск находит ресурс по любому уровню и не теряет его родителей.',
        ],
        [
          'Выбор подтверждается',
          'Переход между уровнями меняет черновик. Выбрать применяет конечный ресурс; Escape и Отмена сохраняют прежнее значение.',
        ],
        [
          'Клавиатура и доступность',
          'Стрелки вверх и вниз перемещают фокус; вправо и влево — между уровнями. Недоступные ветви нельзя выбрать.',
        ],
      ]}
    >
      <Lab
        name="CascadeSelect"
        controls={
          <>
            <h3>Расположение ресурса</h3>
            <p>
              Иерархия появляется только на время выбора. Для плоского списка используем Select, для
              сравнения атрибутов — TableSelect.
            </p>
            <Switch label="Недоступен" checked={disabled} onCheckedChange={setDisabled} />
            <Button size="sm" onClick={() => setValue('msk-02')}>
              Показать выбранный путь
            </Button>
          </>
        }
      >
        <Resource title="Размещение новой ВМ">
          <CascadeSelect
            label="Хост размещения"
            value={value}
            onValueChange={setValue}
            options={locations}
            disabled={disabled}
            hint="Можно найти хост по имени или пройти все уровни."
          />
        </Resource>
      </Lab>
      <States>
        <Spec title="Выбрано">
          <CascadeSelect label="Хост" value="msk-01" onValueChange={noChange} options={locations} />
        </Spec>
        <Spec title="Загрузка">
          <CascadeSelect
            label="Хост"
            value=""
            onValueChange={noChange}
            options={[]}
            loading
            hint="Получаем доступные площадки."
          />
        </Spec>
        <Spec title="Ошибка">
          <CascadeSelect
            label="Хост"
            value=""
            onValueChange={noChange}
            options={locations}
            error="Выберите хост размещения."
          />
        </Spec>
        <Spec title="Только чтение">
          <CascadeSelect
            label="Хост"
            value="spb-01"
            onValueChange={noChange}
            options={locations}
            readOnly
            hint="Расположение задано политикой."
          />
        </Spec>
        <Spec title="Нет ресурсов">
          <CascadeSelect label="Пустая площадка" value="" onValueChange={noChange} options={[]} />
        </Spec>
        <Spec title="Недоступно">
          <CascadeSelect
            label="Хост"
            value="msk-02"
            onValueChange={noChange}
            options={locations}
            disabled
          />
        </Spec>
      </States>
    </DesignPage>
  );
}

const allocation = [
  {
    value: 'shared',
    label: 'Общий пул',
    description: 'Ресурсы распределяются между ВМ',
    icon: <Layers3 />,
  },
  {
    value: 'reserved',
    label: 'Гарантированные ресурсы',
    description: 'Резервирование vCPU и памяти',
    icon: <Cpu />,
  },
  {
    value: 'dedicated',
    label: 'Выделенный хост',
    description: 'Недоступно по текущей квоте',
    disabled: true,
    icon: <Server />,
  },
];
function RadioPage() {
  const [value, setValue] = useState('shared'),
    [cards, setCards] = useState(true),
    [disabled, setDisabled] = useState(false);
  return (
    <DesignPage
      id="radio"
      description="Один вариант из нескольких. Вся строка — цель нажатия, подпись и пояснение остаются рядом."
      rules={[
        [
          'Один выбор',
          'Связанные радиокнопки образуют именованную группу. Для независимых значений используем Checkbox.',
        ],
        [
          'Стрелки внутри группы',
          'Tab входит в выбранный вариант, стрелки меняют выбор, Space подтверждает. Недоступный вариант пропускается.',
        ],
        [
          'Карточка несёт смысл',
          'Карточный вид нужен для пояснений и сравнений. Геометрия самого контрола остаётся одинаковой.',
        ],
      ]}
    >
      <Lab
        name="RadioButton"
        controls={
          <>
            <h3>Модель выделения</h3>
            <Switch label="Карточки с пояснениями" checked={cards} onCheckedChange={setCards} />
            <Switch label="Группа недоступна" checked={disabled} onCheckedChange={setDisabled} />
            <p>Выбрано: {allocation.find((a) => a.value === value)?.label}</p>
          </>
        }
      >
        <div className="extended-control">
          <RadioGroup
            label="Выделение ресурсов"
            value={value}
            onValueChange={setValue}
            options={allocation}
            cards={cards}
            disabled={disabled}
          />
        </div>
      </Lab>
      <States>
        <Spec title="Не выбрана">
          <RadioButton label="Общий пул" name="radio-spec-empty" />
        </Spec>
        <Spec title="Выбрана">
          <RadioButton
            label="Гарантированные ресурсы"
            name="radio-spec-selected"
            checked
            onChange={noChange}
          />
        </Spec>
        <Spec title="Недоступные">
          <div className="stack">
            <RadioButton label="Общий пул" disabled />
            <RadioButton label="Выбранный вариант" checked disabled readOnly />
          </div>
        </Spec>
        <Spec title="Ошибка группы">
          <RadioGroup
            label="Модель размещения"
            value=""
            onValueChange={setValue}
            options={allocation.slice(0, 2)}
            error="Выберите модель размещения."
          />
        </Spec>
      </States>
    </DesignPage>
  );
}

function CodePage() {
  const [value, setValue] = useState(''),
    [phase, setPhase] = useState<'idle' | 'loading' | 'error' | 'success'>('idle'),
    [length, setLength] = useState<4 | 6>(6),
    [disabled, setDisabled] = useState(false);
  useEffect(() => {
    if (phase !== 'loading') return;
    const timer = setTimeout(
      () => setPhase(value === '642180' || value === '6421' ? 'success' : 'error'),
      1100,
    );
    return () => clearTimeout(timer);
  }, [phase, value]);
  return (
    <DesignPage
      id="code-input"
      description="Одноразовый код как единое поле: знакомое редактирование, автозаполнение и ясное состояние каждой ячейки."
      rules={[
        [
          'Одно поле, несколько ячеек',
          'Вставка полного кода, выделение, Backspace и автозаполнение работают как у обычного поля. Разделители и буквы не попадают в значение.',
        ],
        [
          'Проверка по действию',
          'Полный код включает кнопку подтверждения. До ответа повторная отправка недоступна; ошибка сохраняет введённое значение.',
        ],
        [
          'Не полагаться на цвет',
          'У ошибки и успеха есть текст; загрузка сопровождается облачным индикатором. Код не рассылается и не проверяется сервером в этой демонстрации.',
        ],
      ]}
    >
      <Lab
        name="CodeInput"
        controls={
          <>
            <h3>Подтверждение операции</h3>
            <Select
              label="Длина кода"
              value={String(length)}
              onValueChange={(v) => {
                setLength(Number(v) as 4 | 6);
                setValue('');
                setPhase('idle');
              }}
              options={[
                { value: '6', label: '6 цифр' },
                { value: '4', label: '4 цифры' },
              ]}
            />
            <Switch label="Недоступен" checked={disabled} onCheckedChange={setDisabled} />
            <p>Проверочный код: {length === 6 ? '642180' : '6421'}. Другой код покажет ошибку.</p>
          </>
        }
      >
        <div className="verification-example">
          <span className="verification-example__icon">
            <ShieldCheck />
          </span>
          <h3>Подтвердите доступ</h3>
          <p>Код из приложения аутентификации</p>
          <CodeInput
            label="Код подтверждения"
            value={value}
            onValueChange={(v) => {
              setValue(v);
              setPhase('idle');
            }}
            length={length}
            disabled={disabled}
            loading={phase === 'loading'}
            success={phase === 'success'}
            error={phase === 'error' ? 'Код не подошёл. Проверьте и повторите.' : undefined}
          />
          <Button
            variant="primary"
            fullWidth
            loading={phase === 'loading'}
            loadingLabel="Проверяем"
            disabled={disabled || value.length !== length || phase === 'success'}
            onClick={() => setPhase('loading')}
          >
            {phase === 'success' ? 'Доступ подтверждён' : 'Подтвердить'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue('');
              setPhase('idle');
            }}
          >
            Начать заново
          </Button>
        </div>
      </Lab>
      <States>
        <Spec title="Пустое поле">
          <CodeInput label="Код" value="" onValueChange={noChange} />
        </Spec>
        <Spec title="Частично заполнено">
          <CodeInput label="Код" value="642" onValueChange={noChange} />
        </Spec>
        <Spec title="Проверка">
          <CodeInput label="Код" value="642180" onValueChange={noChange} loading />
        </Spec>
        <Spec title="Ошибка">
          <CodeInput
            label="Код"
            value="000000"
            onValueChange={noChange}
            error="Код истёк. Получите новый."
          />
        </Spec>
        <Spec title="Подтверждено">
          <CodeInput label="Код" value="642180" onValueChange={noChange} success />
        </Spec>
        <Spec title="Недоступно / только чтение">
          <div className="stack">
            <CodeInput label="Недоступный код" value="" onValueChange={noChange} disabled />
            <CodeInput
              label="Код только для чтения"
              value="642180"
              onValueChange={noChange}
              readOnly
            />
          </div>
        </Spec>
      </States>
    </DesignPage>
  );
}

function TagPage() {
  const [tone, setTone] = useState<StatusTone>('info'),
    [outlined, setOutlined] = useState(false),
    [removable, setRemovable] = useState(false),
    [shown, setShown] = useState(true);
  return (
    <DesignPage
      id="tag"
      description="Компактная классификация: окружение, владелец, политика. Метка не выглядит как основное действие."
      rules={[
        [
          'Tag — характеристика',
          'Метка описывает ресурс. Для выбора и фильтрации нужен Chip, для числа событий — Badge, для состояния ВМ — Status.',
        ],
        [
          'Удаляется явным действием',
          'Крестик — отдельная общая IconButton с доступным именем. Нажатие на текст ничего не меняет.',
        ],
        [
          'Длинные значения',
          'Метка ограничена контейнером; полное значение доступно по наведению. Цвет дублируется читаемым текстом.',
        ],
      ]}
    >
      <Lab
        name="Tag"
        controls={
          <>
            <ToneControl value={tone} onChange={setTone} />
            <Switch label="Контурная метка" checked={outlined} onCheckedChange={setOutlined} />
            <Switch label="Можно удалить" checked={removable} onCheckedChange={setRemovable} />
            {!shown && (
              <Button size="sm" onClick={() => setShown(true)}>
                Вернуть метку
              </Button>
            )}
          </>
        }
      >
        <Resource>
          <span className="extended-label">Метки ресурса</span>
          <div className="wrap">
            <Tag>production</Tag>
            {shown && (
              <Tag
                tone={tone}
                outlined={outlined}
                icon={<ShieldCheck />}
                onRemove={removable ? () => setShown(false) : undefined}
              >
                backup:daily
              </Tag>
            )}
            <Tag tone="neutral">team:platform</Tag>
          </div>
        </Resource>
      </Lab>
      <States>
        <Spec title="Смысловые тона" wide>
          <div className="wrap">
            {tones.map((t) => (
              <Tag key={t} tone={t}>
                {toneLabel[t]}
              </Tag>
            ))}
          </div>
        </Spec>
        <Spec title="Контурные">
          <div className="wrap">
            {tones.map((t) => (
              <Tag key={t} tone={t} outlined>
                {toneLabel[t]}
              </Tag>
            ))}
          </div>
        </Spec>
        <Spec title="С иконкой">
          <div className="wrap">
            <Tag icon={<MapPin />} tone="info">
              Москва
            </Tag>
            <Tag icon={<Database />} tone="success">
              С резервированием
            </Tag>
          </div>
        </Spec>
        <Spec title="Длинное имя">
          <div style={{ maxWidth: 220 }}>
            <Tag>environment:production-critical-services</Tag>
          </div>
        </Spec>
        <Spec title="Удаление недоступно">
          <Tag onRemove={noChange} disabled>
            managed:policy
          </Tag>
        </Spec>
      </States>
    </DesignPage>
  );
}

const validateTag = (v: string) =>
  v.length > 24
    ? 'Метка должна быть не длиннее 24 символов.'
    : !/^[a-zA-Z0-9:_-]+$/.test(v)
      ? 'Используйте латиницу, цифры, : _ или дефис.'
      : undefined;
function InputTagPage() {
  const [value, setValue] = useState(['production', 'team:platform']),
    [readOnly, setReadOnly] = useState(false),
    [disabled, setDisabled] = useState(false);
  return (
    <DesignPage
      id="input-tag"
      description="Несколько коротких значений в одном поле. Предсказуемые добавление, проверка и удаление меток."
      rules={[
        [
          'Добавление без сюрпризов',
          'Enter, запятая или точка с запятой добавляют метку. Вставка списка разбирает разделители; неподходящие значения остаются в черновике.',
        ],
        [
          'Дубликаты и лимит',
          'Регистр не создаёт дубль. При превышении лимита уже введённые метки сохраняются, причина видна под полем.',
        ],
        [
          'Редактирование доступно',
          'Backspace в пустом поле удаляет последнюю метку. Каждая кнопка удаления доступна с клавиатуры; только чтение сохраняет видимость меток.',
        ],
      ]}
    >
      <Lab
        name="InputTag"
        controls={
          <>
            <h3>Метаданные ВМ</h3>
            <Switch label="Только чтение" checked={readOnly} onCheckedChange={setReadOnly} />
            <Switch label="Недоступно" checked={disabled} onCheckedChange={setDisabled} />
            <p>Попробуйте вставить: production, region:msk, backup:daily. Повтор не добавится.</p>
            <Button size="sm" onClick={() => setValue([])}>
              Очистить пример
            </Button>
          </>
        }
      >
        <Resource>
          <InputTag
            label="Метки"
            value={value}
            onValueChange={setValue}
            max={5}
            readOnly={readOnly}
            disabled={disabled}
            validate={validateTag}
            hint="Enter или запятая добавляют метку. До 5 значений."
          />
        </Resource>
      </Lab>
      <States>
        <Spec title="Пустое поле">
          <InputTag label="Метки" value={[]} onValueChange={setValue} />
        </Spec>
        <Spec title="Несколько строк">
          <InputTag
            label="Метки ресурса"
            value={['production', 'region:msk', 'team:platform', 'backup:daily', 'tier:critical']}
            onValueChange={noChange}
          />
        </Spec>
        <Spec title="Ошибка">
          <InputTag
            label="Метки"
            value={['production']}
            onValueChange={noChange}
            error="В метке нельзя использовать пробелы."
          />
        </Spec>
        <Spec title="Только чтение">
          <InputTag
            label="Политики"
            value={['managed:auto', 'backup:daily']}
            onValueChange={noChange}
            readOnly
          />
        </Spec>
        <Spec title="Недоступно">
          <InputTag label="Метки" value={['production']} onValueChange={noChange} disabled />
        </Spec>
      </States>
    </DesignPage>
  );
}

function MaskPage() {
  const [kind, setKind] = useState<MaskKind>('mac'),
    [value, setValue] = useState(''),
    [readOnly, setReadOnly] = useState(false);
  const names = { mac: 'MAC-адрес', phone: 'Телефон', date: 'Дата обслуживания' };
  return (
    <DesignPage
      id="input-mask"
      description="Маска помогает соблюсти формат. Проверка значения дополняет маску и объясняет ошибку."
      rules={[
        [
          'Разделители вводятся автоматически',
          'Значение хранится отдельно от форматирования. Вставка готового адреса или номера очищает только служебные символы.',
        ],
        [
          'Маска не заменяет валидацию',
          'Дата 31.02.2026 имеет правильную длину, но не существует. Неполное значение отмечается после выхода из поля.',
        ],
        [
          'Где маска не нужна',
          'Для IP-адресов с переменной длиной октетов нужен валидируемый Input. Для свободного текста маска создаёт лишние ограничения.',
        ],
      ]}
    >
      <Lab
        name="InputMask"
        controls={
          <>
            <Select
              label="Формат"
              value={kind}
              onValueChange={(v) => {
                setKind(v);
                setValue('');
              }}
              options={[
                { value: 'mac', label: 'MAC-адрес · HEX' },
                { value: 'phone', label: 'Телефон · +7' },
                { value: 'date', label: 'Дата · ДД.ММ.ГГГГ' },
              ]}
            />
            <Switch label="Только чтение" checked={readOnly} onCheckedChange={setReadOnly} />
            <p>Разделители остаются частью представления, а не данными поля.</p>
          </>
        }
      >
        <Resource title="Сетевой адаптер">
          <InputMask
            key={kind}
            kind={kind}
            label={names[kind]}
            value={value}
            onValueChange={setValue}
            readOnly={readOnly}
            leadingIcon={kind === 'mac' ? <Network /> : undefined}
          />
        </Resource>
      </Lab>
      <States>
        <Spec title="MAC-адрес">
          <InputMask kind="mac" label="MAC-адрес" value="AABBCCDDEEFF" onValueChange={noChange} />
        </Spec>
        <Spec title="Телефон">
          <InputMask
            kind="phone"
            label="Контакт инженера"
            value="9991234567"
            onValueChange={noChange}
          />
        </Spec>
        <Spec title="Частичное значение">
          <InputMask
            kind="date"
            label="Дата"
            value="1211"
            onValueChange={noChange}
            hint="Значение можно дописать."
          />
        </Spec>
        <Spec title="Ошибка даты">
          <InputMask
            kind="date"
            label="Дата"
            value="31022026"
            onValueChange={noChange}
            error="Такой даты не существует."
          />
        </Spec>
        <Spec title="Недоступно">
          <InputMask
            kind="mac"
            label="MAC-адрес"
            value="AABBCCDDEEFF"
            onValueChange={noChange}
            disabled
          />
        </Spec>
        <Spec title="Только чтение">
          <InputMask
            kind="phone"
            label="Телефон"
            value="9991234567"
            onValueChange={noChange}
            readOnly
          />
        </Spec>
      </States>
    </DesignPage>
  );
}

function AccordionPage() {
  const [value, setValue] = useState(['compute']),
    [multiple, setMultiple] = useState(false),
    [vcpus, setVcpus] = useState('4');
  const items = [
    {
      id: 'compute',
      title: 'Вычислительные ресурсы',
      description: '4 vCPU · 16 GiB',
      icon: <Cpu />,
      content: (
        <div className="extended-two">
          <Input
            label="vCPU"
            value={vcpus}
            onChange={(e) => setVcpus(e.target.value)}
            type="number"
            min={1}
          />
          <Input label="Память" value="16 GiB" readOnly />
        </div>
      ),
    },
    {
      id: 'network',
      title: 'Сеть',
      description: 'Production · 10.20.1.14',
      icon: <Network />,
      content: (
        <Message title="Сеть подключена" tone="success" compact>
          Адрес получен от DHCP.
        </Message>
      ),
    },
    {
      id: 'storage',
      title: 'Диски',
      description: '2 диска · 180 GiB',
      icon: <HardDrive />,
      content: (
        <div className="wrap">
          <Tag>system · 60 GiB</Tag>
          <Tag>data · 120 GiB</Tag>
        </div>
      ),
    },
    {
      id: 'policy',
      title: 'Расширенные политики',
      description: 'Недостаточно прав',
      icon: <ShieldCheck />,
      content: null,
      disabled: true,
    },
  ];
  return (
    <DesignPage
      id="accordion"
      description="Разделы формы и подробностей с ясным заголовком, кратким итогом и доступным раскрытием."
      rules={[
        [
          'Заголовок даёт контекст',
          'Сводка видна в закрытом состоянии. Кнопки внутри содержимого не вкладываются в кнопку заголовка.',
        ],
        [
          'Состояние не теряется',
          'Закрытие раздела сохраняет введённые данные. В одиночном режиме раскрытие нового раздела закрывает предыдущий.',
        ],
        [
          'Раскрытие доступно',
          'Enter и Space раскрывают заголовок. Tab проходит по доступным контролам; скрытое содержимое исключено из навигации.',
        ],
      ]}
    >
      <Lab
        name="Accordion"
        controls={
          <>
            <h3>Параметры машины</h3>
            <Switch
              label="Несколько открытых разделов"
              checked={multiple}
              onCheckedChange={(v) => {
                setMultiple(v);
                if (!v) setValue(value.slice(0, 1));
              }}
            />
            <Button size="sm" onClick={() => setValue([])}>
              Свернуть всё
            </Button>
            <p>Измените vCPU, закройте раздел и откройте снова — значение сохранится.</p>
          </>
        }
      >
        <div className="extended-full">
          <Accordion items={items} value={value} onValueChange={setValue} multiple={multiple} />
        </div>
      </Lab>
      <States>
        <Spec title="Закрытый раздел">
          <Accordion items={items.slice(0, 1)} value={[]} onValueChange={setValue} />
        </Spec>
        <Spec title="Открытый раздел">
          <Accordion items={[items[1]]} value={['network']} onValueChange={setValue} />
        </Spec>
        <Spec title="Недоступный раздел">
          <Accordion items={[items[3]]} value={[]} onValueChange={noChange} />
        </Spec>
        <Spec title="Длинный заголовок">
          <Accordion
            items={[
              {
                id: 'long',
                title:
                  'Правила размещения и автоматического восстановления виртуальной машины после сбоя',
                content: 'Параметры политики',
              },
            ]}
            value={[]}
            onValueChange={noChange}
          />
        </Spec>
      </States>
    </DesignPage>
  );
}

function BreadcrumbPage() {
  const [deep, setDeep] = useState(true),
    [currentIndex, setCurrentIndex] = useState(4);
  const tree = [
    { label: 'Облако', icon: <Cloud />, description: 'Обзор инфраструктуры', summary: '3 региона' },
    { label: 'Москва', icon: <MapPin />, description: 'Регион · Облако', summary: '2 кластера' },
    { label: 'Production', icon: <Layers3 />, description: 'Кластер · Москва', summary: '3 хоста' },
    {
      label: 'Виртуальные машины',
      icon: <Server />,
      description: 'Реестр · Production',
      summary: '12 машин',
    },
    {
      label: 'prod-api-01',
      icon: <Server />,
      description: 'Виртуальная машина · Production',
      summary: 'В работе',
    },
  ];
  const allItems = tree.map((item, index) => ({
    label: item.label,
    icon: index === 0 ? item.icon : undefined,
    href: '#breadcrumb',
    onNavigate: () => setCurrentIndex(index),
  }));
  const items = allItems.slice(0, currentIndex + 1);
  const destination = tree[currentIndex];
  return (
    <DesignPage
      id="breadcrumb"
      description="Показывает место объекта в иерархии. Длинный путь сворачивается, сохраняя начало и ближайших родителей."
      rules={[
        [
          'Иерархия, а не история',
          'Путь описывает родителей объекта, а не последовательность прошлых экранов. Текущий объект не дублирует действие перехода.',
        ],
        [
          'Скрытые уровни доступны',
          'Многоточие раскрывает меню промежуточных уровней. Названия сохраняются целиком; длинный текущий объект переносится.',
        ],
        [
          'Навигация отдельна',
          'Breadcrumb дополняет основное меню и внутренние вкладки. Его задача — положение и переход к родителю.',
        ],
      ]}
    >
      <Lab
        name="Breadcrumb"
        controls={
          <>
            <Switch label="Глубокая иерархия" checked={deep} onCheckedChange={setDeep} />
            <p>
              Откройте многоточие и выберите промежуточный уровень. Переход демонстрируется внутри
              примера.
            </p>
            <Button size="sm" onClick={() => setCurrentIndex(4)}>
              Вернуть объект
            </Button>
          </>
        }
      >
        <div className="breadcrumb-example">
          <Breadcrumb
            items={deep ? items : items.length > 2 ? [items[0], ...items.slice(-2)] : items}
          />
          <Resource
            title={destination.label}
            subtitle={destination.description}
            icon={destination.icon}
          >
            <div className="wrap">
              <Tag tone={currentIndex === 4 ? 'success' : 'info'}>{destination.summary}</Tag>
              {currentIndex === 4 && <Tag>Production</Tag>}
            </div>
          </Resource>
        </div>
      </Lab>
      <States>
        <Spec title="Короткий путь">
          <Breadcrumb
            items={[
              { label: 'Облако', href: '#breadcrumb', icon: <Home /> },
              { label: 'Виртуальные машины' },
            ]}
          />
        </Spec>
        <Spec title="Только текущий уровень">
          <Breadcrumb items={[{ label: 'Инфраструктура' }]} />
        </Spec>
        <Spec title="Свёрнутые уровни">
          <Breadcrumb items={allItems} maxItems={3} />
        </Spec>
        <Spec title="Длинное имя">
          <Breadcrumb
            items={[
              { label: 'Кластеры', href: '#breadcrumb' },
              { label: 'production-europe-primary-compute-cluster' },
            ]}
          />
        </Spec>
      </States>
    </DesignPage>
  );
}

function MenuPage() {
  const design = useDesign();
  const [result, setResult] = useState('Выберите действие'),
    [disabled, setDisabled] = useState(false);
  const run = (name: string) => () => setResult(`${name} · демонстрация`);
  const items: MenuItem[] = [
    {
      id: 'open',
      label: 'Открыть консоль',
      icon: <Monitor />,
      group: 'Виртуальная машина',
      onSelect: run('Консоль открыта'),
    },
    {
      id: 'copy',
      label: 'Копировать идентификатор',
      icon: <Copy />,
      onSelect: () => {
        navigator.clipboard
          ?.writeText('vm-prod-api-01')
          .then(() => setResult('Идентификатор скопирован'))
          .catch(() => setResult('Копирование недоступно в этом браузере'));
      },
    },
    {
      id: 'power',
      label: 'Питание',
      icon: <Activity />,
      children: [
        {
          id: 'restart',
          label: 'Перезапустить',
          icon: <RefreshCw />,
          onSelect: run('Перезапуск выбран'),
        },
        {
          id: 'stop',
          label: 'Выключить',
          icon: <CircleDot />,
          onSelect: run('Выключение выбрано'),
        },
      ],
    },
    {
      id: 'move',
      label: 'Мигрировать',
      description: 'Нет доступного хоста',
      disabled: true,
      icon: <GitBranch />,
    },
    {
      id: 'delete',
      label: 'Удалить машину',
      danger: true,
      group: 'Опасная зона',
      icon: <Trash2 />,
      onSelect: run('Для удаления потребуется подтверждение'),
    },
  ];
  return (
    <DesignPage
      id="menu"
      description="Действия по контексту: группы, вложенные команды, недоступность с причиной и явное опасное действие."
      rules={[
        [
          'Общие действия',
          'Пункты используют базовую кнопку. Опасное действие отделено и названо явно; меню само не выполняет необратимую операцию.',
        ],
        [
          'Клавиатура',
          'Enter или стрелка открывают меню, стрелки перемещают фокус, Home и End выбирают края. Escape закрывает меню и возвращает фокус.',
        ],
        [
          'Вложенность компактна',
          'Вложенная группа занимает ту же панель с кнопкой Назад. Вправо открывает группу, влево возвращает к родительскому пункту.',
        ],
      ]}
    >
      <Lab
        name="Menu"
        controls={
          <>
            <h3>Операции над ВМ</h3>
            <Switch label="Меню недоступно" checked={disabled} onCheckedChange={setDisabled} />
            <p>
              Недоступное действие объясняет причину. Вложенные команды не занимают ещё одну
              постоянную колонку.
            </p>
          </>
        }
        foot={<span role="status">{result}</span>}
      >
        <Resource>
          <div className="extended-between">
            <Tag tone="success">Работает</Tag>
            <Menu label="Действия с ВМ" items={items} disabled={disabled} />
          </div>
        </Resource>
      </Lab>
      <States>
        <Spec title="Кнопка с подписью">
          <Menu label="Управление ресурсом" items={items} />
        </Spec>
        <Spec title="Иконка в строке">
          <div className="extended-between">
            <span>prod-api-01</span>
            <Menu compact label="Действия prod-api-01" icon={<MoreHorizontal />} items={items} />
          </div>
        </Spec>
        <Spec title="Недоступное меню">
          <Menu label="Действия с ВМ" items={items} disabled />
        </Spec>
        <Spec title="Нет действий">
          <Menu label="Доступные действия" items={[]} />
        </Spec>
        <Spec title="Профиль и выбор настройки">
          <div className="extended-menu-example">
            <Menu
              label="Профиль: Анна Смирнова"
              variant="ghost"
              size="lg"
              align="end"
              triggerContent={
                <span className="extended-menu-profile">
                  <Avatar name="Анна Смирнова" size="sm" />
                  <span>Анна Смирнова</span>
                </span>
              }
              header={
                <span className="extended-menu-identity">
                  <strong>Анна Смирнова</strong>
                  <span>Администратор</span>
                </span>
              }
              items={[
                {
                  id: 'theme',
                  label: 'Тема интерфейса',
                  description: design.theme === 'light' ? 'Светлая' : 'Тёмная',
                  icon: design.theme === 'light' ? <Sun /> : <Moon />,
                  children: [
                    {
                      id: 'light',
                      label: 'Светлая',
                      icon: <Sun />,
                      checked: design.theme === 'light',
                      onSelect: () => design.setTheme('light'),
                    },
                    {
                      id: 'dark',
                      label: 'Тёмная',
                      icon: <Moon />,
                      checked: design.theme === 'dark',
                      onSelect: () => design.setTheme('dark'),
                    },
                  ],
                },
              ]}
            />
            <p>
              Выбранное значение отмечено галочкой. Меню выровнено по правому краю кнопки; вложенный
              выбор остаётся в той же панели.
            </p>
          </div>
        </Spec>
      </States>
    </DesignPage>
  );
}

function MessagePage() {
  const [tone, setTone] = useState<StatusTone>('warning'),
    [dismissible, setDismissible] = useState(true),
    [compact, setCompact] = useState(false),
    [shown, setShown] = useState(true),
    [quota, setQuota] = useState(false);
  return (
    <DesignPage
      id="message"
      description="Контекстная информация рядом с задачей. Сообщение объясняет ситуацию и предлагает следующий шаг."
      rules={[
        [
          'Остаётся рядом с задачей',
          'Message находится в потоке страницы и сохраняется до разрешения причины. Toast сообщает о событии поверх интерфейса.',
        ],
        [
          'Заголовок и следующий шаг',
          'Одна причина, одно понятное действие. Для ошибки отдельного поля используется сообщение этого поля, а не общий баннер.',
        ],
        [
          'Динамическое объявление',
          'Появившаяся ошибка может объявляться немедленно; статические примеры не озвучиваются все одновременно. Закрытие не исправляет причину.',
        ],
      ]}
    >
      <Lab
        name="Message"
        controls={
          <>
            <ToneControl value={tone} onChange={setTone} />
            <Switch label="Можно закрыть" checked={dismissible} onCheckedChange={setDismissible} />
            <Switch label="Компактный вид" checked={compact} onCheckedChange={setCompact} />
            <Button
              size="sm"
              onClick={() => {
                setShown(true);
                setQuota(false);
              }}
            >
              Восстановить сообщение
            </Button>
          </>
        }
      >
        <div className="extended-full">
          {shown ? (
            <Message
              title={quota ? 'Запрос квоты подготовлен' : 'Квота памяти почти исчерпана'}
              tone={quota ? 'success' : tone}
              compact={compact}
              onDismiss={dismissible ? () => setShown(false) : undefined}
              action={
                !compact && !quota
                  ? { label: 'Запросить увеличение', onClick: () => setQuota(true) }
                  : undefined
              }
            >
              {!compact &&
                (quota
                  ? 'Новая квота ожидает согласования.'
                  : 'Свободно 8 GiB из 128 GiB. Для создания машины потребуется 16 GiB.')}
            </Message>
          ) : (
            <div className="extended-empty">
              Сообщение закрыто
              <Button size="sm" onClick={() => setShown(true)}>
                Показать снова
              </Button>
            </div>
          )}
        </div>
      </Lab>
      <States>
        {tones.map((t) => (
          <Spec key={t} title={toneLabel[t]}>
            <Message
              title={
                {
                  neutral: 'Изменение запланировано',
                  info: 'Доступен новый образ',
                  success: 'Резервная копия создана',
                  warning: 'Квота заканчивается',
                  danger: 'Не удалось подключить диск',
                }[t]
              }
              tone={t}
            >
              prod-api-01 · Москва / Production
            </Message>
          </Spec>
        ))}
        <Spec title="Процесс">
          <Message title="Проверяем подключение" tone="info" loading>
            Это может занять несколько секунд.
          </Message>
        </Spec>
        <Spec title="Длинное сообщение" wide>
          <Message
            title="Операция требует внимания администратора"
            tone="warning"
            action={{ label: 'Показать рекомендации', onClick: () => setQuota(true) }}
          >
            Новый хост не соответствует политике размещения. Проверьте доступные сети, класс
            хранилища и совместимость процессора перед повторной миграцией.
          </Message>
        </Spec>
      </States>
    </DesignPage>
  );
}

function ToastPage() {
  const [items, setItems] = useState<ToastItem[]>([]),
    [tone, setTone] = useState<StatusTone>('success'),
    [sticky, setSticky] = useState(false),
    [action, setAction] = useState(false),
    [result, setResult] = useState('Нажмите кнопку, чтобы показать уведомление');
  const serial = useRef(0);
  const dismiss = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const add = (count = 1) => {
    const next = Array.from({ length: count }, () => ({
      id: `toast-${++serial.current}`,
      title: {
        success: 'Снимок создан',
        info: 'Образ обновлён',
        neutral: 'Задача поставлена в очередь',
        warning: 'Недостаточно свободной памяти',
        danger: 'Снимок не создан',
      }[tone],
      description: `prod-api-01 · Операция ${serial.current}`,
      tone,
      duration: sticky || tone === 'danger' || action ? 0 : 6000,
      action: action
        ? {
            label: 'Отменить действие',
            onClick: () => setResult('Демонстрационное действие отменено'),
          }
        : undefined,
    }));
    setItems((prev) => [...prev, ...next]);
  };
  return (
    <DesignPage
      id="toast"
      description="Краткий результат действия вне потока страницы. Уведомление не сдвигает интерфейс и не перехватывает фокус."
      rules={[
        [
          'Ограниченная очередь',
          'Одновременно видны до трёх уведомлений. Остальные ждут; их время начинается после появления на экране.',
        ],
        [
          'Время под контролем',
          'Обычный результат виден 6 секунд. Наведение, фокус внутри и скрытая вкладка приостанавливают таймер. Ошибка и действие требуют явного закрытия.',
        ],
        [
          'Сообщение без отвлечения',
          'Объявляется новый результат, фокус остаётся у пользователя. Критичная причина также должна быть доступна в контексте задачи.',
        ],
      ]}
    >
      <Lab
        name="Toast"
        controls={
          <>
            <ToneControl value={tone} onChange={setTone} />
            <Switch
              label="Не закрывать автоматически"
              checked={sticky}
              onCheckedChange={setSticky}
            />
            <Switch label="Действие отмены" checked={action} onCheckedChange={setAction} />
            <Button size="sm" onClick={() => add(4)}>
              Показать очередь из четырёх
            </Button>
            <Button size="sm" variant="ghost" disabled={!items.length} onClick={() => setItems([])}>
              Закрыть все
            </Button>
          </>
        }
        foot={<span role="status">{result}</span>}
      >
        <div className="toast-example">
          <div className="toast-example__glyph">
            <Cloud />
            <Bell />
          </div>
          <h3>Результат, который не мешает</h3>
          <p>Появится в правом нижнем углу</p>
          <Button variant="primary" leadingIcon={<Bell />} onClick={() => add()}>
            Показать уведомление
          </Button>
        </div>
      </Lab>
      <States>
        <Spec title="Успех">
          <Message
            className="basis-toast"
            title="Снимок создан"
            tone="success"
            onDismiss={noChange}
          >
            prod-api-01 · 4,2 GiB
          </Message>
        </Spec>
        <Spec title="Ошибка · остаётся на экране">
          <Message
            className="basis-toast"
            title="Не удалось создать снимок"
            tone="danger"
            onDismiss={noChange}
          >
            Проверьте доступное место.
          </Message>
        </Spec>
        <Spec title="С действием">
          <Message
            className="basis-toast"
            title="Метка удалена"
            tone="neutral"
            onDismiss={noChange}
            action={{ label: 'Вернуть', onClick: () => setResult('Метка возвращена') }}
          >
            Изменение можно отменить.
          </Message>
        </Spec>
        <Spec title="Долгая операция">
          <Message
            className="basis-toast"
            title="Создаём резервную копию"
            loading
            tone="info"
            onDismiss={noChange}
          >
            Ход задачи доступен в журнале.
          </Message>
        </Spec>
      </States>
      <ToastRegion items={items} onDismiss={dismiss} />
    </DesignPage>
  );
}

function BadgePage() {
  const [count, setCount] = useState(12),
    [tone, setTone] = useState<StatusTone>('info'),
    [dot, setDot] = useState(false),
    [showZero, setShowZero] = useState(false);
  return (
    <DesignPage
      id="badge"
      description="Небольшой сигнал о количестве или новых событиях. Счётчик дополняет объект, а не заменяет его подпись."
      rules={[
        [
          'Количество или факт',
          'Цифра отвечает на вопрос «сколько», точка — «есть новое». Для текстовой характеристики используем Tag.',
        ],
        [
          'Полное число сохраняется',
          '99+ ограничивает визуальную длину; доступное имя содержит реальное количество. Ноль скрыт, если его показ не включён явно.',
        ],
        [
          'Не перекрывать действие',
          'Накладной Badge не перехватывает нажатия. Доступное имя кнопки должно объяснять, что именно считается.',
        ],
      ]}
    >
      <Lab
        name="Badge"
        controls={
          <>
            <ToneControl value={tone} onChange={setTone} />
            <Input
              label="Количество"
              type="number"
              min={0}
              value={count}
              onChange={(e) => setCount(Math.max(0, Number(e.target.value)))}
            />
            <Switch label="Точка без числа" checked={dot} onCheckedChange={setDot} />
            <Switch label="Показывать ноль" checked={showZero} onCheckedChange={setShowZero} />
          </>
        }
      >
        <Resource title="Операционный центр">
          <div className="badge-example">
            <Badge
              count={count}
              tone={tone}
              dot={dot}
              showZero={showZero}
              label={dot ? 'Есть новые события' : `${count} новых событий`}
            >
              <IconButton
                icon={<Bell />}
                aria-label={`Открыть события: ${count}`}
                onClick={() => setCount(0)}
              />
            </Badge>
            <span>События инфраструктуры</span>
            <Badge count={count} tone={tone} dot={dot} showZero={showZero} />
          </div>
        </Resource>
      </Lab>
      <States>
        <Spec title="Шкала значений">
          <div className="wrap">
            {[0, 1, 12, 99, 140].map((n) => (
              <Badge key={n} count={n} showZero />
            ))}
          </div>
        </Spec>
        <Spec title="Смысловые тона">
          <div className="wrap">
            {tones.map((t) => (
              <Badge key={t} count={8} tone={t} />
            ))}
          </div>
        </Spec>
        <Spec title="Точка">
          <div className="wrap">
            {tones.map((t) => (
              <Badge key={t} dot tone={t} label={`${toneLabel[t]}: есть новое`} />
            ))}
          </div>
        </Spec>
        <Spec title="В строке объекта">
          <div className="extended-between">
            <span>Активные задачи</span>
            <Badge count={4} tone="neutral" />
          </div>
        </Spec>
      </States>
    </DesignPage>
  );
}

function ChipPage() {
  const [selected, setSelected] = useState(['Production']),
    [filters, setFilters] = useState(['Статус: работает', 'CPU ≥ 40 %']),
    [disabled, setDisabled] = useState(false);
  return (
    <DesignPage
      id="chip"
      description="Компактный интерактивный выбор и видимое условие фильтра. Выбор и удаление имеют разные зоны действия."
      rules={[
        [
          'Выбор имеет состояние',
          'Переключаемый Chip использует aria-pressed. Нажатие повторно снимает выбор; несколько чипов могут быть выбраны одновременно.',
        ],
        [
          'Удаление — отдельное действие',
          'Текст описывает условие, крестик снимает его. Если нужно редактирование по нажатию, оно задаётся отдельно. Вложенных кнопок нет.',
        ],
        [
          'Не заменять всё чипами',
          'Для статичной характеристики используем Tag, для единственного основного действия — Button. Набор фильтров должен оставаться обозримым.',
        ],
      ]}
    >
      <Lab
        name="Chip"
        controls={
          <>
            <h3>Окружения и условия</h3>
            <Switch label="Недоступно" checked={disabled} onCheckedChange={setDisabled} />
            <Button
              size="sm"
              onClick={() => {
                setSelected(['Production']);
                setFilters(['Статус: работает', 'CPU ≥ 40 %']);
              }}
            >
              Восстановить пример
            </Button>
            <p>Выбрано окружений: {selected.length}</p>
          </>
        }
      >
        <Resource title="Фильтры ресурсов">
          <span className="extended-label">Окружение</span>
          <div className="wrap">
            {['Production', 'Staging', 'Development'].map((v) => (
              <Chip
                key={v}
                selected={selected.includes(v)}
                disabled={disabled}
                onSelectedChange={(checked) =>
                  setSelected(checked ? [...selected, v] : selected.filter((s) => s !== v))
                }
              >
                {v}
              </Chip>
            ))}
          </div>
          <span className="extended-label">Применённые условия</span>
          <div className="wrap">
            {filters.map((v) => (
              <Chip
                key={v}
                selected
                disabled={disabled}
                onRemove={() => setFilters(filters.filter((f) => f !== v))}
              >
                {v}
              </Chip>
            ))}
            {!filters.length && <small>Условия сняты</small>}
          </div>
        </Resource>
      </Lab>
      <States>
        <Spec title="Обычный / выбранный">
          <div className="wrap">
            <Chip onSelectedChange={noChange}>Production</Chip>
            <Chip selected onSelectedChange={noChange}>
              Staging
            </Chip>
          </div>
        </Spec>
        <Spec title="С иконкой">
          <Chip icon={<MapPin />} onSelectedChange={noChange}>
            Москва
          </Chip>
        </Spec>
        <Spec title="Условие с удалением">
          <Chip selected onRemove={noChange}>
            RAM ≥ 16 GiB
          </Chip>
        </Spec>
        <Spec title="Недоступные">
          <div className="wrap">
            <Chip disabled onSelectedChange={noChange}>
              Production
            </Chip>
            <Chip selected disabled onRemove={noChange}>
              Политика: строго
            </Chip>
          </div>
        </Spec>
      </States>
    </DesignPage>
  );
}

const members = [
  { name: 'Анна Смирнова' },
  { name: 'Дмитрий Волков' },
  { name: 'Мария Кузнецова' },
  { name: 'Илья Соколов' },
  { name: 'Олег Орлов' },
  { name: 'Елена Миронова' },
];
function AvatarPage() {
  const [size, setSize] = useState<'sm' | 'md' | 'lg'>('md'),
    [shape, setShape] = useState<'round' | 'square'>('round'),
    [status, setStatus] = useState<'online' | 'offline' | 'busy'>('online'),
    [name, setName] = useState('Анна Смирнова');
  return (
    <DesignPage
      id="avatar"
      description="Узнаваемый владелец ресурса: изображение, инициалы или служебная иконка, с отдельным индикатором присутствия."
      rules={[
        [
          'Узнаваемость важнее декора',
          'Имя остаётся доступным независимо от изображения. При ошибке загрузки показываются инициалы, при пустом имени — иконка пользователя.',
        ],
        [
          'Размер подчиняется контексту',
          'S — плотная строка, M — список владельцев, L — карточка профиля. Круглая форма для людей, скруглённый квадрат — для организаций и сервисов.',
        ],
        [
          'Группа не теряет участников',
          'Перекрытие ограничено. Остаток отображается как +N с полным списком имён; цвет присутствия дополняется доступной подписью.',
        ],
      ]}
    >
      <Lab
        name="Avatar"
        controls={
          <>
            <Input label="Имя" value={name} onChange={(e) => setName(e.target.value)} />
            <Select
              label="Размер"
              value={size}
              onValueChange={setSize}
              options={[
                { value: 'sm', label: 'S · 32 px' },
                { value: 'md', label: 'M · 44 px' },
                { value: 'lg', label: 'L · 64 px' },
              ]}
            />
            <Select
              label="Форма"
              value={shape}
              onValueChange={setShape}
              options={[
                { value: 'round', label: 'Круглая' },
                { value: 'square', label: 'Скруглённый квадрат' },
              ]}
            />
            <Select
              label="Присутствие"
              value={status}
              onValueChange={setStatus}
              options={[
                { value: 'online', label: 'В сети' },
                { value: 'offline', label: 'Не в сети' },
                { value: 'busy', label: 'Не беспокоить' },
              ]}
            />
          </>
        }
      >
        <Resource>
          <div className="owner-example">
            <Avatar name={name} size={size} shape={shape} status={status} />
            <div>
              <strong>{name || 'Пользователь'}</strong>
              <small>Владелец · инженер платформы</small>
            </div>
          </div>
          <span className="extended-label">Команда проекта</span>
          <AvatarGroup members={members} />
        </Resource>
      </Lab>
      <States>
        <Spec title="Размеры">
          <div className="wrap">
            <Avatar name="Анна Смирнова" size="sm" />
            <Avatar name="Дмитрий Волков" />
            <Avatar name="Мария Кузнецова" size="lg" />
          </div>
        </Spec>
        <Spec title="Инициалы и запасной вариант">
          <div className="wrap">
            <Avatar name="Илья" />
            <Avatar name="" />
            <Avatar name="Анна Смирнова" src="data:image/png;base64,invalid" />
          </div>
        </Spec>
        <Spec title="Сервисы">
          <div className="wrap">
            <Avatar name="BASIS" shape="square" icon={<Cloud />} />
            <Avatar name="База данных" shape="square" tone="success" icon={<Database />} />
            <Avatar name="Команда платформы" shape="square" tone="neutral" icon={<Users />} />
          </div>
        </Spec>
        <Spec title="Присутствие">
          <div className="wrap">
            <Avatar name="Анна Смирнова" status="online" />
            <Avatar name="Дмитрий Волков" status="offline" />
            <Avatar name="Мария Кузнецова" status="busy" />
          </div>
        </Spec>
        <Spec title="Группа с переполнением">
          <AvatarGroup members={members} max={3} />
        </Spec>
      </States>
    </DesignPage>
  );
}

export function ExtendedPages({ page }: { page: ExtendedPage }) {
  const pages = {
    'cascade-select': CascadePage,
    radio: RadioPage,
    'code-input': CodePage,
    tag: TagPage,
    'input-tag': InputTagPage,
    'input-mask': MaskPage,
    accordion: AccordionPage,
    breadcrumb: BreadcrumbPage,
    menu: MenuPage,
    message: MessagePage,
    toast: ToastPage,
    badge: BadgePage,
    chip: ChipPage,
    avatar: AvatarPage,
  };
  const Component = pages[page];
  return <Component />;
}
