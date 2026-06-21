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
import Link from 'next/link'
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
        hideInfo: z.boolean(),
      }),
    [t],
  )

  const {
    register,
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
      hideInfo: false,
    },
  })

  const gender = watch('gender')
  const hideInfo = watch('hideInfo')

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
        hideInfo: me.hideInfo ?? false,
      })
    }
  }, [me, reset])

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

      if (avatarBlob) {
        const result = await chatService.uploadFile(avatarBlob, 'avatar.jpg')
        avatarUrl = result.url
      }
      if (coverBlob) {
        const result = await chatService.uploadFile(coverBlob, 'cover.jpg')
        coverPhoto = result.url
      }

      const updated = await authService.updateProfile({
        displayName: values.displayName,
        bio: values.bio ?? '',
        dateOfBirth: values.dateOfBirth || undefined,
        phoneNumber: values.phoneNumber || null,
        gender: values.gender || undefined,
        hideInfo: values.hideInfo,
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
        <Link
          href="/profile"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
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

        <div className="relative max-w-md mx-auto px-6">
          <Separator className="mb-6" />

          <ProfileForm
            register={register}
            errors={errors}
            gender={gender}
            hideInfo={hideInfo}
            email={user.email}
            saving={saving}
            canSave={isDirty || hasPendingImageEdits}
            texts={{
              displayNameLabel: t('displayNameLabel'),
              displayNamePlaceholder: t('displayNamePlaceholder'),
              bioLabel: t('bioLabel'),
              bioPlaceholder: t('bioPlaceholder'),
              dobLabel: t('dobLabel'),
              phoneLabel: t('phoneLabel'),
              phonePlaceholder: t('phonePlaceholder'),
              genderLabel: t('genderLabel'),
              genderPlaceholder: t('genderPlaceholder'),
              genderMale: t('genderMale'),
              genderFemale: t('genderFemale'),
              genderOther: t('genderOther'),
              hideInfoLabel: t('hideInfoLabel'),
              hideInfoHint: t('hideInfoHint'),
              emailLabel: t('emailLabel'),
              saveButton: t('saveButton'),
            }}
            onSubmit={handleSubmit(onSubmit)}
            onGenderChange={(v) => setValue('gender', v, { shouldDirty: true })}
            onHideInfoChange={(v) => setValue('hideInfo', v, { shouldDirty: true })}
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
    </div>
  )
}
