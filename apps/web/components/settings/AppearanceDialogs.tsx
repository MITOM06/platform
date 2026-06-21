'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Sun, Moon, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { setLocaleAction } from '@/lib/actions/locale'
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ThemeValue = 'light' | 'dark' | 'system'

const THEME_OPTIONS: { value: ThemeValue; icon: typeof Sun; activeColor: string }[] = [
  { value: 'light', icon: Sun, activeColor: 'text-amber-500' },
  { value: 'dark', icon: Moon, activeColor: 'text-pon-cyan' },
  { value: 'system', icon: Monitor, activeColor: 'text-pon-peach' },
]

/** Theme picker — shows Light / Dark / System options like the mobile dialog. */
export function ThemePickerDialog({ open, onOpenChange }: DialogProps) {
  const t = useTranslations('settings')
  const { theme, setTheme } = useTheme()
  const current = (theme ?? 'system') as ThemeValue

  const labelFor = (v: ThemeValue) =>
    v === 'light' ? t('themeLight') : v === 'dark' ? t('themeDark') : t('themeSystem')

  const select = (v: ThemeValue) => {
    setTheme(v)
    onOpenChange(false)
    toast.success(t('themeChanged', { theme: labelFor(v) }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{t('chooseThemeTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {THEME_OPTIONS.map(({ value, icon: Icon, activeColor }) => {
            const active = current === value
            return (
              <button
                key={value}
                onClick={() => select(value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                  active ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted',
                )}
              >
                <Icon className={cn('size-5 shrink-0', active ? activeColor : 'text-muted-foreground')} />
                <span className={cn('flex-1 text-sm', active ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                  {labelFor(value)}
                </span>
                {active && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Language picker — lists all supported languages by native name like the mobile dialog. */
export function LanguagePickerDialog({ open, onOpenChange }: DialogProps) {
  const t = useTranslations('settings')
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const select = (next: Locale) => {
    if (next === locale) {
      onOpenChange(false)
      return
    }
    startTransition(async () => {
      await setLocaleAction(next)
      onOpenChange(false)
      toast.success(t('languageChanged'))
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{t('chooseLanguageTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
          {SUPPORTED_LOCALES.map((lng) => {
            const active = lng === locale
            return (
              <button
                key={lng}
                disabled={isPending}
                onClick={() => select(lng)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60',
                  active ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted',
                )}
              >
                <span className={cn('flex-1 text-sm', active ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                  {LOCALE_NAMES[lng]}
                </span>
                {active && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
