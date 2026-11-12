import type { HTMLAttributes } from 'react';
export function ButtonGroup({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} role="group" className={`basis-button-group ${className}`} />;
}
