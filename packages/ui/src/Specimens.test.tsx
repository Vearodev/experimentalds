import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Select } from './Choice';
import { Slider } from './Feedback';
it('select focuses the selected option, skips disabled options and restores focus', async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(
    <Select
      label="Регион"
      value="b"
      onValueChange={change}
      options={[
        { value: 'a', label: 'Первый' },
        { value: 'b', label: 'Второй' },
        { value: 'c', label: 'Недоступный', disabled: true },
      ]}
    />,
  );
  const trigger = screen.getByRole('combobox');
  await user.click(trigger);
  expect(screen.getByRole('option', { name: 'Второй' })).toHaveFocus();
  await user.keyboard('{ArrowDown}{Enter}');
  expect(change).toHaveBeenCalledWith('a');
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('range sliders share one domain and clamp values at the other thumb', () => {
  const change = vi.fn();
  render(<Slider label="CPU" range value={[20, 80]} min={0} max={100} onValueChange={change} />);
  const [low, high] = screen.getAllByRole('slider');
  expect(low).toHaveAttribute('max', '100');
  expect(high).toHaveAttribute('min', '0');
  fireEvent.change(low, { target: { value: '90' } });
  expect(change).toHaveBeenLastCalledWith([80, 80]);
  fireEvent.change(high, { target: { value: '10' } });
  expect(change).toHaveBeenLastCalledWith([20, 20]);
});
