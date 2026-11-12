import type { TableFilterField, TableToolColumn } from '@basis/ui';
import { fieldTypes, filterLabels, statusLabels, type FilterField } from './table-model';
export const columnIds = ['name', 'status', 'cpu', 'ram', 'project', 'ip', 'actions'];
export const columnDescriptions: Partial<Record<string, string>> = {
  name: 'Имя виртуальной машины внутри проекта. Ссылка открывает её страницу; нажатие на строку — быстрый просмотр.',
  status: 'Текущее состояние питания и выполнения операций.',
  cpu: 'Текущая загрузка виртуальных процессоров, в процентах.',
  ram: 'Объём выделенной оперативной памяти, в гибибайтах.',
  project: 'Проект, которому принадлежит виртуальная машина.',
  ip: 'Основной IPv4-адрес сетевого интерфейса.',
};
export const toolColumns: TableToolColumn[] = columnIds.map((id) => ({
  id,
  label: id === 'actions' ? 'Действия' : filterLabels[id as FilterField],
  description: columnDescriptions[id],
  locked: id === 'name' || id === 'actions',
}));
export const toolFields: TableFilterField<FilterField>[] = (
  Object.keys(filterLabels) as FilterField[]
).map((id) => ({
  id,
  label: filterLabels[id],
  description: columnDescriptions[id],
  kind:
    fieldTypes[id] === 'set'
      ? 'enum'
      : id === 'ip'
        ? 'ip'
        : fieldTypes[id] === 'number'
          ? 'number'
          : 'text',
  unit: id === 'cpu' ? '%' : id === 'ram' ? 'GiB' : undefined,
  min: 0,
  max: id === 'cpu' ? 100 : undefined,
  hint: id === 'cpu' ? '0–100 %. Только ВМ с измеренной загрузкой.' : undefined,
  placeholder: id === 'name' ? 'Например, prod-api' : undefined,
  options: (id === 'status'
    ? Object.keys(statusLabels)
    : ['Production', 'Staging', 'Development']
  ).map((value) => ({
    value,
    label: statusLabels[value] || value,
    icon:
      id === 'status' ? (
        <span className={'basis-tt-filter-status-dot basis-tt-is-' + value} />
      ) : undefined,
  })),
}));
