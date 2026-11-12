import { useState } from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsoleWorkspace } from './ConsoleWorkspace';
import type { ConsoleResource, ConsoleSession } from './console-types';
const resource: ConsoleResource = {
  id: 'a',
  name: 'api-01',
  project: 'Production',
  host: 'host-01',
  address: '10.0.0.1',
  system: 'Ubuntu',
  cpu: 4,
  memory: 8,
  available: true,
};
const sessions: ConsoleSession[] = [resource, { ...resource, id: 'b', name: 'db-01' }].map(
  (resource) => ({
    resource,
    status: 'connected',
    lines: [],
    history: ['hostname'],
    generation: 0,
  }),
);
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function Harness({ onPassword = vi.fn(), onCommand = vi.fn() }) {
  const [activeId, onSelect] = useState('a');
  const [activation, setActivation] = useState(0);
  return (
    <>
      <button onClick={() => setActivation((v) => v + 1)}>Открыть консоли извне</button>
      <ConsoleWorkspace
        activation={activation}
        sessions={sessions}
        activeId={activeId}
        resources={sessions.map((s) => s.resource)}
        onSelect={onSelect}
        onCloseSession={vi.fn()}
        onClose={vi.fn()}
        onOpenResource={vi.fn()}
        onReorder={vi.fn()}
        onCommand={onCommand}
        onPassword={onPassword}
        onSignal={vi.fn()}
        onReconnect={vi.fn()}
        onDisconnect={vi.fn()}
      />
    </>
  );
}
it('restores keyboard focus from an external launcher and isolates console shortcuts', async () => {
  const user = userEvent.setup();
  const shortcut = vi.fn((event: KeyboardEvent) => {
    if (event.ctrlKey && event.key === 'k')
      throw new Error('Portal shortcut must not receive console input');
  });
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Свернуть консоли' }));
  await user.click(screen.getByRole('button', { name: 'Открыть консоли извне' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Команда для api-01' })).toHaveFocus(),
  );
  window.addEventListener('keydown', shortcut);
  try {
    await user.keyboard('{Control>}k{/Control}');
  } finally {
    window.removeEventListener('keydown', shortcut);
  }
  expect(shortcut.mock.calls.some(([event]) => event.ctrlKey && event.key === 'k')).toBe(false);
});
it('preserves a draft per machine and while minimized', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByRole('textbox', { name: 'Команда для api-01' }), 'ip a');
  await user.click(screen.getByRole('tab', { name: 'db-01' }));
  expect(screen.getByRole('textbox', { name: 'Команда для db-01' })).toHaveValue('');
  await user.click(screen.getByRole('tab', { name: 'api-01' }));
  expect(screen.getByRole('textbox', { name: 'Команда для api-01' })).toHaveValue('ip a');
  await user.click(screen.getByRole('button', { name: 'Свернуть консоли' }));
  expect(
    screen.queryByRole('dialog', { name: 'Консоли виртуальных машин' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Развернуть консоли · 2 · api-01' }));
  expect(screen.getByRole('textbox', { name: 'Команда для api-01' })).toHaveValue('ip a');
});
it('clears a password on tab switch and sends only to the current machine', async () => {
  const user = userEvent.setup(),
    send = vi.fn(),
    command = vi.fn();
  render(<Harness onPassword={send} onCommand={command} />);
  await user.click(screen.getByRole('button', { name: 'Ввести пароль' }));
  await user.type(screen.getByLabelText('Пароль гостевой ОС'), 'demo-secret');
  await user.click(screen.getByRole('tab', { name: 'db-01' }));
  await user.click(screen.getByRole('button', { name: 'Ввести пароль' }));
  expect(screen.getByLabelText('Пароль гостевой ОС')).toHaveValue('');
  await user.type(screen.getByLabelText('Пароль гостевой ОС'), 'demo-only');
  await user.click(screen.getByRole('button', { name: 'Ввести' }));
  expect(send).toHaveBeenCalledExactlyOnceWith('b', 'demo-only', true);
  expect(command).not.toHaveBeenCalled();
  expect(document.body).not.toHaveTextContent('demo-only');
  await user.click(screen.getByRole('button', { name: 'Ввести пароль' }));
  expect(screen.getByLabelText('Пароль гостевой ОС')).toHaveValue('');
});
