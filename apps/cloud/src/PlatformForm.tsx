import { useId, useRef, useState } from 'react';
import { ArrowRight, Check, Save } from 'lucide-react';
import {
  Button,
  ContextPanel,
  Input,
  InputTag,
  Message,
  NumberInput,
  PasswordInput,
  Select,
  Switch,
  TableSelect,
  Tabs,
  Textarea,
  StatusBadge,
} from '@basis/ui';
import { platformStatusLabels, platformTone } from '../platform-catalog';
import {
  groupAccountId,
  listPlatformRecords,
  platformRecordName,
  platformState,
  visiblePlatformRecords,
} from '../platform-model';
import type {
  PlatformEntity,
  PlatformField,
  PlatformRecord,
  PlatformValue,
} from '../platform-types';
import { useCloud } from './cloud-state';
import { ApiError } from './api';
import { PlatformIcon } from './PlatformIcon';
import { navigate } from './parts';

export function PlatformForm({
  entity,
  row,
  initial = {},
  anchor,
  onClose,
  onCreated,
  onlyFields,
  sectionTitle,
}: {
  entity: PlatformEntity;
  row?: PlatformRecord;
  initial?: Record<string, PlatformValue>;
  anchor: HTMLElement | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
  onlyFields?: string[];
  sectionTitle?: string;
}) {
  const { data: source, scope, mutate, working } = useCloud(),
    data = source!;
  const formId = useId(),
    form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Record<string, PlatformValue>>(() => {
    const preset: Record<string, PlatformValue> = Object.fromEntries(
      entity.fields
        .filter((f) => f.initial !== undefined || f.kind === 'number')
        .map((f) => [f.key, f.initial ?? f.min ?? 0]),
    );
    if (scope !== 'all') {
      if (data.projects.some((p) => p.id === scope)) {
        preset.rgId = scope;
        preset.accountId = groupAccountId(data, scope);
      } else preset.accountId = scope;
    } else if (platformState(data).mode !== 'admin')
      preset.accountId = platformState(data).accountId;
    return {
      name: '',
      ...preset,
      ...(row
        ? (Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined),
          ) as Record<string, PlatformValue>)
        : {}),
      ...initial,
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [failure, setFailure] = useState(''),
    [step, setStep] = useState('parameters');
  const fields = entity.fields.filter(
    (field) =>
      (!['security-rules', 'sdn-rules'].includes(entity.id) ||
        !['portMin', 'portMax', 'port'].includes(field.key) ||
        ['tcp', 'udp'].includes(String(draft.protocol))) &&
      (!onlyFields || onlyFields.includes(field.key)) &&
      field.form !== false &&
      !field.readonly &&
      field.kind !== 'date' &&
      initial[field.key] === undefined &&
      !(
        entity.id === 'members' &&
        ((initial.accessGroupId && ['accountId', 'rgId'].includes(field.key)) ||
          (initial.rgId && ['accountId', 'accessGroupId'].includes(field.key)) ||
          (initial.accountId && ['rgId', 'accessGroupId'].includes(field.key)))
      ) &&
      !(row && field.kind === 'password'),
  );
  const staged = fields.length > 7;
  const hardwareFields = ['chipset', 'numa', 'cpuPin', 'hugepages'];
  const hardwareLocked = entity.id === 'vms' && row && row.status !== 'STOPPED';
  const choicesFor = (field: PlatformField) => {
    if (!field.reference) return [];
    return visiblePlatformRecords(data, field.reference).filter((r) => {
      if (
        draft.accountId &&
        r.accountId &&
        field.reference !== 'accounts' &&
        r.accountId !== draft.accountId
      )
        return false;
      if (field.key === 'vinsId' && draft.rgId && r.rgId !== draft.rgId) return false;
      if (field.key === 'nodeId' && draft.zoneId && r.zoneId !== draft.zoneId) return false;
      if (field.key === 'zoneId' && draft.gridId && r.gridId !== draft.gridId) return false;
      if (
        draft.accessGroupId &&
        r.accessGroupId &&
        field.key !== 'accessGroupId' &&
        r.accessGroupId !== draft.accessGroupId
      )
        return false;
      if (
        field.key === 'sepId' &&
        draft.policyId &&
        r.id !==
          listPlatformRecords(data, 'storage-policies').find((p) => p.id === draft.policyId)?.sepId
      )
        return false;
      if (field.key === 'backendId' && draft.lbId && r.lbId !== draft.lbId) return false;
      return true;
    });
  };
  const update = (key: string, value: PlatformValue) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === 'protocol') {
        next.portMin = null;
        next.portMax = null;
        next.port = null;
      }
      if (key === 'ethertype') next.cidr = '';
      if (key === 'policyId') {
        const policy = listPlatformRecords(data, 'storage-policies').find((r) => r.id === value);
        if (policy?.sepId) next.sepId = String(policy.sepId);
      }
      if (key === 'accountId') {
        next.rgId = '';
        next.vinsId = '';
      }
      if (key === 'rgId') {
        next.vinsId = '';
        next.accountId = groupAccountId(data, String(value));
      }
      if (key === 'accessGroupId')
        for (const dependent of [
          'segmentId',
          'portId',
          'networkObjectId',
          'externalNetworkId',
          'poolId',
        ])
          next[dependent] = '';
      if (key === 'zoneId') next.nodeId = '';
      if (key === 'k8ciId') {
        const config = listPlatformRecords(data, 'k8ci').find((r) => r.id === value);
        if (Array.isArray(config?.plugins) && !config.plugins.includes(String(next.networkPlugin)))
          next.networkPlugin = config.plugins[0] || '';
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: '' }));
    setFailure('');
  };
  const check = () => {
    const issues: Record<string, string> = {};
    if (!String(draft.name || '').trim()) issues.name = 'Укажите название.';
    for (const field of fields)
      if (
        field.required &&
        (draft[field.key] === undefined ||
          draft[field.key] === '' ||
          draft[field.key] === null ||
          (Array.isArray(draft[field.key]) && !(draft[field.key] as string[]).length))
      )
        issues[field.key] = 'Обязательное поле.';
    for (const field of fields)
      if (
        field.kind === 'number' &&
        draft[field.key] != null &&
        (Number(draft[field.key]) < (field.min ?? 0) ||
          Number(draft[field.key]) > (field.max ?? 1_000_000))
      )
        issues[field.key] = 'Значение вне допустимого диапазона.';
    if (
      ['security-rules', 'sdn-rules'].includes(entity.id) &&
      ['tcp', 'udp'].includes(String(draft.protocol))
    )
      for (const key of entity.id === 'security-rules' ? ['portMin', 'portMax'] : ['port'])
        if (!draft[key]) issues[key] = 'Укажите порт.';
    setErrors(issues);
    if (Object.keys(issues).length) {
      setFailure('Проверьте выделенные поля.');
      return false;
    }
    return true;
  };
  const submit = async () => {
    if (!check()) {
      setStep('parameters');
      return;
    }
    if (staged && step === 'parameters') {
      setStep('review');
      return;
    }
    setFailure('');
    try {
      const result = await mutate(
        `/platform/${entity.id}${row ? `/${row.id}` : ''}`,
        draft,
        row ? 'Изменения приняты' : 'Создание началось',
        row ? 'PATCH' : 'POST',
      );
      setDraft({ name: '' });
      onClose();
      if (!row && result.id) {
        if (onCreated) onCreated(result.id);
        else navigate(`${entity.id}/${result.id}`);
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Не удалось сохранить ресурс.');
      if (error instanceof ApiError && Object.keys(error.fields).length) {
        setErrors(error.fields);
        setStep('parameters');
      }
    }
  };
  const renderField = (field: PlatformField) => {
    const value = draft[field.key],
      error = errors[field.key];
    const common = {
      label: field.label,
      required: field.required,
      disabled: Boolean(hardwareLocked && hardwareFields.includes(field.key)),
      error,
      hint:
        field.reference || field.description !== field.label + '.' ? field.description : undefined,
    };
    if (field.reference) {
      const choices = choicesFor(field);
      if (['policyId', 'nodeId', 'vmId', 'k8ciId', 'sepId', 'pgpuId'].includes(field.key))
        return (
          <TableSelect
            {...common}
            title={field.label}
            placeholder="Выберите ресурс"
            multiple={false}
            value={value ? [String(value)] : []}
            onValueChange={(ids) => update(field.key, ids[0] || '')}
            rows={choices}
            getRowId={(r) => r.id}
            getRowLabel={(r) => r.name}
            searchText={(r) => `${r.name} ${r.id} ${r.description || ''}`}
            columns={[
              { id: 'name', header: 'Название', width: 260, render: (r) => r.name },
              {
                id: 'status',
                header: 'Состояние',
                width: 160,
                render: (r) => (
                  <StatusBadge tone={platformTone(r.status)}>
                    {platformStatusLabels[r.status] || r.status}
                  </StatusBadge>
                ),
              },
            ]}
            isRowSelectable={(r) => !['DISABLED', 'MAINTENANCE', 'BLOCKED'].includes(r.status)}
          />
        );
      return (
        <Select
          {...common}
          value={String(value || '')}
          onValueChange={(v) => update(field.key, v)}
          options={[
            ...(field.required ? [] : [{ value: '', label: 'Не задано' }]),
            ...choices.map((r) => ({
              value: r.id,
              label: r.name,
              description: r.description ? String(r.description) : r.id,
              disabled: ['DISABLED', 'MAINTENANCE', 'BLOCKED'].includes(r.status),
            })),
          ]}
          placeholder={field.required ? 'Выберите ресурс' : 'Не задано'}
        />
      );
    }
    if (field.kind === 'number')
      return (
        <NumberInput
          {...common}
          value={Number(value ?? 0)}
          onValueChange={(v) => update(field.key, v)}
          min={field.min ?? 0}
          max={field.max ?? 1_000_000}
          step={1}
          unit={field.unit}
        />
      );
    if (field.kind === 'boolean')
      return (
        <Switch
          disabled={common.disabled}
          label={field.label}
          description={field.description}
          checked={Boolean(value)}
          onCheckedChange={(checked) => update(field.key, checked)}
        />
      );
    if (field.kind === 'enum') {
      let options = field.options || [];
      if (field.key === 'networkPlugin' && draft.k8ciId) {
        const config = listPlatformRecords(data, 'k8ci').find((r) => r.id === draft.k8ciId);
        if (Array.isArray(config?.plugins))
          options = options.filter((o) => (config.plugins as string[]).includes(o.value));
      }
      return (
        <Select
          {...common}
          value={String(value || '')}
          onValueChange={(v) => update(field.key, v)}
          options={[
            ...(field.required ? [] : [{ value: '', label: 'Не задано' }]),
            ...options.map((o) => ({ ...o, label: platformStatusLabels[o.value] || o.label })),
          ]}
        />
      );
    }
    if (field.kind === 'textarea')
      return (
        <Textarea
          {...common}
          value={String(value || '')}
          onChange={(e) => update(field.key, e.target.value)}
          rows={3}
        />
      );
    if (field.kind === 'tags')
      return (
        <InputTag
          {...common}
          value={Array.isArray(value) ? value : []}
          onValueChange={(v) => update(field.key, v)}
          placeholder="Введите значение и нажмите Enter"
        />
      );
    if (field.kind === 'password')
      return (
        <PasswordInput
          {...common}
          value={String(value || '')}
          onChange={(e) => update(field.key, e.target.value)}
          autoComplete="new-password"
        />
      );
    return (
      <Input
        {...common}
        value={String(value || '')}
        onChange={(e) => update(field.key, e.target.value)}
        required={field.required}
      />
    );
  };
  return (
    <ContextPanel
      open
      anchor={anchor}
      title={
        sectionTitle && row
          ? `${sectionTitle} · ${row.name}`
          : row
            ? `Изменение · ${row.name}`
            : entity.createLabel || `Создание · ${entity.singular.toLocaleLowerCase()}`
      }
      description={sectionTitle ? undefined : entity.description}
      icon={<PlatformIcon name={entity.icon} />}
      presentation="drawer"
      onClose={onClose}
      footer={
        <>
          <Button onClick={staged && step === 'review' ? () => setStep('parameters') : onClose}>
            {staged && step === 'review' ? 'Назад' : 'Отмена'}
          </Button>
          <Button
            variant="primary"
            leadingIcon={
              staged && step === 'parameters' ? <ArrowRight /> : row ? <Save /> : <Check />
            }
            loading={working}
            type="submit"
            form={formId}
          >
            {staged && step === 'parameters' ? 'Проверить' : row ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        ref={form}
        noValidate
        className="platform-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {staged && (
          <Tabs
            items={[
              { id: 'parameters', label: 'Параметры' },
              { id: 'review', label: 'Проверка' },
            ]}
            value={step}
            onValueChange={(next) => {
              if (next === 'parameters' || check()) setStep(next);
            }}
            label="Шаги формы"
          />
        )}
        {failure && (
          <Message tone="danger" title="Проверьте параметры">
            {failure}
          </Message>
        )}
        {hardwareLocked && fields.some((field) => hardwareFields.includes(field.key)) && (
          <Message tone="info" title="Аппаратные параметры доступны после выключения" compact>
            Выключите машину, чтобы изменить чипсет, NUMA и параметры памяти. Выбор узла остаётся
            доступен.
          </Message>
        )}
        {step === 'review' ? (
          <>
            <Message tone="info" title="Проверьте конфигурацию">
              После подтверждения операция появится в журнале задач.
            </Message>
            <dl className="platform-facts">
              <div>
                <dt>Название</dt>
                <dd>{String(draft.name)}</dd>
              </div>
              {fields
                .filter(
                  (field) =>
                    field.kind !== 'password' &&
                    draft[field.key] !== undefined &&
                    draft[field.key] !== '',
                )
                .map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>
                      {field.reference
                        ? platformRecordName(data, field.reference, draft[field.key])
                        : Array.isArray(draft[field.key])
                          ? (draft[field.key] as string[]).join(', ')
                          : typeof draft[field.key] === 'boolean'
                            ? draft[field.key]
                              ? 'Да'
                              : 'Нет'
                            : platformStatusLabels[String(draft[field.key])] ||
                              String(draft[field.key])}{' '}
                      {field.unit}
                    </dd>
                  </div>
                ))}
            </dl>
          </>
        ) : (
          <>
            {!onlyFields && (
              <Input
                label={entity.id === 'users' ? 'Имя пользователя' : 'Название'}
                value={String(draft.name || '')}
                onChange={(event) => update('name', event.target.value)}
                error={errors.name}
                required
                autoFocus
                maxLength={80}
              />
            )}
            <div className="platform-form-fields">
              {fields.map((field) => (
                <div key={field.key} data-field={field.key} data-numeric={field.kind === 'number'}>
                  {renderField(field)}
                </div>
              ))}
            </div>
          </>
        )}
        {!row && entity.id === 'users' && (
          <Message tone="info" title="Демонстрационная учётная запись">
            Внешний провайдер авторизации не вызывается. Пароль не сохраняется.
          </Message>
        )}
      </form>
    </ContextPanel>
  );
}
