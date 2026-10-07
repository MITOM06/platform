import type { ReactNode } from 'react'

/** Group heading of the People panel, with an optional action on the right. */
export function SectionTitle({ id, children, action }: { id: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-2 px-4 pt-3 pb-1">
      <h3 id={id} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {children}
      </h3>
      {action}
    </div>
  )
}
