'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/auth.store'
import { authService } from '@/lib/api/auth'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl } from '@/lib/media'
import { Separator } from '@/components/ui/separator'
import { ProfileImageHeader } from '@/components/profile/ProfileImageHeader'
import { ProfileForm, type ProfileFormValues } from '@/components/profile/ProfileForm'

// Code-split the cropper (pulls in react-easy-crop) — only needed once the user
// picks an image to crop, so it must not ship in the edit page's first load.
const ImageCropperModal = dynamic(
  () => import('@/components/profile/ImageCropperModal').then((m) => m.ImageCropperModal),
  { ssr: false },
)

type CropTarget = 'avatar' | 'cover' | null

export default function EditProfilePage() {
  const t = useTranslations('profile')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)

  // Phone is saved to the DB only via the OTP verify endpoint, not on form
  // submit — so it lives in local state, seeded from the persisted profile.
  const [localPhone, setLocalPhone] = useState('')
  const [localPhoneVerified, setLocalPhoneVerified] = useState(false)

  // The form is initially seeded from the partial authStore user; the real
  // server profile arrives via `me` and triggers reset(). Until that reset
  // runs, react-hook-form can report isDirty=true for fields (e.g. bio) whose
  // defaultValues differ from the real values — which would pop the unsaved
  // dialog on a Back tap even when the user changed nothing. Gate on this flag.
  const [isFormReady, setIsFormReady] = useState(false)

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: authService.getMe,
    enabled: !!accessToken,
  })

  // Staged (not-yet-uploaded) image edits — only persisted on explicit Save Changes.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // Cropper modal state
  const [cropTarget, setCropTarget] = useState<CropTarget>(null)
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)

  const schema = useMemo(
    () =>
      z.object({
        displayName: z.string().min(1, t('displayNameRequired')).max(50, t('displayNameTooLong')),
        bio: z.string().max(160, t('bioTooLong')).optional(),
        dateOfBirth: z.string().optional(),
        phoneNumber: z.string().max(20, t('phoneTooLong')).optional(),
        gender: z.string().optional(),
        showDateOfBirth: z.boolean(),
        showPhoneNumber: z.boolean(),
        showGender: z.boolean(),
      }),
    [t],
  )

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user?.displayName ?? '',
      bio: '',
      dateOfBirth: '',
      phoneNumber: '',
      gender: '',
      showDateOfBirth: true,
      showPhoneNumber: true,
      showGender: true,
    },
  })

  const gender = watch('gender')
  const showDateOfBirth = watch('showDateOfBirth')
  const showPhoneNumber = watch('showPhoneNumber')
  const showGender = watch('showGender')

  // Seed the form once the persisted profile loads — this is what was missing
  // before, causing bio to appear empty on every reopen.
  useEffect(() => {
    if (me) {
      reset({
        displayName: me.displayName ?? '',
        bio: me.bio ?? '',
        // Backend stores DOB as a Date; <input type="date"> needs yyyy-MM-dd.
        dateOfBirth: me.dateOfBirth ? me.dateOfBirth.slice(0, 10) : '',
        phoneNumber: me.phoneNumber ?? '',
        gender: me.gender ?? '',
        // Per-field flags fall back to !hideInfo for legacy users who never had them.
        showDateOfBirth: me.showDateOfBirth ?? !me.hideInfo,
        showPhoneNumber: me.showPhoneNumber ?? !me.hideInfo,
        showGender: me.showGender ?? !me.hideInfo,
      })
      setLocalPhone(me.phoneNumber ?? '')
      setLocalPhoneVerified(me.phoneVerified ?? false)
      setIsFormReady(true)
    }
  }, [me, reset])

  const handlePhoneChange = (phone: string, verified: boolean) => {
    setLocalPhone(phone)
    setLocalPhoneVerified(verified)
    // Mark the form dirty so the "Save Changes" button enables.
    setValue('phoneNumber', phone, { shouldDirty: true })
  }

  const openCropper = (target: CropTarget, file: File) => {
    const objectUrl = URL.createObjectURL(file)
    setCropSourceUrl(objectUrl)
    setCropTarget(target)
  }

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) openCropper('avatar', file)
  }

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) openCropper('cover', file)
  }

  const closeCropper = () => {
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    setCropSourceUrl(null)
    setCropTarget(null)
  }

  const handleCropConfirm = (blob: Blob) => {
    const previewUrl = URL.createObjectURL(blob)
    if (cropTarget === 'avatar') {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(previewUrl)
      setAvatarBlob(blob)
    } else if (cropTarget === 'cover') {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
      setCoverPreview(previewUrl)
      setCoverBlob(blob)
    }
    closeCropper()
  }

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !accessToken) return
    setSaving(true)
    try {
      let avatarUrl: string | undefined
      let coverPhoto: string | undefined

      // The cropper exports WebP when supported, else JPEG — keep the stored
      // filename extension consistent with the actual blob type.
      const ext = (blob: Blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg')
      if (avatarBlob) {
        const result = await chatService.uploadFile(avatarBlob, `avatar.${ext(avatarBlob)}`)
        avatarUrl = result.url
      }
      if (coverBlob) {
        const result = await chatService.uploadFile(coverBlob, `cover.${ext(coverBlob)}`)
        coverPhoto = result.url
      }

      const updated = await authService.updateProfile({
        displayName: values.displayName,
        bio: values.bio ?? '',
        dateOfBirth: values.dateOfBirth || undefined,
        // phoneNumber intentionally omitted — set only via phone OTP verification
        gender: values.gender || undefined,
        showDateOfBirth: values.showDateOfBirth,
        showPhoneNumber: values.showPhoneNumber,
        showGender: values.showGender,
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(coverPhoto ? { coverPhoto } : {}),
      })

      setAuth(
        {
          ...user,
          displayName: updated.displayName ?? values.displayName,
          bio: updated.bio ?? values.bio ?? '',
          avatarUrl: updated.avatarUrl ?? user.avatarUrl,
          coverPhoto: updated.coverPhoto ?? user.coverPhoto,
        },
        accessToken,
      )
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['user', user.id] })
      setAvatarBlob(null)
      setCoverBlob(null)
      toast.success(t('saveSuccess'))
      router.push('/profile')
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  // Submit handler exposed so the unsaved-changes dialog can "Save and leave".
  const handleSave = handleSubmit(onSubmit)

  // Unsaved-changes guard: dirty form fields OR staged (not-yet-uploaded)
  // images. Only meaningful once the form has been seeded from server data —
  // before that, isDirty is a false positive from the partial default values.
  const hasUnsavedChanges = isFormReady && (isDirty || !!avatarBlob || !!coverBlob)

  // Warn on browser close/refresh while there are unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      e.preventDefault()
      e.returnValue = '' // required for Chrome to show the native dialog
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // In-app back navigation: confirm before discarding unsaved changes.
  const handleBack = () => {
    if (hasUnsavedChanges) {
      setLeaveConfirmOpen(true)
    } else {
      router.push('/profile')
    }
  }

  if (!user) return null

  const initials = user.displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const resolvedAvatar = avatarPreview ?? absoluteMediaUrl(me?.avatarUrl ?? user.avatarUrl ?? '')
  const resolvedCover = coverPreview ?? absoluteMediaUrl(me?.coverPhoto ?? user.coverPhoto ?? '')
  const hasPendingImageEdits = !!avatarBlob || !!coverBlob

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md z-10">
        <button
          type="button"
          onClick={handleBack}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <ProfileImageHeader
          resolvedCover={resolvedCover}
          resolvedAvatar={resolvedAvatar}
          initials={initials}
          displayName={user.displayName}
          email={user.email}
          changeCoverLabel={t('changeCover')}
          coverInputRef={coverInputRef}
          avatarInputRef={avatarInputRef}
          onCoverPick={handleCoverPick}
          onAvatarPick={handleAvatarPick}
        />

        <div className="relative max-w-2xl mx-auto px-6">
          <Separator className="mb-6" />

          <ProfileForm
            register={register}
            control={control}
            errors={errors}
            gender={gender}
            showDateOfBirth={showDateOfBirth}
            showPhoneNumber={showPhoneNumber}
            showGender={showGender}
            phoneNumber={localPhone}
            phoneVerified={localPhoneVerified}
            email={user.email}
            saving={saving}
            canSave={isDirty || hasPendingImageEdits}
            texts={{
              displayNameLabel: t('displayNameLabel'),
              displayNamePlaceholder: t('displayNamePlaceholder'),
              bioLabel: t('bioLabel'),
              bioPlaceholder: t('bioPlaceholder'),
              dobLabel: t('dobLabel'),
              dobPlaceholder: t('dobPlaceholder'),
              phoneLabel: t('phoneLabel'),
              phonePlaceholder: t('phonePlaceholder'),
              phoneSendOtp: t('phoneSendOtp'),
              phoneSending: t('phoneSending'),
              phoneVerified: t('phoneVerified'),
              phoneUnverified: t('phoneUnverified'),
              phoneChange: t('phoneChange'),
              phoneOtpTitle: t('phoneOtpTitle'),
              phoneOtpSubtitle: t('phoneOtpSubtitle'),
              phoneOtpConfirm: t('phoneOtpConfirm'),
              phoneVerifying: t('phoneVerifying'),
              phoneOtpIncomplete: t('phoneOtpIncomplete'),
              phoneResend: t('phoneResend'),
              phoneResendCountdown: t('phoneResendCountdown'),
              phoneSuccess: t('phoneSuccess'),
              phoneErrorInvalid: t('phoneErrorInvalid'),
              phoneErrorSend: t('phoneErrorSend'),
              phoneErrorVerify: t('phoneErrorVerify'),
              phoneErrorExpired: t('phoneErrorExpired'),
              phoneErrorTaken: t('phoneErrorTaken'),
              phoneNoticeText: t('phoneNoticeText'),
              phoneVerifyAction: t('phoneVerifyAction'),
              phoneModalPhoneTitle: t('phoneModalPhoneTitle'),
              phoneModalPhoneSubtitle: t('phoneModalPhoneSubtitle'),
              phoneErrorRateLimit: t('phoneErrorRateLimit'),
              genderLabel: t('genderLabel'),
              genderPlaceholder: t('genderPlaceholder'),
              genderMale: t('genderMale'),
              genderFemale: t('genderFemale'),
              genderOther: t('genderOther'),
              privacySectionLabel: t('privacySectionLabel'),
              privacySectionHint: t('privacySectionHint'),
              showDobLabel: t('showDobLabel'),
              showPhoneLabel: t('showPhoneLabel'),
              showGenderLabel: t('showGenderLabel'),
              emailLabel: t('emailLabel'),
              saveButton: t('saveButton'),
            }}
            onSubmit={handleSubmit(onSubmit)}
            onGenderChange={(v) => setValue('gender', v, { shouldDirty: true })}
            onShowFieldChange={(field, v) => setValue(field, v, { shouldDirty: true })}
            onPhoneChange={handlePhoneChange}
          />
        </div>
      </div>

      {cropTarget !== null && (
        <ImageCropperModal
          open
          imageSrc={cropSourceUrl}
          aspect={cropTarget === 'cover' ? 16 / 6 : 1}
          shape={cropTarget === 'avatar' ? 'round' : 'rect'}
          onCancel={closeCropper}
          onConfirm={handleCropConfirm}
        />
      )}

      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unsavedChangesTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('unsavedChangesDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keepEditing')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setLeaveConfirmOpen(false)
                await handleSave()
              }}
            >
              {t('saveAndLeave')}
            </AlertDialogAction>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setLeaveConfirmOpen(false)
                router.push('/profile')
              }}
            >
              {t('leaveWithoutSaving')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
