export type PlatformValue = string | number | boolean | string[] | null;
export type PlatformRecord = {
  id: string;
  name: string;
  status: string;
  description?: string;
  createdAt?: string;
  [key: string]: PlatformValue | undefined;
};
export type PlatformMode = 'admin' | 'user' | 'reader';
export type PlatformState = {
  revision: 1 | 2;
  mode: PlatformMode;
  accountId: string;
  records: Record<string, PlatformRecord[]>;
  removed: { entity: string; record: PlatformRecord; removedAt: string; data?: unknown }[];
};
export type PlatformField = {
  key: string;
  label: string;
  description: string;
  kind?:
    | 'text'
    | 'number'
    | 'enum'
    | 'relation'
    | 'ip'
    | 'boolean'
    | 'date'
    | 'tags'
    | 'textarea'
    | 'password';
  reference?: string;
  options?: { value: string; label: string }[];
  unit?: string;
  required?: boolean;
  hidden?: boolean;
  form?: boolean;
  readonly?: boolean;
  min?: number;
  max?: number;
  initial?: PlatformValue;
};
export type PlatformAction = {
  id: string;
  label: string;
  description: string;
  api: string;
  tone?: 'danger' | 'warning' | 'success';
  target?: string;
  from?: string[];
  admin?: boolean;
};
export type PlatformTab = {
  id: string;
  label: string;
  entity?: string;
  foreignKey?: string;
  idsField?: string;
};
export type PlatformEntity = {
  id: string;
  label: string;
  singular: string;
  group: string;
  icon: string;
  description: string;
  api: string;
  source: string;
  scope: 'global' | 'account' | 'rg';
  admin?: boolean;
  create?: string;
  createLabel?: string;
  delete?: string;
  fields: PlatformField[];
  actions?: PlatformAction[];
  tabs?: PlatformTab[];
  internal?: boolean;
  specialized?: boolean;
};
