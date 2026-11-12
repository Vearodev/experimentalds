import { describe, expect, it } from 'vitest';
import { clampWindow, resizeWindow } from './useFloatingWindow';
const bounds = { width: 1280, height: 720, inset: 16, minWidth: 560, minHeight: 380 };
const rect = { x: 100, y: 40, width: 1080, height: 640 };
describe('floating workspace geometry', () => {
  it('keeps all edges reachable on a narrow viewport', () => {
    expect(clampWindow(rect, { ...bounds, width: 390, height: 844 })).toEqual({
      x: 16,
      y: 40,
      width: 358,
      height: 640,
    });
    const small = clampWindow(rect, { ...bounds, width: 390, height: 320 });
    expect(small).toEqual({ x: 16, y: 16, width: 358, height: 288 });
  });
  it('clamps movement and keeps opposite edges anchored during resize', () => {
    expect(resizeWindow(rect, -1000, 1000, 'move', bounds)).toEqual({ ...rect, x: 16, y: 64 });
    expect(resizeWindow(rect, 1000, 1000, 'nw', bounds)).toEqual({
      x: 620,
      y: 300,
      width: 560,
      height: 380,
    });
    expect(resizeWindow(rect, 1000, 1000, 'se', bounds)).toEqual({
      x: 100,
      y: 40,
      width: 1164,
      height: 664,
    });
  });
});
