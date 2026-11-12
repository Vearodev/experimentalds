import type { ConsoleLine, ConsoleResource, ConsoleSession, ConsoleStatus } from '@basis/ui';
export type ConsoleState = { sessions: ConsoleSession[]; activeId: string; activation: number };
export const emptyConsoles: ConsoleState = { sessions: [], activeId: '', activation: 0 };
export type ConsoleAction =
  | { type: 'open'; resource: ConsoleResource }
  | { type: 'select' | 'close' | 'reconnect'; id: string }
  | { type: 'status'; id: string; status: ConsoleStatus; generation?: number }
  | { type: 'command'; id: string; command: string }
  | { type: 'signal'; id: string; signal: string }
  | { type: 'password'; id: string; enter: boolean }
  | { type: 'reorder'; ids: string[] }
  | { type: 'sync'; resources: ConsoleResource[] }
  | { type: 'clear' }
  | { type: 'restore' };
const welcome = (r: ConsoleResource): ConsoleLine[] => [
  { kind: 'output', text: `${r.system} · ${r.name}` },
  { kind: 'system', text: 'help — доступные команды' },
];
function response(command: string, r: ConsoleResource): string {
  const values: Record<string, string> = {
    help: 'help       доступные команды\nstatus     сведения о машине\nhostname   имя машины\nip a       сетевые интерфейсы\nuptime     время работы\nfree -h    память\ndf -h      диски\nwhoami     пользователь\nclear      очистить экран',
    hostname: r.name,
    whoami: 'root',
    pwd: '/root',
    ls: 'backups  cloud-init.log  scripts',
    status: `${r.name}: running\n${r.cpu} vCPU · ${r.memory} GiB RAM · ${r.system}`,
    ip: `eth0  UP  ${r.address}/24`,
    'ip a': `1: lo    inet 127.0.0.1/8\n2: eth0  UP\n   inet ${r.address}/24 scope global eth0`,
    uptime: 'up 12 days, 04:38, 1 user, load average: 0.12, 0.08, 0.06',
    'free -h': `              total     used      free\nMem:          ${r.memory} GiB     ${(r.memory * 0.34).toFixed(1)} GiB   ${(r.memory * 0.66).toFixed(1)} GiB\nSwap:         0 B       0 B       0 B`,
    'df -h':
      'Filesystem    Size   Used   Avail   Use%  Mounted on\n/dev/vda1     80G    18G    62G     23%   /',
    'uname -a': `Linux ${r.name} 6.8.0-generic x86_64 GNU/Linux`,
  };
  return values[command] || `Команда «${command}» недоступна в демонстрации. Введите help.`;
}
export function consoleReducer(state: ConsoleState, action: ConsoleAction): ConsoleState {
  if (action.type === 'clear') return { ...emptyConsoles, activation: state.activation };
  if (action.type === 'restore') return { ...state, activation: state.activation + 1 };
  if (action.type === 'open') {
    const exists = state.sessions.some((s) => s.resource.id === action.resource.id);
    return {
      activeId: action.resource.id,
      activation: state.activation + 1,
      sessions: exists
        ? state.sessions
        : [
            ...state.sessions,
            {
              resource: action.resource,
              status: action.resource.available
                ? 'connecting'
                : action.resource.unavailableStatus || 'stopped',
              lines: welcome(action.resource),
              history: [],
              generation: state.activation + 1,
            },
          ],
    };
  }
  if (action.type === 'select')
    return state.sessions.some((s) => s.resource.id === action.id)
      ? { ...state, activeId: action.id }
      : state;
  if (action.type === 'close') {
    const index = state.sessions.findIndex((s) => s.resource.id === action.id);
    const sessions = state.sessions.filter((s) => s.resource.id !== action.id);
    return {
      ...state,
      sessions,
      activeId:
        state.activeId === action.id
          ? sessions[Math.min(index, sessions.length - 1)]?.resource.id || ''
          : state.activeId,
    };
  }
  if (action.type === 'reorder') {
    if (
      new Set(action.ids).size !== state.sessions.length ||
      action.ids.length !== state.sessions.length ||
      action.ids.some((id) => !state.sessions.some((s) => s.resource.id === id))
    )
      return state;
    return {
      ...state,
      sessions: action.ids.map((id) => state.sessions.find((s) => s.resource.id === id)!),
    };
  }
  if (action.type === 'sync')
    return {
      ...state,
      sessions: state.sessions.map((s) => {
        const resource = action.resources.find((r) => r.id === s.resource.id);
        return !resource
          ? {
              ...s,
              resource: { ...s.resource, available: false },
              status: 'error',
              generation: s.generation + 1,
            }
          : {
              ...s,
              resource,
              status: !resource.available
                ? resource.unavailableStatus || 'stopped'
                : !s.resource.available
                  ? 'disconnected'
                  : s.status,
              generation: !resource.available ? s.generation + 1 : s.generation,
            };
      }),
    };
  return {
    ...state,
    sessions: state.sessions.map((s): ConsoleSession => {
      if (s.resource.id !== action.id) return s;
      if (action.type === 'reconnect')
        return {
          ...s,
          status: s.resource.available ? 'connecting' : s.resource.unavailableStatus || 'stopped',
          generation: s.generation + 1,
        };
      if (action.type === 'status')
        return action.generation !== undefined && action.generation !== s.generation
          ? s
          : {
              ...s,
              status: action.status,
              generation: action.generation === undefined ? s.generation + 1 : s.generation,
            };
      if (s.status !== 'connected') return s;
      let lines: ConsoleLine[] = [];
      if (action.type === 'password')
        lines = [
          {
            kind: 'system',
            text: `Пароль передан в ${s.resource.name}${action.enter ? ' · Enter отправлен' : ''}. Значение не сохраняется.`,
          },
        ];
      if (action.type === 'signal')
        lines = [{ kind: 'system', text: `Отправлено: ${action.signal}` }];
      if (action.type === 'command') {
        const command = action.command.trim().slice(0, 1024);
        if (!command) return s;
        const history = [...s.history.filter((v) => v !== command), command].slice(-50);
        if (command === 'clear') return { ...s, lines: [], history };
        lines = [
          { kind: 'command', text: `root@${s.resource.name}:~# ${command}` },
          { kind: 'output', text: response(command, s.resource) },
        ];
        return { ...s, lines: [...s.lines, ...lines].slice(-200), history };
      }
      return { ...s, lines: [...s.lines, ...lines].slice(-200) };
    }),
  };
}
