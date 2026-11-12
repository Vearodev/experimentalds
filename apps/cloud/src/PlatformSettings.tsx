import { useState } from 'react';
import { Pencil, Save } from 'lucide-react';
import { Button, Message, Select, StatusBadge, TableSelect } from '@basis/ui';
import { platformEntity } from '../platform-catalog';
import { canChangePlatform } from '../platform-model';
import type { PlatformEntity, PlatformRecord } from '../platform-types';
import api from '../platform-api.json';
import { useCloud } from './cloud-state';
import { PlatformForm } from './PlatformForm';
import { PlatformFacts } from './ResourceDetails';
import { Panel } from './parts';

export function PlatformRecordSettings({
  entity,
  row,
  fields,
  title,
  description,
}: {
  entity: PlatformEntity;
  row: PlatformRecord;
  fields: string[];
  title: string;
  description?: string;
}) {
  const { data } = useCloud();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Panel
        className="resource-settings"
        title={title}
        subtitle={description}
        action={
          <Button
            size="sm"
            leadingIcon={<Pencil />}
            disabled={Boolean(canChangePlatform(data!, entity.id, row))}
            onClick={(event) => setAnchor(event.currentTarget)}
          >
            Изменить
          </Button>
        }
      >
        <PlatformFacts
          entity={{
            ...entity,
            fields: entity.fields.filter((field) => fields.includes(field.key)),
          }}
          row={row}
          identity={false}
          descriptions
        />
      </Panel>
      {anchor && (
        <PlatformForm
          entity={entity}
          row={row}
          onlyFields={fields}
          sectionTitle={title}
          anchor={anchor}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
export function ApiPermissions({ row }: { row: PlatformRecord }) {
  const { data, mutate, working } = useCloud();
  const [namespace, setNamespace] = useState('cloudapi');
  const [selected, setSelected] = useState<string[]>(() =>
    Array.isArray(row.allowedMethods) ? row.allowedMethods : [],
  );
  const [error, setError] = useState('');
  const options = api.filter((op) => op.namespace === namespace);
  const save = async () => {
    setError('');
    try {
      await mutate(
        `/platform/api-access/${row.id}/permissions`,
        { methods: selected },
        'Разрешения роли обновлены',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить права.');
    }
  };
  return (
    <Panel
      title="Разрешённые методы API"
      subtitle="Роль задаёт доступ к операциям. Доступ к аккаунтам и ресурсным группам назначается отдельно."
    >
      <div className="platform-form">
        <div className="platform-context-line">
          <StatusBadge tone={row.protected ? 'neutral' : 'info'}>
            {row.protected ? 'Системная роль' : 'Настраиваемая роль'}
          </StatusBadge>
          <span>{selected.length} разрешённых методов</span>
        </div>
        <Select
          label="Пространство API"
          value={namespace}
          onValueChange={setNamespace}
          options={['cloudapi', 'cloudbroker', 'sdn', 'system'].map((value) => ({
            value,
            label: value,
          }))}
        />
        <TableSelect
          label="Методы"
          title="Разрешённые методы"
          rows={options}
          columns={[
            { id: 'method', header: 'Метод', width: 300, render: (op) => op.name },
            { id: 'purpose', header: 'Назначение', width: 360, render: (op) => op.summary },
          ]}
          multiple
          value={selected.filter((id) => options.some((op) => op.id === id))}
          onValueChange={(values) =>
            setSelected((current) => [
              ...current.filter((id) => !options.some((op) => op.id === id)),
              ...values,
            ])
          }
          getRowId={(op) => op.id}
          getRowLabel={(op) => op.name}
          searchText={(op) => op.name + ' ' + op.summary}
          disabled={Boolean(row.protected) || Boolean(canChangePlatform(data!, 'api-access', row))}
          hint="Можно выбрать несколько методов. Изменения вступят в силу после сохранения."
        />
        {error && (
          <Message tone="danger" title="Не удалось сохранить">
            {error}
          </Message>
        )}
        <Button
          variant="primary"
          leadingIcon={<Save />}
          loading={working}
          disabled={Boolean(row.protected) || Boolean(canChangePlatform(data!, 'api-access', row))}
          onClick={() => void save()}
        >
          Сохранить разрешения
        </Button>
      </div>
    </Panel>
  );
}
export const vmConfiguration = platformEntity('vms')!;
