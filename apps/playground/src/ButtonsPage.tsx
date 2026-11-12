import { useDesign } from './DesignContext';
import { ComponentTokens } from './TokenPanel';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  HardDrive,
  Info,
  LayoutGrid,
  List,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Server,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  Button,
  ButtonGroup,
  CloudLoader,
  IconButton,
  SplitButton,
  Tooltip,
  type ButtonSize,
  type ButtonVariant,
  type ButtonTone,
  type LoaderVariant,
} from '@basis/ui';
import { PageHeading, SectionHeading } from './PageParts';
import { useOperation, type Scenario } from './useOperation';

const variants: {
  value: ButtonVariant;
  name: string;
  label: string;
  icon?: ReactNode;
  hint: string;
}[] = [
  {
    value: 'primary',
    name: 'Основная',
    label: 'Создать',
    icon: <Plus />,
    hint: 'Главное действие',
  },
  {
    value: 'secondary',
    name: 'Вторичная',
    label: 'Настроить',
    icon: <Settings2 />,
    hint: 'Обычные действия',
  },
  {
    value: 'tonal',
    name: 'Акцентная',
    label: 'Открыть',
    icon: <ArrowUpRight />,
    hint: 'Контекстный акцент',
  },
  { value: 'ghost', name: 'Тихая', label: 'Подробнее', hint: 'Внутри интерфейса' },
];
const tones: {
  value: ButtonTone;
  name: string;
  action: string;
  busy: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    value: 'brand',
    name: 'Брендовый',
    action: 'Создать ВМ',
    busy: 'Создаём ВМ',
    hint: 'Основной поток работы',
    icon: <Plus />,
  },
  {
    value: 'neutral',
    name: 'Нейтральный',
    action: 'Сохранить',
    busy: 'Сохраняем',
    hint: 'Без смыслового акцента',
    icon: <Settings2 />,
  },
  {
    value: 'success',
    name: 'Успех',
    action: 'Подтвердить',
    busy: 'Подтверждаем',
    hint: 'Одобрение и позитивное действие',
    icon: <Check />,
  },
  {
    value: 'warning',
    name: 'Внимание',
    action: 'Перезапустить',
    busy: 'Перезапускаем',
    hint: 'Действие требует внимания',
    icon: <RefreshCw />,
  },
  {
    value: 'danger',
    name: 'Опасность',
    action: 'Удалить',
    busy: 'Удаляем',
    hint: 'Деструктивное действие',
    icon: <Trash2 />,
  },
  {
    value: 'info',
    name: 'Информация',
    action: 'Проверить',
    busy: 'Проверяем',
    hint: 'Диагностика и информация',
    icon: <Info />,
  },
];
type Content = 'leading' | 'text' | 'trailing' | 'both' | 'icon';
const stored = () => {
  try {
    return JSON.parse(localStorage.getItem('basis.button-playground') || '{}') as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
};

export function ButtonsPage() {
  const design = useDesign();
  const liveButton = useRef<HTMLButtonElement>(null);
  const [saved] = useState(stored),
    [variant, setVariant] = useState<ButtonVariant>(
      variants.some((v) => v.value === saved.variant)
        ? (saved.variant as ButtonVariant)
        : 'primary',
    );
  const [size, setSize] = useState<ButtonSize>(
    ['sm', 'md', 'lg'].includes(saved.size) ? (saved.size as ButtonSize) : 'md',
  );
  const [tone, setTone] = useState<ButtonTone>(
    tones.some((item) => item.value === saved.tone)
      ? (saved.tone as ButtonTone)
      : saved.variant === 'danger'
        ? 'danger'
        : 'brand',
  );
  const currentTone = tones.find((item) => item.value === tone)!;
  const [content, setContent] = useState<Content>(
    ['leading', 'text', 'trailing', 'both', 'icon'].includes(saved.content)
      ? (saved.content as Content)
      : 'leading',
  );
  const [loader, setLoader] = useState<LoaderVariant>(
    ['cloud', 'orbit', 'dots'].includes(saved.loader) ? (saved.loader as LoaderVariant) : 'cloud',
  );
  const [scenario, setScenario] = useState<Scenario>('success'),
    [disabled, setDisabled] = useState(false),
    [view, setView] = useState('list');
  const [split, setSplit] = useState('vm'),
    [event, setEvent] = useState(''),
    [dialogOpen, setDialogOpen] = useState(false),
    [deleted, setDeleted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    operation = useOperation(scenario),
    busy = operation.phase === 'loading';
  useEffect(() => {
    try {
      localStorage.setItem(
        'basis.button-playground',
        JSON.stringify({ variant, tone, size, content, loader }),
      );
    } catch {
      /* The playground also works with storage disabled. */
    }
  }, [variant, tone, size, content, loader]);
  useEffect(() => {
    if (dialogOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [dialogOpen]);
  const changeScenario = (value: Scenario) => {
    operation.reset();
    setScenario(value);
  };
  const label =
    operation.phase === 'success'
      ? 'Готово'
      : operation.phase === 'error'
        ? 'Повторить'
        : currentTone.action;
  const icon =
    operation.phase === 'success' ? (
      <Check />
    ) : operation.phase === 'error' ? (
      <RefreshCw />
    ) : (
      currentTone.icon
    );
  const phaseLabel = {
    idle: 'Готова к действию',
    loading: scenario === 'progress' ? 'Загрузка образа' : 'Подготавливаем ресурсы',
    success: 'Операция завершена',
    error: 'Не удалось создать ВМ. Можно повторить.',
    cancelled: 'Операция отменена',
  }[operation.phase];
  const feedback =
    operation.phase === 'success' || operation.phase === 'error' ? operation.phase : undefined;
  const liveProps = {
    ref: liveButton,
    variant,
    tone,
    size,
    disabled,
    loading: busy,
    loader,
    progress: scenario === 'progress' ? operation.progress : undefined,
    feedback,
    onClick: operation.run,
    className: 'live-action',
  };
  return (
    <>
      <PageHeading
        category="Базовый компонент / Button"
        title="Кнопки"
        description="Чёткий силуэт, спокойный объём и точный отклик. Цвет задаёт иерархию, движение сообщает о работе."
      >
        <Button
          size="sm"
          leadingIcon={<Settings2 />}
          onClick={() => design.openComponent('button')}
        >
          Токены компонента
        </Button>
      </PageHeading>
      <section className="live-lab" aria-label="Интерактивный образец кнопки">
        <div className="live-stage">
          <div className="stage-top">
            <span>
              <span className="live-dot" />
              Живой образец
            </span>
            <span>
              {size.toUpperCase()} · {{ sm: 32, md: 36, lg: 44 }[size]} px
            </span>
          </div>
          <div className="live-action-zone">
            <div className="button-orbit" aria-hidden="true" />
            {content === 'icon' ? (
              <IconButton {...liveProps} aria-label={busy ? currentTone.busy : label} icon={icon} />
            ) : (
              <Button
                {...liveProps}
                loadingLabel={
                  content === 'text'
                    ? undefined
                    : scenario === 'progress'
                      ? `Выполняем · ${String(operation.progress).padStart(3, '\u2007')}%`
                      : currentTone.busy
                }
                leadingIcon={['leading', 'both'].includes(content) ? icon : undefined}
                trailingIcon={['trailing', 'both'].includes(content) ? <ArrowRight /> : undefined}
              >
                {label}
              </Button>
            )}
            <div className="cancel-slot">
              <Button
                size="sm"
                variant="ghost"
                style={{ visibility: busy ? 'visible' : 'hidden' }}
                disabled={!busy}
                onClick={() => {
                  operation.cancel();
                  liveButton.current?.focus({ preventScroll: true });
                }}
              >
                Отменить
              </Button>
            </div>
          </div>
          <div className="stage-bottom">
            {busy && scenario === 'progress' && (
              <span
                className="basis-visually-hidden"
                role="progressbar"
                aria-label="Выполнение действия"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={operation.progress}
              />
            )}
            <span className={`operation-status ${operation.phase}`} role="status">
              {operation.phase === 'success' ? (
                <Check size={14} />
              ) : operation.phase === 'error' ? (
                <Info size={14} />
              ) : (
                <span className="status-dot" />
              )}
              {disabled ? 'Недоступна · недостаточно прав' : phaseLabel}
            </span>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Сбросить пример"
              icon={<RotateCcw />}
              onClick={operation.reset}
            />
          </div>
        </div>
        <div className="lab-settings">
          <div className="settings-title">
            Настройка образца<span>Button</span>
          </div>
          <fieldset disabled={busy}>
            <label>
              Иерархия
              <select
                value={variant}
                onChange={(e) => {
                  setVariant(e.target.value as ButtonVariant);
                  operation.reset();
                }}
              >
                {variants.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Тон
              <select
                aria-label="Тон кнопки"
                value={tone}
                onChange={(event) => {
                  setTone(event.target.value as ButtonTone);
                  operation.reset();
                }}
              >
                {tones.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Содержимое
              <select value={content} onChange={(e) => setContent(e.target.value as Content)}>
                <option value="leading">Иконка слева</option>
                <option value="text">Только текст</option>
                <option value="trailing">Иконка справа</option>
                <option value="both">Две иконки</option>
                <option value="icon">Только иконка</option>
              </select>
            </label>
            <label>
              Размер
              <select value={size} onChange={(e) => setSize(e.target.value as ButtonSize)}>
                <option value="sm">S · 32 px</option>
                <option value="md">M · 36 px</option>
                <option value="lg">L · 44 px</option>
              </select>
            </label>
            <label>
              После нажатия
              <select value={scenario} onChange={(e) => changeScenario(e.target.value as Scenario)}>
                <option value="success">Успешная операция</option>
                <option value="error">Ошибка → повтор</option>
                <option value="progress">Измеримый прогресс</option>
                <option value="long">Долгая операция</option>
              </select>
            </label>
          </fieldset>
          <div className="settings-bottom">
            <label className="check-field">
              <input
                type="checkbox"
                checked={disabled}
                disabled={busy}
                onChange={(e) => setDisabled(e.target.checked)}
              />
              Недоступна
            </label>
            <span>
              Запросов: <strong data-testid="request-count">{operation.requests}</strong>
            </span>
          </div>
        </div>
      </section>
      <div className="compact-principles">
        <span>
          <ShieldCheck size={14} />
          Повторное нажатие защищено
        </span>
        <span>
          <LayersIcon />
          Размер сохраняется при загрузке
        </span>
        <span>
          <Info size={14} />
          Фокус остаётся на кнопке
        </span>
      </div>

      <section className="ds-section">
        <SectionHeading number="01" title="Иерархия и смысловой тон" note="Две независимые оси" />
        <p className="foundation-note">
          Иерархия отвечает за силу действия, тон — за его смысл. Успех операции после нажатия —
          отдельное состояние обратной связи. Выберите образец, чтобы изучить его состояния ниже.
        </p>
        <div className="matrix-scroll tone-matrix-scroll">
          <table className="tone-matrix">
            <thead>
              <tr>
                <th>Тон</th>
                {variants.map((v) => (
                  <th key={v.value}>{v.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tones.map((item) => (
                <tr key={item.value} data-active={tone === item.value}>
                  <th scope="row">
                    <strong>{item.name}</strong>
                    <small>{item.hint}</small>
                  </th>
                  {variants.map((v) => (
                    <td key={v.value}>
                      <Button
                        variant={v.value}
                        tone={item.value}
                        leadingIcon={item.icon}
                        onClick={() => {
                          setTone(item.value);
                          setVariant(v.value);
                          operation.reset();
                        }}
                        aria-label={`${item.name} · ${v.name}`}
                      >
                        {item.action}
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="02"
          title={`Состояния · ${currentTone.name}`}
          note="M / 36 px · выбранный тон"
        />
        <div className="tone-state-picker">
          <span>Смысловой тон</span>
          <ButtonGroup aria-label="Тон матрицы состояний">
            {tones.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant="ghost"
                tone={item.value}
                aria-pressed={tone === item.value}
                onClick={() => {
                  setTone(item.value);
                  operation.reset();
                }}
              >
                {item.name}
              </Button>
            ))}
          </ButtonGroup>
        </div>
        <div className="matrix-scroll">
          <table className="state-matrix">
            <thead>
              <tr>
                <th>Иерархия</th>
                {['Обычная', 'Наведение', 'Нажатие', 'Фокус', 'Недоступна', 'Загрузка'].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.value}>
                  <th scope="row">
                    <strong>{v.name}</strong>
                    <small>{v.hint}</small>
                  </th>
                  {['default', 'hover', 'pressed', 'focus', 'disabled', 'loading'].map((state) => (
                    <td key={state}>
                      <Button
                        variant={v.value}
                        tone={tone}
                        leadingIcon={currentTone.icon}
                        disabled={state === 'disabled'}
                        loading={state === 'loading'}
                        loader={loader}
                        data-preview-state={state}
                        tabIndex={-1}
                        aria-label={`${v.name}: ${state}`}
                        onClick={() => setVariant(v.value)}
                      >
                        {currentTone.action}
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="03" title="Облако в движении" note="Выберите характер индикатора" />
        <div className="loader-options">
          {(
            [
              {
                value: 'cloud',
                name: 'Облачный пульс',
                hint: 'Подготовка и запуск ресурсов',
                tag: 'Основной',
              },
              { value: 'orbit', name: 'Орбита', hint: 'Фоновые операции', tag: 'Альтернатива' },
              { value: 'dots', name: 'Поток', hint: 'Короткое ожидание', tag: 'Нейтральный' },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              className="loader-option"
              aria-pressed={loader === item.value}
              onClick={() => setLoader(item.value)}
            >
              <span className="loader-preview">
                <span className="loader-preview-dark">
                  <CloudLoader variant={item.value} />
                </span>
                <span className="loader-preview-light">
                  <CloudLoader variant={item.value} />
                </span>
              </span>
              <span className="loader-copy">
                <strong>{item.name}</strong>
                <small>{item.hint}</small>
              </span>
              <span className="loader-option-mark">
                {loader === item.value ? <Check size={15} /> : <span />}
              </span>
            </button>
          ))}
        </div>
        <div className="motion-note">
          <span>
            1 200 ms <span className="note-dot">·</span> без изменения геометрии
          </span>
          <span>Системное уменьшение движения учитывается автоматически</span>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="04"
          title="Содержимое и композиции"
          note="Та же кнопка · разные задачи"
        />
        <div className="composition-grid">
          <Example title="Только текст" note="Действие понятно из подписи">
            <Button onClick={() => setEvent('Изменения сохранены')}>Сохранить</Button>
          </Example>
          <Example title="Иконка слева" note="Быстрое распознавание действия">
            <Button leadingIcon={<Plus />} onClick={() => setEvent('Создание виртуальной машины')}>
              Создать ВМ
            </Button>
          </Example>
          <Example title="Иконка справа" note="Переход к следующему шагу">
            <Button trailingIcon={<ArrowRight />} onClick={() => setEvent('Открыт следующий шаг')}>
              Продолжить
            </Button>
          </Example>
          <Example title="Только иконка" note="Подпись и подсказка по фокусу">
            <div className="inline-buttons">
              <Tooltip content="Обновить список">
                <IconButton
                  icon={<RefreshCw />}
                  aria-label="Обновить список"
                  onClick={() => setEvent('Список обновлён')}
                />
              </Tooltip>
              <Tooltip content="Настроить столбцы">
                <IconButton
                  icon={<Settings2 />}
                  aria-label="Настроить столбцы"
                  onClick={() => setEvent('Настройка столбцов')}
                />
              </Tooltip>
              <Tooltip content="Копировать идентификатор">
                <IconButton
                  icon={<Copy />}
                  aria-label="Копировать идентификатор"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText('vm-demo-01');
                      setEvent('Идентификатор vm-demo-01 скопирован');
                    } catch {
                      setEvent('Идентификатор для копирования: vm-demo-01');
                    }
                  }}
                />
              </Tooltip>
            </div>
          </Example>
          <Example title="Составная кнопка" note="Главное действие и выбор типа">
            <SplitButton
              value={split}
              onValueChange={setSplit}
              onAction={(id) =>
                setEvent(
                  `Создание: ${{ vm: 'виртуальная машина', disk: 'диск', network: 'сеть' }[id as 'vm' | 'disk' | 'network']}`,
                )
              }
              actions={[
                { id: 'vm', label: 'Создать ВМ', icon: <Server /> },
                { id: 'disk', label: 'Создать диск', icon: <HardDrive /> },
                { id: 'network', label: 'Создать сеть', icon: <Network /> },
              ]}
            />
          </Example>
          <Example title="Выбор режима" note="Один выбранный режим">
            <ButtonGroup aria-label="Вид ресурсов">
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<List />}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                Список
              </Button>
              <IconButton
                size="sm"
                variant="ghost"
                icon={<LayoutGrid />}
                aria-label="Плитки"
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              />
            </ButtonGroup>
          </Example>
        </div>
        <div className="example-feedback" role="status">
          {event || 'Попробуйте кнопки — результат появится здесь.'}
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="05" title="Размеры и плотный интерфейс" note="32 / 36 / 44 px" />
        <div className="sizes-and-danger">
          <div className="size-examples">
            {(
              [
                { size: 'sm', label: 'S', hint: '32 px · таблицы' },
                { size: 'md', label: 'M', hint: '36 px · основной' },
                { size: 'lg', label: 'L', hint: '44 px · крупные действия' },
              ] as const
            ).map((item) => (
              <div key={item.size}>
                <span>{item.hint}</span>
                <Button
                  size={item.size}
                  variant="primary"
                  leadingIcon={<Plus />}
                  onClick={() => setSize(item.size)}
                >
                  Создать ВМ
                </Button>
                <small>
                  {item.label} · иконка {{ sm: 14, md: 16, lg: 20 }[item.size]} px
                </small>
              </div>
            ))}
          </div>
          <div className="danger-example">
            <span>Критичное действие</span>
            <Button
              variant="danger"
              leadingIcon={<Trash2 />}
              onClick={() => {
                setDeleted(false);
                setDialogOpen(true);
              }}
            >
              Удалить ВМ
            </Button>
            <small>{deleted ? 'Демонстрационная ВМ удалена' : 'С отдельным подтверждением'}</small>
          </div>
        </div>
        <a className="composition-link" href="#table">
          <span>
            <TableGlyph />
            <strong>Проверить кнопки в таблице</strong>
            <small>Сортировка, действия строк и массовый выбор</small>
          </span>
          <ArrowUpRight size={18} />
        </a>
      </section>
      <section className="ds-section" id="button-api">
        <SectionHeading number="06" title="Параметры дизайна" note="Связи и значения" />
        <ComponentTokens component="button" />
        <div className="contract-row">
          <span>
            <kbd>Tab</kbd> фокус
          </span>
          <span>
            <kbd>Enter</kbd>
            <kbd>Space</kbd> активация
          </span>
          <span>Недоступная кнопка пропускается при Tab</span>
          <span>При загрузке фокус сохраняется</span>
        </div>
      </section>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
        onCancel={() => setDialogOpen(false)}
      >
        <div className="dialog-top">
          <span className="danger-icon">
            <Trash2 size={20} />
          </span>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Закрыть подтверждение"
            icon={<X />}
            onClick={() => setDialogOpen(false)}
          />
        </div>
        <h2 id="delete-title">Удалить виртуальную машину?</h2>
        <p id="delete-description">
          <strong>vm-demo-01</strong> и её системный диск будут удалены. Это демонстрация поведения
          кнопки.
        </p>
        <div className="dialog-actions">
          <Button autoFocus onClick={() => setDialogOpen(false)}>
            Отмена
          </Button>
          <Button
            variant="danger"
            leadingIcon={<Trash2 />}
            onClick={() => {
              setDeleted(true);
              setDialogOpen(false);
            }}
          >
            Удалить ВМ
          </Button>
        </div>
      </dialog>
    </>
  );
}
function Example({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="composition-example">
      <h3>{title}</h3>
      <div className="composition-control">{children}</div>
      <p>{note}</p>
    </div>
  );
}
function LayersIcon() {
  return (
    <span className="mini-dimension" aria-hidden="true">
      ↔
    </span>
  );
}
function TableGlyph() {
  return <List size={18} />;
}
