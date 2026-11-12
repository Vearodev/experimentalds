import type { CSSProperties, ReactNode } from 'react';
import { ArrowUpRight, Check, CircleDashed, Copy, Info, Clock3 } from 'lucide-react';
import { Button, IconButton, Progress, StatusBadge, Tag, Tooltip } from '@basis/ui';
import { platformEntity, platformStatusLabels, platformTone } from '../platform-catalog';
import { listPlatformRecords, platformRecordName, recordVisible } from '../platform-model';
import type {
  PlatformEntity,
  PlatformField,
  PlatformRecord,
  PlatformValue,
} from '../platform-types';
import type { CloudState, Task } from '../domain';
import { useCloud } from './cloud-state';
import { date, navigate, Panel } from './parts';
import { PlatformIcon } from './PlatformIcon';
import {
  resourceFieldGroups,
  resourceHighlights,
  relatedResourceRows,
} from './resource-presentation';
import './resource-details.css';

export function PlatformValueView({
  state,
  field,
  value,
  expanded = false,
}: {
  state: CloudState;
  field: PlatformField;
  value: PlatformValue | undefined;
  expanded?: boolean;
}): ReactNode {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && !value.length)
  )
    return <span className="resource-unset">Не задано</span>;
  if (field.reference)
    return (
      <a className="platform-resource-link" href={`#cloud/${field.reference}/${value}`}>
        {platformRecordName(state, field.reference, value)}
      </a>
    );
  if (field.kind === 'boolean')
    return (
      <span className="resource-boolean" data-enabled={Boolean(value)}>
        {value ? <Check size={14} /> : <CircleDashed size={14} />}
        {value ? 'Да' : 'Нет'}
      </span>
    );
  if (field.kind === 'date')
    return Number.isNaN(new Date(String(value)).getTime()) ? String(value) : date(String(value));
  if (Array.isArray(value))
    return (
      <span className="platform-tags">
        {(expanded ? value : value.slice(0, 4)).map((item) => (
          <Tag key={item}>{item}</Tag>
        ))}
        {!expanded && value.length > 4 && <span>+{value.length - 4}</span>}
      </span>
    );
  if (
    value === 0 &&
    ['iops', 'readIops', 'writeIops', 'readBandwidth', 'writeBandwidth'].includes(field.key)
  )
    return 'Без ограничения';
  if (typeof value === 'number')
    return (
      <span className="cloud-number">
        {value.toLocaleString('ru-RU')}
        {field.unit && <small className="cloud-unit">{field.unit}</small>}
      </span>
    );
  const option = field.options?.find((o) => o.value === String(value));
  return (
    <span className={field.kind === 'ip' ? 'cloud-mono' : undefined}>
      {option && option.label !== option.value
        ? option.label
        : platformStatusLabels[String(value)] || option?.label || String(value)}
    </span>
  );
}

