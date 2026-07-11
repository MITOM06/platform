'use client'

import {
  Info,
  User,
  Save,
  Pencil,
  Cake,
  Users,
  Lock,
  Loader2,
  CalendarIcon,
} from 'lucide-react'
import { Controller } from 'react-hook-form'
import type {
  UseFormRegister,
  FieldErrors,
  Control,
} from 'react-hook-form'
import { format, parse, isValid } from 'date-fns'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { PhoneField } from '@/components/profile/PhoneField'

export type ProfileFormValues = {
  displayName: string
  bio?: string
  dateOfBirth?: string
  phoneNumber?: string // E.164 value
  phoneVerified?: boolean // local verification state
  gender?: string
  showDateOfBirth: boolean
  showPhoneNumber: boolean
  showGender: boolean
}

/** Per-field privacy toggle keys (the fields users can choose to hide). */
export type PrivacyField = 'showDateOfBirth' | 'showPhoneNumber' | 'showGender'

type ProfileFormTexts = {
  displayNameLabel: string
  displayNamePlaceholder: string
  bioLabel: string
  bioPlaceholder: string
  dobLabel: string
  dobPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  phoneSendOtp: string
  phoneSending: string
  phoneVerified: string
  phoneUnverified: string
  phoneChange: string
  phoneOtpTitle: string
  phoneOtpSubtitle: string
  phoneOtpConfirm: string
  phoneVerifying: string
  phoneOtpIncomplete: string
  phoneResend: string
  phoneResendCountdown: string
  phoneSuccess: string
  phoneErrorInvalid: string
  phoneErrorSend: string
  phoneErrorVerify: string
  phoneErrorExpired: string
  phoneErrorTaken: string
  phoneNoticeText: string
  phoneVerifyAction: string
  phoneModalPhoneTitle: string
  phoneModalPhoneSubtitle: string
  phoneErrorRateLimit: string
  genderLabel: string
  genderPlaceholder: string
  genderMale: string
  genderFemale: string
  genderOther: string
  privacySectionLabel: string
  privacySectionHint: string
  showDobLabel: string
  showPhoneLabel: string
  showGenderLabel: string
  roleLabel: string
  emailLabel: string
  saveButton: string
}

type ProfileFormProps = {
  register: UseFormRegister<ProfileFormValues>
  control: Control<ProfileFormValues>
  errors: FieldErrors<ProfileFormValues>
  gender?: string
  showDateOfBirth: boolean
  showPhoneNumber: boolean
  showGender: boolean
  phoneNumber?: string
  phoneVerified?: boolean
  email: string
  roleName: string
  saving: boolean
  canSave: boolean
  texts: ProfileFormTexts
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onGenderChange: (value: string) => void
  onShowFieldChange: (field: PrivacyField, value: boolean) => void
  onPhoneChange: (phone: string, verified: boolean) => void
}

