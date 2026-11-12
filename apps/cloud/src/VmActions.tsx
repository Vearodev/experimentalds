import { canChangePlatform, listPlatformRecords, vmMetadata } from '../platform-model';
import { useState } from 'react';
import {
  Camera,
  Play,
  Power,
  RotateCw,
  Trash2,
  Terminal,
  Pause,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { Button, CodeInput, Dialog, Menu, Message, type MenuItem } from '@basis/ui';
import { actionNames, busy, type VM, type VmAction } from '../domain';
import { useCloud } from './cloud-state';
import { ApiError } from './api';
import { navigate } from './parts';
import { useVmConsole } from './ConsoleProvider';

export function canAct(vm: VM, action: VmAction, locked = false) {
  if (busy(vm) || locked) return false;
  if (action === 'start') return ['stopped', 'error'].includes(vm.status);
  if (action === 'stop' || action === 'restart') return vm.status === 'running';
  if (action === 'delete') return ['stopped', 'error'].includes(vm.status);
  return vm.status !== 'error';
}
export function useVmActions() {
  const { data, mutate, working, notify } = useCloud();
  const [confirmation, setConfirmation] = useState<{ action: VmAction; vms: VM[] } | null>(null),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [codeError, setCodeError] = useState('');
  const perform = async (action: VmAction, vms: VM[], close = false) => {
    setError('');
    setCodeError('');
    try {
      await mutate(
        '/vms/actions',
        { ids: vms.map((v) => v.id), action, code },
        `${actionNames[action]}: задача создана`,
      );
      if (close) setConfirmation(null);
    } catch (e) {
      if (close) {
        setError(e instanceof Error ? e.message : 'Операция не выполнена.');
        if (e instanceof ApiError) setCodeError(e.fields.code || '');
      } else notify('Операция не выполнена', 'danger', e instanceof Error ? e.message : undefined);
    }
  };
  const act = (action: VmAction, vms: VM[]) => {
    if (working || !vms.length) return;
    if (['stop', 'restart', 'delete'].includes(action)) {
      setConfirmation({ action, vms });
      setError('');
      setCode('');
      setCodeError('');
    } else void perform(action, vms);
  };
  const locked = (vm: VM) =>
    working ||
    Boolean(
      data &&
      (canChangePlatform(
        data,
        'vms',
        listPlatformRecords(data, 'vms').find((r) => r.id === vm.id),
      ) ||
        vmMetadata(data, vm.id)?.locked ||
        vmMetadata(data, vm.id)?.administrativeStatus === 'DISABLED'),
    ) ||
    Boolean(
      data?.tasks.some(
        (t) =>
          t.status === 'running' &&
          (t.vmIds.includes(vm.id) ||
            (t.platformOperation?.entity === 'vms' && t.platformOperation.ids.includes(vm.id))),
      ),
    );
  const available = (vm: VM, action: VmAction) => canAct(vm, action, locked(vm));
  const dialog = (
    <Dialog
      open={Boolean(confirmation)}
      onOpenChange={(open) => {
        if (!open && !working) setConfirmation(null);
      }}
      title={
        confirmation
          ? `${actionNames[confirmation.action]} ${confirmation.vms.length > 1 ? `${confirmation.vms.length} машин` : confirmation.vms[0].name}`
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
            tone={confirmation?.action === 'delete' ? 'danger' : 'warning'}
            loading={working}
            disabled={confirmation?.action === 'delete' && code.length !== 6}
            onClick={() =>
              confirmation && void perform(confirmation.action, confirmation.vms, true)
            }
          >
            {confirmation?.action === 'delete'
              ? 'Удалить машины'
              : confirmation?.action === 'restart'
                ? 'Перезапустить'
                : 'Выключить'}
          </Button>
        </>
      }
    >
      {confirmation && (
        <div className="cloud-form-stack">
          <Message
            tone={confirmation.action === 'delete' ? 'danger' : 'warning'}
            title={
              confirmation.action === 'delete'
                ? 'Системные диски и снимки будут удалены'
                : 'Работа приложений будет прервана'
            }
          >
            {confirmation.action === 'delete'
              ? 'Дополнительные диски останутся в аккаунте и станут свободными. Это демонстрационные ресурсы.'
              : 'Операция применяется ко всем перечисленным машинам. Дождитесь завершения фоновой задачи.'}
          </Message>
          <div className="cloud-confirm-resources">
            {confirmation.vms.map((vm) => (
              <span key={vm.id}>{vm.name}</span>
            ))}
          </div>
          {confirmation.action === 'delete' && (
            <CodeInput
              label="Код подтверждения"
              value={code}
              onValueChange={(value) => {
                setCode(value);
                setCodeError('');
              }}
              error={codeError}
              hint="В этой демонстрации используйте код 642180."
              disabled={working}
            />
          )}
          {error && (
            <Message tone="danger" title="Не удалось выполнить действие">
              {error}
            </Message>
          )}
        </div>
      )}
    </Dialog>
  );
  return { act, available, dialog };
}
export function VmMenu({
  vm,
  act,
  available,
}: {
  vm: VM;
  act: (action: VmAction, vms: VM[]) => void;
  available: (vm: VM, action: VmAction) => boolean;
}) {
  const consoles = useVmConsole();
  const { data, mutate, notify, working } = useCloud();
  const extraBlocked =
    working ||
    Boolean(
      data &&
      (canChangePlatform(data, 'vms') ||
        vmMetadata(data, vm.id)?.locked ||
        data.tasks.some(
          (t) =>
            t.status === 'running' &&
            (t.vmIds.includes(vm.id) ||
              (t.platformOperation?.entity === 'vms' && t.platformOperation.ids.includes(vm.id))),
        )),
    );
  const pauseAction = vm.status === 'paused' ? 'resume' : 'pause';
  const item = (id: VmAction, label: string, icon: React.ReactNode): MenuItem => ({
    id,
    label,
    icon,
    disabled: !available(vm, id),
    danger: id === 'delete',
    description: !available(vm, id)
      ? id === 'delete' && vm.status === 'running'
        ? 'Сначала выключите машину'
        : 'Недоступно в текущем состоянии'
      : undefined,
    onSelect: () => act(id, [vm]),
  });
  return (
    <Menu
      compact
      label={`Действия с ${vm.name}`}
      items={[
        {
          id: 'console',
          label: 'Открыть консоль',
          icon: <Terminal />,
          description: 'Окно поверх портала',
          disabled: Boolean(data && canChangePlatform(data, 'vms')),
          onSelect: () => consoles.openConsole(vm),
        },
        {
          id: 'power',
          label: 'Питание',
          icon: <Power />,
          children: [
            item('start', 'Запустить', <Play />),
            item('stop', 'Выключить', <Power />),
            item('restart', 'Перезапустить', <RotateCw />),
            {
              id: 'pause-resume',
              label: pauseAction === 'pause' ? 'Приостановить' : 'Возобновить',
              icon: <Pause />,
              disabled: extraBlocked || !['running', 'paused'].includes(vm.status),
              onSelect: () => {
                void mutate(`/platform/vms/${vm.id}/${pauseAction}`, {}, 'Операция запущена').catch(
                  (e) => notify('Операция не выполнена', 'danger', e.message),
                );
              },
            },
          ],
        },
        item('snapshot', 'Создать снимок', <Camera />),
        {
          id: 'placement',
          label: 'Размещение и конфигурация',
          icon: <Settings2 />,
          onSelect: () => navigate(`vms/${vm.id}/placement`),
        },
        {
          id: 'security',
          label: 'Безопасность и блокировка',
          icon: <ShieldCheck />,
          onSelect: () => navigate(`vms/${vm.id}/security`),
        },
        { ...item('delete', 'Удалить машину', <Trash2 />), group: 'Удаление' },
      ]}
    />
  );
}
