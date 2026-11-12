import {
  canChangePlatform,
  groupAccountId,
  listPlatformRecords,
  visiblePlatformRecords,
  scopeContains,
} from '../platform-model';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Server,
  ShieldCheck,
} from 'lucide-react';
import {
  Accordion,
  Button,
  CascadeSelect,
  Checkbox,
  Input,
  InputMask,
  InputTag,
  Message,
  NumberInput,
  Progress,
  RadioGroup,
  Select,
  Slider,
  Switch,
  TableSelect,
  Tabs,
  Tag,
  Textarea,
  type CascadeOption,
  type DataColumn,
} from '@basis/ui';
import {
  templates,
  projectUsage,
  validateVm,
  type FieldErrors,
  type VmDraft,
  type Volume,
} from '../domain';
import { useCloud } from './cloud-state';
import { ApiError } from './api';
import { navigate, PageTitle, projectName } from './parts';

const draftKey = 'basis-cloud-create-draft-v1';
const steps = [
  { id: 'identity', label: '01 · Основное' },
  { id: 'resources', label: '02 · Ресурсы и сеть' },
  { id: 'review', label: '03 · Проверка' },
];
const stepFields = [
  ['name', 'projectId', 'hostId', 'template', 'policyId', 'chipset', 'numa'],
  ['cpu', 'memory', 'rootSize', 'networkId', 'ip', 'mac', 'volumeIds', 'tags', 'description'],
  [],
];
export function CreateVmPage() {
  const { data: source, scope, setScope, mutate, working } = useCloud(),
    data = source!;
  const [draft, setDraft] = useState<VmDraft>(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          data.projects.some((p) => p.id === saved.projectId) &&
          scopeContains(data, scope, saved.projectId)
        )
          return saved;
      }
    } catch {
      /* Start a new draft. */
    }
    const projectId = data.projects.find((p) => scopeContains(data, scope, p.id))?.id || '';
    return {
      name: '',
      accountId: projectId
        ? groupAccountId(data, projectId)
        : visiblePlatformRecords(data, 'accounts').find((r) => r.id === scope)?.id || '',
      projectId,
      hostId: '',
      template: templates[0],
      imageId: 'image-1',
      policyId: 'policy-2',
      chipset: 'Q35',
      numa: 'none',
      cpuPin: false,
      hugepages: false,
      cpu: 4,
      memory: 8,
      rootSize: 40,
      networkId: data.networks.find((n) => n.projectId === projectId)?.id || '',
      dhcp: true,
      ip: '',
      mac: '',
      volumeIds: [],
      tags: [],
      description: '',
      backup: true,
      start: true,
    };
  });
  const [step, setStep] = useState(0),
    [furthest, setFurthest] = useState(0),
    [errors, setErrors] = useState<FieldErrors>({}),
    [failure, setFailure] = useState(''),
    [preset, setPreset] = useState('balanced'),
    [expanded, setExpanded] = useState<string[]>([]);
  const completed = useRef(false),
    form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!completed.current)
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        /* The current form remains usable. */
      }
  }, [draft]);
  const update = <K extends keyof VmDraft>(key: K, value: VmDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };
  const project = data.projects.find((p) => p.id === draft.projectId),
    usage = projectUsage(data, draft.projectId);
  const host = data.hosts.find((h) => h.id === draft.hostId),
    cluster = data.clusters.find((c) => c.id === host?.clusterId),
    network = data.networks.find((n) => n.id === draft.networkId);
  const options: CascadeOption[] = [...new Set(data.clusters.map((c) => c.region))].map(
    (region) => ({
      value: region,
      label: region,
      children: data.clusters
        .filter(
          (c) =>
            c.region === region &&
            listPlatformRecords(data, 'clusters').find((r) => r.id === c.id)?.gridId ===
              listPlatformRecords(data, 'projects').find((r) => r.id === draft.projectId)?.gridId,
        )
        .map((c) => ({
          value: c.id,
          label: c.name,
          description: c.description,
          children: data.hosts
            .filter((h) => h.clusterId === c.id)
            .map((h) => ({
              value: h.id,
              label: h.name,
              description: h.maintenance
                ? 'Техническое обслуживание'
                : `${h.cpu} vCPU · ${h.memory} GiB`,
              disabled: h.maintenance,
            })),
        })),
    }),
  );
  const diskColumns: DataColumn<Volume>[] = [
    {
      id: 'name',
      header: 'Диск',
      width: 230,
      sortable: true,
      render: (v) => <strong>{v.name}</strong>,
    },
    { id: 'size', header: 'GiB', width: 80, align: 'right', sortable: true, render: (v) => v.size },
    { id: 'tier', header: 'Класс', width: 90, render: (v) => v.tier.toUpperCase() },
    {
      id: 'state',
      header: 'Доступность',
      width: 130,
      render: (v) => (
        <Tag tone={v.vmId ? 'neutral' : 'success'}>{v.vmId ? 'Подключён' : 'Свободен'}</Tag>
      ),
    },
  ];
  const setProject = (projectId: string) => {
    setDraft((d) => ({
      ...d,
      projectId,
      accountId: projectId ? groupAccountId(data, projectId) : d.accountId,
      hostId: '',
      networkId: data.networks.find((n) => n.projectId === projectId)?.id || '',
      volumeIds: [],
      ip: '',
    }));
    setErrors({});
  };
  const focusError = () =>
    requestAnimationFrame(() =>
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
  const advance = (next: number) => {
    if (next > step) {
      const invalidTag = form.current?.querySelector<HTMLInputElement>(
        '.basis-input-tag input[aria-invalid="true"]',
      );
      if (invalidTag) {
        invalidTag.focus();
        return;
      }
      const all = validateVm(draft, data),
        relevant = Object.fromEntries(
          Object.entries(all).filter(([key]) => stepFields.slice(0, next).flat().includes(key)),
        );
      if (Object.keys(relevant).length) {
        setErrors(relevant);
        if (['mac', 'tags', 'description'].some((key) => relevant[key])) setExpanded(['advanced']);
        if (stepFields[0].some((key) => relevant[key])) setStep(0);
        focusError();
        return;
      }
    }
    setStep(next);
    setFurthest((v) => Math.max(v, next));
    setFailure('');
    form.current?.closest('.cloud-page-scroll')?.scrollTo({ top: 0 });
  };
  const submit = async () => {
    const all = validateVm(draft, data);
    if (Object.keys(all).length) {
      setErrors(all);
      if (['mac', 'tags', 'description'].some((key) => all[key])) setExpanded(['advanced']);
      setStep(stepFields[0].some((key) => all[key]) ? 0 : 1);
      focusError();
      return;
    }
    setFailure('');
    try {
      const result = await mutate('/vms', draft, 'Машина создаётся');
      completed.current = true;
      sessionStorage.removeItem(draftKey);
      navigate(`vms/${result.id}`);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Не удалось создать машину.');
      if (e instanceof ApiError && Object.keys(e.fields).length) {
        setErrors(e.fields);
        if (['mac', 'tags', 'description'].some((key) => e.fields[key])) setExpanded(['advanced']);
        setStep(stepFields[0].some((key) => e.fields[key]) ? 0 : 1);
        focusError();
      }
    }
  };
  if (canChangePlatform(data, 'vms'))
    return (
      <Message title="Создание недоступно">
        Роль наблюдателя разрешает только просмотр ресурсов.
      </Message>
    );
  return (
    <>
      <PageTitle
        title="Создание виртуальной машины"
        description="Размещение, ресурсы и подключение — с проверкой доступности до создания."
      />
      <form
        ref={form}
        className="cloud-create-layout"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!working) void (step === 2 ? submit() : advance(step + 1));
        }}
      >
        <div className="cloud-create-main">
          <div className="cloud-create-content">
            <Tabs
              label="Шаги создания машины"
              items={steps.map((item, index) => ({
                ...item,
                disabled: index > furthest + 1 || working,
              }))}
              value={steps[step].id}
              onValueChange={(value) => advance(steps.findIndex((item) => item.id === value))}
            >
              {failure && (
                <Message tone="danger" title="Не удалось создать машину">
                  {failure}
                </Message>
              )}
              {step === 0 && (
                <div className="cloud-form-section">
                  <div className="cloud-section-intro">
                    <span>
                      <Server />
                    </span>
                    <div>
                      <h2>Имя и размещение</h2>
                      <p>Ресурсная группа определяет квоты, сети и доступные диски.</p>
                    </div>
                  </div>
                  <Input
                    label="Имя машины"
                    required
                    placeholder="Например, prod-api-03"
                    value={draft.name}
                    onChange={(e) => update('name', e.target.value.toLowerCase())}
                    error={errors.name}
                    hint="Латиница, цифры и дефис · 3–40 символов · уникально в ресурсной группе"
                    maxLength={40}
                    autoFocus
                  />
                  <Select
                    label="Аккаунт"
                    value={
                      draft.accountId ||
                      (draft.projectId ? groupAccountId(data, draft.projectId) : '')
                    }
                    options={visiblePlatformRecords(data, 'accounts').map((r) => ({
                      value: r.id,
                      label: r.name,
                    }))}
                    onValueChange={(accountId) => {
                      update('accountId', accountId);
                      setProject(
                        visiblePlatformRecords(data, 'projects').find(
                          (r) => r.accountId === accountId,
                        )?.id || '',
                      );
                    }}
                  />
                  <div className="cloud-form-grid">
                    <Select
                      label="Ресурсная группа"
                      searchable
                      value={draft.projectId}
                      onValueChange={setProject}
                      options={visiblePlatformRecords(data, 'projects')
                        .filter(
                          (p) =>
                            p.accountId ===
                            (draft.accountId || groupAccountId(data, draft.projectId)),
                        )
                        .map((p) => ({
                          value: p.id,
                          label: p.name,
                          description: String(p.description || ''),
                        }))}
                      error={errors.projectId}
                    />
                    <Select
                      label="Образ операционной системы"
                      value={draft.template}
                      onValueChange={(value: string) => {
                        update('template', value);
                        update(
                          'imageId',
                          listPlatformRecords(data, 'images').find((r) => r.name === value)?.id,
                        );
                      }}
                      options={visiblePlatformRecords(data, 'images')
                        .filter((r) => r.type === 'OS' && r.status === 'ENABLED')
                        .map((image) => ({
                          value: image.name,
                          label: image.name,
                          icon: <Server />,
                        }))}
                      error={errors.template}
                    />
                  </div>
                  {!draft.projectId && (
                    <Message
                      title="В аккаунте пока нет ресурсной группы"
                      action={{
                        label: 'Создать группу',
                        onClick: () => {
                          if (draft.accountId) setScope(draft.accountId);
                          navigate('projects');
                        },
                      }}
                    >
                      Сначала создайте группу и её сеть, затем вернитесь к черновику машины.
                    </Message>
                  )}
                  <CascadeSelect
                    label="Размещение"
                    value={draft.hostId}
                    onValueChange={(value) => update('hostId', value)}
                    options={options}
                    error={errors.hostId}
                    levels={['Площадка', 'Зона', 'Узел']}
                    hint="Площадка → зона → узел. Доступность проверяется для выбранной ресурсной группы."
                  />
                </div>
              )}
              {step === 1 && (
                <div className="cloud-form-section">
                  <div className="cloud-section-intro">
                    <span>
                      <Cpu />
                    </span>
                    <div>
                      <h2>Вычислительные ресурсы</h2>
                      <p>Значения можно уточнить под конкретную нагрузку.</p>
                    </div>
                  </div>
                  <RadioGroup
                    label="Профиль нагрузки"
                    cards
                    value={preset}
                    onValueChange={(value) => {
                      setPreset(value);
                      setDraft((d) => ({
                        ...d,
                        cpu: value === 'compute' ? 8 : 4,
                        memory: value === 'memory' ? 32 : value === 'compute' ? 16 : 8,
                      }));
                    }}
                    options={[
                      {
                        value: 'balanced',
                        label: 'Универсальный',
                        description: '4 vCPU · 8 GiB',
                        icon: <Cloud />,
                      },
                      {
                        value: 'compute',
                        label: 'Вычисления',
                        description: '8 vCPU · 16 GiB',
                        icon: <Cpu />,
                      },
                      {
                        value: 'memory',
                        label: 'Память',
                        description: '4 vCPU · 32 GiB',
                        icon: <MemoryStick />,
                      },
                    ]}
                  />
                  <div className="cloud-form-grid">
                    <div>
                      <NumberInput
                        label="Процессоры"
                        value={draft.cpu}
                        onValueChange={(value) => update('cpu', value)}
                        min={1}
                        max={32}
                        unit="vCPU"
                        error={errors.cpu}
                      />
                      <Slider
                        label="Количество vCPU"
                        value={draft.cpu}
                        onValueChange={(value: number) => update('cpu', value)}
                        min={1}
                        max={32}
                        marks={[1, 8, 16, 32]}
                      />
                    </div>
                    <div>
                      <NumberInput
                        label="Оперативная память"
                        value={draft.memory}
                        onValueChange={(value) => update('memory', value)}
                        min={1}
                        max={128}
                        unit="GiB"
                        error={errors.memory}
                      />
                      <Slider
                        label="Объём памяти"
                        value={draft.memory}
                        onValueChange={(value: number) => update('memory', value)}
                        min={1}
                        max={128}
                        marks={[1, 32, 64, 128]}
                      />
                    </div>
                  </div>
                  {errors.hostId && (
                    <Message title="Недостаточно ресурсов узла" tone="danger">
                      {errors.hostId} Вернитесь на первый шаг и выберите другое размещение.
                    </Message>
                  )}
                  <div className="cloud-section-intro">
                    <span>
                      <HardDrive />
                    </span>
                    <div>
                      <h2>Диски</h2>
                      <p>Системный диск создаётся вместе с машиной.</p>
                    </div>
                  </div>
                  <NumberInput
                    label="Системный диск · SSD"
                    value={draft.rootSize}
                    onValueChange={(value) => update('rootSize', value)}
                    min={20}
                    max={1024}
                    unit="GiB"
                    error={errors.rootSize}
                  />
                  <TableSelect
                    label="Политика хранения системного диска"
                    title="Политика хранения"
                    multiple={false}
                    value={draft.policyId ? [draft.policyId] : []}
                    onValueChange={(ids) => update('policyId', ids[0] || '')}
                    rows={visiblePlatformRecords(data, 'storage-policies')}
                    getRowId={(r) => r.id}
                    getRowLabel={(r) => r.name}
                    searchText={(r) => r.name}
                    columns={[
                      { id: 'name', header: 'Политика', width: 260, render: (r) => r.name },
                      {
                        id: 'replication',
                        header: 'Репликация',
                        width: 160,
                        render: (r) => (r.replication ? 'Поддерживается' : 'Нет'),
                      },
                    ]}
                    isRowSelectable={(r) => r.status === 'ENABLED'}
                    error={errors.policyId}
                  />
                  <TableSelect
                    label="Дополнительные диски"
                    title="Диски аккаунта"
                    placeholder="Выбрать свободные диски"
                    rows={data.volumes.filter(
                      (v) =>
                        listPlatformRecords(data, 'volumes').find((r) => r.id === v.id)
                          ?.accountId === groupAccountId(data, draft.projectId) && !v.boot,
                    )}
                    columns={diskColumns}
                    value={draft.volumeIds}
                    onValueChange={(value) => update('volumeIds', value)}
                    getRowId={(v) => v.id}
                    getRowLabel={(v) => v.name}
                    searchText={(v) => `${v.name} ${v.tier}`}
                    getSortValue={(v, column) => (column === 'size' ? v.size : v.name)}
                    isRowSelectable={(v) => !v.vmId}
                    error={errors.volumeIds}
                    hint="Необязательно. Занятые диски видны, но недоступны для выбора."
                  />
                  <div className="cloud-section-intro">
                    <span>
                      <Network />
                    </span>
                    <div>
                      <h2>Сетевое подключение</h2>
                      <p>Адрес должен быть свободным в выбранной подсети.</p>
                    </div>
                  </div>
                  <Select
                    label="Сеть ViNS"
                    value={draft.networkId}
                    onValueChange={(value: string) => {
                      update('networkId', value);
                      update('ip', '');
                    }}
                    options={data.networks
                      .filter((n) => n.projectId === draft.projectId)
                      .map((n) => ({ value: n.id, label: n.name, description: n.cidr }))}
                    error={errors.networkId}
                  />
                  {!data.networks.some((n) => n.projectId === draft.projectId) && (
                    <Message
                      tone="warning"
                      title="В ресурсной группе нет сети"
                      action={{ label: 'Перейти к сетям', onClick: () => navigate('networks') }}
                    >
                      Черновик машины сохранён в этой вкладке. Создайте сеть и вернитесь к форме.
                    </Message>
                  )}
                  <Checkbox
                    label="Получить IP-адрес автоматически"
                    description="Свободный адрес будет назначен из выбранной подсети."
                    checked={draft.dhcp}
                    onCheckedChange={(value) => update('dhcp', value)}
                  />
                  {!draft.dhcp && (
                    <Input
                      label="IPv4-адрес"
                      placeholder={
                        network?.cidr.split('/')[0].replace(/\.0$/, '.50') || '10.20.0.50'
                      }
                      value={draft.ip}
                      onChange={(e) => update('ip', e.target.value)}
                      error={errors.ip}
                    />
                  )}
                  <Accordion
                    label="Дополнительные параметры машины"
                    value={expanded}
                    onValueChange={setExpanded}
                    items={[
                      {
                        id: 'advanced',
                        title: 'Дополнительные параметры',
                        description: 'MAC-адрес, метки и описание',
                        icon: <ShieldCheck />,
                        content: (
                          <div className="cloud-form-stack">
                            <Select
                              label="Чипсет"
                              value={draft.chipset || 'Q35'}
                              onValueChange={(value) => update('chipset', value)}
                              options={[
                                { value: 'Q35', label: 'Q35' },
                                { value: 'i440fx', label: 'i440fx' },
                              ]}
                            />
                            <Select
                              label="NUMA"
                              value={draft.numa || 'none'}
                              onValueChange={(value) => update('numa', value)}
                              options={[
                                { value: 'none', label: 'Автоматически' },
                                { value: 'loose', label: 'Предпочтительное размещение' },
                                { value: 'strict', label: 'Строгое размещение' },
                              ]}
                            />
                            <Switch
                              label="Закрепление vCPU"
                              checked={draft.cpuPin || false}
                              onCheckedChange={(value) => update('cpuPin', value)}
                            />
                            <Switch
                              label="Huge pages"
                              checked={draft.hugepages || false}
                              onCheckedChange={(value) => update('hugepages', value)}
                            />
                            <InputMask
                              kind="mac"
                              label="MAC-адрес"
                              value={draft.mac}
                              onValueChange={(value) => update('mac', value)}
                              hint="Оставьте пустым для автоматического назначения."
                              error={errors.mac}
                            />
                            <InputTag
                              label="Метки"
                              value={draft.tags}
                              onValueChange={(value) => update('tags', value)}
                              max={8}
                              validate={(value) =>
                                /^[a-z0-9:_-]{1,24}$/i.test(value)
                                  ? undefined
                                  : 'До 24 символов: латиница, цифры, : _ -.'
                              }
                              error={errors.tags}
                              hint="Например, critical, team:platform. Enter добавляет метку."
                            />
                            <Textarea
                              label="Описание"
                              rows={3}
                              value={draft.description}
                              onChange={(e) => update('description', e.target.value)}
                              maxLength={500}
                              error={errors.description}
                              hint={`${draft.description.length} / 500 символов`}
                            />
                          </div>
                        ),
                      },
                    ]}
                  />
                  <Switch
                    label="Включить политику резервного копирования"
                    description="Сохраняет настройку защиты; снимки можно создавать вручную в демо."
                    checked={draft.backup}
                    onCheckedChange={(value) => update('backup', value)}
                  />
                </div>
              )}
              {step === 2 && (
                <div className="cloud-form-section">
                  <div className="cloud-section-intro">
                    <span>
                      <Check />
                    </span>
                    <div>
                      <h2>Всё готово к созданию</h2>
                      <p>
                        Проверьте конфигурацию. Ресурсы будут выделены из квоты ресурсной группы.
                      </p>
                    </div>
                  </div>
                  <dl className="cloud-review-properties">
                    <dt>Имя</dt>
                    <dd>{draft.name}</dd>
                    <dt>Ресурсная группа</dt>
                    <dd>{projectName(data, draft.projectId)}</dd>
                    <dt>Размещение</dt>
                    <dd>
                      {cluster?.region} / {cluster?.name} / {host?.name}
                    </dd>
                    <dt>Образ</dt>
                    <dd>{draft.template}</dd>
                    <dt>Ресурсы</dt>
                    <dd>
                      {draft.cpu} vCPU · {draft.memory} GiB RAM
                    </dd>
                    <dt>Системный диск</dt>
                    <dd>{draft.rootSize} GiB · SSD</dd>
                    <dt>Дополнительные диски</dt>
                    <dd>
                      {draft.volumeIds.length
                        ? data.volumes
                            .filter((v) => draft.volumeIds.includes(v.id))
                            .map((v) => v.name)
                            .join(', ')
                        : 'Не выбраны'}
                    </dd>
                    <dt>Сеть</dt>
                    <dd>
                      {network?.name} · {network?.cidr}
                    </dd>
                    <dt>IP-адрес</dt>
                    <dd>{draft.dhcp ? 'Автоматически' : draft.ip}</dd>
                    <dt>Резервное копирование</dt>
                    <dd>{draft.backup ? 'Политика включена' : 'Выключено'}</dd>
                    {draft.tags.length > 0 && (
                      <>
                        <dt>Метки</dt>
                        <dd className="cloud-tags">
                          {draft.tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </dd>
                      </>
                    )}
                  </dl>
                  <Checkbox
                    checked={draft.start}
                    onCheckedChange={(value) => update('start', value)}
                    label="Запустить после создания"
                    description="Вы сможете открыть консоль, когда завершится фоновая задача."
                  />
                  <Message tone="info" title="Создание занимает несколько секунд">
                    Это локальная демонстрация. Реальная инфраструктура и платные ресурсы не
                    создаются.
                  </Message>
                </div>
              )}
            </Tabs>
          </div>
          <div className="cloud-form-footer">
            <Button disabled={working} variant="ghost" onClick={() => navigate('vms')}>
              Закрыть
            </Button>
            <span />
            {step > 0 && (
              <Button
                leadingIcon={<ArrowLeft />}
                aria-label="Предыдущий шаг"
                disabled={working}
                onClick={() => advance(step - 1)}
              >
                Назад
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              leadingIcon={step === 2 ? <PlusIcon /> : undefined}
              trailingIcon={step < 2 ? <ArrowRight /> : undefined}
              loading={working}
            >
              {step === 2 ? 'Создать машину' : 'Продолжить'}
            </Button>
          </div>
        </div>
        <aside className="cloud-create-summary">
          <span className="cloud-eyebrow">Конфигурация</span>
          <h3>{draft.name || 'Новая машина'}</h3>
          <p>{project?.name}</p>
          <div className="cloud-summary-specs">
            <span>
              <Cpu />
              {draft.cpu} vCPU
            </span>
            <span>
              <MemoryStick />
              {draft.memory} GiB
            </span>
            <span>
              <HardDrive />
              {draft.rootSize} GiB
            </span>
          </div>
          <hr />
          <h3>Квота после создания</h3>
          <Progress
            label="Процессоры"
            compact
            value={project ? ((usage.cpu + draft.cpu) / project.cpuQuota) * 100 : 0}
            status={errors.cpu ? 'error' : 'active'}
            description={`${usage.cpu + draft.cpu} / ${project?.cpuQuota || 0} vCPU`}
          />
          <Progress
            label="Память"
            compact
            value={project ? ((usage.memory + draft.memory) / project.memoryQuota) * 100 : 0}
            status={errors.memory ? 'error' : 'active'}
            description={`${usage.memory + draft.memory} / ${project?.memoryQuota || 0} GiB`}
          />
          <div className="cloud-draft-note">
            <ShieldCheck size={16} />
            <span>Черновик сохраняется в этой вкладке.</span>
          </div>
        </aside>
      </form>
    </>
  );
}
function PlusIcon() {
  return <Server />;
}
