import { useState } from 'react';
import { HardDrive, Network, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  ContextPanel,
  Dialog,
  IconButton,
  Input,
  Message,
  NumberInput,
  RadioGroup,
  Select,
  StatusBadge,
  Tag,
  Textarea,
  Tooltip,
} from '@basis/ui';
import { useCloud } from './cloud-state';
import { ApiError } from './api';
import { Empty, navigate, PageTitle, PlainTable, projectName } from './parts';
import type { CloudNetwork, FieldErrors, Volume } from '../domain';
import type { RegistryColumn, Rule } from './registry-model';

export function ResourceForm({
  kind,
  onClose,
}: {
  kind: 'volumes' | 'networks' | 'projects';
  onClose: () => void;
}) {
  const { data: source, scope, mutate, working, setScope } = useCloud(),
    data = source!;
  const [form, setForm] = useState({
    name: '',
    projectId: scope === 'all' ? data.projects[0]?.id || '' : scope,
    size: 100,
    tier: 'ssd',
    cidr: '',
    vlan: 200,
    cpuQuota: 64,
    memoryQuota: 128,
    environment: 'development',
    description: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({}),
    [failure, setFailure] = useState('');
  const patch = (key: string, value: unknown) => {
    setForm((v) => ({ ...v, [key]: value }));
    setErrors((v) => ({ ...v, [key]: '' }));
  };
  const title =
    kind === 'volumes' ? 'Создать диск' : kind === 'networks' ? 'Создать сеть' : 'Новый проект';
  const submit = async () => {
    if (!form.name.trim()) {
      setErrors({ name: 'Укажите название.' });
      return;
    }
    setFailure('');
    try {
      const result = await mutate(
        `/${kind}`,
        form,
        kind === 'volumes' ? 'Диск создан' : kind === 'networks' ? 'Сеть создана' : 'Проект создан',
      );
      if (kind === 'projects') {
        setScope(result.id!);
        navigate('overview');
      }
      onClose();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Не удалось сохранить.');
      if (e instanceof ApiError) setErrors(e.fields);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !working) onClose();
      }}
      title={title}
      description={
        kind === 'projects'
          ? 'Изолированная рабочая область со своими ресурсами и квотами.'
          : kind === 'volumes'
            ? 'Диск останется свободным, пока вы не подключите его к машине.'
            : 'Приватная сеть для машин одного проекта.'
      }
      footer={
        <>
          <Button disabled={working} onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={working}
            leadingIcon={<Plus />}
            onClick={() => void submit()}
          >
            {kind === 'projects'
              ? 'Создать проект'
              : kind === 'volumes'
                ? 'Создать диск'
                : 'Создать сеть'}
          </Button>
        </>
      }
    >
      <form
        className="cloud-form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!working) void submit();
        }}
        noValidate
      >
        <h3 className="cloud-form-caption">
          <span>Имя и проект</span>
        </h3>
        <Input
          autoFocus
          label="Название"
          required
          placeholder={
            kind === 'volumes'
              ? 'prod-data-03'
              : kind === 'networks'
                ? 'prod-services'
                : 'Новый проект'
          }
          value={form.name}
          onChange={(e) => patch('name', e.target.value)}
          maxLength={60}
          error={errors.name}
        />
        {kind !== 'projects' && (
          <Select
            label="Проект"
            value={form.projectId}
            onValueChange={(value: string) => patch('projectId', value)}
            options={data.projects.map((p) => ({ value: p.id, label: p.name }))}
            error={errors.projectId}
          />
        )}
        {kind === 'volumes' && (
          <>
            <h3 className="cloud-form-caption">
              <HardDrive />
              <span>Параметры хранилища</span>
            </h3>
            <NumberInput
              label="Объём диска"
              value={form.size}
              onValueChange={(value) => patch('size', value)}
              min={10}
              max={4096}
              unit="GiB"
              error={errors.size}
            />
            <RadioGroup
              cards
              label="Класс хранения"
              value={form.tier}
              onValueChange={(value) => patch('tier', value)}
              options={[
                {
                  value: 'ssd',
                  label: 'SSD',
                  description: 'Приложения и базы данных',
                  icon: <HardDrive />,
                },
                {
                  value: 'hdd',
                  label: 'HDD',
                  description: 'Архивы и резервные копии',
                  icon: <HardDrive />,
                },
              ]}
            />
          </>
        )}
        {kind === 'networks' && (
          <>
            <h3 className="cloud-form-caption">
              <Network />
              <span>Адресация и изоляция</span>
            </h3>
            <Input
              label="Подсеть CIDR"
              required
              placeholder="10.40.0.0/24"
              value={form.cidr}
              onChange={(e) => patch('cidr', e.target.value)}
              error={errors.cidr}
              hint="Сетевой адрес с маской от /16 до /28."
            />
            <NumberInput
              label="VLAN"
              value={form.vlan}
              onValueChange={(value) => patch('vlan', value)}
              min={1}
              max={4094}
              error={errors.vlan}
            />
            <Message title="Адреса назначаются внутри подсети" compact>
              При создании машины доступен автоматический или статический IP-адрес. Занятый адрес
              использовать нельзя.
            </Message>
          </>
        )}
        {kind === 'projects' && (
          <>
            <Select
              label="Назначение"
              value={form.environment}
              onValueChange={(value: string) => patch('environment', value)}
              options={[
                { value: 'production', label: 'Рабочая среда' },
                { value: 'development', label: 'Разработка' },
                { value: 'recovery', label: 'Резервная площадка' },
              ]}
            />
            <div className="cloud-form-grid">
              <NumberInput
                label="Квота vCPU"
                value={form.cpuQuota}
                onValueChange={(value) => patch('cpuQuota', value)}
                min={8}
                max={512}
                error={errors.cpuQuota}
              />
              <NumberInput
                label="Квота памяти"
                value={form.memoryQuota}
                onValueChange={(value) => patch('memoryQuota', value)}
                min={16}
                max={2048}
                unit="GiB"
                error={errors.memoryQuota}
              />
            </div>
            <Textarea
              label="Описание"
              value={form.description}
              onChange={(e) => patch('description', e.target.value)}
              rows={3}
              maxLength={500}
            />
            <Message title="Проект начинается с пустой инфраструктуры" compact>
              После создания добавьте приватную сеть, затем создайте первую машину. Вы станете
              участником проекта.
            </Message>
          </>
        )}
        {failure && (
          <Message title="Не удалось создать ресурс" tone="danger">
            {failure}
          </Message>
        )}
      </form>
    </Dialog>
  );
}
export function DeleteResource({
  name,
  path,
  onClose,
}: {
  name: string;
  path: string;
  onClose: () => void;
}) {
  const { mutate, working } = useCloud(),
    [error, setError] = useState('');
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !working) onClose();
      }}
      title={`Удалить ${name}?`}
      tone="danger"
      description="Можно удалить только ресурс, который не используется машинами."
      footer={
        <>
          <Button disabled={working} onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            tone="danger"
            loading={working}
            onClick={async () => {
              setError('');
              try {
                await mutate(path, {}, 'Ресурс удалён', 'DELETE');
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Не удалось удалить ресурс.');
              }
            }}
          >
            Удалить
          </Button>
        </>
      }
    >
      {error ? (
        <Message title="Ресурс не удалён" tone="danger">
          {error}
        </Message>
      ) : (
        <Message tone="warning" title="Ресурс исчезнет из проекта">
          Данные демонстрационные. Исходный набор можно восстановить в настройках среды.
        </Message>
      )}
    </Dialog>
  );
}

