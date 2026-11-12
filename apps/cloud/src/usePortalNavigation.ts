import { createContext, useEffect, useRef, useState } from 'react';

export const PageNavigationContext = createContext<{
  enabled: boolean;
  label: string;
  goBack: () => void;
} | null>(null);

type Visit = { route: string; scope: string };
type PortalEntry = { document: string; current: Visit; back: Visit | null };
const stateKey = 'basis.portal.navigation.v1';
const readRoute = () => location.hash.slice('#cloud/'.length) || 'overview';
const documentKey = () => location.origin + location.pathname;

function readEntry(): PortalEntry | null {
  const entry = history.state?.[stateKey] as PortalEntry | undefined;
  const validVisit = (value: Visit | null | undefined): value is Visit =>
    Boolean(value && typeof value.route === 'string' && typeof value.scope === 'string');
  return entry?.document === documentKey() &&
    validVisit(entry.current) &&
    entry.current.route === readRoute() &&
    (entry.back === null || validVisit(entry.back))
    ? entry
    : null;
}

export function parentPortalRoute(route: string): string | null {
  if (route === 'overview') return null;
  if (route === 'create') return 'vms';
  const parts = route.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : 'overview';
}

/** Registries and service hubs already have a direct entry in the main navigation. */
export function hasContextualBack(route: string): boolean {
  return route.includes('/') || route === 'create' || route === 'settings';
}

/** Keeps native Back/Forward and the workspace scope in the same history entry. */
export function usePortalNavigation(scope: string, onScopeChange: (scope: string) => void) {
  const [route, setRoute] = useState(readRoute);
  const [entry, setEntry] = useState<PortalEntry | null>(readEntry);
  const previous = useRef<PortalEntry | null>(null);
  const currentScope = useRef(scope);
  const changeScope = useRef(onScopeChange);
  const restoringScope = useRef<string | null>(null);
  currentScope.current = scope;
  changeScope.current = onScopeChange;

  const commit = (next: PortalEntry, method: 'pushState' | 'replaceState', url = location.href) => {
    history[method]({ ...history.state, [stateKey]: next }, '', url);
    previous.current = next;
    setEntry(next);
  };

  useEffect(() => {
    const sync = () => {
      const saved = readEntry();
      if (saved) {
        previous.current = saved;
        setEntry(saved);
        if (saved.current.scope !== currentScope.current) {
          restoringScope.current = saved.current.scope;
          changeScope.current(saved.current.scope);
        }
      }
      setRoute(readRoute());
    };
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  useEffect(() => {
    if (restoringScope.current !== null) {
      if (scope === restoringScope.current) restoringScope.current = null;
      return;
    }
    // Record after React commits both route and scope. Native popstate can run
    // inside a hash assignment, before the scope update in that action renders.
    if (route !== readRoute()) return;
    const last = previous.current?.current;
    if (last?.route === route && last.scope === scope) return;
    commit(
      {
        document: documentKey(),
        current: { route, scope },
        back: last || null,
      },
      last?.route === route ? 'pushState' : 'replaceState',
    );
  }, [route, scope]);

  const parent = parentPortalRoute(route);
  const backTarget = entry?.back || (parent ? { route: parent, scope } : null);
  const goBack = () => {
    if (entry?.back) {
      history.back();
    } else if (parent) {
      // A direct link has no known portal predecessor. Replace it with its parent,
      // so repeated Back presses move upward instead of cycling to the detail page.
      commit(
        { document: documentKey(), current: { route: parent, scope }, back: null },
        'replaceState',
        '#cloud/' + parent,
      );
      setRoute(parent);
    }
  };
  return { route, backTarget, showBack: Boolean(backTarget) && hasContextualBack(route), goBack };
}
