import { scopeContains, platformState } from '../platform-model';
import { createContext, useContext, type ReactNode } from 'react';
import { ConsoleWorkspace, type ConsoleResource } from '@basis/ui';
import { useCloud } from './cloud-state';
import { useConsoleSessions } from './useConsoleSessions';
import type { VM } from '../domain';
const ConsoleContext = createContext<{
  count: number;
  openConsole: (vm: VM) => void;
  restore: () => void;
} | null>(null);
export function ConsoleProvider({ children }: { children: ReactNode }) {
  const { data } = useCloud();
  const resources: ConsoleResource[] = (data?.vms || [])
    .filter((vm) => data && scopeContains(data, 'all', vm.projectId))
    .map((vm) => ({
      id: vm.id,
      name: vm.name,
      project: data?.projects.find((p) => p.id === vm.projectId)?.name || 'Ресурсная группа',
      host: data?.hosts.find((h) => h.id === vm.hostId)?.name || 'Узел',
      address: vm.ip,
      system: vm.template,
      cpu: vm.cpu,
      memory: vm.memory,
      available: vm.status === 'running' && Boolean(data && platformState(data).mode !== 'reader'),
      unavailableStatus: vm.status === 'error' ? 'error' : 'stopped',
    }));
  const console = useConsoleSessions(resources);
  return (
    <ConsoleContext.Provider
      value={{
        count: console.state.sessions.length,
        openConsole: (vm) => {
          const resource = resources.find((r) => r.id === vm.id);
          if (resource) console.open(resource);
        },
        restore: () => console.dispatch({ type: 'restore' }),
      }}
    >
      {children}
      <ConsoleWorkspace {...console.props} />
    </ConsoleContext.Provider>
  );
}
export function useVmConsole() {
  const context = useContext(ConsoleContext);
  if (!context) throw new Error('ConsoleProvider is required.');
  return context;
}
