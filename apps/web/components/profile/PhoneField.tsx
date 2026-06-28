'use client'

import { useState } from 'react'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
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

/** Reads the typed auth-service error code (`response.data.code`) without `any`. */
function errorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { code?: unknown } } }).response?.data
    if (data && typeof data.code === 'string') return data.code
  }
  return undefined
}

export function PhoneField({ value, verified, onChange, disabled, labels }: PhoneFieldProps) {
  // local draft (what's currently in the input, may differ from saved value)
  const [draft, setDraft] = useState<string>(value ?? '')
  const [showOtpDialog, setShowOtpDialog] = useState(false)
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [otpError, setOtpError] = useState('')

  // Has the user changed the input from the saved verified number?
  const isDirty = draft !== value

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
      setShowOtpDialog(true)
      startTimer()
    } catch (err: unknown) {
      const code = errorCode(err)
      toast.error(code === 'PHONE_ALREADY_TAKEN' ? labels.errorTaken : labels.errorSend)
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
      setShowOtpDialog(false)
      onChange(draft, true)
    } catch (err: unknown) {
      const errCode = errorCode(err)
      setOtpError(errCode === 'PHONE_OTP_EXPIRED' ? labels.errorExpired : labels.errorVerify)
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    await handleSendOtp()
  }

  const handlePhoneInputChange = (v: string | undefined) => {
    const next = v ?? ''
    setDraft(next)
    // If the user changes the number away from the saved value, revoke the
    // locally-shown verified state (the DB still holds the old value until
    // they verify the new one).
    if (next !== value) onChange(value, false)
  }

  const showSendButton = !!draft && (isDirty || !verified)
  const showChangeButton = verified && !isDirty

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          {labels.label}
          {verified && !isDirty && (
            <span className="inline-flex items-center gap-1 text-xs text-green-500 font-medium">
              <CheckCircle2 className="size-3.5" />
              {labels.verified}
            </span>
          )}
        </label>

        <div className="flex gap-2">
          {/* react-phone-number-input renders country selector + number input */}
          <PhoneInput
            international
            defaultCountry="VN"
            value={draft}
            onChange={handlePhoneInputChange}
            disabled={disabled}
            className={cn(
              'flex-1 phone-input-container',
              'border border-input rounded-md px-3 py-2 text-sm bg-background',
              'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
            )}
            placeholder={labels.placeholder}
          />

          {showSendButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={handleSendOtp}
              disabled={disabled || sending || !isValidPhoneNumber(draft)}
            >
              {sending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                  {labels.sending}
                </>
              ) : (
                labels.sendOtp
              )}
            </Button>
          )}

          {showChangeButton && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => setDraft('')}
              disabled={disabled}
            >
              {labels.change}
            </Button>
          )}
        </div>

        {/* Hint text */}
        {!draft && <p className="text-xs text-muted-foreground">{labels.placeholder}</p>}
        {draft && isValidPhoneNumber(draft) && !verified && (
          <p className="text-xs text-amber-500 flex items-center gap-1">
            <ShieldCheck className="size-3.5" />
            {labels.unverified}
          </p>
        )}
      </div>

      {/* OTP verification dialog */}
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{labels.otpTitle}</DialogTitle>
            <DialogDescription>
              {labels.otpSubtitle}{' '}
              <span className="font-medium text-foreground">{draft}</span>
            </DialogDescription>
          </DialogHeader>

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
        </DialogContent>
      </Dialog>
    </>
  )
}
