import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ListEnd, Rows3 } from 'lucide-react';
import { Button, IconButton } from './Button';
import { ContextPanel } from './ContextPanel';
import { Tooltip } from './Tooltip';
import { Input } from './Fields';
import type { DataTablePagination } from './table-paging';

const number = new Intl.NumberFormat('ru');

function NavigationSettings({
  pagination: p,
  anchor,
  onClose,
}: {
  pagination: DataTablePagination;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const pages = Math.max(1, Math.ceil(p.total / p.pageSize));
  const [draft, setDraft] = useState(String(Math.min(p.page, pages)));
  const [error, setError] = useState('');
  const infinite = p.mode === 'infinite';
  const navigate = (page: number) => {
    p.onPageChange(page);
    onClose();
  };
  const submit = () => {
    const page = Number(draft);
    if (!/^\d+$/.test(draft) || !Number.isInteger(page) || page < 1 || page > pages) {
      setError(`Введите страницу от 1 до ${pages}`);
      return;
    }
    navigate(page);
  };
  return (
    <ContextPanel
      open
      anchor={anchor}
      title="Навигация по списку"
      description={
        infinite
          ? `Загружено ${number.format(Math.min(p.page * p.pageSize, p.total))} из ${number.format(p.total)}`
          : `Ресурсы ${p.total ? `${number.format((p.page - 1) * p.pageSize + 1)}–${number.format(Math.min(p.page * p.pageSize, p.total))}` : '0'} из ${number.format(p.total)}`
      }
      icon={<Rows3 />}
      compact
      footer={null}
      onClose={onClose}
    >
      <div className="basis-table-navigation-settings">
        {!infinite && (
          <form
            className="basis-table-navigation-jump"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              label="Перейти к странице"
              aria-label="Номер страницы"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={draft}
              suffix={`/ ${number.format(pages)}`}
              error={error}
              hint={`От 1 до ${number.format(pages)}`}
              disabled={!p.total}
              onChange={(e) => {
                setDraft(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && error) {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraft(String(Math.min(p.page, pages)));
                  setError('');
                }
              }}
            />
            <Button type="submit" leadingIcon={<ArrowRight />} disabled={!p.total}>
              Перейти
            </Button>
          </form>
        )}
        {p.onPageSizeChange && (
          <div className="basis-table-navigation-size">
            <span>{infinite ? 'Ресурсов в одной порции' : 'Ресурсов на странице'}</span>
            <div
              role="group"
              aria-label={infinite ? 'Размер порции' : 'Количество элементов на странице'}
            >
              {[...new Set([...(p.pageSizeOptions || [12, 24, 48, 96]), p.pageSize])]
                .sort((a, b) => a - b)
                .map((size) => (
                  <Button
                    key={size}
                    variant={size === p.pageSize ? 'tonal' : 'secondary'}
                    aria-pressed={size === p.pageSize}
                    aria-label={`${size} ${infinite ? 'в порции' : 'на странице'}`}
                    onClick={() => {
                      if (size !== p.pageSize) p.onPageSizeChange?.(size);
                      onClose();
                    }}
                  >
                    {number.format(size)}
                  </Button>
                ))}
            </div>
          </div>
        )}
        {!infinite && pages > 1 && (
          <div className="basis-table-navigation-edges">
            <Button variant="ghost" size="sm" disabled={p.page === 1} onClick={() => navigate(1)}>
              В начало
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={p.page === pages}
              onClick={() => navigate(pages)}
            >
              В конец
            </Button>
          </div>
        )}
      </div>
    </ContextPanel>
  );
}

/** The same navigator is rendered in either location, with shared controlled state. */
export function TablePageNavigation({
  pagination: p,
  compact = false,
  disabled = false,
  unavailable = false,
}: {
  pagination: DataTablePagination;
  /** Location affects accessible names only, never the visual design. */
  compact?: boolean;
  disabled?: boolean;
  unavailable?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pages = Math.max(1, Math.ceil(p.total / p.pageSize));
  const page = Math.min(p.page, pages);
  const infinite = p.mode === 'infinite';
  const end = Math.min(page * p.pageSize, p.total);
  const from = p.total ? (page - 1) * p.pageSize + 1 : 0;
  const range = infinite
    ? number.format(end)
    : p.total
      ? `${number.format(from)}–${number.format(end)}`
      : '0';
  const suffix = compact ? ' — сверху' : '';
  useEffect(() => {
    if (disabled || unavailable) setAnchor(null);
  }, [disabled, unavailable]);
  return (
    <>
      <div
        className="basis-table-pagination"
        role="group"
        aria-label={compact ? 'Пагинация над таблицей' : 'Пагинация под таблицей'}
      >
        {infinite ? (
          <span className="basis-table-navigation-mode" aria-label="Последовательная загрузка">
            <ListEnd aria-hidden="true" />
          </span>
        ) : (
          <Tooltip content="Предыдущая страница">
            <IconButton
              size="md"
              variant="ghost"
              aria-label={`Предыдущая страница${suffix}`}
              icon={<ChevronLeft />}
              disabled={disabled || page === 1}
              onClick={() => p.onPageChange(page - 1)}
            />
          </Tooltip>
        )}
        <Tooltip
          content={
            unavailable
              ? 'Данные пока недоступны'
              : `${infinite ? 'Загружено' : 'Ресурсы'} ${range} из ${number.format(p.total)} · ${infinite ? 'размер порции' : 'переход и количество на странице'}`
          }
        >
          <Button
            className="basis-table-navigation-range"
            size="md"
            variant="ghost"
            aria-label={`Навигация по данным${suffix}`}
            aria-description={
              infinite
                ? `Загружено ${end} из ${p.total}, порция ${p.pageSize}`
                : `Страница ${page} из ${pages}, ${p.pageSize} на странице`
            }
            aria-haspopup="dialog"
            aria-expanded={Boolean(anchor)}
            disabled={disabled || unavailable}
            trailingIcon={<ChevronDown />}
            onClick={(e) => setAnchor(e.currentTarget)}
          >
            <span className="basis-table-navigation-full">
              {infinite ? (
                <span>
                  <strong>{unavailable ? '—' : range}</strong>
                  <span className="basis-table-navigation-total">
                    {' '}
                    из {unavailable ? '—' : number.format(p.total)}
                  </span>
                </span>
              ) : (
                <span className="basis-table-navigation-page">
                  <span className="basis-table-navigation-page-reserve" aria-hidden="true">
                    Стр. <strong>{number.format(pages)}</strong> из {number.format(pages)}
                  </span>
                  <span className="basis-table-navigation-page-value">
                    <span className="basis-table-navigation-total">Стр.</span>{' '}
                    <strong>{unavailable ? '—' : number.format(page)}</strong>
                    <span className="basis-table-navigation-total">
                      {' '}
                      из {unavailable ? '—' : number.format(pages)}
                    </span>
                  </span>
                </span>
              )}
            </span>
            <span className="basis-table-navigation-compact">
              {unavailable ? '—' : infinite ? number.format(end) : `${page}/${pages}`}
            </span>
          </Button>
        </Tooltip>
        <Tooltip
          content={
            infinite
              ? p.loadMoreError
                ? 'Повторить подгрузку'
                : 'Загрузить следующую порцию'
              : 'Следующая страница'
          }
        >
          <IconButton
            size="md"
            variant="ghost"
            aria-label={`${infinite ? 'Следующая порция' : 'Следующая страница'}${suffix}`}
            icon={infinite ? <ChevronDown /> : <ChevronRight />}
            loading={infinite && p.loadingMore}
            disabled={disabled || page === pages}
            onClick={infinite ? p.onLoadMore : () => p.onPageChange(page + 1)}
          />
        </Tooltip>
      </div>
      {anchor && (
        <NavigationSettings pagination={p} anchor={anchor} onClose={() => setAnchor(null)} />
      )}
    </>
  );
}

export function TablePagingFooter({
  pagination: p,
  disabled = false,
  showNavigation = true,
  children,
}: {
  pagination: DataTablePagination;
  disabled?: boolean;
  showNavigation?: boolean;
  children?: ReactNode;
}) {
  const page = Math.min(p.page, Math.max(1, Math.ceil(p.total / p.pageSize)));
  const end = Math.min(page * p.pageSize, p.total);
  const from = p.total ? (page - 1) * p.pageSize + 1 : 0;
  const summary = !p.total
    ? 'Всего '
    : p.mode === 'infinite'
      ? `Загружено ${number.format(end)} из `
      : `Записи ${number.format(from)}–${number.format(end)} из `;
  return (
    <>
      <div className="basis-table-footer-info">
        <span
          className="basis-table-footer-summary"
          role="status"
          aria-label={`${summary}${number.format(p.total)}`}
        >
          <span className="basis-table-footer-summary-full">{summary}</span>
          <span className="basis-table-footer-summary-compact">Всего </span>
          <strong>{number.format(p.total)}</strong>
        </span>
        {children && <div className="basis-table-footer-note">{children}</div>}
      </div>
      {showNavigation && <TablePageNavigation pagination={p} disabled={disabled} />}
    </>
  );
}
