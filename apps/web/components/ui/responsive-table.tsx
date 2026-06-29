'use client'

import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ResponsiveColumn<T> {
  key: string
  header: ReactNode
  /** Custom cell renderer. Falls back to `row[key]` if omitted. */
  render?: (row: T) => ReactNode
  className?: string
  /** Drop this column from the mobile card view. */
  hideOnMobile?: boolean
  /** Use as the card title on mobile (one column should set this). */
  primary?: boolean
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: ReactNode
  className?: string
}

function cellValue<T>(col: ResponsiveColumn<T>, row: T): ReactNode {
  if (col.render) return col.render(row)
  return (row as Record<string, ReactNode>)[col.key]
}

export function ResponsiveTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  empty,
  className,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        {empty ?? 'No data'}
      </div>
    )
  }

  const primary = columns.find((c) => c.primary)
  const mobileRest = columns.filter((c) => !c.primary && !c.hideOnMobile)

  return (
    <>
      {/* Desktop: real table */}
      <div className={cn('hidden md:block overflow-x-auto', className)}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} className={cn('py-2 px-3 font-medium', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className={cn(
                  'border-b last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-muted/50',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('py-2 px-3', c.className)}>
                    {cellValue(c, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={getRowKey(row)}
            className={cn(
              'rounded-lg border bg-card p-3',
              onRowClick && 'cursor-pointer active:bg-muted/50',
            )}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {primary && (
              <div className="font-medium mb-2 break-words">{cellValue(primary, row)}</div>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {mobileRest.map((c) => (
                <Fragment key={c.key}>
                  <dt className="text-muted-foreground">{c.header}</dt>
                  <dd className="text-right tabular-nums">{cellValue(c, row)}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  )
}
