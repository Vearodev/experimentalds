import { beforeEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DesignProvider, useDesign, tokenManifest } from './DesignContext';
function Harness() {
  const d = useDesign();
  return (
    <>
      <output aria-label="Радиус">{d.resolved['comp.button.radius'].cssValue}</output>
      <output aria-label="Цвет">
        {d.resolved['comp.button.primary.background.default'].cssValue}
      </output>
      <output aria-label="Ошибка">{d.error}</output>
      <button onClick={() => d.change('comp.button.radius', '{sys.radius.panel}')}>Радиус</button>
      <button
        onClick={() => d.change('sys.color.action.primary.bg.default', '{ref.color.navy.700}')}
      >
        Цвет темы
      </button>
      <button onClick={() => d.setTheme(d.theme === 'light' ? 'dark' : 'light')}>Сменить</button>
      <button onClick={d.undo}>Отмена</button>
      <button onClick={d.redo}>Повтор</button>
      <button onClick={() => d.change('comp.button.radius', '{ref.radius.control}')}>
        Неверная связь
      </button>
    </>
  );
}
beforeEach(() => localStorage.clear());
it('migrates legacy status geometry without changing the new counter badge', () => {
  localStorage.setItem(
    'basis.design-experiment.v2',
    JSON.stringify({
      edits: { shared: { 'comp.badge.radius': '{sys.radius.panel}' }, light: {}, dark: {} },
    }),
  );
  function Geometry() {
    const d = useDesign();
    return (
      <>
        <output aria-label="Статус">{d.resolved['comp.status.radius'].cssValue}</output>
        <output aria-label="Счётчик">{d.resolved['comp.badge.radius'].cssValue}</output>
      </>
    );
  }
  render(
    <DesignProvider>
      <Geometry />
    </DesignProvider>,
  );
  expect(screen.getByLabelText('Статус')).toHaveTextContent('16px');
  expect(screen.getByLabelText('Счётчик')).not.toHaveTextContent('16px');
  expect(JSON.parse(localStorage.getItem('basis.design-experiment.v2')!).version).toBe(
    tokenManifest.version,
  );
});
it('migrates the retired button mark without discarding other design edits', () => {
  localStorage.setItem(
    'basis.design-experiment.v2',
    JSON.stringify({
      edits: {
        shared: {
          'comp.button.signature': '{sys.color.brand.accent}',
          'comp.button.radius': '{sys.radius.panel}',
        },
        light: {},
        dark: {},
      },
    }),
  );
  render(
    <DesignProvider>
      <Harness />
    </DesignProvider>,
  );
  expect(screen.getByLabelText('Радиус')).toHaveTextContent('16px');
  expect(
    JSON.parse(localStorage.getItem('basis.design-experiment.v2')!).edits.shared,
  ).not.toHaveProperty('comp.button.signature');
  expect(localStorage.getItem('basis.design-experiment.v2.recovery')).toContain(
    'comp.button.signature',
  );
});
it('applies shared geometry to both themes and preserves undo/redo', async () => {
  const user = userEvent.setup();
  render(
    <DesignProvider>
      <Harness />
    </DesignProvider>,
  );
  await user.click(screen.getByRole('button', { name: /^Радиус$/ }));
  expect(screen.getByLabelText('Радиус')).toHaveTextContent('16px');
  await user.click(screen.getByText('Сменить'));
  expect(screen.getByLabelText('Радиус')).toHaveTextContent('16px');
  expect(screen.getByLabelText('Цвет')).toHaveTextContent('#44b6fb');
  await user.click(screen.getByText('Отмена'));
  expect(screen.getByLabelText('Радиус')).toHaveTextContent('8px');
  await user.click(screen.getByText('Повтор'));
  expect(screen.getByLabelText('Радиус')).toHaveTextContent('16px');
});
it('limits semantic color changes to their theme and rejects layer violations', async () => {
  const user = userEvent.setup();
  render(
    <DesignProvider>
      <Harness />
    </DesignProvider>,
  );
  await user.click(screen.getByText('Цвет темы'));
  expect(screen.getByLabelText('Цвет')).not.toHaveTextContent('#1c2a60');
  await user.click(screen.getByText('Сменить'));
  expect(screen.getByLabelText('Цвет')).toHaveTextContent('#44b6fb');
  await user.click(screen.getByText('Неверная связь'));
  expect(screen.getByLabelText('Ошибка')).toHaveTextContent('через семантическую роль');
  expect(screen.getByLabelText('Радиус')).toHaveTextContent('8px');
});
it('keeps valid experiments across reloads and isolates invalid stored edits', async () => {
  const user = userEvent.setup();
  const first = render(
    <DesignProvider>
      <Harness />
    </DesignProvider>,
  );
  await user.click(screen.getByRole('button', { name: /^Радиус$/ }));
  first.unmount();
  const second = render(
    <DesignProvider>
      <Harness />
    </DesignProvider>,
  );
  expect(screen.getByLabelText('Радиус')).toHaveTextContent('16px');
  second.unmount();
  const invalid = JSON.stringify({
    edits: { shared: { 'missing.token': 1 }, light: {}, dark: {} },
  });
  localStorage.setItem('basis.design-experiment.v2', invalid);
  render(
    <DesignProvider>
      <Harness />
    </DesignProvider>,
  );
  expect(screen.getByLabelText('Радиус')).toHaveTextContent('8px');
  expect(localStorage.getItem('basis.design-experiment.v2.recovery')).toBe(invalid);
});
