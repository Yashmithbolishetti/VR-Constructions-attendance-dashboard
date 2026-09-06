import React from 'react';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { Database } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'Upload your biometric export file to populate this table.',
  emptyActionLabel,
  onEmptyAction,
  className = '',
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className={`overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/[0.08] ${className}`}>
        <div className="bg-neutral-50 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-white/[0.08] p-4 flex gap-4">
          {columns.map((col, idx) => (
            <Skeleton key={idx} width="20%" height={16} />
          ))}
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-white/[0.04] bg-white dark:bg-[#12151B]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex gap-4 items-center">
              {columns.map((col, idx) => (
                <Skeleton key={idx} width="20%" height={14} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`rounded-2xl bg-white dark:bg-[#12151B] border border-neutral-200 dark:border-white/[0.08] overflow-hidden ${className}`}>
        <EmptyState
          icon={<Database className="w-6 h-6 text-neutral-400" />}
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
          bordered={false}
        />
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#12151B] ${className}`}>
      <table className="w-full text-left border-collapse text-xs md:text-sm">
        <thead>
          <tr className="border-b border-neutral-200/80 dark:border-white/[0.08] bg-neutral-50/70 dark:bg-white/[0.02]">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`py-3.5 px-4 font-semibold text-neutral-600 dark:text-neutral-400 tracking-tight text-[11px] md:text-xs uppercase select-none ${
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                    ? 'text-right'
                    : 'text-left'
                } ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.04]">
          {data.map((item, index) => (
            <tr
              key={keyExtractor(item, index)}
              className="hover:bg-neutral-50/80 dark:hover:bg-white/[0.02] transition-colors"
            >
              {columns.map((col) => {
                const content = col.render
                  ? col.render(item, index)
                  : ((item as Record<string, unknown>)[col.key] as React.ReactNode);
                return (
                  <td
                    key={col.key}
                    className={`py-3.5 px-4 text-neutral-800 dark:text-neutral-200 ${
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                    } ${col.className || ''}`}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