const setFilter = (field: string, values: string[]): Rule[] => [
  { field, operator: 'in', value: '', to: '', values },
];
export function StoragePage() {
  const { data: source, scope } = useCloud(),
    data = source!;
  const [create, setCreate] = useState(false),
    [remove, setRemove] = useState<Volume | null>(null),
    [detail, setDetail] = useState<Volume | null>(null);
  const rows = data.volumes.filter((v) => scope === 'all' || v.projectId === scope);
  const columns: RegistryColumn<Volume>[] = [
    {
      id: 'name',
      header: 'Название диска',
      width: 244,
      pinned: 'start',
      value: (v) => v.name,
      description:
        'Имя системного или дополнительного диска. Нажмите на строку для просмотра параметров.',
      render: (v) => (
        <span className="cloud-resource-name">
          <HardDrive size={15} aria-hidden="true" />
          <span title={v.name}>{v.name}</span>
          {v.boot && <Tag>OS</Tag>}
        </span>
      ),
    },
    {
      id: 'size',
      header: 'Объём',
      width: 128,
      kind: 'number',
      unit: 'GiB',
      value: (v) => v.size,
      align: 'right',
      description: 'Выделенный размер диска в GiB.',
      render: (v) => (
        <span className="cloud-number">
          {v.size}
          <small className="cloud-unit">GiB</small>
        </span>
      ),
    },
    {
      id: 'tier',
      header: 'Класс',
      width: 112,
      kind: 'enum',
      value: (v) => v.tier,
      options: [
        { value: 'ssd', label: 'SSD' },
        { value: 'hdd', label: 'HDD' },
      ],
      description: 'Класс хранилища определяет производительность диска.',
      render: (v) => <Tag>{v.tier.toUpperCase()}</Tag>,
    },
    {
      id: 'project',
      header: 'Проект',
      width: 156,
      kind: 'enum',
      value: (v) => v.projectId,
      options: data.projects.map((p) => ({ value: p.id, label: p.name })),
      description: 'Проект, которому принадлежит диск.',
      render: (v) => projectName(data, v.projectId),
    },
    {
      id: 'connection',
      header: 'Подключение',
      width: 224,
      kind: 'enum',
      value: (v) => v.vmId || 'free',
      options: [
        { value: 'free', label: 'Свободен' },
        ...data.vms.map((v) => ({ value: v.id, label: v.name })),
      ],
      description:
        'Машина, к которой подключён диск. Свободный диск можно подключить в разделе ресурсов ВМ.',
      render: (v) =>
        v.vmId ? (
          <a href={`#cloud/vms/${v.vmId}/resources`}>
            {data.vms.find((vm) => vm.id === v.vmId)?.name}
          </a>
        ) : (
          <StatusBadge tone="neutral">Свободен</StatusBadge>
        ),
    },
    {
      id: 'availability',
      header: 'Использование',
      width: 150,
      hidden: true,
      kind: 'enum',
      value: (v) => (v.vmId ? 'attached' : 'free'),
      options: [
        { value: 'attached', label: 'Подключён' },
        { value: 'free', label: 'Свободен' },
      ],
      description: 'Свободные диски доступны для подключения.',
      render: (v) => (v.vmId ? 'Подключён' : 'Свободен'),
    },
    {
      id: 'boot',
      header: 'Назначение',
      width: 150,
      hidden: true,
      kind: 'enum',
      value: (v) => (v.boot ? 'system' : 'data'),
      options: [
        { value: 'system', label: 'Системный' },
        { value: 'data', label: 'Дополнительный' },
      ],
      description: 'Системный диск содержит загрузочный образ машины.',
      render: (v) => (v.boot ? 'Системный' : 'Дополнительный'),
    },
    {
      id: 'actions',
      utility: 'actions',
      header: 'Действия',
      width: 96,
      pinned: 'end',
      render: (v) => (
        <div className="cloud-cell-actions">
          <Tooltip content={v.vmId ? 'Сначала отключите диск от машины' : 'Удалить диск'}>
            <IconButton
              size="sm"
              variant="ghost"
              tone="danger"
              aria-label={`Удалить диск ${v.name}`}
              icon={<Trash2 />}
              disabled={!!v.vmId}
              onClick={() => setRemove(v)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];
  return (
    <>
      <PageTitle
        title="Диски"
        description={`${rows.reduce((n, v) => n + v.size, 0).toLocaleString('ru-RU')} GiB выделено · системные и дополнительные тома`}
        actions={
          <Button variant="primary" leadingIcon={<Plus />} onClick={() => setCreate(true)}>
            Создать диск
          </Button>
        }
      />
      <PlainTable
        rows={rows}
        columns={columns}
        caption="Диски"
        onRowActivate={setDetail}
        previewRowId={detail?.id}
        placeholder="Имя диска, машина, проект…"
        initialSort={[{ column: 'name', direction: 'asc' }]}
        presets={[
          { label: 'Подключённые', filters: setFilter('availability', ['attached']) },
          { label: 'Свободные', filters: setFilter('availability', ['free']) },
          { label: 'Системные', filters: setFilter('boot', ['system']) },
        ]}
        empty={
          <Empty
            title="Дисков пока нет"
            description="Создайте дополнительный диск для ваших машин."
            action={<Button onClick={() => setCreate(true)}>Создать диск</Button>}
          />
        }
      />
      {create && <ResourceForm kind="volumes" onClose={() => setCreate(false)} />}
      {remove && (
        <DeleteResource
          name={remove.name}
          path={`/volumes/${remove.id}`}
          onClose={() => setRemove(null)}
        />
      )}
      <ContextPanel
        open={!!detail}
        anchor={null}
        presentation="drawer"
        icon={<HardDrive />}
        onClose={() => setDetail(null)}
        title={detail?.name || 'Диск'}
        description="Параметры и подключение диска"
        footer={
          <>
            <Button onClick={() => setDetail(null)}>Закрыть</Button>
            {detail?.vmId && (
              <Button
                variant="primary"
                onClick={() => {
                  navigate(`vms/${detail.vmId}/resources`);
                  setDetail(null);
                }}
              >
                Открыть машину
              </Button>
            )}
          </>
        }
      >
        {detail && (
          <div className="cloud-form-stack">
            <div className="cloud-resource-preview">
              <HardDrive />
              <div>
                <strong>
                  {detail.size} <small>GiB</small>
                </strong>
                <span>
                  {detail.tier.toUpperCase()} ·{' '}
                  {detail.boot ? 'Системный диск' : 'Дополнительный диск'}
                </span>
              </div>
            </div>
            <dl className="cloud-properties">
              <dt>Проект</dt>
              <dd>{projectName(data, detail.projectId)}</dd>
              <dt>Подключение</dt>
              <dd>{data.vms.find((v) => v.id === detail.vmId)?.name || 'Не подключён'}</dd>
              <dt>Доступность</dt>
              <dd>
                <StatusBadge tone={detail.vmId ? 'info' : 'neutral'}>
                  {detail.vmId ? 'Используется' : 'Свободен'}
                </StatusBadge>
              </dd>
            </dl>
            {!detail.vmId && (
              <Message tone="info" title="Готов к подключению">
                Откройте ресурсы машины в этом проекте и выберите «Подключить диск».
              </Message>
            )}
          </div>
        )}
      </ContextPanel>
    </>
  );
}
export function NetworksPage() {
  const { data: source, scope } = useCloud(),
    data = source!;
  const [create, setCreate] = useState(false),
    [remove, setRemove] = useState<CloudNetwork | null>(null),
    [detail, setDetail] = useState<CloudNetwork | null>(null);
  const rows = data.networks.filter((n) => scope === 'all' || n.projectId === scope);
  const vmCount = (id: string) => data.vms.filter((vm) => vm.networkId === id).length;
  const columns: RegistryColumn<CloudNetwork>[] = [
    {
      id: 'name',
      header: 'Название сети',
      width: 230,
      pinned: 'start',
      value: (n) => n.name,
      description: 'Имя изолированной сети проекта. Нажмите на строку для просмотра подключений.',
      render: (n) => (
        <span className="cloud-resource-name">
          <Network size={15} aria-hidden="true" />
          <span title={n.name}>{n.name}</span>
        </span>
      ),
    },
    {
      id: 'cidr',
      header: 'Подсеть',
      width: 180,
      kind: 'ip',
      value: (n) => n.cidr,
      description: 'IPv4-подсеть в формате CIDR. Фильтруется по адресу или префиксу.',
      render: (n) => <span className="cloud-mono">{n.cidr}</span>,
    },
    {
      id: 'vlan',
      header: 'VLAN',
      width: 108,
      kind: 'number',
      value: (n) => n.vlan,
      min: 1,
      max: 4094,
      align: 'right',
      description: 'Идентификатор виртуальной сети, от 1 до 4094.',
      render: (n) => <span className="cloud-number">{n.vlan}</span>,
    },
    {
      id: 'project',
      header: 'Проект',
      width: 160,
      kind: 'enum',
      value: (n) => n.projectId,
      options: data.projects.map((p) => ({ value: p.id, label: p.name })),
      description: 'Область изоляции и доступа к сети.',
      render: (n) => projectName(data, n.projectId),
    },
    {
      id: 'vms',
      header: 'Машины',
      width: 120,
      kind: 'number',
      value: (n) => vmCount(n.id),
      align: 'right',
      description: 'Количество машин, подключённых к этой сети.',
      render: (n) => <span className="cloud-number">{vmCount(n.id)}</span>,
    },
    {
      id: 'actions',
      utility: 'actions',
      header: 'Действия',
      width: 96,
      pinned: 'end',
      render: (n) => (
        <div className="cloud-cell-actions">
          <Tooltip content={vmCount(n.id) ? 'Сеть используется машинами' : 'Удалить сеть'}>
            <IconButton
              size="sm"
              variant="ghost"
              tone="danger"
              aria-label={`Удалить сеть ${n.name}`}
              icon={<Trash2 />}
              disabled={vmCount(n.id) > 0}
              onClick={() => setRemove(n)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];
  const connected: Rule[] = [{ field: 'vms', operator: 'gte', value: '1', to: '', values: [] }],
    free: Rule[] = [{ field: 'vms', operator: 'equals', value: '0', to: '', values: [] }];
  return (
    <>
      <PageTitle
        title="Сети"
        description={`Приватная инфраструктура · ${rows.reduce((n, r) => n + vmCount(r.id), 0)} подключений к машинам`}
        actions={
          <Button variant="primary" leadingIcon={<Plus />} onClick={() => setCreate(true)}>
            Создать сеть
          </Button>
        }
      />
      <PlainTable
        rows={rows}
        columns={columns}
        caption="Сети"
        onRowActivate={setDetail}
        previewRowId={detail?.id}
        placeholder="Название, подсеть, VLAN…"
        initialSort={[{ column: 'name', direction: 'asc' }]}
        presets={[
          { label: 'Используются', filters: connected },
          { label: 'Без подключений', filters: free },
        ]}
        empty={
          <Empty
            title="Сетей пока нет"
            description="Создайте приватную сеть для размещения машин."
            action={<Button onClick={() => setCreate(true)}>Создать сеть</Button>}
          />
        }
      />
      <div className="cloud-registry-context">
        <Network size={16} />
        <span>
          Каждая сеть изолирована в своём проекте. Подключения и IP-адреса доступны в быстром
          просмотре.
        </span>
      </div>
      {create && <ResourceForm kind="networks" onClose={() => setCreate(false)} />}
      {remove && (
        <DeleteResource
          name={remove.name}
          path={`/networks/${remove.id}`}
          onClose={() => setRemove(null)}
        />
      )}
      <ContextPanel
        open={!!detail}
        anchor={null}
        presentation="drawer"
        icon={<Network />}
        onClose={() => setDetail(null)}
        title={detail?.name || 'Сеть'}
        description={
          detail
            ? `${detail.cidr} · VLAN ${detail.vlan} · ${projectName(data, detail.projectId)}`
            : undefined
        }
        footer={<Button onClick={() => setDetail(null)}>Закрыть</Button>}
      >
        {detail && (
          <div className="cloud-form-stack">
            <div className="cloud-resource-preview">
              <Network />
              <div>
                <strong>{detail.cidr}</strong>
                <span>Приватная сеть · VLAN {detail.vlan}</span>
              </div>
            </div>
            <h3 className="cloud-section-title">
              Подключённые машины <span>{vmCount(detail.id)}</span>
            </h3>
            <div className="cloud-connected-list">
              {data.vms
                .filter((vm) => vm.networkId === detail.id)
                .map((vm) => (
                  <Button
                    key={vm.id}
                    variant="ghost"
                    onClick={() => {
                      setDetail(null);
                      navigate(`vms/${vm.id}/network`);
                    }}
                  >
                    <strong>{vm.name}</strong>
                    <span className="cloud-mono">{vm.ip}</span>
                  </Button>
                ))}
              {!vmCount(detail.id) && (
                <Empty
                  title="Нет подключений"
                  description="Сеть можно выбрать при создании машины."
                />
              )}
            </div>
          </div>
        )}
      </ContextPanel>
    </>
  );
}
