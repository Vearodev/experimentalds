import { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePageEntrance } from './usePageEntrance';

const cancel = vi.fn();
const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({ cancel }));
const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
let reduced = false;
let now = 0;
let preferenceChanged: (() => void) | undefined;

beforeEach(() => {
  reduced = false;
  now = 0;
  preferenceChanged = undefined;
  vi.clearAllMocks();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: (_: string, listener: () => void) => {
      preferenceChanged = listener;
    },
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: (name: string) =>
      name.includes('duration') ? '120ms' : name.includes('easing') ? 'ease-out' : '0.92',
  }));
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (original) Object.defineProperty(HTMLElement.prototype, 'animate', original);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).animate;
});

function Page({
  route,
  loading = false,
  registry = false,
}: {
  route: string;
  loading?: boolean;
  registry?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  usePageEntrance(ref, route, loading);
  return (
    <div ref={ref}>
      <h1>Ресурс</h1>
      {loading ? (
        <p>Загрузка</p>
      ) : registry ? (
        <section aria-label="Реестр" />
      ) : (
        <div className="basis-tabs">
          <nav>Разделы ресурса</nav>
          <div className="basis-tabs__panel" data-testid="content">
            <input aria-label="Черновик" />
            <div className="resource-metrics" />
          </div>
        </div>
      )}
    </div>
  );
}

it('transitions only content without moving metrics, remounting or stealing focus', () => {
  const view = render(<Page route="overview" />);
  expect(animate).not.toHaveBeenCalled();
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'Сохранённый черновик' } });
  input.focus();
  now = 200;
  view.rerender(<Page route="details" />);
  expect(input).toHaveValue('Сохранённый черновик');
  expect(input).toHaveFocus();
  expect(animate).toHaveBeenCalledTimes(1);
  expect(animate.mock.contexts[0]).toBe(screen.getByTestId('content'));
  expect(animate.mock.calls[0][1].duration).toBe(120);
  expect(animate.mock.calls[0][0]).toEqual([{ opacity: 0.92 }, { opacity: 1 }]);
});

it('does not start motion for a reduced-motion preference', () => {
  reduced = true;
  const view = render(<Page route="overview" />);
  view.rerender(<Page route="details" />);
  expect(animate).not.toHaveBeenCalled();
});

it('cancels motion if the preference changes while a page is entering', () => {
  const view = render(<Page route="overview" />);
  view.rerender(<Page route="details" />);
  preferenceChanged?.();
  expect(cancel).toHaveBeenCalledTimes(1);
});

it('does not flash on initial data, rerenders or a refresh of the same route', () => {
  const view = render(<Page route="overview" loading />);
  view.rerender(<Page route="overview" />);
  view.rerender(<Page route="overview" />);
  expect(animate).not.toHaveBeenCalled();
  now = 200;
  view.rerender(<Page route="details" />);
  expect(animate).toHaveBeenCalledTimes(1);
  view.rerender(<Page route="details" loading />);
  now = 600;
  view.rerender(<Page route="details" />);
  expect(animate).toHaveBeenCalledTimes(1);
  expect(cancel).toHaveBeenCalledTimes(1);
});

it('settles rapid navigation immediately instead of stacking or restarting transitions', () => {
  const view = render(<Page route="overview" />);
  now = 200;
  view.rerender(<Page route="network" />);
  now = 240;
  view.rerender(<Page route="resources" />);
  expect(animate).toHaveBeenCalledTimes(1);
  expect(cancel).toHaveBeenCalledTimes(1);
  now = 500;
  view.rerender(<Page route="overview" />);
  expect(animate).toHaveBeenCalledTimes(2);
});

it('leaves registries and their controls immediately visible', () => {
  const view = render(<Page route="overview" />);
  now = 200;
  view.rerender(<Page route="vms" registry />);
  expect(animate).not.toHaveBeenCalled();
});
