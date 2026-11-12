import { useState } from 'react';
import { Check, HardDrive, Layers3, SlidersHorizontal, Table2 } from 'lucide-react';
import { Button, ButtonGroup, StatusBadge, TableSelect, Tooltip, type DataColumn } from '@basis/ui';
import { PageHeading, SectionHeading } from './PageParts';
import { ComponentTokens } from './TokenPanel';
import { useDesign } from './DesignContext';

type Disk = { id: string; name: string; size: number; tier: 'NVMe' | 'SSD' | 'HDD'; busy: boolean };
const disks: Disk[] = [
  { id: 'd1', name: 'disk-app-01', size: 120, tier: 'NVMe', busy: false },
  { id: 'd2', name: 'disk-app-02', size: 240, tier: 'NVMe', busy: false },
  { id: 'd3', name: 'disk-logs-01', size: 80, tier: 'SSD', busy: false },
  { id: 'd4', name: 'disk-database-01', size: 512, tier: 'NVMe', busy: true },
  { id: 'd5', name: 'disk-backup-01', size: 1024, tier: 'HDD', busy: false },
  { id: 'd6', name: 'disk-cache-01', size: 64, tier: 'SSD', busy: false },
  { id: 'd7', name: 'disk-archive-regional-production-01', size: 2048, tier: 'HDD', busy: false },
];
const columns: DataColumn<Disk>[] = [
  {
    id: 'name',
    header: 'Имя диска',
    width: 224,
    sortable: true,
    description: 'Название диска в проекте. Выбор доступен только для свободных дисков.',
    render: (row) => (
      <span className="picker-resource-name" title={row.name}>
        <HardDrive size={16} />
        <span>{row.name}</span>
      </span>
    ),
  },
  {
    id: 'size',
    header: 'Объём',
    width: 128,
    align: 'right',
    sortable: true,
    description: 'Полный объём диска в гибибайтах.',
    render: (row) => (
      <span className="numeric">
        {row.size.toLocaleString('ru')} <span className="unit">GiB</span>
      </span>
    ),
  },
  {
    id: 'tier',
    header: 'Тип',
    width: 112,
    sortable: true,
    description: 'Класс носителя: NVMe, SSD или HDD.',
    render: (row) => <span className="picker-storage-type">{row.tier}</span>,
  },
  {
    id: 'busy',
    header: 'Доступность',
    width: 160,
    description: 'Подключённые диски видны для контекста, но недоступны для выбора.',
    render: (row) => (
      <StatusBadge tone={row.busy ? 'warning' : 'success'} subtle>
        {row.busy ? 'Подключён' : 'Свободен'}
      </StatusBadge>
    ),
  },
];
const source = {
  rows: disks,
  columns,
  getRowId: (row: Disk) => row.id,
  getRowLabel: (row: Disk) => row.name,
  searchText: (row: Disk) => `${row.name} ${row.tier} ${row.busy ? 'Подключён' : 'Свободен'}`,
  getSortValue: (row: Disk, column: string) =>
    column === 'size' ? row.size : column === 'tier' ? row.tier : row.name,
  isRowSelectable: (row: Disk) => !row.busy,
};
export function TableSelectPage() {
  const design = useDesign(),
    [value, setValue] = useState(['d1', 'd3']),
    [multiple, setMultiple] = useState(true),
    [single, setSingle] = useState<string[]>([]),
    [errorValue, setErrorValue] = useState<string[]>([]);
  const selected = disks.filter((disk) => value.includes(disk.id));
  return (
    <>
      <PageHeading
        category="Составной компонент / TableSelect"
        title="Табличный выбор"
        description="Когда одного названия недостаточно. Сравните характеристики ресурсов и выберите нужные, сохраняя контекст задачи."
      >
        <Button
          size="sm"
          leadingIcon={<SlidersHorizontal />}
          onClick={() => design.openComponent('table-select')}
        >
          Токены компонента
        </Button>
      </PageHeading>
      <section className="component-lab">
        <div className="specimen-stage">
          <div className="stage-top">
            <span>
              <i className="live-dot" />
              Живой образец
            </span>
            <span>Поле + таблица + выбор</span>
          </div>
          <div className="specimen-stage__content">
            <div className="field-demo table-select-demo">
              <div className="resource-heading">
                <HardDrive />
                <div>
                  <strong>Подключение дисков</strong>
                  <span>vm-production-01 / Production</span>
                </div>
              </div>
              <TableSelect
                {...source}
                value={value}
                onValueChange={setValue}
                label={multiple ? 'Диски для подключения' : 'Диск для подключения'}
                title="Выбор дисков"
                multiple={multiple}
                hint="Сравните объём, тип и доступность перед подключением."
              />
              <div className="picker-selection-summary">
                <span>
                  Ресурсов: <strong>{selected.length}</strong>
                </span>
                <span>
                  Объём:{' '}
                  <strong>
                    {selected.reduce((sum, disk) => sum + disk.size, 0).toLocaleString('ru')} GiB
                  </strong>
                </span>
              </div>
              {selected.length > 0 && (
                <div className="picker-selected-items">
                  {selected.slice(0, 3).map((disk) => (
                    <Tooltip
                      key={disk.id}
                      content={`${disk.name} · ${disk.size} GiB · ${disk.tier}`}
                    >
                      <span tabIndex={0}>
                        <Check size={12} />
                        {disk.name}
                      </span>
                    </Tooltip>
                  ))}
                  {selected.length > 3 && <span>Ещё {selected.length - 3}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="stage-bottom">
            <span className="stage-axis">
              <i />
              Выбор сохраняется после применения
            </span>
            <Table2 size={15} />
          </div>
        </div>
        <div className="specimen-notes">
          <span className="eyebrow">Режим выбора</span>
          <h3>
            Сначала сравнить.
            <br />
            Затем подтвердить.
          </h3>
          <ButtonGroup aria-label="Режим табличного выбора">
            <Button
              size="sm"
              variant={multiple ? 'tonal' : 'ghost'}
              aria-pressed={multiple}
              onClick={() => setMultiple(true)}
            >
              Несколько
            </Button>
            <Button
              size="sm"
              variant={!multiple ? 'tonal' : 'ghost'}
              aria-pressed={!multiple}
              onClick={() => {
                setMultiple(false);
                setValue((current) => current.slice(0, 1));
              }}
            >
              Один
            </Button>
          </ButtonGroup>
          <p>
            Поиск не сбрасывает отметки. «Выбранные» показывает текущий набор. «Отмена» возвращает
            сохранённое значение.
          </p>
          <div className="keyboard-hint">
            <kbd>Tab</kbd>элементы<kbd>Space</kbd>выбор<kbd>Esc</kbd>отмена
          </div>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="01"
          title="Состояния и сценарии"
          note="Единый контракт в обеих темах"
        />
        <div className="specimen-grid three">
          <article className="specimen-card">
            <h3>Одиночный выбор</h3>
            <p className="specimen-description">Радиокнопки и одно итоговое значение.</p>
            <div className="specimen-card__body">
              <TableSelect
                {...source}
                label="Системный диск"
                title="Выбор системного диска"
                multiple={false}
                value={single}
                onValueChange={setSingle}
                placeholder="Выберите диск"
              />
            </div>
          </article>
          <article className="specimen-card">
            <h3>Недоступное поле</h3>
            <p className="specimen-description">Значение остаётся читаемым.</p>
            <div className="specimen-card__body">
              <TableSelect
                {...source}
                label="Диски ВМ"
                value={['d1']}
                onValueChange={() => {}}
                disabled
                hint="Изменение доступно после остановки ВМ."
              />
            </div>
          </article>
          <article className="specimen-card">
            <h3>Загрузка ресурсов</h3>
            <p className="specimen-description">Поле сохраняет свою геометрию.</p>
            <div className="specimen-card__body">
              <TableSelect
                {...source}
                label="Диски проекта"
                value={[]}
                onValueChange={() => {}}
                loading
              />
            </div>
          </article>
          <article className="specimen-card">
            <h3>Ошибка выбора</h3>
            <p className="specimen-description">После применения ошибка снимается.</p>
            <div className="specimen-card__body">
              <TableSelect
                {...source}
                label="Диск данных"
                title="Выбор диска данных"
                value={errorValue}
                onValueChange={setErrorValue}
                error={!errorValue.length ? 'Выберите хотя бы один свободный диск.' : undefined}
              />
            </div>
          </article>
          <article className="specimen-card">
            <h3>Нет ресурсов</h3>
            <p className="specimen-description">Пустой список объясняет причину.</p>
            <div className="specimen-card__body">
              <TableSelect
                {...source}
                rows={[]}
                label="Свободные диски"
                title="Свободные диски"
                value={[]}
                onValueChange={() => {}}
                emptyMessage="В этом проекте пока нет дисков"
              />
            </div>
          </article>
          <article className="specimen-card">
            <h3>Общая конструкция</h3>
            <div className="specimen-card__body picker-composition">
              <Layers3 />
              <p>
                Поле, кнопка, таблица, статусы и подсказки используют общие токены. Отдельного стиля
                кнопок для выбора ресурсов нет.
              </p>
            </div>
          </article>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading number="02" title="Правила работы с выбором" />
        <div className="design-rules">
          <div>
            <span>01</span>
            <div>
              <strong>Выделение по видимым строкам</strong>
              <p>
                Чекбокс в заголовке выбирает только доступные результаты текущего поиска. Отметки за
                пределами поиска сохраняются.
              </p>
            </div>
          </div>
          <div>
            <span>02</span>
            <div>
              <strong>Недоступное объяснено</strong>
              <p>
                Подключённый диск присутствует в таблице со статусом, но его нельзя отметить.
                Массовый выбор пропускает его.
              </p>
            </div>
          </div>
          <div>
            <span>03</span>
            <div>
              <strong>Явное подтверждение</strong>
              <p>
                В поле хранится применённый набор. Изменения в таблице становятся значением только
                после «Применить».
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="ds-section">
        <SectionHeading
          number="03"
          title="Параметры дизайна"
          note="Собственные роли и общие базовые компоненты"
        />
        <ComponentTokens component="table-select" />
      </section>
    </>
  );
}
