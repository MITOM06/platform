'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Copy, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface Props {
  codes: string[]
  /** Account the codes belong to — written into the downloaded file. */
  accountEmail: string
  continueLabel: string
  onContinue: () => void
  busy?: boolean
}

const FILE_NAME = 'pon-backup-codes.txt'

/**
 * The 10 single-use backup codes, shown exactly once (after enrolling, or after
 * regenerating them in Settings → Security). Copy / Download .txt, and the
 * user must tick "I saved my backup codes" before continuing.
 */
export function BackupCodesPanel({ codes, accountEmail, continueLabel, onContinue, busy = false }: Props) {
  const t = useTranslations('auth.mfa')
  const [saved, setSaved] = useState(false)
  const checkboxId = useId()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      toast.success(t('codesCopied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  const download = () => {
    const text = [t('fileHeader', { email: accountEmail }), t('fileNote'), '', ...codes, ''].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = FILE_NAME
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <ul
        className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-4 font-mono text-sm tracking-wider"
        aria-label={t('backupTitle')}
      >
        {codes.map((code) => (
          <li key={code} data-testid="backup-code" className="text-center select-all">
            {code}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="gap-1.5" onClick={copy}>
          <Copy className="size-4" aria-hidden />
          {t('copyCodes')}
        </Button>
        <Button type="button" variant="outline" className="gap-1.5" onClick={download}>
          <Download className="size-4" aria-hidden />
          {t('downloadCodes')}
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
        <Checkbox id={checkboxId} checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
        <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-medium">
          {t('savedCheckbox')}
        </Label>
      </div>

      <Button
        type="button"
        className="w-full h-11 text-base font-bold tracking-wide"
        disabled={!saved || busy}
        onClick={onContinue}
      >
        {busy && <Loader2 className="size-4 animate-spin mr-2" aria-hidden />}
        {continueLabel}
      </Button>
    </div>
  )
}
