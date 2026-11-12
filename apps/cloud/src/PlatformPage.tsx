import { relatedResourceRows } from './resource-presentation';
import {
  PlatformFacts,
  PlatformValueView,
  ResourceOverview,
  DetailFacts,
  CopyValue,
} from './ResourceDetails';
import { csvCell } from './csv';
import { ApiPermissions, PlatformRecordSettings } from './PlatformSettings';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  Button,
  ContextPanel,
  Dialog,
  Input,
  Menu,
  Message,
  Progress,
  StatusBadge,
  Tabs,
  Tag,
  Tooltip,
} from '@basis/ui';
import {
  platformEntity,
  platformDefaultColumns,
  platformGroups,
  platformStatusLabels,
  platformTone,
} from '../platform-catalog';
import {
  canChangePlatform,
  listPlatformRecords,
  platformRecordName,
  platformState,
  platformUsage,
  recordVisible,
  resourceDependencies,
  visiblePlatformRecords,
} from '../platform-model';
import type { PlatformEntity, PlatformRecord, PlatformValue } from '../platform-types';
import { useCloud } from './cloud-state';
import { useDesign } from '../../playground/src/DesignContext';
import { PlatformIcon } from './PlatformIcon';
import { PlatformForm } from './PlatformForm';
import { ResourceTable } from './ResourceTable';
import type { RegistryColumn } from './registry-model';
import { Empty, navigate, PageTitle, Panel } from './parts';
import { VmTable } from './VmTable';

const mutable = (entity: PlatformEntity) =>
  Boolean(entity.create || ['locations', 'nodes', 'vnf-devices', 'optimizer'].includes(entity.id));
