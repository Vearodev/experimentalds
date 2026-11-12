import { describe, expect, it } from 'vitest';
import {
  canonicalWorkspaceRoute,
  parseNavigationPreferences,
  workspaceKey,
  reorderSavedWorkspaces,
} from './workspace-navigation';
describe('Saved workspaces', () => {
  it('keeps reordered workspace context across persistence, including concurrent additions', () => {
    const a = { route: 'vms/vm-1/snapshots', scope: 'all' },
      b = { route: 'networks', scope: 'production' },
      c = { route: 'vms', scope: 'all' };
    const original = [a, b, c];
    const reordered = reorderSavedWorkspaces(original, [
      workspaceKey(b),
      workspaceKey(a),
      'removed::item',
    ]);
    expect(reordered).toEqual([b, a, c]);
    expect(original).toEqual([a, b, c]);
    expect(parseNavigationPreferences(JSON.stringify({ favorites: reordered })).favorites).toEqual([
      b,
      a,
      c,
    ]);
  });
  it('preserves entity tabs and project context, deduplicating equivalent overview routes', () => {
    const value = parseNavigationPreferences(
      JSON.stringify({
        compact: true,
        expanded: ['compute'],
        favorites: [
          { route: 'vms/vm-1/overview', scope: 'production' },
          { route: 'vms/vm-1', scope: 'production' },
          { route: 'vms/vm-1/network', scope: 'production' },
          { route: 'vms', scope: 'all' },
          { route: 'vms', scope: 'production' },
        ],
      }),
    );
    expect(value.compact).toBe(true);
    expect(value.expanded).toEqual(['compute']);
    expect(value.favorites.map(workspaceKey)).toEqual([
      'production::vms/vm-1',
      'production::vms/vm-1/network',
      'all::vms',
      'production::vms',
    ]);
    expect(parseNavigationPreferences(JSON.stringify(value))).toEqual(value);
  });
  it('rejects malformed persisted values, forms and unsupported routes', () => {
    expect(parseNavigationPreferences('broken').favorites).toEqual([]);
    expect(
      parseNavigationPreferences(
        JSON.stringify({
          favorites: [
            null,
            {},
            { route: 'create', scope: 'all' },
            { route: 'vms/vm-1/fake', scope: 'all' },
            { route: 'vms', scope: {} },
          ],
        }),
      ).favorites,
    ).toEqual([]);
    expect(canonicalWorkspaceRoute('clusters/cluster-1')).toBe('clusters/cluster-1');
    expect(canonicalWorkspaceRoute('volumes/volume-1')).toBe('volumes/volume-1');
    expect(canonicalWorkspaceRoute('volumes/volume-1/replication')).toBe(
      'volumes/volume-1/replication',
    );
    expect(canonicalWorkspaceRoute('volumes/volume-1/unsupported')).toBeNull();
    expect(canonicalWorkspaceRoute('vms/vm-1/network/extra')).toBeNull();
  });
});
