import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedState } from '../domain';

describe('Static Pages transport', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    const state = seedState(Date.now());
    state.simulation.latency = 0;
    localStorage.setItem('basis-cloud-demo-v1', JSON.stringify(state));
    const meta = document.createElement('meta');
    meta.name = 'basis-demo-transport';
    meta.content = 'embedded';
    document.head.append(meta);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('No HTTP API on Pages'))),
    );
  });

  afterEach(() => {
    document.querySelector('meta[name="basis-demo-transport"]')?.remove();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads and changes demo data over HTTP without contacting a server, then restores it', async () => {
    const api = await import('./api');
    expect(location.protocol).toBe('http:');
    expect(api.offline).toBe(true);
    expect((await api.request('/state')).state.vms.length).toBeGreaterThan(0);
    await api.request('/simulation', 'POST', { latency: 0, fault: 'none', table: 'empty' });
    vi.resetModules();
    const reloaded = await import('./api');
    expect((await reloaded.request('/registry')).registry?.empty).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('continues processing after a failed operation', async () => {
    const { request } = await import('./api');
    await expect(request('/reset', 'POST', { confirm: 'wrong' })).rejects.toThrow();
    expect((await request('/state')).state.vms.length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the in-memory demo usable when browser storage cannot be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    const { request } = await import('./api');
    await request('/simulation', 'POST', { latency: 0, fault: 'none', table: 'empty' });
    expect((await request('/registry')).registry?.empty).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
