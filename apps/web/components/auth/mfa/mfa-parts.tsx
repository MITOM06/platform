'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ShieldCheck } from 'lucide-react'
import { OtpInput } from '@/components/auth/OtpInput'
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TOTP_LENGTH } from '@/lib/auth/mfa'

/** A blank 6-box authenticator code. */
export function emptyCode(): string[] {
  return Array<string>(TOTP_LENGTH).fill('')
}

/** The full code once every box is filled with a digit, else `null`. */
export function completeCode(digits: string[]): string | null {
  const code = digits.join('')
  return new RegExp(`^\\d{${TOTP_LENGTH}}$`).test(code) ? code : null
}

/** Inline, already-localized error for the 2FA screens. */
export function MfaAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {children}
    </div>
  )
}

/** The 6-box authenticator-code input, labelled for assistive tech. */
export function MfaCodeInput({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const t = useTranslations('auth.mfa')
  return (
    <div role="group" aria-label={t('codeLabel')}>
      <OtpInput value={value} onChange={onChange} length={TOTP_LENGTH} disabled={disabled} />
    </div>
  )
}

/** Card header shared by the verify and enroll screens. */
export function MfaCardHeader({ title, description, email }: { title: string; description: string; email: string }) {
  const t = useTranslations('auth.mfa')
  return (
    <CardHeader>
      <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary/10">
        <ShieldCheck className="size-5 text-primary" aria-hidden />
      </div>
      <CardTitle className="text-2xl">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <p className="text-xs text-muted-foreground" data-testid="mfa-account">
        {t('signingInAs', { email })}
      </p>
    </CardHeader>
  )
}

/** Numbered step title used by the enrollment screen. */
export function MfaStep({ n, title, body, children }: { n: number; title: string; body: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {n}
        </span>
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
