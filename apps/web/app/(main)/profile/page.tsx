'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Loader2,
  Camera,
  ImagePlus,
  User,
  Info,
  Save,
  Pencil,
  Cake,
  Phone,
  Users,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/store/auth.store'
import { authService } from '@/lib/api/auth'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl } from '@/lib/media'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ImageCropperModal } from '@/components/profile/ImageCropperModal'

type FormValues = {
  displayName: string
  bio?: string
  dateOfBirth?: string
  phoneNumber?: string
  gender?: string
  hideInfo: boolean
}

type CropTarget = 'avatar' | 'cover' | null

export default function ProfilePage() {
  const t = useTranslations('profile')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)
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
  } = useForm<FormValues>({
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

  const onSubmit = async (values: FormValues) => {
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
        phoneNumber: values.phoneNumber ?? '',
        gender: values.gender ?? '',
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
      setAvatarBlob(null)
      setCoverBlob(null)
      toast.success(t('saveSuccess'))
      router.push('/conversations')
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
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Cover Photo Section */}
        <div className="relative h-40 w-full overflow-hidden group">
          {resolvedCover ? (
            <Image src={resolvedCover} alt="" fill unoptimized className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink" />
          )}
          <div className="absolute inset-0 bg-black/20" />

          <button
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors text-white text-xs font-medium px-3 py-1.5 backdrop-blur-sm"
          >
            <ImagePlus className="size-3.5" />
            {t('changeCover')}
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverPick}
          />
        </div>

        {/* Avatar overlapping cover */}
        <div className="relative max-w-md mx-auto px-6">
          <div className="flex justify-center -mt-14">
            <div className="relative group">
              <Avatar className="size-28 ring-4 ring-background shadow-xl">
                {resolvedAvatar ? (
                  <AvatarImage src={resolvedAvatar} alt={user.displayName} />
                ) : (
                  <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-pon-cyan to-pon-pink text-white">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>

              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center cursor-pointer"
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="size-6 text-white" />
                </div>
              </button>

              <div className="absolute -bottom-1 -right-1 size-8 rounded-full bg-primary flex items-center justify-center shadow-md border-2 border-background">
                <Camera className="size-3.5 text-white" />
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarPick}
              />
            </div>
          </div>

          {/* User info */}
          <div className="text-center mt-4 mb-8">
            <h2 className="text-xl font-bold text-foreground">{user.displayName}</h2>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          </div>

          <Separator className="mb-6" />

          {/* Edit form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pb-24 md:pb-10">
            {/* Display name */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm font-medium flex items-center gap-2">
                <User className="size-4 text-primary" />
                {t('displayNameLabel')}
              </Label>
              <div className="relative">
                <Input
                  id="displayName"
                  {...register('displayName')}
                  placeholder={t('displayNamePlaceholder')}
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
                {t('bioLabel')}
              </Label>
              <div className="relative">
                <Input
                  id="bio"
                  {...register('bio')}
                  placeholder={t('bioPlaceholder')}
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
                {t('dobLabel')}
              </Label>
              <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
            </div>

            {/* Phone number */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-sm font-medium flex items-center gap-2">
                <Phone className="size-4 text-primary" />
                {t('phoneLabel')}
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                {...register('phoneNumber')}
                placeholder={t('phonePlaceholder')}
              />
              {errors.phoneNumber && (
                <p className="text-xs text-destructive">{errors.phoneNumber.message}</p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Users className="size-4 text-primary" />
                {t('genderLabel')}
              </Label>
              <Select value={gender || ''} onValueChange={(v) => setValue('gender', v, { shouldDirty: true })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('genderPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t('genderMale')}</SelectItem>
                  <SelectItem value="female">{t('genderFemale')}</SelectItem>
                  <SelectItem value="other">{t('genderOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Privacy toggle — hide sensitive info from other users */}
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Lock className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('hideInfoLabel')}</p>
                  <p className="text-xs text-muted-foreground">{t('hideInfoHint')}</p>
                </div>
              </div>
              <Switch
                checked={hideInfo}
                onCheckedChange={(v) => setValue('hideInfo', v, { shouldDirty: true })}
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <span className="text-base">@</span>
                {t('emailLabel')}
              </Label>
              <Input
                value={user.email}
                disabled
                className="text-muted-foreground bg-muted/50"
              />
            </div>

            <Separator />

            {/* Save button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-pon-cyan via-pon-peach to-pon-pink hover:opacity-90 text-white font-semibold h-11 shadow-lg shadow-primary/20 transition-all"
              disabled={saving || (!isDirty && !hasPendingImageEdits)}
            >
              {saving ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              {t('saveButton')}
            </Button>
          </form>
        </div>
      </div>

      <ImageCropperModal
        open={cropTarget !== null}
        imageSrc={cropSourceUrl}
        aspect={cropTarget === 'cover' ? 16 / 6 : 1}
        shape={cropTarget === 'avatar' ? 'round' : 'rect'}
        onCancel={closeCropper}
        onConfirm={handleCropConfirm}
      />
    </div>
  )
}