function exportRows(entity: PlatformEntity, rows: PlatformRecord[]) {
  const fields = [
    'id',
    'name',
    'status',
    ...entity.fields.filter((field) => field.kind !== 'password').map((field) => field.key),
  ];
  const csv =
    '\uFEFF' +
    [
      fields.map(csvCell).join(';'),
      ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(';')),
    ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${entity.id}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PlatformRegistry({
  entity,
  rows: supplied,
  initial = {},
  contextKey = '',
}: {
  entity: PlatformEntity;
  rows?: PlatformRecord[];
  initial?: Record<string, PlatformValue>;
  contextKey?: string;
}) {
  const { data: source, scope, mutate, working, notify } = useCloud(),
    data = source!;
  const { resolved } = useDesign();
  const width = (role: string) =>
    Number(
      resolved[`comp.table.column.${role === 'actions' ? role : `compact.${role}`}.width`].value
        .value,
    );
  const rows = supplied || visiblePlatformRecords(data, entity.id, scope);
  const [preview, setPreview] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [form, setForm] = useState<{ row?: PlatformRecord; anchor: HTMLElement } | null>(null);
  const [confirmation, setConfirmation] = useState<{
      rows: PlatformRecord[];
      action: string;
    } | null>(null),
    [confirmName, setConfirmName] = useState(''),
    [failure, setFailure] = useState('');
  const blocked = (row?: PlatformRecord) =>
    canChangePlatform(data, entity.id, row) ||
    (row &&
    data.tasks.some(
      (t) =>
        t.status === 'running' &&
        t.platformOperation?.entity === entity.id &&
        t.platformOperation.ids.includes(row.id),
    )
      ? 'С ресурсом уже выполняется операция.'
      : '');
  const ask = (selected: PlatformRecord[], action: string) => {
    setConfirmation({ rows: selected, action });
    setConfirmName('');
    setFailure('');
  };
  const perform = async () => {
    if (!confirmation) return;
    try {
      if (confirmation.rows.length > 1)
        await mutate(
          `/platform/${entity.id}/actions`,
          { ids: confirmation.rows.map((r) => r.id), action: confirmation.action },
          'Операция запущена',
        );
      else {
        const row = confirmation.rows[0];
        if (entity.id === 'recycle-bin')
          await mutate(
            `/platform/${row.entity}/${row.originalId}/restore`,
            {},
            'Восстановление началось',
          );
        else
          await mutate(
            `/platform/${entity.id}/${row.id}${confirmation.action === 'delete' ? '' : `/${confirmation.action}`}`,
            {},
            'Операция запущена',
            confirmation.action === 'delete' ? 'DELETE' : 'POST',
          );
      }
      setConfirmation(null);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Не удалось выполнить операцию.');
    }
  };
  const rowMenu = (row: PlatformRecord) => {
    const unavailable = blocked(row);
    const dependencies = entity.delete ? resourceDependencies(data, entity.id, row.id) : [];
    return (
      <Menu
        compact
        label={`Действия с ${row.name}`}
        icon={<MoreHorizontal />}
        items={[
          {
            id: 'open',
            label: 'Открыть страницу',
            icon: <ArrowUpRight />,
            onSelect: () => navigate(`${entity.id}/${row.id}`),
          },
          ...(mutable(entity)
            ? [
                {
                  id: 'edit',
                  label: 'Изменить',
                  icon: <Pencil />,
                  disabled: Boolean(unavailable),
                  description: unavailable || undefined,
                  onSelect: () => setForm({ row, anchor: document.activeElement as HTMLElement }),
                },
              ]
            : []),
          ...(entity.actions || []).map((action) => ({
            id: action.id,
            label: action.label,
            disabled: Boolean(unavailable || (action.from && !action.from.includes(row.status))),
            description:
              unavailable ||
              (action.from && !action.from.includes(row.status)
                ? 'Недоступно в текущем состоянии'
                : undefined),
            onSelect: () => ask([row], action.id),
          })),
          ...(entity.delete
            ? [
                {
                  id: 'delete',
                  label: 'Удалить',
                  icon: <Trash2 />,
                  danger: true,
                  disabled: Boolean(unavailable || row.protected || dependencies.length),
                  description:
                    unavailable ||
                    (row.protected
                      ? 'Защищённый системный ресурс'
                      : dependencies.length
                        ? `Связанных ресурсов: ${dependencies.length}`
                        : 'Ресурс будет перемещён в корзину'),
                  onSelect: () => ask([row], 'delete'),
                },
              ]
            : []),
          ...(entity.id === 'recycle-bin'
            ? [
                {
                  id: 'restore',
                  label: 'Восстановить',
                  icon: <RotateCcw />,
                  disabled: Boolean(unavailable),
                  onSelect: () => ask([row], 'restore'),
                },
              ]
            : []),
          ...(entity.id === 'tasks' && row.status === 'FAILED'
            ? [
                {
                  id: 'retry',
                  label: 'Повторить',
                  icon: <RotateCcw />,
                  disabled: platformState(data).mode === 'reader',
                  onSelect: () => {
                    void mutate(`/tasks/${row.id}/retry`, {}, 'Повторная задача создана').catch(
                      (e) => notify('Повтор не выполнен', 'danger', e.message),
                    );
                  },
                },
              ]
            : []),
        ]}
      />
    );
  };
  const statusOptions = [...new Set(rows.map((r) => r.status))].map((status) => ({
    value: status,
    label: platformStatusLabels[status] || status,
  }));
  const columns: RegistryColumn<PlatformRecord>[] = [
    {
      id: 'name',
      header: 'Название',
      description: `Имя ресурса. Нажмите для перехода: ${entity.singular.toLocaleLowerCase()}.`,
      pinned: 'start',
      width: width('identity'),
      value: (r) => r.name,
      render: (r) => (
        <a className="cloud-vm-link" href={`#cloud/${entity.id}/${r.id}`}>
          <PlatformIcon name={entity.icon} size={15} />
          <span title={r.name}>{r.name}</span>
        </a>
      ),
    },
    {
      id: 'status',
      header: 'Состояние',
      description: 'Текущее состояние ресурса или результат операции.',
      kind: 'enum',
      width: width('status'),
      value: (r) => r.status,
      options: statusOptions,
      render: (r) => (
        <StatusBadge tone={platformTone(r.status)}>
          {platformStatusLabels[r.status] || r.status}
        </StatusBadge>
      ),
    },
    ...entity.fields
      .filter((f) => f.kind !== 'password')
      .map((field, index): RegistryColumn<PlatformRecord> => ({
        id: field.key,
        header: field.label,
        description: field.description,
        width: width(
          field.kind === 'number' ? 'numeric' : field.kind === 'ip' ? 'address' : 'relation',
        ),
        hidden: platformDefaultColumns[entity.id]
          ? !platformDefaultColumns[entity.id].includes(field.key)
          : field.hidden || index > 3,
        kind:
          field.reference || field.kind === 'enum' || field.kind === 'boolean'
            ? 'enum'
            : field.kind === 'number' || field.kind === 'date' || field.kind === 'ip'
              ? field.kind
              : 'text',
        value: (r) =>
          typeof r[field.key] === 'number'
            ? (r[field.key] as number)
            : Array.isArray(r[field.key])
              ? (r[field.key] as string[]).join(', ')
              : r[field.key] === undefined || r[field.key] === null
                ? null
                : String(r[field.key]),
        options: field.reference
          ? listPlatformRecords(data, field.reference).map((r) => ({ value: r.id, label: r.name }))
          : field.kind === 'boolean'
            ? [
                { value: 'true', label: 'Да' },
                { value: 'false', label: 'Нет' },
              ]
            : field.options?.map((option) => ({
                ...option,
                label: platformStatusLabels[option.value] || option.label,
              })),
        unit: field.unit,
        min: field.min,
        max: field.max,
        align: field.kind === 'number' ? 'right' : undefined,
        render: (r) => <PlatformValueView state={data} field={field} value={r[field.key]} />,
      })),
    {
      id: 'id',
      header: 'ID',
      description: 'Уникальный идентификатор ресурса.',
      hidden: true,
      width: width('relation'),
      value: (r) => r.id,
      render: (r) => <span className="cloud-mono">{r.id}</span>,
    },
    {
      id: 'actions',
      utility: 'actions',
      header: 'Действия',
      width: width('actions'),
      pinned: 'end',
      render: rowMenu,
    },
  ];
  const selectedPreview = rows.find((r) => r.id === preview?.id);
  return (
    <>
      {(entity.internal || Boolean(contextKey)) && (
        <div className="platform-related-heading">
          <div>
            <h2>{entity.label}</h2>
            <span>Всего: {rows.length}</span>
          </div>
          {entity.create && (
            <Button
              size="sm"
              leadingIcon={<Plus />}
              disabled={Boolean(blocked())}
              onClick={(event) => setForm({ anchor: event.currentTarget })}
            >
              Добавить
            </Button>
          )}
        </div>
      )}
      <ResourceTable
        rows={rows}
        columns={columns}
        caption={entity.label}
        tableId={`platform:${entity.id}:${contextKey || scope}`}
        initialSort={[
          {
            column: ['audits', 'jobs', 'tasks', 'incidents'].includes(entity.id)
              ? entity.fields.some((f) => f.key === 'startedAt')
                ? 'startedAt'
                : 'createdAt'
              : 'name',
            direction: ['audits', 'jobs', 'tasks', 'incidents'].includes(entity.id)
              ? 'desc'
              : 'asc',
          },
        ]}
        placeholder={`Поиск · ${entity.label.toLocaleLowerCase()}`}
        previewRowId={preview?.id}
        onRowActivate={(row, anchor) => setPreview({ id: row.id, anchor })}
        rowTone={(r) =>
          platformTone(r.status) === 'danger'
            ? 'error'
            : platformTone(r.status) === 'warning'
              ? 'warning'
              : undefined
        }
        presets={statusOptions
          .filter((s) =>
            [
              'ERROR',
              'FAILED',
              'WARNING',
              'MAINTENANCE',
              'DISABLED',
              'RUNNING',
              'STOPPED',
              'AVAILABLE',
            ].includes(s.value),
          )
          .slice(0, 3)
          .map((s) => ({
            label: s.label,
            filters: [{ field: 'status', operator: 'in', value: '', to: '', values: [s.value] }],
          }))}
        bulkActions={(selected) => (
          <>
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<Download />}
              onClick={() => exportRows(entity, selected)}
            >
              Экспорт
            </Button>
            {entity.actions
              ?.filter((a) => ['enable', 'disable', 'start', 'stop'].includes(a.id))
              .map((a) => (
                <Tooltip
                  key={a.id}
                  content={
                    selected.every((r) => !blocked(r) && (!a.from || a.from.includes(r.status)))
                      ? a.description
                      : 'Действие должно быть доступно для всех выбранных ресурсов.'
                  }
                >
                  <Button
                    size="sm"
                    disabled={
                      !selected.every((r) => !blocked(r) && (!a.from || a.from.includes(r.status)))
                    }
                    onClick={() => ask(selected, a.id)}
                  >
                    {a.label}
                  </Button>
                </Tooltip>
              ))}
            {entity.delete && (
              <Button
                size="sm"
                tone="danger"
                leadingIcon={<Trash2 />}
                disabled={selected.some(
                  (r) =>
                    Boolean(blocked(r)) ||
                    Boolean(r.protected) ||
                    resourceDependencies(data, entity.id, r.id).length > 0,
                )}
                onClick={() => ask(selected, 'delete')}
              >
                Удалить
              </Button>
            )}
          </>
        )}
        empty={
          <Empty
            title="Ресурсов пока нет"
            description={
              Object.keys(initial).length
                ? 'Добавьте первый связанный ресурс.'
                : 'Выберите другую рабочую область или создайте ресурс.'
            }
          />
        }
      />
      {selectedPreview && (
        <ContextPanel
          open
          anchor={preview?.anchor || null}
          title={selectedPreview.name}
          description={entity.singular}
          icon={<PlatformIcon name={entity.icon} />}
          presentation="drawer"
          onClose={() => setPreview(null)}
          footer={
            <>
              <Button onClick={() => setPreview(null)}>Закрыть</Button>
              <Button
                variant="primary"
                trailingIcon={<ArrowUpRight />}
                onClick={() => {
                  setPreview(null);
                  navigate(`${entity.id}/${selectedPreview.id}`);
                }}
              >
                Открыть страницу
              </Button>
            </>
          }
        >
          <div className="platform-preview">
            <StatusBadge tone={platformTone(selectedPreview.status)}>
              {platformStatusLabels[selectedPreview.status] || selectedPreview.status}
            </StatusBadge>
            {selectedPreview.description && <p>{selectedPreview.description}</p>}
            <PlatformFacts entity={entity} row={selectedPreview} compact />
            {entity.tabs?.some((tab) => tab.entity) && (
              <div className="platform-related-links">
                {entity.tabs
                  .filter((tab) => tab.entity)
                  .map((tab) => (
                    <Button
                      key={tab.id}
                      variant="ghost"
                      trailingIcon={<ArrowRight />}
                      onClick={() => {
                        setPreview(null);
                        navigate(`${entity.id}/${selectedPreview.id}/${tab.id}`);
                      }}
                    >
                      {tab.label}
                    </Button>
                  ))}
              </div>
            )}
          </div>
        </ContextPanel>
      )}
      {form && (
        <PlatformForm
          entity={entity}
          row={form.row}
          initial={initial}
          anchor={form.anchor}
          onClose={() => setForm(null)}
          onCreated={entity.internal ? () => {} : undefined}
        />
      )}
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => !open && !working && setConfirmation(null)}
        title={
          confirmation
            ? `${confirmation.action === 'delete' ? 'Удалить' : confirmation.action === 'restore' ? 'Восстановить' : entity.actions?.find((a) => a.id === confirmation.action)?.label || 'Выполнить операцию'} · ${confirmation.rows.length === 1 ? confirmation.rows[0].name : `${confirmation.rows.length} ресурсов`}`
            : ''
        }
        tone={confirmation?.action === 'delete' ? 'danger' : 'default'}
        footer={
          <>
            <Button disabled={working} onClick={() => setConfirmation(null)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              tone={confirmation?.action === 'delete' ? 'danger' : 'brand'}
              loading={working}
              disabled={
                confirmation?.action === 'delete' &&
                confirmName !==
                  (confirmation.rows.length === 1 ? confirmation.rows[0].name : 'УДАЛИТЬ')
              }
              onClick={() => void perform()}
            >
              Подтвердить
            </Button>
          </>
        }
      >
        <div className="platform-form">
          {failure && (
            <Message tone="danger" title="Операция не выполнена">
              {failure}
            </Message>
          )}
          <p>
            {confirmation?.action === 'delete'
              ? 'Ресурс будет перемещён в корзину. Перед удалением проверяются все связи.'
              : confirmation?.action === 'restore'
                ? 'Ресурс вернётся в свой раздел после завершения задачи.'
                : entity.actions?.find((a) => a.id === confirmation?.action)?.description}
          </p>
          {confirmation && confirmation.rows.length > 1 && (
            <ul className="platform-confirm-list">
              {confirmation.rows.map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
            </ul>
          )}
          {confirmation?.action === 'delete' && (
            <Input
              label={confirmation.rows.length === 1 ? 'Введите имя ресурса' : 'Введите УДАЛИТЬ'}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
            />
          )}
        </div>
      </Dialog>
    </>
  );
}

export function PlatformPage({
  entityId,
  id,
  tab = 'overview',
}: {
  entityId: string;
  id?: string;
  tab?: string;
}) {
  const { data: source, scope, setScope, mutate, notify } = useCloud(),
    data = source!,
    entity = platformEntity(entityId)!;
  const [form, setForm] = useState<HTMLElement | null>(null);
  const row = id ? listPlatformRecords(data, entityId).find((r) => r.id === id) : undefined;
  const currentTask = data.tasks.find(
    (t) =>
      t.platformOperation?.entity === entityId &&
      t.platformOperation.ids.includes(id || '') &&
      t.status === 'running',
  );
  const failedTask = data.tasks.find(
    (t) =>
      t.status === 'error' &&
      t.platformOperation?.entity === entityId &&
      t.platformOperation.ids.includes(id || ''),
  );
  const denied = row
    ? !recordVisible(data, entityId, row)
    : entity.admin && platformState(data).mode !== 'admin';
  if (denied)
    return (
      <Empty
        title="Раздел недоступен"
        description="Для этого ресурса нужны другие права доступа."
        action={<Button onClick={() => navigate('overview')}>На обзор</Button>}
      />
    );
  if (id && !row)
    return currentTask ? (
      <>
        <PageTitle title={currentTask.resource} description={currentTask.name} />
        <Panel title="Подготовка ресурса">
          <Progress value={currentTask.progress} label="Выполняется" />
          <p>Можно продолжить работу в портале. Результат появится здесь автоматически.</p>
          <Button variant="ghost" onClick={() => navigate('tasks')}>
            Открыть задачи
          </Button>
        </Panel>
      </>
    ) : failedTask ? (
      <>
        <PageTitle title={failedTask.resource} />
        <Message
          tone="danger"
          title="Не удалось создать ресурс"
          action={{
            label: 'Повторить',
            onClick: () => {
              void mutate(`/tasks/${failedTask.id}/retry`, {}, 'Повторная задача создана')
                .then((result) => navigate(`${entityId}/${result.id || id}`))
                .catch((e) => notify('Повтор не выполнен', 'danger', e.message));
            },
          }}
        >
          {failedTask.error}
        </Message>
        <Button variant="ghost" onClick={() => navigate('tasks')}>
          Открыть задачи
        </Button>
      </>
    ) : (
      <Empty
        title="Ресурс не найден"
        description="Возможно, ресурс удалён или выбранная ссылка устарела."
        action={<Button onClick={() => navigate(entityId)}>Вернуться в раздел</Button>}
      />
    );
  const group = platformGroups.find((g) => g.id === entity.group);
  const blocked =
    canChangePlatform(data, entityId, row) || (currentTask ? 'Дождитесь завершения операции.' : '');
  const allTabs = [
    { id: 'overview', label: 'Обзор' },
    ...(entity.tabs || []),
    ...(!['audits', 'jobs', 'tasks', 'recycle-bin', 'incidents'].includes(entityId)
      ? [{ id: 'activity', label: 'Аудит' }]
      : []),
  ];
  const selectedTab = allTabs.find((item) => item.id === tab) || allTabs[0];
  const tabDefinition = entity.tabs?.find((item) => item.id === selectedTab.id);
  const linkedRows = row && tabDefinition ? relatedResourceRows(data, row, tabDefinition) : [];
  return (
    <>
      <PageTitle
        eyebrow={row ? entity.singular : group?.label}
        title={
          row ? (
            <span className="platform-title">
              <span className="cloud-resource-mark">
                <PlatformIcon name={entity.icon} size={22} />
              </span>
              {row.name}
              <StatusBadge tone={platformTone(row.status)}>
                {platformStatusLabels[row.status] || row.status}
              </StatusBadge>
            </span>
          ) : (
            entity.label
          )
        }
        description={row ? row.description || undefined : entity.description}
        actions={
          <>
            {row && (
              <Button
                variant="ghost"
                leadingIcon={<ArrowLeft />}
                onClick={() => navigate(entityId)}
              >
                К списку
              </Button>
            )}
            {row && ['accounts', 'projects'].includes(entityId) && (
              <Button
                leadingIcon={<Check />}
                onClick={() => {
                  setScope(row.id);
                  navigate('overview');
                }}
              >
                Работать в этой области
              </Button>
            )}
            {row
              ? mutable(entity) && (
                  <Tooltip content={blocked || 'Изменить параметры ресурса'}>
                    <Button
                      leadingIcon={<Pencil />}
                      disabled={Boolean(blocked)}
                      onClick={(event) => setForm(event.currentTarget)}
                    >
                      Изменить
                    </Button>
                  </Tooltip>
                )
              : entity.create && (
                  <Tooltip content={blocked || `Создать: ${entity.singular.toLocaleLowerCase()}`}>
                    <Button
                      variant="primary"
                      leadingIcon={<Plus />}
                      disabled={Boolean(blocked)}
                      onClick={(event) => setForm(event.currentTarget)}
                    >
                      {entity.createLabel || 'Создать'}
                    </Button>
                  </Tooltip>
                )}
          </>
        }
      />
      {row ? (
        <>
          <Tabs
            items={allTabs.map((item) => {
              const t = entity.tabs?.find((t) => t.id === item.id);
              return {
                ...item,
                count: t?.entity ? relatedResourceRows(data, row, t).length : undefined,
              };
            })}
            value={selectedTab.id}
            onValueChange={(value) =>
              navigate(`${entityId}/${row.id}${value === 'overview' ? '' : `/${value}`}`)
            }
            label={`Разделы · ${row.name}`}
          >
            {selectedTab.id === 'overview' ? (
              <ResourceOverview entity={entity} row={row}>
                {['accounts', 'projects'].includes(entityId) && <QuotaSummary id={row.id} />}
              </ResourceOverview>
            ) : tabDefinition?.entity ? (
              tabDefinition.entity === 'vms' ? (
                <VmTable
                  contextKey={`${entityId}:${row.id}`}
                  resourceIds={linkedRows.map((r) => r.id)}
                />
              ) : (
                <PlatformRegistry
                  key={`${entityId}:${row.id}:${tab}`}
                  entity={platformEntity(tabDefinition.entity)!}
                  rows={linkedRows}
                  initial={tabDefinition.foreignKey ? { [tabDefinition.foreignKey]: row.id } : {}}
                  contextKey={`${entityId}:${row.id}:${tab}`}
                />
              )
            ) : selectedTab.id === 'activity' ? (
              <PlatformRegistry
                entity={platformEntity('audits')!}
                rows={listPlatformRecords(data, 'audits').filter(
                  (a) =>
                    recordVisible(data, 'audits', a) &&
                    (a.resourceId === row.id ||
                      (entityId === 'accounts' && a.accountId === row.id) ||
                      (entityId === 'projects' && a.rgId === row.id)),
                )}
                contextKey={`${entityId}:${row.id}`}
              />
            ) : selectedTab.id === 'quotas' ? (
              <QuotaSummary id={row.id} />
            ) : (
              <div className="resource-scenario">
                <ResourceScenario
                  entity={entity}
                  row={row}
                  tab={selectedTab.id}
                  onEdit={(anchor) => setForm(anchor)}
                />
              </div>
            )}
          </Tabs>
        </>
      ) : (
        <>
          <div className="platform-section-context">
            <span>Всего: {visiblePlatformRecords(data, entityId, scope).length}</span>
            <span>
              {entity.scope === 'global'
                ? 'Инфраструктура платформы'
                : scope === 'all'
                  ? 'Все доступные области'
                  : 'Текущая рабочая область'}
            </span>
            {entity.admin && <Tag>Администрирование</Tag>}
          </div>
          <PlatformRegistry key={`${entityId}:${scope}`} entity={entity} />
        </>
      )}
      {form && (
        <PlatformForm entity={entity} row={row} anchor={form} onClose={() => setForm(null)} />
      )}
    </>
  );
}
function QuotaSummary({ id }: { id: string }) {
  const { data: source } = useCloud(),
    data = source!,
    usage = platformUsage(data, id);
  const owner =
    listPlatformRecords(data, 'accounts').find((r) => r.id === id) ||
    listPlatformRecords(data, 'projects').find((r) => r.id === id);
  return (
    <Panel
      className="resource-settings"
      title="Выделено и доступно"
      subtitle="Квоты учитывают выделенные ресурсы всех машин, включая выключенные."
    >
      <div className="platform-quota-list">
        {[
          {
            label: 'Процессоры',
            value: usage.cpu,
            total: Number(owner?.cpuQuota || 0),
            unit: 'vCPU',
          },
          {
            label: 'Оперативная память',
            value: usage.memory,
            total: Number(owner?.memoryQuota || 0),
            unit: 'GiB',
          },
          { label: 'Диски', value: usage.disk, total: Number(owner?.diskQuota || 0), unit: 'GiB' },
        ].map((q) => (
          <div key={q.label}>
            <div>
              <span>
                {q.label}
                {q.value > q.total * 0.85 && (
                  <StatusBadge tone={q.value > q.total ? 'danger' : 'warning'}>
                    {q.value > q.total ? 'Превышена' : 'Почти исчерпана'}
                  </StatusBadge>
                )}
              </span>
              <strong>
                {q.value.toLocaleString('ru-RU')}{' '}
                <small>
                  / {q.total.toLocaleString('ru-RU')} {q.unit}
                </small>
              </strong>
            </div>
            <Progress
              value={q.total ? (q.value / q.total) * 100 : 0}
              label={q.label}
              hideLabel
              compact
              status="active"
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}
function ResourceScenario({
  entity,
  row,
  tab,
  onEdit,
}: {
  entity: PlatformEntity;
  row: PlatformRecord;
  tab: string;
  onEdit: (anchor: HTMLElement) => void;
}) {
  const { data } = useCloud();
  const targeted: Record<string, string[]> = {
    'kubernetes/network': ['vinsId', 'networkPlugin', 'highlyAvailable'],
    'vnf-devices/configuration': ['nodeId', 'address', 'cpu', 'memory'],
    'nodes/network': ['address'],
    'optimizer/policies': ['zoneId', 'mode'],
    'optimizer/schedule': ['schedule'],
  };
  if (targeted[entity.id + '/' + tab])
    return (
      <div className="platform-tab-content">
        <PlatformRecordSettings
          entity={entity}
          row={row}
          title={entity.tabs?.find((t) => t.id === tab)?.label || 'Конфигурация'}
          fields={targeted[entity.id + '/' + tab]}
        />
      </div>
    );
  if (entity.id === 'kubernetes' && tab === 'access')
    return (
      <Panel
        title="Подключение к кластеру"
        subtitle="Используйте конфигурацию доступа из доверенной среды."
      >
        <div className="vm-address">
          <div>
            <small>API endpoint</small>
            <strong className="cloud-mono">
              https://{String(row.address || '198.51.100.30')}:6443
            </strong>
          </div>
          <CopyValue
            value={`https://${String(row.address || '198.51.100.30')}:6443`}
            label="API endpoint"
          />
        </div>
        <DetailFacts
          items={[
            {
              label: 'Сеть',
              value: row.vinsId ? (
                <a href={`#cloud/networks/${row.vinsId}`}>
                  {platformRecordName(data!, 'networks', row.vinsId)}
                </a>
              ) : (
                'Не задана'
              ),
            },
            {
              label: 'Конфигурация',
              value: row.k8ciId ? (
                <a href={`#cloud/k8ci/${row.k8ciId}`}>
                  {platformRecordName(data!, 'k8ci', row.k8ciId)}
                </a>
              ) : (
                'Не задана'
              ),
            },
          ]}
        />
        <Message tone="info" title="Демонстрационный кластер">
          Действующая конфигурация доступа и ключи в демо не выдаются.
        </Message>
      </Panel>
    );
  if (entity.id === 'volumes' && tab === 'replication')
    return (
      <div className="platform-tab-content">
        <PlatformRecordSettings
          entity={entity}
          row={row}
          title="Репликация диска"
          description={
            row.replication === 'SYNCED'
              ? 'Реплика синхронизирована. В демо моделируются конфигурация и состояние.'
              : 'Выберите отдельную политику хранения для реплики.'
          }
          fields={['replicaPolicyId']}
        />
      </div>
    );
  if (entity.id === 'volumes' && tab === 'qos')
    return (
      <div className="platform-tab-content">
        <PlatformRecordSettings
          entity={entity}
          row={row}
          title="Ограничения I/O"
          description="Нулевое значение снимает ограничение. Настройки чтения и записи независимы."
          fields={['readIops', 'writeIops', 'readBandwidth', 'writeBandwidth']}
        />
      </div>
    );
  if (entity.id === 'api-access' && tab === 'permissions')
    return (
      <div className="platform-tab-content">
        <ApiPermissions key={row.id} row={row} />
      </div>
    );
  if (entity.id === 'zero-access' && tab === 'recording')
    return (
      <Panel title="Журнал сеанса">
        <div className="platform-session-log">
          <p>
            <time>10:14:02</time> Сеанс открыт · {platformRecordName(data!, 'users', row.userId)}
          </p>
          <p>
            <time>10:14:06</time> Подключение к {platformRecordName(data!, 'nodes', row.nodeId)}
          </p>
          <p>
            <time>10:37:58</time> Сеанс завершён
          </p>
        </div>
        <Message tone="info" title="Учебная запись">
          Демонстрационный журнал не содержит реальных команд или данных доступа.
        </Message>
      </Panel>
    );
  return (
    <Panel
      title={entity.tabs?.find((t) => t.id === tab)?.label || 'Конфигурация'}
      subtitle={row.description ? String(row.description) : entity.description}
    >
      <PlatformFacts entity={entity} row={row} grouped />
      {mutable(entity) && (
        <Button
          leadingIcon={<Pencil />}
          disabled={Boolean(canChangePlatform(data!, entity.id, row))}
          onClick={(event) => onEdit(event.currentTarget)}
        >
          Изменить параметры
        </Button>
      )}
    </Panel>
  );
}