export function ProfileForm({
  register,
  control,
  errors,
  gender,
  showDateOfBirth,
  showPhoneNumber,
  showGender,
  phoneNumber,
  phoneVerified,
  email,
  roleName,
  saving,
  canSave,
  texts,
  onSubmit,
  onGenderChange,
  onShowFieldChange,
  onPhoneChange,
}: ProfileFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-tabbar md:pb-10">
      {/* Display name */}
      <div className="space-y-2">
        <Label htmlFor="displayName" className="text-sm font-medium flex items-center gap-2">
          <User className="size-4 text-primary" />
          {texts.displayNameLabel}
        </Label>
        <div className="relative">
          <Input
            id="displayName"
            {...register('displayName')}
            placeholder={texts.displayNamePlaceholder}
            className="pr-8"
          />
          <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
        </div>
        {errors.displayName && (
          <p className="text-xs text-destructive">{errors.displayName.message}</p>
        )}
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio" className="text-sm font-medium flex items-center gap-2">
          <Info className="size-4 text-primary" />
          {texts.bioLabel}
        </Label>
        <div className="relative">
          <Input
            id="bio"
            {...register('bio')}
            placeholder={texts.bioPlaceholder}
            maxLength={160}
            className="pr-8"
          />
          <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
        </div>
        {errors.bio && (
          <p className="text-xs text-destructive">{errors.bio.message}</p>
        )}
      </div>

      {/* Date of birth */}
      <div className="space-y-2">
        <Label htmlFor="dateOfBirth" className="text-sm font-medium flex items-center gap-2">
          <Cake className="size-4 text-primary" />
          {texts.dobLabel}
        </Label>

        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field }) => {
            // Convert between the stored "yyyy-MM-dd" string and a Date object.
            const selectedDate = field.value
              ? parse(field.value, 'yyyy-MM-dd', new Date())
              : undefined
            const isValidDate = !!selectedDate && isValid(selectedDate)

            return (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal h-10',
                      !isValidDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
                    {isValidDate ? format(selectedDate, 'dd/MM/yyyy') : texts.dobPlaceholder}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={isValidDate ? selectedDate : undefined}
                    onSelect={(date) =>
                      field.onChange(date ? format(date, 'yyyy-MM-dd') : '')
                    }
                    captionLayout="dropdown"
                    startMonth={new Date(1900, 0)}
                    endMonth={new Date()}
                    disabled={{ after: new Date() }}
                    defaultMonth={isValidDate ? selectedDate : new Date(2000, 0)}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            )
          }}
        />

        {errors.dateOfBirth && (
          <p className="text-xs text-destructive">{errors.dateOfBirth.message}</p>
        )}
      </div>

      {/* Phone number — country picker + SMS OTP verification */}
      <PhoneField
        value={phoneNumber ?? ''}
        verified={phoneVerified ?? false}
        onChange={onPhoneChange}
        disabled={saving}
        labels={{
          label: texts.phoneLabel,
          placeholder: texts.phonePlaceholder,
          sendOtp: texts.phoneSendOtp,
          sending: texts.phoneSending,
          verified: texts.phoneVerified,
          unverified: texts.phoneUnverified,
          change: texts.phoneChange,
          otpTitle: texts.phoneOtpTitle,
          otpSubtitle: texts.phoneOtpSubtitle,
          otpConfirm: texts.phoneOtpConfirm,
          verifying: texts.phoneVerifying,
          otpIncomplete: texts.phoneOtpIncomplete,
          resend: texts.phoneResend,
          resendCountdown: texts.phoneResendCountdown,
          successToast: texts.phoneSuccess,
          errorInvalid: texts.phoneErrorInvalid,
          errorSend: texts.phoneErrorSend,
          errorVerify: texts.phoneErrorVerify,
          errorExpired: texts.phoneErrorExpired,
          errorTaken: texts.phoneErrorTaken,
          noticeText: texts.phoneNoticeText,
          verifyAction: texts.phoneVerifyAction,
          modalPhoneTitle: texts.phoneModalPhoneTitle,
          modalPhoneSubtitle: texts.phoneModalPhoneSubtitle,
          errorRateLimit: texts.phoneErrorRateLimit,
        }}
      />

      {/* Gender */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Users className="size-4 text-primary" />
          {texts.genderLabel}
        </Label>
        <Select value={gender || ''} onValueChange={onGenderChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={texts.genderPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">
              <span className="flex items-center gap-2">
                <span className="text-blue-500">♂</span>
                {texts.genderMale}
              </span>
            </SelectItem>
            <SelectItem value="female">
              <span className="flex items-center gap-2">
                <span className="text-pink-500">♀</span>
                {texts.genderFemale}
              </span>
            </SelectItem>
            <SelectItem value="other">
              <span className="flex items-center gap-2">
                <span className="text-purple-500">⚧</span>
                {texts.genderOther}
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Role (read-only) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Users className="size-4" />
          {texts.roleLabel}
        </Label>
        <Input value={roleName} disabled className="text-muted-foreground bg-muted/50" />
      </div>

      {/* Email (read-only) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <span className="text-base">@</span>
          {texts.emailLabel}
        </Label>
        <Input
          value={email}
          disabled
          className="text-muted-foreground bg-muted/50"
        />
      </div>

      {/* Privacy section — per-field visibility toggles */}
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center gap-2 min-w-0">
          <Lock className="size-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{texts.privacySectionLabel}</p>
            <p className="text-xs text-muted-foreground">{texts.privacySectionHint}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="showDateOfBirth" className="text-sm font-normal">
            {texts.showDobLabel}
          </Label>
          <Switch
            id="showDateOfBirth"
            checked={showDateOfBirth}
            onCheckedChange={(v) => onShowFieldChange('showDateOfBirth', v)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="showPhoneNumber" className="text-sm font-normal">
            {texts.showPhoneLabel}
          </Label>
          <Switch
            id="showPhoneNumber"
            checked={showPhoneNumber}
            onCheckedChange={(v) => onShowFieldChange('showPhoneNumber', v)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="showGender" className="text-sm font-normal">
            {texts.showGenderLabel}
          </Label>
          <Switch
            id="showGender"
            checked={showGender}
            onCheckedChange={(v) => onShowFieldChange('showGender', v)}
          />
        </div>
      </div>

      <Separator />

      {/* Save button */}
      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-pon-cyan via-pon-peach to-pon-pink hover:opacity-90 text-white font-semibold h-11 shadow-lg shadow-primary/20 transition-all"
        disabled={saving || !canSave}
      >
        {saving ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <Save className="size-4 mr-2" />
        )}
        {texts.saveButton}
      </Button>
    </form>
  )
}
