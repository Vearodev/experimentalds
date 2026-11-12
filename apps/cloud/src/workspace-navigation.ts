import { platformEntities, platformEntity, platformGroups } from '../platform-catalog';
export type SavedWorkspace = { route: string; scope: string; label?: string };
export type NavigationPreferences = {
  compact: boolean;
  expanded: string[];
  favorites: SavedWorkspace[];
};
export const navigationStorageKey = 'basis.cloud.navigation.v1';
const sections = new Set([
  ...platformEntities.map((entry) => entry.id),
  'overview',
  'vms',
  'volumes',
  'networks',
  'clusters',
  'projects',
  'tasks',
  'settings',
]);
const vmTabs = new Set([
  'overview',
  'resources',
  'network',
  'snapshots',
  'activity',
  'placement',
  'security',
]);
export function canonicalWorkspaceRoute(route: string): string | null {
  const [section, id, tab, extra] = route.split('/');
  if (!sections.has(section) || extra !== undefined) return null;
  if (!id) return tab === undefined ? section : null;
  if (!platformEntity(section) || !/^[\w:-]+$/.test(id)) return null;
  const tabs =
    section === 'vms'
      ? vmTabs
      : new Set([
          'overview',
          'activity',
          ...(platformEntity(section)?.tabs || []).map((item) => item.id),
        ]);
  if (tab && !tabs.has(tab)) return null;
  return section + '/' + id + (tab && tab !== 'overview' ? '/' + tab : '');
}
export const workspaceKey = ({ route, scope }: SavedWorkspace) => `${scope}::${route}`;
export function reorderSavedWorkspaces(favorites: SavedWorkspace[], order: string[]) {
  const position = new Map(order.map((id, index) => [id, index]));
  return [...favorites].sort(
    (a, b) =>
      (position.get(workspaceKey(a)) ?? order.length) -
      (position.get(workspaceKey(b)) ?? order.length),
  );
}
export function parseNavigationPreferences(raw: string | null): NavigationPreferences {
  const defaults: NavigationPreferences = {
    compact: false,
    expanded: ['compute', 'tenants'],
    favorites: [],
  };
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object') return defaults;
    const favorites: SavedWorkspace[] = [];
    if (Array.isArray(value.favorites))
      for (const entry of value.favorites) {
        if (
          !entry ||
          typeof entry.route !== 'string' ||
          typeof entry.scope !== 'string' ||
          !/^[\w-]+$/.test(entry.scope)
        )
          continue;
        const route = canonicalWorkspaceRoute(entry.route);
        if (!route) continue;
        const favorite: SavedWorkspace = {
          route,
          scope: entry.scope,
          ...(typeof entry.label === 'string' ? { label: entry.label.slice(0, 240) } : {}),
        };
        if (!favorites.some((item) => workspaceKey(item) === workspaceKey(favorite)))
          favorites.push(favorite);
      }
    return {
      compact: value.compact === true,
      expanded: Array.isArray(value.expanded)
        ? [
            ...new Set<string>(
              value.expanded.filter(
                (id: unknown) =>
                  platformGroups.some((group) => group.id === id) || id === 'management',
              ),
            ),
          ]
        : defaults.expanded,
      favorites,
    };
  } catch {
    return defaults;
  }
}
export function loadNavigationPreferences(): NavigationPreferences {
  try {
    return parseNavigationPreferences(localStorage.getItem(navigationStorageKey));
  } catch {
    return parseNavigationPreferences(null);
  }
}
