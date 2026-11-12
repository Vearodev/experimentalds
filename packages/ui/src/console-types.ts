export type ConsoleResource = {
  id: string;
  name: string;
  project: string;
  host: string;
  address: string;
  system: string;
  cpu: number;
  memory: number;
  available: boolean;
  unavailableStatus?: 'error' | 'stopped';
};
export type ConsoleStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'stopped';
export type ConsoleLine = { kind: 'output' | 'command' | 'system' | 'error'; text: string };
export type ConsoleSession = {
  resource: ConsoleResource;
  status: ConsoleStatus;
  lines: ConsoleLine[];
  history: string[];
  generation: number;
};
export const consoleStatusLabels: Record<ConsoleStatus, string> = {
  connecting: 'Подключение',
  connected: 'Подключено',
  disconnected: 'Отключено',
  error: 'Ошибка подключения',
  stopped: 'Машина выключена',
};
