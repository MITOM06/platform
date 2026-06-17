'use client'

import {
  Info,
  User,
  Save,
  Pencil,
  Cake,
  Phone,
  Users,
  Lock,
  Loader2,
} from 'lucide-react'
import type {
  UseFormRegister,
  FieldErrors,
} from 'react-hook-form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export type ProfileFormValues = {
  displayName: string
  bio?: string
  dateOfBirth?: string
  phoneNumber?: string
  gender?: string
  hideInfo: boolean
}

type ProfileFormTexts = {
  displayNameLabel: string
  displayNamePlaceholder: string
  bioLabel: string
  bioPlaceholder: string
  dobLabel: string
  phoneLabel: string
  phonePlaceholder: string
  genderLabel: string
  genderPlaceholder: string
  genderMale: string
  genderFemale: string
  genderOther: string
  hideInfoLabel: string
  hideInfoHint: string
  emailLabel: string
  saveButton: string
}

type ProfileFormProps = {
  register: UseFormRegister<ProfileFormValues>
  errors: FieldErrors<ProfileFormValues>
  gender?: string
  hideInfo: boolean
  email: string
  saving: boolean
  canSave: boolean
  texts: ProfileFormTexts
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onGenderChange: (value: string) => void
  onHideInfoChange: (value: boolean) => void
}

export function ProfileForm({
  register,
  errors,
  gender,
  hideInfo,
  email,
  saving,
  canSave,
  texts,
  onSubmit,
  onGenderChange,
  onHideInfoChange,
}: ProfileFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-24 md:pb-10">
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
        <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
      </div>

      {/* Phone number */}
      <div className="space-y-2">
        <Label htmlFor="phoneNumber" className="text-sm font-medium flex items-center gap-2">
          <Phone className="size-4 text-primary" />
          {texts.phoneLabel}
        </Label>
        <Input
          id="phoneNumber"
          type="tel"
          {...register('phoneNumber')}
          placeholder={texts.phonePlaceholder}
        />
        {errors.phoneNumber && (
          <p className="text-xs text-destructive">{errors.phoneNumber.message}</p>
        )}
      </div>

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
            <SelectItem value="male">{texts.genderMale}</SelectItem>
            <SelectItem value="female">{texts.genderFemale}</SelectItem>
            <SelectItem value="other">{texts.genderOther}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Privacy toggle — hide sensitive info from other users */}
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="flex items-center gap-2 min-w-0">
          <Lock className="size-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{texts.hideInfoLabel}</p>
            <p className="text-xs text-muted-foreground">{texts.hideInfoHint}</p>
          </div>
        </div>
        <Switch
          checked={hideInfo}
          onCheckedChange={onHideInfoChange}
        />
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
