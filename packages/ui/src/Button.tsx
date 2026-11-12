import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { CloudLoader, type LoaderVariant } from './CloudLoader';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger';
export type ButtonTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  loader?: LoaderVariant;
  progress?: number;
  feedback?: 'success' | 'error';
  fullWidth?: boolean;
  fullHeight?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    tone = 'brand',
    size = 'md',
    leadingIcon,
    trailingIcon,
    loading = false,
    loadingLabel,
    loader = 'cloud',
    progress,
    feedback,
    fullWidth = false,
    fullHeight = false,
    children,
    className = '',
    onClick,
    disabled,
    type = 'button',
    ...native
  },
  ref,
) {
  const hasLabel = children !== null && children !== undefined && children !== '';
  const showLoadingLabel =
    hasLabel && (Boolean(leadingIcon || trailingIcon) || Boolean(loadingLabel));
  const busyLabel = loadingLabel || children;
  const disabledByAria = native['aria-disabled'] === true || native['aria-disabled'] === 'true';
  const fraction = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress!)) : undefined;
  return (
    <button
      {...native}
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={loading || disabledByAria || undefined}
      aria-busy={loading || undefined}
      aria-label={loading && loadingLabel ? loadingLabel : native['aria-label']}
      data-variant={variant === 'danger' ? 'primary' : variant}
      data-tone={variant === 'danger' ? 'danger' : tone}
      data-size={size}
      data-loading={loading || undefined}
      data-feedback={feedback}
      data-icon-only={!hasLabel || undefined}
      className={`basis-button ${fullWidth ? 'basis-button--full' : ''} ${fullHeight ? 'basis-button--full-height' : ''} ${className}`}
      onClick={(event) => {
        if (disabled || loading || disabledByAria) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    >
      <span className="basis-button__content">
        {leadingIcon && (
          <span className="basis-button__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        {hasLabel && <span className="basis-button__label">{children}</span>}
        {trailingIcon && (
          <span className="basis-button__icon" aria-hidden="true">
            {trailingIcon}
          </span>
        )}
      </span>
      <span className="basis-button__busy" aria-hidden="true">
        {!(trailingIcon && !leadingIcon) && <CloudLoader variant={loader} />}
        {showLoadingLabel && <span className="basis-button__label">{busyLabel}</span>}
        {trailingIcon && !leadingIcon && <CloudLoader variant={loader} />}
      </span>
      {loading && fraction !== undefined && (
        <span className="basis-button__progress" aria-hidden="true">
          <span style={{ width: `${fraction}%` }} />
        </span>
      )}
    </button>
  );
});

export type IconButtonProps = Omit<
  ButtonProps,
  'children' | 'leadingIcon' | 'trailingIcon' | 'aria-label' | 'loadingLabel'
> & {
  icon: ReactNode;
  'aria-label': string;
};
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, ...props },
  ref,
) {
  return <Button {...props} ref={ref} leadingIcon={icon} />;
});
