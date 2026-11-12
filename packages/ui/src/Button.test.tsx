import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Plus } from 'lucide-react';
import { Button, IconButton } from './Button';

describe('Button interaction contract', () => {
  it('does not submit a surrounding form unless explicitly configured', async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <Button>Обычное действие</Button>
        <Button type="submit">Сохранить</Button>
      </form>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Обычное действие' }));
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('supports native Enter and Space activation', async () => {
    const activate = vi.fn();
    render(<Button onClick={activate}>Запустить</Button>);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(activate).toHaveBeenCalledTimes(2);
  });

  it('retains focus during loading and blocks clicks, keyboard activation and form submission', async () => {
    const activate = vi.fn(),
      submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const ref = createRef<HTMLButtonElement>();
    const view = (loading: boolean) => (
      <form onSubmit={submit}>
        <Button
          ref={ref}
          tone="success"
          type="submit"
          loading={loading}
          loadingLabel="Создаём ВМ"
          onClick={activate}
        >
          Создать ВМ
        </Button>
      </form>
    );
    const { rerender } = render(view(false));
    const user = userEvent.setup();
    await user.tab();
    expect(ref.current).toHaveFocus();
    rerender(view(true));
    expect(ref.current).toHaveFocus();
    expect(ref.current).toHaveAccessibleName('Создаём ВМ');
    expect(ref.current).toHaveAttribute('aria-busy', 'true');
    expect(ref.current).not.toBeDisabled();
    await user.keyboard('{Enter} ');
    fireEvent.click(ref.current!);
    expect(activate).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    rerender(view(false));
    await user.keyboard('{Enter}');
    expect(activate).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('skips a native disabled button in the tab order', async () => {
    const activate = vi.fn();
    render(
      <>
        <Button disabled onClick={activate}>
          Недоступна
        </Button>
        <Button>Следующая</Button>
      </>,
    );
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Следующая' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Недоступна' }));
    expect(activate).not.toHaveBeenCalled();
  });

  it('makes an aria-disabled control discoverable without activating it', async () => {
    const activate = vi.fn();
    render(
      <Button aria-disabled onClick={activate}>
        Нужны права администратора
      </Button>,
    );
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await user.keyboard('{Enter} ');
    fireEvent.click(screen.getByRole('button'));
    expect(activate).not.toHaveBeenCalled();
  });

  it('keeps an icon-only button named while its icon is replaced by a loader', () => {
    const { rerender } = render(
      <IconButton icon={<Plus />} aria-label="Создать виртуальную машину" />,
    );
    expect(screen.getByRole('button')).toHaveAccessibleName('Создать виртуальную машину');
    rerender(
      <IconButton icon={<Plus />} tone="info" loading aria-label="Создать виртуальную машину" />,
    );
    expect(screen.getByRole('button')).toHaveAccessibleName('Создать виртуальную машину');
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
});
