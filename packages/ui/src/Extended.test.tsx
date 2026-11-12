import { useState } from 'react';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  CodeInput,
  InputMask,
  InputTag,
  RadioGroup,
  formatMask,
  maskError,
  maskRaw,
} from './StructuredFields';
import { Accordion, Breadcrumb, Menu } from './Disclosure';
import { Avatar, Badge, Chip } from './Identity';
import { CascadeSelect } from './CascadeSelect';
import { ToastRegion, type ToastItem } from './Notifications';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
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
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('code paste uses one editable value and preserves keyboard editing', async () => {
  const user = userEvent.setup();
  function Harness() {
    const [value, setValue] = useState('');
    return <CodeInput value={value} onValueChange={setValue} />;
  }
  render(<Harness />);
  const input = screen.getByRole('textbox');
  await user.click(input);
  await user.paste('64 21-80 extra');
  expect(input).toHaveValue('642180');
  await user.keyboard('{End}{Backspace}');
  expect(input).toHaveValue('64218');
  await user.keyboard('0');
  expect(input).toHaveValue('642180');
});
it('tag input deduplicates pasted values, retains invalid drafts, and enforces its limit', async () => {
  const user = userEvent.setup();
  function Harness() {
    const [value, setValue] = useState(['production']);
    return (
      <InputTag
        label="Метки"
        value={value}
        onValueChange={setValue}
        max={3}
        validate={(v) => (v.includes(' ') ? 'Без пробелов' : undefined)}
      />
    );
  }
  render(<Harness />);
  const input = screen.getByRole('textbox');
  await user.click(input);
  await user.paste('Production, msk, bad value, daily');
  expect(screen.getAllByRole('button', { name: /Удалить метку/ })).toHaveLength(3);
  expect(input).toHaveValue('bad value');
  expect(screen.getByRole('alert')).toHaveTextContent('Без пробелов');
  await user.clear(input);
  await user.type(input, 'four{Enter}');
  expect(screen.getByRole('alert')).toHaveTextContent('Не больше 3');
  expect(input).toHaveValue('four');
  await user.clear(input);
  await user.keyboard('{Backspace}');
  expect(screen.getAllByRole('button', { name: /Удалить метку/ })).toHaveLength(2);
});
it('masks normalize full paste and validate actual calendar dates', () => {
  expect(maskRaw('+7 (999) 123-45-67', 'phone')).toBe('9991234567');
  expect(maskRaw('+7 (999)', 'phone')).toBe('999');
  expect(formatMask('9991234567', 'phone')).toBe('+7 (999) 123-45-67');
  expect(maskRaw('aa:bb:cc:dd:ee:ff', 'mac')).toBe('AABBCCDDEEFF');
  expect(maskError('31022026', 'date')).toBeTruthy();
  expect(maskError('29022024', 'date')).toBeUndefined();
  expect(maskError('29022026', 'date')).toBeTruthy();
  expect(maskError('1211', 'date')).toBeTruthy();
});
it('read-only structured fields ignore custom paste handlers', async () => {
  const user = userEvent.setup(),
    code = vi.fn(),
    tags = vi.fn();
  render(
    <>
      <CodeInput value="642180" onValueChange={code} readOnly />
      <InputTag label="Метки" value={['production']} onValueChange={tags} readOnly />
    </>,
  );
  await user.click(screen.getByRole('textbox', { name: 'Код подтверждения, 6 цифр' }));
  await user.paste('999999');
  fireEvent.paste(screen.getByRole('textbox', { name: 'Метки' }), {
    clipboardData: { getData: () => 'msk, daily' },
  });
  expect(code).not.toHaveBeenCalled();
  expect(tags).not.toHaveBeenCalled();
});
it('masked phone supports deletion across inserted separators', async () => {
  const user = userEvent.setup();
  function Harness() {
    const [v, setV] = useState('999');
    return <InputMask label="Телефон" kind="phone" value={v} onValueChange={setV} />;
  }
  render(<Harness />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  await user.click(input);
  await user.keyboard('{End}{Backspace}');
  expect(input).toHaveValue('+7 (99');
});
it('radio keyboard selection skips unavailable options and keeps one checked value', async () => {
  const user = userEvent.setup();
  function Harness() {
    const [v, setV] = useState('one');
    return (
      <RadioGroup
        label="Размещение"
        value={v}
        onValueChange={setV}
        options={[
          { value: 'one', label: 'Общий' },
          { value: 'blocked', label: 'Недоступный', disabled: true },
          { value: 'three', label: 'Резерв' },
        ]}
      />
    );
  }
  render(<Harness />);
  await user.click(screen.getByRole('radio', { name: 'Общий' }));
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('radio', { name: 'Резерв' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Общий' })).not.toBeChecked();
});
it('accordion closes other sections without resetting entered content', async () => {
  const user = userEvent.setup();
  function Harness() {
    const [v, setV] = useState(['one']);
    return (
      <Accordion
        value={v}
        onValueChange={setV}
        items={[
          { id: 'one', title: 'Ресурсы', content: <input aria-label="vCPU" defaultValue="4" /> },
          { id: 'two', title: 'Сеть', content: 'Production' },
        ]}
      />
    );
  }
  render(<Harness />);
  await user.clear(screen.getByLabelText('vCPU'));
  await user.type(screen.getByLabelText('vCPU'), '8');
  await user.click(screen.getByRole('button', { name: 'Сеть' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Ресурсы' }));
  expect(screen.getByLabelText('vCPU')).toHaveValue('8');
});
it('nested menu keyboard navigation restores the parent item and trigger', async () => {
  const user = userEvent.setup(),
    select = vi.fn();
  render(
    <Menu
      label="Действия"
      items={[
        {
          id: 'power',
          label: 'Питание',
          children: [{ id: 'restart', label: 'Перезапустить', onSelect: select }],
        },
        { id: 'blocked', label: 'Удалить', disabled: true },
      ]}
    />,
  );
  const trigger = screen.getByRole('button', { name: 'Действия' });
  await user.click(trigger);
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('menuitem', { name: 'Перезапустить' })).toHaveFocus();
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('menuitem', { name: 'Питание' })).toHaveFocus();
  await user.keyboard('{ArrowRight}{Enter}');
  expect(select).toHaveBeenCalledOnce();
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
it('cascade cancels its draft and commits only an available leaf', async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(
    <CascadeSelect
      label="Хост"
      value=""
      onValueChange={change}
      options={[
        {
          value: 'r',
          label: 'Москва',
          children: [
            { value: 'a', label: 'Хост A' },
            { value: 'b', label: 'Хост B', disabled: true },
          ],
        },
      ]}
    />,
  );
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: /Москва/ }));
  expect(screen.getByRole('button', { name: /^Выбрать$/ })).toBeDisabled();
  expect(screen.getByRole('option', { name: 'Хост B' })).toBeDisabled();
  await user.click(screen.getByRole('option', { name: 'Хост A' }));
  await user.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(change).not.toHaveBeenCalled();
  await user.click(screen.getByRole('combobox'));
  await user.type(screen.getByRole('textbox', { name: 'Поиск в иерархии' }), 'Хост A');
  await user.click(screen.getByRole('option', { name: 'Москва / Хост A' }));
  await user.click(screen.getByRole('button', { name: /^Выбрать$/ }));
  expect(change).toHaveBeenCalledWith('a');
  expect(screen.getByRole('combobox')).toHaveFocus();
});
it('collapsed breadcrumb preserves intermediate navigation', async () => {
  const user = userEvent.setup(),
    go = vi.fn();
  render(
    <Breadcrumb
      maxItems={3}
      items={[
        { label: 'Облако', href: '#' },
        { label: 'Москва', onNavigate: go },
        { label: 'Production', href: '#' },
        { label: 'ВМ' },
      ]}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Скрытые уровни' }));
  await user.click(screen.getByRole('menuitem', { name: 'Москва' }));
  expect(go).toHaveBeenCalledOnce();
  expect(screen.getByText('ВМ')).toHaveAttribute('aria-current', 'page');
});
it('chip removal does not toggle its selection', async () => {
  const user = userEvent.setup(),
    toggle = vi.fn(),
    remove = vi.fn();
  render(
    <Chip selected onSelectedChange={toggle} onRemove={remove}>
      Production
    </Chip>,
  );
  await user.click(screen.getByRole('button', { name: 'Убрать фильтр Production' }));
  expect(remove).toHaveBeenCalledOnce();
  expect(toggle).not.toHaveBeenCalled();
});
it('overflow badge retains its full accessible count and broken avatars retain identity', () => {
  render(
    <>
      <Badge count={125} />
      <Avatar name="Анна Смирнова" src="broken.png" />
    </>,
  );
  expect(screen.getByRole('img', { name: 'Количество: 125' })).toHaveTextContent('99+');
  const avatar = screen.getByRole('img', { name: 'Анна Смирнова' });
  fireEvent.error(avatar.querySelector('img')!);
  expect(avatar).toHaveTextContent('АС');
});
it('toast pauses expiry on hover and queued messages receive their own full duration', () => {
  vi.useFakeTimers();
  function Harness() {
    const [items, setItems] = useState<ToastItem[]>(
      Array.from({ length: 4 }, (_, i) => ({
        id: String(i),
        title: `Задача ${i}`,
        tone: 'success',
        duration: 6000,
      })),
    );
    return (
      <ToastRegion
        items={items}
        onDismiss={(id) => setItems((v) => v.filter((i) => i.id !== id))}
      />
    );
  }
  render(<Harness />);
  expect(screen.queryByText('Задача 3')).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(2000));
  const region = screen.getByRole('region', { name: 'Уведомления' });
  fireEvent.mouseEnter(region);
  act(() => vi.advanceTimersByTime(8000));
  expect(within(region).getByText('Задача 0')).toBeInTheDocument();
  fireEvent.mouseLeave(region);
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByText('Задача 3')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(5999));
  expect(screen.getByText('Задача 3')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole('region', { name: 'Уведомления' })).not.toBeInTheDocument();
});
it('error toast with an action stays until the user acts', () => {
  vi.useFakeTimers();
  const dismiss = vi.fn(),
    action = vi.fn();
  render(
    <ToastRegion
      items={[
        {
          id: 'error',
          title: 'Ошибка',
          tone: 'danger',
          action: { label: 'Повторить', onClick: action },
        },
      ]}
      onDismiss={dismiss}
    />,
  );
  act(() => vi.advanceTimersByTime(120000));
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(action).toHaveBeenCalledOnce();
  expect(dismiss).toHaveBeenCalledWith('error');
});
it('empty menu can still close with Escape and return focus', async () => {
  const user = userEvent.setup();
  render(<Menu label="Нет действий" items={[]} />);
  const trigger = screen.getByRole('button', { name: 'Нет действий' });
  await user.click(trigger);
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
it('compact menu has a visible default affordance and opens from the keyboard', async () => {
  const user = userEvent.setup();
  render(<Menu compact label="Действия машины" items={[{ id: 'start', label: 'Запустить' }]} />);
  const trigger = screen.getByRole('button', { name: 'Действия машины' });
  expect(trigger.querySelector('svg.lucide-ellipsis')).not.toBeNull();
  await user.tab();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Запустить' })).toHaveFocus();
});
it('tag input commits a valid draft on blur and retains invalid text for correction', async () => {
  const user = userEvent.setup();
  function Harness() {
    const [tags, setTags] = useState<string[]>([]);
    return (
      <>
        <InputTag
          label="Метки"
          value={tags}
          onValueChange={setTags}
          validate={(v) => (/^[a-z]+$/.test(v) ? undefined : 'Только латиница')}
        />
        <button>Продолжить</button>
      </>
    );
  }
  render(<Harness />);
  const input = screen.getByRole('textbox', { name: 'Метки' });
  await user.type(input, 'production');
  await user.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(screen.getByRole('button', { name: 'Удалить метку production' })).toBeInTheDocument();
  await user.type(input, 'bad!');
  await user.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(input).toHaveValue('bad!');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('Только латиница');
});
it('closing a focused toast restores the previous control', async () => {
  const user = userEvent.setup();
  function Harness() {
    const [items, setItems] = useState<ToastItem[]>([
      { id: 'one', title: 'Готово', tone: 'success', duration: 0 },
    ]);
    return (
      <>
        <button>Показать результат</button>
        <ToastRegion items={items} onDismiss={() => setItems([])} />
      </>
    );
  }
  render(<Harness />);
  const before = screen.getByRole('button', { name: 'Показать результат' });
  await user.click(before);
  await user.tab();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(before).toHaveFocus());
});
