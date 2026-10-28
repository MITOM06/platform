'use client'

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Lock,
  LockOpen,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store/auth.store'
import { authService } from '@/lib/api/auth'
import { passwordChangeErrorKey } from '@/lib/auth/password-change-error'
import {
  PASSWORD_CHANGE_FIELDS,
  passwordChangeErrorField,
  validatePasswordChange,
  type FieldError,
  type PasswordChangeField,
} from '@/lib/auth/password-change-form'
import { parseAuthError } from '@/lib/auth/auth-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { TwoFactorSection } from '@/components/settings/TwoFactorSection'

const FIELD_IDS: Record<PasswordChangeField, string> = {
  current: 'sec-current',
  next: 'sec-new',
  confirm: 'sec-confirm',
}

type ServerFieldError = FieldError & { field: PasswordChangeField }

function focusField(field: PasswordChangeField) {
  document.getElementById(FIELD_IDS[field])?.focus()
}

export default function SecurityPage() {
  const t = useTranslations('settings.security')
  const tReg = useTranslations('auth.password')
  const tCommon = useTranslations('common')
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)

  const hasPassword = user?.hasPassword ?? false

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  // Input problems show under their input from the first submit on, re-checked as
  // the user types. A server answer about one input (wrong current password) stays
  // until that input is edited; `error` is for problems of the whole form.
  const [attempted, setAttempted] = useState(false)
  const [serverFieldError, setServerFieldError] = useState<ServerFieldError | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Inputs are disabled while saving, so focus moves once the request settles.
  const focusAfterSave = useRef<PasswordChangeField | null>(null)

  useEffect(() => {
    if (saving || !focusAfterSave.current) return
    focusField(focusAfterSave.current)
    focusAfterSave.current = null
  }, [saving])

  const form = { current: currentPw, next: newPw, confirm: confirmPw }
  const localErrors = attempted ? validatePasswordChange(form, hasPassword) : {}

  const fieldError = (field: PasswordChangeField) => {
    const e = localErrors[field] ?? (serverFieldError?.field === field ? serverFieldError : undefined)
    return e ? t(e.key, e.values) : undefined
  }

  const edit = (field: PasswordChangeField, setValue: (v: string) => void) => (value: string) => {
    setValue(value)
    if (serverFieldError?.field === field) setServerFieldError(null)
  }

  const clearForm = () => {
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setAttempted(false)
    setServerFieldError(null)
  }

  const reset = () => {
    clearForm()
    setError(null)
  }

  const handleSubmit = async () => {
    setAttempted(true)
    setError(null)
    setServerFieldError(null)
    const errors = validatePasswordChange(form, hasPassword)
    const firstInvalid = PASSWORD_CHANGE_FIELDS.find((f) => errors[f])
    if (firstInvalid) {
      focusField(firstInvalid)
      return
    }

    setSaving(true)
    try {
      await authService.changePassword(hasPassword ? currentPw : undefined, newPw)
      toast.success(hasPassword ? t('changeSuccess') : t('setSuccess'))
      // Refresh the profile so `hasPassword` updates in the auth store.
      const updated = await authService.getMe()
      if (updated && accessToken && user) {
        setAuth({ ...user, ...updated }, accessToken)
      }
      clearForm()
    } catch (e: unknown) {
      // Mapped by error `code`, never the raw English server text
      // (.claude/rules/no-raw-system-data-in-ui.md). SSO_REQUIRED (passwords are
      // off for an SSO-enforced domain) gets this screen's own wording.
      if (parseAuthError(e).code === 'SSO_REQUIRED') {
        setError(t('ssoPasswordDisabled'))
      } else {
        const mapped = passwordChangeErrorKey(e)
        const field = passwordChangeErrorField(mapped.key)
        if (field) {
          setServerFieldError({ field, ...mapped })
          focusAfterSave.current = field
        } else {
          setError(t(mapped.key, mapped.values))
        }
      }
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8 pb-tabbar md:pb-8">
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
                <div
                  role="alert"
                  className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              {hasPassword && (
                <PasswordInput
                  id={FIELD_IDS.current}
                  label={t('currentLabel')}
                  icon={Lock}
                  value={currentPw}
                  onChange={edit('current', setCurrentPw)}
                  placeholder={t('currentPlaceholder')}
                  disabled={saving}
                  autoComplete="current-password"
                  error={fieldError('current')}
                />
              )}

              <PasswordInput
                id={FIELD_IDS.next}
                label={hasPassword ? t('newLabel') : t('passwordLabel')}
                icon={LockOpen}
                value={newPw}
                onChange={edit('next', setNewPw)}
                placeholder={t('newPlaceholder')}
                disabled={saving}
                autoComplete="new-password"
                error={fieldError('next')}
              >
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
              </PasswordInput>

              <PasswordInput
                id={FIELD_IDS.confirm}
                label={t('confirmLabel')}
                icon={Lock}
                value={confirmPw}
                onChange={edit('confirm', setConfirmPw)}
                placeholder={t('confirmPlaceholder')}
                disabled={saving}
                autoComplete="new-password"
                error={fieldError('confirm')}
                onEnter={handleSubmit}
              />

              <div className="flex items-center justify-between pt-1">
                {/* Changing the password signs every OTHER device out (server-side). */}
                <p className="text-xs text-muted-foreground">
                  {hasPassword ? t('otherDevicesSignedOut') : t('staySignedIn')}
                </p>
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

          <TwoFactorSection />
        </div>
      </div>
    </div>
  )
}

/** Labelled password input with a show/hide toggle and its own error line. */
function PasswordInput({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete,
  error,
  onEnter,
  children,
}: {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled: boolean
  autoComplete: string
  error?: string
  onEnter?: () => void
  children?: ReactNode
}) {
  const [show, setShow] = useState(false)
  const errorId = `${id}-error`
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-10"
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onKeyDown={onEnter ? (e) => { if (e.key === 'Enter') onEnter() } : undefined}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
      {children}
    </div>
  )
}
