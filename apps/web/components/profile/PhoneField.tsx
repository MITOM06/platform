'use client'

import { useState } from 'react'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { CheckCircle2, Loader2, ShieldAlert, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { OtpInput } from '@/components/auth/OtpInput'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { authService } from '@/lib/api/auth'
import { cn } from '@/lib/utils'

export interface PhoneFieldLabels {
  label: string
  placeholder: string
  sendOtp: string
  sending: string
  verified: string
  unverified: string
  change: string
  otpTitle: string
  otpSubtitle: string
  otpConfirm: string
  verifying: string
  otpIncomplete: string
  resend: string
  resendCountdown: string
  successToast: string
  errorInvalid: string
  errorSend: string
  errorVerify: string
  errorExpired: string
  errorTaken: string
  // ── notice-first redesign labels ──
  noticeText: string
  verifyAction: string
  modalPhoneTitle: string
  modalPhoneSubtitle: string
  errorRateLimit: string
}

interface PhoneFieldProps {
  /** E.164 phone number already stored on the user profile (may be empty). */
  value: string
  verified: boolean
  onChange: (phone: string, verified: boolean) => void
  disabled?: boolean
  labels: PhoneFieldLabels
}

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

type VerifyStep = 'phone' | 'otp'

/** Reads the typed auth-service error code (`response.data.code`) without `any`. */
function errorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { code?: unknown } } }).response?.data
    if (data && typeof data.code === 'string') return data.code
  }
  return undefined
}

/**
 * Notice-first phone verification field with three resting states (no number /
 * unverified / verified). Tapping Verify or Change opens a two-step modal:
 * enter number → enter OTP. Mirrors the Flutter PhoneVerificationSection.
 */
export function PhoneField({ value, verified, onChange, disabled, labels }: PhoneFieldProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState<VerifyStep>('phone')
  const [draft, setDraft] = useState('')
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [otpError, setOtpError] = useState('')

  const startTimer = () => {
    setResendTimer(RESEND_COOLDOWN)
    const id = setInterval(() => {
      setResendTimer((s) => {
        if (s <= 1) {
          clearInterval(id)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const openModal = () => {
    setDraft(value ?? '')
    setStep('phone')
    setOtp(Array(OTP_LENGTH).fill(''))
    setOtpError('')
    setModalOpen(true)
  }

  const handleSendOtp = async () => {
    if (!draft || !isValidPhoneNumber(draft)) {
      toast.error(labels.errorInvalid)
      return
    }
    setSending(true)
    try {
      await authService.sendPhoneOtp(draft)
      setOtp(Array(OTP_LENGTH).fill(''))
      setOtpError('')
      setStep('otp')
      startTimer()
    } catch (err: unknown) {
      const code = errorCode(err)
      if (code === 'PHONE_OTP_RATE_LIMIT') {
        toast.error(labels.errorRateLimit)
      } else if (code === 'PHONE_ALREADY_TAKEN') {
        toast.error(labels.errorTaken)
      } else {
        toast.error(labels.errorSend)
      }
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length < OTP_LENGTH) {
      setOtpError(labels.otpIncomplete)
      return
    }
    setVerifying(true)
    setOtpError('')
    try {
      await authService.verifyPhoneOtp(code)
      toast.success(labels.successToast)
      setModalOpen(false)
      onChange(draft, true)
    } catch (err: unknown) {
      const errCode = errorCode(err)
      setOtpError(errCode === 'PHONE_OTP_EXPIRED' ? labels.errorExpired : labels.errorVerify)
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = () => {
    if (resendTimer > 0) return
    // Go back to the phone step so the user re-confirms the number before we
    // send another code (and reset the OTP digits).
    setOtp(Array(OTP_LENGTH).fill(''))
    setOtpError('')
    setStep('phone')
  }

  const modal = (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {step === 'phone' ? labels.modalPhoneTitle : labels.otpTitle}
          </DialogTitle>
          <DialogDescription>
            {step === 'phone' ? (
              labels.modalPhoneSubtitle
            ) : (
              <>
                {labels.otpSubtitle}{' '}
                <span className="font-medium text-foreground">{draft}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'phone' ? (
          <div className="space-y-4 pt-2">
            <PhoneInput
              international
              defaultCountry="VN"
              value={draft}
              onChange={(v) => setDraft(v ?? '')}
              className={cn(
                'phone-input-container',
                'border border-input rounded-md px-3 py-2 text-sm bg-background',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
              )}
              placeholder={labels.placeholder}
            />
            <Button
              onClick={handleSendOtp}
              disabled={sending || !draft || !isValidPhoneNumber(draft)}
              className="w-full"
            >
              {sending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {labels.sending}
                </>
              ) : (
                labels.sendOtp
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            <OtpInput value={otp} onChange={setOtp} length={OTP_LENGTH} />
            {otpError && <p className="text-sm text-destructive text-center">{otpError}</p>}
            <Button onClick={handleVerify} disabled={verifying} className="w-full">
              {verifying ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {labels.verifying}
                </>
              ) : (
                labels.otpConfirm
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {resendTimer > 0 ? (
                <span>{labels.resendCountdown.replace('{seconds}', String(resendTimer))}</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="underline underline-offset-4 hover:text-primary"
                >
                  {labels.resend}
                </button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )

  // ── State 3: number present and verified ──
  if (value && verified) {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium">{labels.label}</label>
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2">
          <Phone className="size-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-sm font-mono truncate">{value}</span>
          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium shrink-0">
            <CheckCircle2 className="size-3.5" />
            {labels.verified}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={openModal}
            disabled={disabled}
          >
            {labels.change}
          </Button>
        </div>
        {modal}
      </div>
    )
  }

  // ── State 2: number present but not yet verified ──
  if (value && !verified) {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium">{labels.label}</label>
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 px-3 py-2">
          <Phone className="size-4 text-amber-600 shrink-0" />
          <span className="flex-1 text-sm font-mono text-muted-foreground truncate">{value}</span>
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium shrink-0">
            <ShieldAlert className="size-3.5" />
            {labels.unverified}
          </span>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={openModal}
            disabled={disabled}
          >
            {labels.verifyAction}
          </Button>
        </div>
        {modal}
      </div>
    )
  }

  // ── State 1: no number yet (primary state) ──
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{labels.label}</label>
      <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/20 px-3 py-3">
        <ShieldAlert className="size-4 text-muted-foreground shrink-0" />
        <p className="flex-1 text-sm text-muted-foreground">{labels.noticeText}</p>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={openModal}
          disabled={disabled}
        >
          {labels.verifyAction}
        </Button>
      </div>
      {modal}
    </div>
  )
}
