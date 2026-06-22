'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { connectorService } from '@/lib/api/connector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DirectoryEntry } from '@/lib/api/connector-types'

interface DirectoryKeyDialogProps {
  /** The apikey entry being connected; null closes the dialog. */
  entry: DirectoryEntry | null
  onOpenChange: (open: boolean) => void
  onConnected: () => void
}

/** Paste-an-API-key dialog for `apikey` directory entries. */
export function DirectoryKeyDialog({
  entry,
  onOpenChange,
  onConnected,
}: DirectoryKeyDialogProps) {
  const t = useTranslations('integrations')
  const [credential, setCredential] = useState('')

  useEffect(() => {
    if (entry) setCredential('')
  }, [entry])

  const connect = useMutation({
    mutationFn: () =>
      connectorService.connectDirectoryKey(entry!.slug, credential.trim()),
    onSuccess: () => {
      toast.success(t('connectSuccess', { provider: entry?.name ?? '' }))
      onConnected()
    },
    onError: () => toast.error(t('connectError')),
  })

  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('directoryKeyTitle', { provider: entry?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('directoryKeyDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="dir-key">{t('directoryKeyLabel')}</Label>
          <Input
            id="dir-key"
            type="password"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('directoryCancel')}
          </Button>
          <Button
            disabled={!credential.trim() || connect.isPending}
            onClick={() => connect.mutate()}
          >
            {connect.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
            {t('connect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
