import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, expect, it } from 'vitest';
import { hasContextualBack, parentPortalRoute, usePortalNavigation } from './usePortalNavigation';

beforeEach(() => history.replaceState(null, '', '#cloud/overview'));
const mount = () =>
  renderHook(() => {
    const [scope, setScope] = useState('all');
    return { ...usePortalNavigation(scope, setScope), scope, setScope };
  });
async function visit(route: string, result: { current: { route: string } }) {
  act(() => {
    location.hash = '#cloud/' + route;
  });
  await waitFor(() => expect(result.current.route).toBe(route));
}

it('returns a direct entity link to its parent without leaving the portal or creating a loop', () => {
  history.replaceState(null, '', '#cloud/vms/vm-1/network');
  const { result } = mount();
  const length = history.length;
  act(() => result.current.goBack());
  expect(result.current.route).toBe('vms/vm-1');
  act(() => result.current.goBack());
  expect(result.current.route).toBe('vms');
  act(() => result.current.goBack());
  expect(result.current.route).toBe('overview');
  expect(result.current.backTarget).toBeNull();
  expect(history.length).toBe(length);
});

it('uses the actual previous resource and preserves native Forward', async () => {
  const { result } = mount();
  await visit('networks/net-dev', result);
  await visit('vms/vm-10', result);
  act(() => result.current.goBack());
  await waitFor(() => expect(result.current.route).toBe('networks/net-dev'));
  act(() => history.forward());
  await waitFor(() => expect(result.current.route).toBe('vms/vm-10'));
});

it('restores the workspace when going back through a context change', async () => {
  const { result } = mount();
  await visit('vms', result);
  act(() => result.current.setScope('dev'));
  await visit('vms/vm-10', result);
  act(() => result.current.goBack());
  await waitFor(() => expect(result.current.route).toBe('vms'));
  expect(result.current.scope).toBe('dev');
  act(() => result.current.goBack());
  await waitFor(() => expect(result.current.scope).toBe('all'));
  expect(result.current.route).toBe('vms');
});

it('records combined route and scope changes as one navigation', async () => {
  const { result } = mount();
  act(() => {
    result.current.setScope('dev');
    location.hash = '#cloud/vms';
  });
  await waitFor(() => expect(result.current.route).toBe('vms'));
  act(() => result.current.goBack());
  await waitFor(() => expect(result.current.route).toBe('overview'));
  expect(result.current.scope).toBe('all');
});

it('keeps the native predecessor after remounting the portal', async () => {
  const first = mount();
  await visit('vms', first.result);
  await visit('vms/vm-1', first.result);
  first.unmount();
  const second = mount();
  act(() => second.result.current.goBack());
  await waitFor(() => expect(second.result.current.route).toBe('vms'));
});

it('does not create a phantom entry when popstate fires before the scope render', async () => {
  const { result } = mount();
  await visit('vms/vm-10', result);
  act(() => {
    result.current.setScope('dev');
    location.hash = '#cloud/overview';
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  });
  await waitFor(() => expect(result.current.route).toBe('overview'));
  expect(result.current.scope).toBe('dev');
  act(() => result.current.goBack());
  await waitFor(() => expect(result.current.route).toBe('vms/vm-10'));
  expect(result.current.scope).toBe('all');
});

it('routes creation and list fallback to the relevant parent', () => {
  expect(parentPortalRoute('create')).toBe('vms');
  expect(parentPortalRoute('accounts/account-100/groups')).toBe('accounts/account-100');
  expect(parentPortalRoute('volumes')).toBe('overview');
  expect(parentPortalRoute('overview')).toBeNull();
});

it('only shows contextual Back in details, creation and profile settings', async () => {
  const { result } = mount();
  expect(result.current.showBack).toBe(false);
  await visit('vms', result);
  expect(result.current.showBack).toBe(false);
  await visit('vms/vm-10', result);
  expect(result.current.showBack).toBe(true);
  act(() => result.current.goBack());
  await waitFor(() => expect(result.current.route).toBe('vms'));
  expect(result.current.showBack).toBe(false);
  expect(hasContextualBack('create')).toBe(true);
  expect(hasContextualBack('settings')).toBe(true);
  expect(hasContextualBack('health')).toBe(false);
});
