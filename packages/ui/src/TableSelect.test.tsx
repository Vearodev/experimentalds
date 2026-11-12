import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { TableSelect } from './TableSelect';
// jsdom has no top-layer implementation; browser QA verifies placement and focus.
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
});
afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
const rows = [
  { id: 'a', name: 'disk-a', busy: false },
  { id: 'b', name: 'disk-b', busy: false },
  { id: 'c', name: 'disk-c', busy: true },
];
const source = {
  rows,
  columns: [
    { id: 'name', header: 'Имя', width: 220, render: (row: (typeof rows)[number]) => row.name },
  ],
  getRowId: (row: (typeof rows)[number]) => row.id,
  getRowLabel: (row: (typeof rows)[number]) => row.name,
  searchText: (row: (typeof rows)[number]) => row.name,
  isRowSelectable: (row: (typeof rows)[number]) => !row.busy,
};
it('preserves draft selections through search, skips unavailable rows and commits only on apply', async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(
    <TableSelect
      {...source}
      label="Диски"
      title="Выбор дисков"
      value={['a']}
      onValueChange={change}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Диски' }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByRole('textbox', { name: 'Поиск: Выбор дисков' }), 'disk-b');
  await user.click(within(dialog).getByRole('checkbox', { name: 'Выбрать disk-b' }));
  expect(change).not.toHaveBeenCalled();
  await user.clear(within(dialog).getByRole('textbox', { name: 'Поиск: Выбор дисков' }));
  expect(within(dialog).getByRole('checkbox', { name: 'Выбрать disk-a' })).toBeChecked();
  expect(within(dialog).getByRole('checkbox', { name: 'Выбрать disk-c' })).toBeDisabled();
  await user.click(within(dialog).getByRole('button', { name: 'Применить · 2' }));
  expect(change).toHaveBeenCalledWith(['a', 'b']);
});
it('discards cancelled changes and gives single selection radio semantics', async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(
    <TableSelect {...source} label="Диск" value={['a']} onValueChange={change} multiple={false} />,
  );
  await user.click(screen.getByRole('button', { name: 'Диск' }));
  expect(
    screen.queryByRole('checkbox', { name: 'Выбрать все видимые строки' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('radio', { name: 'Выбрать disk-b' }));
  expect(screen.getByRole('radio', { name: 'Выбрать disk-a' })).not.toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(change).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Диск' }));
  expect(screen.getByRole('radio', { name: 'Выбрать disk-a' })).toBeChecked();
});
