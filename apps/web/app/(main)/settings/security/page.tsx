'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Lock,
  LockOpen,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store/auth.store'
import { authService } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'

interface ServerError {
  response?: { data?: { message?: string } }
}

export default function SecurityPage() {
  const t = useTranslations('settings.security')
  const tReg = useTranslations('auth.register')
  const tCommon = useTranslations('common')
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)

  const hasPassword = user?.hasPassword ?? false

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return tReg('reqLength')
    if (!/[A-Z]/.test(pw)) return tReg('reqUppercase')
    if (!/[a-z]/.test(pw)) return tReg('reqLowercase')
    if (!/[0-9]/.test(pw)) return tReg('reqDigit')
    if (!/[!@#$%^&*]/.test(pw)) return tReg('reqSpecial')
    return null
  }

  const reset = () => {
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setError(null)
  }

  const handleSubmit = async () => {
    const pwError = validatePassword(newPw)
    if (pwError) {
      setError(pwError)
      return
    }
    if (newPw !== confirmPw) {
      setError(t('mismatch'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await authService.changePassword(hasPassword ? currentPw : undefined, newPw)
      toast.success(hasPassword ? t('changeSuccess') : t('setSuccess'))
      // Refresh the profile so `hasPassword` updates in the auth store.
      const updated = await authService.getMe()
      if (updated && accessToken && user) {
        setAuth({ ...user, ...updated }, accessToken)
      }
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (e: unknown) {
      let msg = t('genericError')
      const serverMsg = (e as ServerError)?.response?.data?.message
      if (serverMsg?.includes('Incorrect current password')) {
        msg = t('incorrectCurrent')
      } else if (serverMsg?.includes('Current password is required')) {
        msg = t('currentRequired')
      } else if (serverMsg) {
        msg = serverMsg
      }
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {!hasPassword && (
            <div className="flex gap-3 items-start rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5">
              <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {t('noPasswordTitle')}
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                  {t('noPasswordSubtitle')}
                </p>
              </div>
            </div>
          )}

          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">
                  {hasPassword ? t('changePasswordTitle') : t('setPasswordTitle')}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {hasPassword
                    ? t('changePasswordSubtitle')
                    : t('setPasswordSubtitle')}
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}

              {hasPassword && (
                <div className="space-y-2">
                  <Label htmlFor="sec-current">{t('currentLabel')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="sec-current"
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      placeholder={t('currentPlaceholder')}
                      className="pl-9 pr-10"
                      disabled={saving}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrent ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sec-new">
                  {hasPassword ? t('newLabel') : t('passwordLabel')}
                </Label>
                <div className="relative">
                  <LockOpen className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="sec-new"
                    type={showNew ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder={t('newPlaceholder')}
                    className="pl-9 pr-10"
                    disabled={saving}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNew ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <PasswordStrengthMeter
                  password={newPw}
                  labels={{
                    weak: tReg('pwStrengthWeak'),
                    medium: tReg('pwStrengthMedium'),
                    strong: tReg('pwStrengthStrong'),
                    veryStrong: tReg('pwStrengthVeryStrong'),
                    reqLength: tReg('reqLength'),
                    reqUppercase: tReg('reqUppercase'),
                    reqLowercase: tReg('reqLowercase'),
                    reqDigit: tReg('reqDigit'),
                    reqSpecial: tReg('reqSpecial'),
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sec-confirm">{t('confirmLabel')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="sec-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder={t('confirmPlaceholder')}
                    className="pl-9 pr-10"
                    disabled={saving}
                    autoComplete="new-password"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmit()
                    }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">{t('staySignedIn')}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={reset} disabled={saving}>
                    {tCommon('cancel')}
                  </Button>
                  <Button onClick={handleSubmit} disabled={saving}>
                    {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                    {hasPassword ? t('changeButton') : t('setButton')}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-muted flex items-center justify-center">
                <ShieldCheck className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-base text-muted-foreground">
                  {t('twoFaTitle')}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('twoFaSubtitle')}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-dashed bg-muted/30 px-5 py-4 flex items-center gap-3">
              <ShieldCheck className="size-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{t('twoFaComingSoon')}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
