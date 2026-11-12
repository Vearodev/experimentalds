import type { ReactNode } from 'react';
import { ResourceTable, type ResourceTableProps } from './ResourceTable';
import { useCloud } from './cloud-state';
import { Cloud, Cpu, HardDrive, Layers3, MemoryStick, Server } from 'lucide-react';
import {
  Button,
  CloudLoader,
  Progress,
  Skeleton,
  StatusBadge,
  TableEmptyState,
  type StatusTone,
} from '@basis/ui';
import { busy, statusNames, type CloudState, type VM, type VmStatus } from '../domain';
export const navigate = (path: string) => {
  location.hash = `#cloud/${path}`;
};
export const projectName = (data: CloudState, id: string) =>
  data.projects.find((p) => p.id === id)?.name || 'Все ресурсные группы';
export const hostName = (data: CloudState, id: string) =>
  data.hosts.find((h) => h.id === id)?.name || '—';
export const date = (value: string | number) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
export const toneFor: Record<VmStatus, StatusTone> = {
  running: 'success',
  stopped: 'neutral',
  paused: 'warning',
  error: 'danger',
  creating: 'info',
  starting: 'info',
  stopping: 'warning',
  restarting: 'info',
  deleting: 'warning',
};
export function VmState({ vm }: { vm: VM }) {
  return (
    <span className="cloud-vm-state">
      {busy(vm) && <CloudLoader />}
      <StatusBadge tone={toneFor[vm.status]}>{statusNames[vm.status]}</StatusBadge>
    </span>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="cloud-page-heading">
      <div>
        {eyebrow && <span className="cloud-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="cloud-actions">{actions}</div>}
    </header>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`cloud-panel ${className}`}>
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="cloud-panel-body">{children}</div>
    </section>
  );
}
export function Empty({
  title = 'Ничего не найдено',
  description = 'Попробуйте изменить условия поиска.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return <TableEmptyState title={title} description={description} action={action} />;
}
export function LoadingPage() {
  return (
    <div className="cloud-loading" role="status" aria-label="Загрузка облака">
      <Skeleton width="36%" height={32} />
      <div className="cloud-metrics">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={124} shape="block" />
        ))}
      </div>
      <Skeleton height={350} shape="block" />
      <span className="basis-visually-hidden">Загружаем ресурсы</span>
    </div>
  );
}
export function ResourceMark({ kind = 'vm' }: { kind?: 'vm' | 'cluster' | 'disk' | 'cloud' }) {
  const Icon =
    kind === 'vm' ? Server : kind === 'cluster' ? Layers3 : kind === 'disk' ? HardDrive : Cloud;
  return (
    <span className="cloud-resource-mark">
      <Icon />
    </span>
  );
}
export function Capacity({
  type,
  value,
  total,
}: {
  type: 'cpu' | 'memory' | 'disk';
  value: number;
  total: number;
}) {
  const Icon = type === 'cpu' ? Cpu : type === 'memory' ? MemoryStick : HardDrive,
    label = type === 'cpu' ? 'Процессоры' : type === 'memory' ? 'Оперативная память' : 'Хранилище',
    unit = type === 'cpu' ? 'vCPU' : 'GiB';
  return (
    <article className="cloud-capacity">
      <div>
        <Icon size={16} />
        <span>{label}</span>
        <small>{unit}</small>
      </div>
      <strong>
        {value.toLocaleString('ru-RU')} <span>/ {total.toLocaleString('ru-RU')}</span>
      </strong>
      <Progress
        label="Выделено"
        value={total ? (value / total) * 100 : 0}
        compact
        status={value > total * 0.85 ? 'paused' : 'active'}
      />
    </article>
  );
}
export function PlainTable<T extends { id: string; name?: string }>(
  props: Omit<ResourceTableProps<T>, 'tableId'> & { tableId?: string },
) {
  const { scope } = useCloud();
  return (
    <ResourceTable
      {...props}
      tableId={props.tableId || `${location.hash}:${scope}:${props.caption}`}
    />
  );
}
export function Back({
  path = 'vms',
  children = 'К списку машин',
}: {
  path?: string;
  children?: ReactNode;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={() => navigate(path)}>
      ← {children}
    </Button>
  );
}
