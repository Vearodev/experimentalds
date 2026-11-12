import { Play, Power, Terminal } from 'lucide-react';
import { Button, StatusBadge, Tag } from '@basis/ui';
import type { VM } from '../domain';
import { vmMetadata } from '../platform-model';
import { useCloud } from './cloud-state';
import { hostName, projectName, VmState } from './parts';
import {
  CopyValue,
  DetailFacts,
  DetailSection,
  ResourceIdentity,
  ResourceMetrics,
} from './ResourceDetails';

/** A product composition of existing DS components, shared with the resource-page visual language. */
export function VmQuickPreview({
  vm,
  onConsole,
  onPower,
  powerAvailable,
}: {
  vm: VM;
  onConsole: () => void;
  onPower: () => void;
  powerAvailable: boolean;
}) {
  const { data } = useCloud();
  if (!data) return null;
  const running = vm.status === 'running';
  const volumes = data.volumes.filter((volume) => volume.vmId === vm.id);
  const network = data.networks.find((item) => item.id === vm.networkId);
  return (
    <div className="resource-preview">
      <div className="resource-preview__status">
        <VmState vm={vm} />
        {vmMetadata(data, vm.id)?.locked && <StatusBadge tone="warning">Заблокирована</StatusBadge>}
      </div>
      <ResourceMetrics
        items={[
          {
            label: 'Процессоры',
            icon: 'Cpu',
            value: (
              <>
                {vm.cpu}
                <small>vCPU</small>
              </>
            ),
          },
          {
            label: 'Память',
            icon: 'CircuitBoard',
            value: (
              <>
                {vm.memory}
                <small>GiB</small>
              </>
            ),
          },
          {
            label: 'Диски',
            icon: 'HardDrive',
            value: (
              <>
                {volumes.reduce((sum, volume) => sum + volume.size, 0)}
                <small>GiB</small>
              </>
            ),
          },
        ]}
      />
      <div className="resource-preview__actions" aria-label="Управление машиной">
        <Button leadingIcon={<Terminal />} onClick={onConsole}>
          Консоль
        </Button>
        <Button
          leadingIcon={running ? <Power /> : <Play />}
          tone={running ? 'neutral' : 'brand'}
          disabled={!powerAvailable}
          onClick={onPower}
        >
          {running ? 'Выключить' : 'Запустить'}
        </Button>
      </div>
      {vm.description && vm.description !== 'Управляемый ресурс облачной платформы.' && (
        <p className="resource-preview__description">{vm.description}</p>
      )}
      <DetailSection title="Размещение и подключения" icon="Network">
        <DetailFacts
          items={[
            {
              label: 'Ресурсная группа',
              value: (
                <a href={`#cloud/projects/${vm.projectId}`}>{projectName(data, vm.projectId)}</a>
              ),
            },
            {
              label: 'Вычислительный узел',
              value: <a href={`#cloud/nodes/${vm.hostId}`}>{hostName(data, vm.hostId)}</a>,
            },
            {
              label: 'Сеть',
              value: network ? (
                <a href={`#cloud/networks/${network.id}`}>{network.name}</a>
              ) : (
                <span className="resource-unset">Не назначена</span>
              ),
            },
            {
              label: 'IP-адрес',
              value: vm.ip ? (
                <span className="resource-preview__copy">
                  <code>{vm.ip}</code>
                  <CopyValue value={vm.ip} label="IP-адрес" />
                </span>
              ) : (
                <span className="resource-unset">Не назначен</span>
              ),
            },
            { label: 'Образ системы', value: vm.template },
          ]}
        />
      </DetailSection>
      <DetailSection title="Метки" icon="Tags">
        <div className="cloud-tags">
          {vm.tags.length ? (
            vm.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
          ) : (
            <span className="resource-unset">Нет меток</span>
          )}
        </div>
      </DetailSection>
      <ResourceIdentity row={vm} />
    </div>
  );
}
