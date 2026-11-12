import { createContext, useContext } from 'react';
import type { StatusTone } from '@basis/ui';
import type { CloudState } from '../domain';
import type { ApiResult } from '../mock-engine';

export type CloudContextValue = {
  data: CloudState | null;
  loading: boolean;
  error: string;
  working: boolean;
  scope: string;
  setScope: (id: string) => void;
  refresh: (skeleton?: boolean) => Promise<void>;
  loadRegistry: () => Promise<{ empty: boolean }>;
  mutate: (path: string, body?: unknown, message?: string, method?: string) => Promise<ApiResult>;
  notify: (title: string, tone?: StatusTone, description?: string) => void;
};
export const CloudContext = createContext<CloudContextValue | null>(null);
export function useCloud() {
  const value = useContext(CloudContext);
  if (!value) throw new Error('CloudProvider required');
  return value;
}