export function CopyValue({ value, label }: { value: string; label: string }) {
  const { notify } = useCloud();
  return (
    <Tooltip content={`Копировать ${label}`}>
      <IconButton
        size="sm"
        variant="ghost"
        icon={<Copy />}
        aria-label={`Копировать ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            notify('Скопировано', 'success', value);
          } catch {
            notify('Буфер обмена недоступен', 'warning', 'Выделите значение и скопируйте вручную.');
          }
        }}
      />
    </Tooltip>
  );
}

export function DetailFacts({
  items,
  descriptions = false,
}: {
  items: { label: string; value: ReactNode; description?: string }[];
  descriptions?: boolean;
}) {
  return (
    <dl className="resource-facts" data-descriptions={descriptions}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>
            <span>{item.label}</span>
            {!descriptions && item.description && (
              <Tooltip content={item.description}>
                <span
                  className="resource-field-help"
                  tabIndex={0}
                  aria-label={`О поле «${item.label}»`}
                >
                  <Info size={13} />
                </span>
              </Tooltip>
            )}
            {descriptions && item.description && <small>{item.description}</small>}
          </dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section className="resource-section">
      <h3>
        <PlatformIcon name={icon} />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function ResourceIdentity({ row }: { row: { id: string; createdAt?: string } }) {
  return (
    <footer className="resource-identity">
      <span>
        ID <code>{row.id}</code>
        <CopyValue value={row.id} label="ID ресурса" />
      </span>
      {row.createdAt && (
        <span>
          <Clock3 size={13} />
          Создан {date(row.createdAt)}
        </span>
      )}
    </footer>
  );
}

export function PlatformFacts({
  entity,
  row,
  compact = false,
  identity = true,
  descriptions = false,
  grouped = false,
  omit = [],
}: {
  entity: PlatformEntity;
  row: PlatformRecord;
  compact?: boolean;
  identity?: boolean;
  descriptions?: boolean;
  grouped?: boolean;
  omit?: string[];
}) {
  const { data } = useCloud();
  const fields = entity.fields.filter(
    (f) =>
      f.kind !== 'password' &&
      !['description', 'createdAt', ...omit].includes(f.key) &&
      (!compact || !f.hidden),
  );
  const groups = resourceFieldGroups({ ...entity, fields });
  const showGroups = grouped && fields.length > 6 && groups.length > 1;
  const render = (fields: PlatformField[]) => (
    <DetailFacts
      descriptions={descriptions}
      items={fields.map((field) => ({
        label: field.label,
        description: [field.label + '.', field.label + ', ' + field.unit + '.'].includes(
          field.description,
        )
          ? undefined
          : field.description,
        value: <PlatformValueView state={data!} field={field} value={row[field.key]} expanded />,
      }))}
    />
  );
  return (
    <div className="resource-properties" data-compact={compact}>
      <div className={showGroups ? 'resource-fact-groups' : undefined}>
        {showGroups
          ? groups.map((group) => (
              <DetailSection key={group.id} title={group.title} icon={group.icon}>
                {render(group.fields)}
              </DetailSection>
            ))
          : render(fields)}
      </div>
      {identity && <ResourceIdentity row={row} />}
    </div>
  );
}

export function ResourceMetrics({
  items,
}: {
  items: {
    label: string;
    icon: string;
    value: ReactNode;
    note?: ReactNode;
    progress?: number;
    progressLabel?: string;
    compactValue?: boolean;
    warning?: boolean;
    href?: string;
  }[];
}) {
  if (!items.length) return null;
  return (
    <div
      className="resource-metrics"
      aria-label="Ключевые параметры"
      style={{ '--resource-metric-count': items.length } as CSSProperties}
    >
      {items.map((item) => (
        <article key={item.label}>
          <div className="resource-metric-label">
            <PlatformIcon name={item.icon} />
            <span>{item.label}</span>
            {item.href && (
              <a href={item.href} aria-label={`Подробнее: ${item.label}`}>
                <ArrowUpRight size={15} />
              </a>
            )}
          </div>
          <div className="resource-metric-value" data-compact={item.compactValue}>
            {item.value}
          </div>
          {item.note && (
            <div className="resource-metric-note">
              {item.note}
              {item.warning && <StatusBadge tone="warning">Высокая нагрузка</StatusBadge>}
            </div>
          )}
          {item.progress !== undefined && (
            <Progress
              label={item.progressLabel || 'Использование'}
              value={item.progress}
              compact
              hideLabel
              status="active"
            />
          )}
        </article>
      ))}
    </div>
  );
}

export function ResourceConnection({
  icon,
  label,
  name,
  href,
  detail,
}: {
  icon: string;
  label: string;
  name: string;
  href?: string;
  detail?: string;
}) {
  const content = (
    <>
      <span className="resource-connection-icon">
        <PlatformIcon name={icon} size={18} />
      </span>
      <span>
        <small>{label}</small>
        <strong>{name}</strong>
        {detail && <em>{detail}</em>}
      </span>
      {href && <ArrowUpRight size={15} />}
    </>
  );
  return href ? (
    <a className="resource-connection" href={href}>
      {content}
    </a>
  ) : (
    <div className="resource-connection">{content}</div>
  );
}

export function RecentVmTasks({ tasks, href }: { tasks: Task[]; href: string }) {
  return (
    <Panel
      title="Последние операции"
      action={
        <Button
          size="sm"
          variant="ghost"
          trailingIcon={<ArrowUpRight />}
          onClick={() => navigate(href)}
        >
          Все операции
        </Button>
      }
    >
      {tasks.length ? (
        <ol className="resource-timeline">
          {tasks.slice(0, 3).map((task) => (
            <li key={task.id}>
              <span className="resource-event-dot" data-tone={task.status} />
              <div>
                <strong>{task.name}</strong>
                <span>
                  {date(task.startedAt)}
                  {task.error ? ` · ${task.error}` : ''}
                </span>
              </div>
              <StatusBadge
                tone={
                  task.status === 'error'
                    ? 'danger'
                    : task.status === 'running'
                      ? 'info'
                      : 'success'
                }
              >
                {task.status === 'error'
                  ? 'Ошибка'
                  : task.status === 'running'
                    ? `${task.progress}%`
                    : 'Завершено'}
              </StatusBadge>
            </li>
          ))}
        </ol>
      ) : (
        <div className="resource-quiet">
          <Clock3 size={20} />
          <div>
            <strong>Операций пока нет</strong>
            <p>Здесь появятся запуск, изменения конфигурации и другие действия с машиной.</p>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function ResourceOverview({
  entity,
  row,
  children,
}: {
  entity: PlatformEntity;
  row: PlatformRecord;
  children?: ReactNode;
}) {
  const { data: source } = useCloud(),
    data = source!;
  const highlights = (resourceHighlights[entity.id] || []).flatMap((item) => {
    const field = entity.fields.find((f) => f.key === item.key);
    return field && row[item.key] !== undefined && row[item.key] !== null
      ? [{ ...item, field }]
      : [];
  });
  const relations = (entity.tabs || [])
    .filter((tab) => tab.entity)
    .map((tab) => ({
      tab,
      rows: relatedResourceRows(data, row, tab),
    }));
  const events = listPlatformRecords(data, 'audits')
    .filter(
      (a) =>
        recordVisible(data, 'audits', a) &&
        (a.resourceId === row.id ||
          (entity.id === 'accounts' && a.accountId === row.id) ||
          (entity.id === 'projects' && a.rgId === row.id)),
    )
    .slice(0, 3);
  const activity = !['audits', 'jobs', 'tasks', 'recycle-bin', 'incidents'].includes(entity.id);
  const scopeEntity = ['accounts', 'projects'].includes(entity.id);
  const related = relations.length > 0 && (
    <Panel title="Связанные ресурсы">
      <div className="resource-relations">
        {relations.map(({ tab, rows }) => (
          <a key={tab.id} href={`#cloud/${entity.id}/${row.id}/${tab.id}`}>
            <span className="resource-connection-icon">
              <PlatformIcon name={platformEntity(tab.entity!)?.icon} size={18} />
            </span>
            <span>
              <strong>{tab.label}</strong>
              <small>
                {rows.length
                  ? rows
                      .slice(0, 2)
                      .map((r) => r.name)
                      .join(' · ') + (rows.length > 2 ? ` и ещё ${rows.length - 2}` : '')
                  : 'Пока не добавлены'}
              </small>
            </span>
            <b>{rows.length}</b>
            <ArrowUpRight size={15} />
          </a>
        ))}
      </div>
    </Panel>
  );
  return (
    <div className="resource-overview">
      <ResourceMetrics
        items={highlights.map(({ key, icon, field }) => ({
          label: field.label,
          icon,
          value: <PlatformValueView state={data} field={field} value={row[key]} />,
          compactValue: field.kind !== 'number',
        }))}
      />
      <div className="platform-detail-grid resource-detail-grid">
        <div className="resource-detail-main">
          <Panel title={entity.group === 'operations' ? 'Сведения о записи' : 'Конфигурация'}>
            <PlatformFacts
              entity={entity}
              row={row}
              grouped
              omit={[
                ...highlights.map((h) => h.key),
                ...(['accounts', 'projects'].includes(entity.id)
                  ? ['cpuQuota', 'memoryQuota', 'diskQuota']
                  : []),
                ...(entity.id === 'volumes'
                  ? [
                      'readIops',
                      'writeIops',
                      'readBandwidth',
                      'writeBandwidth',
                      ...(!row.replicaPolicyId ? ['replicaPolicyId'] : []),
                    ]
                  : []),
              ]}
            />
          </Panel>
          {scopeEntity && related}
        </div>
        <aside className="platform-detail-aside">
          {children}
          {!scopeEntity && related}
          {activity && (
            <Panel
              title="Последние события"
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  trailingIcon={<ArrowUpRight />}
                  onClick={() => navigate(`${entity.id}/${row.id}/activity`)}
                >
                  Аудит
                </Button>
              }
            >
              {events.length ? (
                <ol className="resource-timeline">
                  {events.map((event) => (
                    <li key={event.id}>
                      <span className="resource-event-dot" data-tone={platformTone(event.status)} />
                      <div>
                        <a href={`#cloud/audits/${event.id}`}>{event.name}</a>
                        <span>
                          {String(event.actor || '')} · {date(String(event.createdAt))} ·{' '}
                          {platformStatusLabels[event.status] || event.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="resource-quiet">
                  <Clock3 size={20} />
                  <div>
                    <strong>Событий пока нет</strong>
                    <p>Здесь будут последние изменения ресурса.</p>
                  </div>
                </div>
              )}
            </Panel>
          )}
          {!activity && !relations.length && (
            <Panel title="Контекст записи">
              <div className="resource-quiet">
                <PlatformIcon name={entity.icon} size={22} />
                <div>
                  <strong>{platformStatusLabels[row.status] || row.status}</strong>
                  <p>{row.description || entity.description}</p>
                </div>
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
