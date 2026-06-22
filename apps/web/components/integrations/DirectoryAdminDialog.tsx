'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { useDirectoryAdmin } from '@/lib/hooks/use-connectors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  DirectoryAuthMode,
  DirectoryEntry,
  DirectoryTier,
} from '@/lib/api/connector-types'

interface DirectoryAdminDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this entry; otherwise it creates a new one. */
  entry?: DirectoryEntry | null
}

const AUTH_MODES: DirectoryAuthMode[] = ['mcp-oauth', 'env-oauth', 'apikey', 'none']
const TIERS: DirectoryTier[] = ['both', 'personal', 'workspace']

/**
 * Create/edit dialog for MCP directory entries — admin-only (MANAGE_WORKSPACE).
 * Built-in entries can be edited (e.g. toggle availability) but their slug is
 * immutable. Env-oauth fields are only shown when that mode is selected.
 */
export function DirectoryAdminDialog({
  open,
  onOpenChange,
  entry,
}: DirectoryAdminDialogProps) {
  const t = useTranslations('integrations')
  const { create, update } = useDirectoryAdmin()
  const isEdit = !!entry

  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mcpUrl, setMcpUrl] = useState('')
  const [authMode, setAuthMode] = useState<DirectoryAuthMode>('mcp-oauth')
  const [tier, setTier] = useState<DirectoryTier>('both')
  const [envClientIdName, setEnvClientIdName] = useState('')
  const [envClientSecretName, setEnvClientSecretName] = useState('')
  const [authorizeUrl, setAuthorizeUrl] = useState('')
  const [tokenUrl, setTokenUrl] = useState('')

  // Seed the form when the dialog opens (and re-seed if it opens for a different
  // entry). Done during render (React-recommended) instead of in an effect to
  // avoid cascading renders. Keyed on open + entry id so closing then reopening
  // re-seeds cleanly.
  const formKey = open ? (entry?.id ?? 'new') : 'closed'
  const [prevFormKey, setPrevFormKey] = useState(formKey)
  if (formKey !== prevFormKey) {
    setPrevFormKey(formKey)
    if (open) {
      setSlug(entry?.slug ?? '')
      setName(entry?.name ?? '')
      setDescription(entry?.description ?? '')
      setMcpUrl(entry?.mcpUrl ?? '')
      setAuthMode(entry?.authMode ?? 'mcp-oauth')
      setTier(entry?.tier ?? 'both')
      setEnvClientIdName('')
      setEnvClientSecretName('')
      setAuthorizeUrl('')
      setTokenUrl('')
    }
  }

  const pending = create.isPending || update.isPending

  const handleSave = () => {
    const envFields =
      authMode === 'env-oauth'
        ? {
            envClientIdName: envClientIdName.trim() || undefined,
            envClientSecretName: envClientSecretName.trim() || undefined,
            authorizeUrl: authorizeUrl.trim() || undefined,
            tokenUrl: tokenUrl.trim() || undefined,
          }
        : {}

    if (isEdit && entry) {
      update.mutate(
        {
          id: entry.id,
          input: {
            name: name.trim(),
            description: description.trim(),
            mcpUrl: mcpUrl.trim(),
            authMode,
            tier,
            ...envFields,
          },
        },
        { onSuccess: () => onOpenChange(false) },
      )
      return
    }
    create.mutate(
      {
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim(),
        mcpUrl: mcpUrl.trim(),
        authMode,
        tier,
        ...envFields,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  const canSave = name.trim() && mcpUrl.trim() && (isEdit || slug.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('directoryEditTitle') : t('directoryAddTitle')}
          </DialogTitle>
          <DialogDescription>{t('directoryDialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="dir-slug">{t('directorySlug')}</Label>
              <Input
                id="dir-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-server"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="dir-name">{t('directoryName')}</Label>
            <Input
              id="dir-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dir-desc">{t('directoryDescription')}</Label>
            <Textarea
              id="dir-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dir-url">{t('directoryMcpUrl')}</Label>
            <Input
              id="dir-url"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="https://mcp.example.com/mcp"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('directoryAuthMode')}</Label>
              <Select
                value={authMode}
                onValueChange={(v) => setAuthMode(v as DirectoryAuthMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('directoryTier')}</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as DirectoryTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`tier_${m}` as 'tier_both')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {authMode === 'env-oauth' && (
            <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">{t('directoryEnvHint')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dir-cid">{t('directoryEnvClientId')}</Label>
                  <Input
                    id="dir-cid"
                    value={envClientIdName}
                    onChange={(e) => setEnvClientIdName(e.target.value)}
                    placeholder="FOO_CLIENT_ID"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dir-cs">{t('directoryEnvClientSecret')}</Label>
                  <Input
                    id="dir-cs"
                    value={envClientSecretName}
                    onChange={(e) => setEnvClientSecretName(e.target.value)}
                    placeholder="FOO_CLIENT_SECRET"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dir-auth">{t('directoryAuthorizeUrl')}</Label>
                <Input
                  id="dir-auth"
                  value={authorizeUrl}
                  onChange={(e) => setAuthorizeUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dir-tok">{t('directoryTokenUrl')}</Label>
                <Input
                  id="dir-tok"
                  value={tokenUrl}
                  onChange={(e) => setTokenUrl(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('directoryCancel')}
          </Button>
          <Button disabled={!canSave || pending} onClick={handleSave}>
            {pending && <Loader2 className="size-4 animate-spin mr-1.5" />}
            {t('directorySave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
