'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useConnectorActions } from '@/lib/hooks/use-connectors'
import type { ActionGroup, ConnectionView } from '@/lib/api/connector-types'

interface ConnectorPermissionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: ConnectionView
}

/** The four action classes, in display order. */
const ACTION_GROUPS: ActionGroup[] = ['view', 'create', 'edit', 'delete']

const LABEL_KEY: Record<ActionGroup, string> = {
  view: 'permView',
  create: 'permCreate',
  edit: 'permEdit',
  delete: 'permDelete',
}

const DESC_KEY: Record<ActionGroup, string> = {
  view: 'permViewDesc',
  create: 'permCreateDesc',
  edit: 'permEditDesc',
  delete: 'permDeleteDesc',
}

export function ConnectorPermissionsDialog({
  open,
  onOpenChange,
  connection,
}: ConnectorPermissionsDialogProps) {
  const t = useTranslations('integrations')
  const { updatePermissions } = useConnectorActions()

  // Local UI state, seeded from the connection. We re-seed whenever the dialog
  // opens (key remount below) so it always reflects the latest server value.
  const [selected, setSelected] = useState<Set<ActionGroup>>(
    () => new Set(connection.actionGroups),
  )

  const toggle = (group: ActionGroup, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(group)
      else next.delete(group)
      return next
    })
  }

  const handleSave = () => {
    updatePermissions.mutate(
      { id: connection.id, actionGroups: ACTION_GROUPS.filter((g) => selected.has(g)) },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t('permissionsTitle')}</DialogTitle>
          <DialogDescription>{t('permissionsSubtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {ACTION_GROUPS.map((group) => {
            const id = `perm-${group}`
            return (
              <div
                key={group}
                className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 px-3.5 py-3"
              >
                <div className="space-y-0.5">
                  <Label htmlFor={id} className="text-sm font-medium">
                    {t(LABEL_KEY[group])}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t(DESC_KEY[group])}
                  </p>
                </div>
                <Switch
                  id={id}
                  checked={selected.has(group)}
                  onCheckedChange={(on) => toggle(group, on)}
                />
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={updatePermissions.isPending}
          >
            {t('customCancel')}
          </Button>
          <Button onClick={handleSave} disabled={updatePermissions.isPending}>
            {updatePermissions.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('directorySave')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
