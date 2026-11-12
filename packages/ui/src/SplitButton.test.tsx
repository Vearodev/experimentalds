import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SplitButton } from './SplitButton';

describe('SplitButton keyboard behavior', () => {
  it('skips unavailable options, selects with Enter and restores trigger focus', async () => {
    const action = vi.fn();
    function Example() {
      const [value, setValue] = useState('vm');
      return (
        <SplitButton
          value={value}
          onValueChange={setValue}
          onAction={action}
          actions={[
            { id: 'vm', label: 'Создать ВМ' },
            { id: 'disk', label: 'Создать диск', disabled: true },
            { id: 'network', label: 'Создать сеть' },
          ]}
        />
      );
    }
    render(<Example />);
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Выбрать действие' });
    await user.click(trigger);
    expect(screen.getByRole('menuitemradio', { name: 'Создать ВМ' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Создать сеть' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Создать сеть' }));
    expect(action).toHaveBeenCalledWith('network');
  });

  it('opens with ArrowDown and dismisses with Escape without executing an action', async () => {
    const action = vi.fn();
    render(
      <SplitButton
        value="vm"
        onValueChange={vi.fn()}
        onAction={action}
        actions={[{ id: 'vm', label: 'Создать ВМ' }]}
      />,
    );
    const user = userEvent.setup();
    await user.tab();
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Выбрать действие' })).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
});
