'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Loader2,
  Camera,
  User,
  Info,
  Calendar,
  Save,
  Pencil,
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/auth.store'
import { authService } from '@/lib/api/auth'
import { chatService } from '@/lib/api/chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

type FormValues = {
  displayName: string
  bio?: string
}

export default function ProfilePage() {
  const t = useTranslations('profile')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const schema = useMemo(
    () =>
      z.object({
        displayName: z.string().min(1, t('displayNameRequired')).max(50, t('displayNameTooLong')),
        bio: z.string().max(160, t('bioTooLong')).optional(),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user?.displayName ?? '',
      bio: '',
    },
  })

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview immediately
    const objectUrl = URL.createObjectURL(file)
    setAvatarPreview(objectUrl)

    setUploadingAvatar(true)
    try {
      const result = await chatService.uploadFile(file)
      await authService.updateProfile({ avatarUrl: result.url })

      if (user && accessToken) {
        setAuth(user, accessToken)
      }
      toast.success(t('avatarSuccess'))
    } catch {
      toast.error(t('avatarError'))
      setAvatarPreview(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    if (!user || !accessToken) return
    setSaving(true)
    try {
      const updated = await authService.updateProfile({
        displayName: values.displayName,
        ...(values.bio ? { bio: values.bio } : {}),
      })
      setAuth(
        { id: user.id, email: user.email, displayName: updated.displayName ?? values.displayName },
        accessToken,
      )
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
        <div className="relative h-40 w-full overflow-hidden">
          {/* Gradient cover */}
          <div className="absolute inset-0 bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink" />
          <div className="absolute inset-0 bg-black/20" />

          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 left-8 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute bottom-2 right-12 w-24 h-24 rounded-full bg-white/15 blur-xl" />
          </div>
        </div>

        {/* Avatar overlapping cover */}
        <div className="relative max-w-md mx-auto px-6">
          <div className="flex justify-center -mt-14">
            <div className="relative group">
              <Avatar className="size-28 ring-4 ring-background shadow-xl">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} alt={user.displayName} />
                ) : (
                  <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-pon-cyan to-pon-pink text-white">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>

              {/* Upload overlay */}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center cursor-pointer"
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? (
                    <Loader2 className="size-6 text-white animate-spin" />
                  ) : (
                    <Camera className="size-6 text-white" />
                  )}
                </div>
              </button>

              {/* Camera badge */}
              <div className="absolute -bottom-1 -right-1 size-8 rounded-full bg-primary flex items-center justify-center shadow-md border-2 border-background">
                <Camera className="size-3.5 text-white" />
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pb-10">
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

            {/* Date of birth (display only) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-4" />
                {t('birthdateLabel')}
              </Label>
              <Input
                value={t('birthdateNotSet')}
                disabled
                className="text-muted-foreground bg-muted/50"
              />
            </div>

            <Separator />

            {/* Save button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-pon-cyan via-pon-peach to-pon-pink hover:opacity-90 text-white font-semibold h-11 shadow-lg shadow-primary/20 transition-all"
              disabled={saving || !isDirty}
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
    </div>
  )
}
