import { Cloud } from 'lucide-react';

export type LoaderVariant = 'cloud' | 'orbit' | 'dots';

export function CloudLoader({ variant = 'cloud' }: { variant?: LoaderVariant }) {
  return (
    <span className={`basis-loader basis-loader--${variant}`} aria-hidden="true">
      {variant === 'cloud' && (
        <>
          <Cloud className="basis-loader__cloud" strokeWidth={1.65} />
          <span className="basis-loader__signals">
            <i />
            <i />
            <i />
          </span>
        </>
      )}
      {variant === 'orbit' && (
        <>
          <span className="basis-loader__orbit" />
          <span className="basis-loader__satellite" />
        </>
      )}
      {variant === 'dots' && (
        <span className="basis-loader__dots">
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
}
