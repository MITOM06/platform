'use client'

import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/auth.store'
import { authService } from '@/lib/api/auth'
import { absoluteMediaUrl } from '@/lib/media'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">{label}</span>
      <span className="text-sm text-foreground break-words">{value}</span>
    </div>
  )
}

export default function ProfilePage() {
  const t = useTranslations('profile')
  const locale = useLocale()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: authService.getMe,
    enabled: !!accessToken,
  })

  if (!user) return null

  const initials = user.displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const resolvedAvatar = absoluteMediaUrl(me?.avatarUrl ?? user.avatarUrl ?? '')
  const resolvedCover = absoluteMediaUrl(me?.coverPhoto ?? user.coverPhoto ?? '')

  const notSet = t('notSet')
  const formatDob = (iso?: string) => {
    if (!iso) return notSet
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return notSet
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(d)
  }
  const genderLabel = (g?: string) =>
    g === 'male'
      ? t('genderMale')
      : g === 'female'
        ? t('genderFemale')
        : g === 'other'
          ? t('genderOther')
          : notSet

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
        <span className="font-semibold text-base">{t('viewTitle')}</span>
      </header>

      <div className="flex-1 overflow-y-auto flex justify-center px-4 py-6 md:py-10">
        <div className="w-full max-w-md rounded-2xl border bg-card shadow-sm overflow-hidden self-start">
        {/* Cover Photo */}
        <div className="relative h-40 w-full overflow-hidden">
          {resolvedCover ? (
            <Image src={resolvedCover} alt="" fill unoptimized className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink" />
          )}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        <div className="relative px-6">
          {/* Avatar overlapping cover */}
          <div className="flex justify-center -mt-14">
            <Avatar className="size-28 ring-4 ring-background shadow-xl">
              {resolvedAvatar ? (
                <AvatarImage src={resolvedAvatar} alt={user.displayName} />
              ) : (
                <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-pon-cyan to-pon-pink text-white">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>
          </div>

          {/* Name + email */}
          <div className="text-center mt-4 mb-2">
            <h2 className="text-xl font-bold text-foreground">{user.displayName}</h2>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          </div>

          <Separator className="my-4" />

          {/* Read-only details */}
          <div className="divide-y divide-border">
            <InfoRow label={t('bioLabel')} value={me?.bio?.trim() || notSet} />
            <InfoRow label={t('dobLabel')} value={formatDob(me?.dateOfBirth)} />
            <InfoRow label={t('phoneLabel')} value={me?.phoneNumber?.trim() || notSet} />
            <InfoRow label={t('genderLabel')} value={genderLabel(me?.gender)} />
            <InfoRow label={t('emailLabel')} value={user.email} />
          </div>

          {/* Edit button at the bottom */}
          <div className="py-6">
            <Button className="w-full gap-2" onClick={() => router.push('/profile/edit')}>
              <Pencil className="size-4" />
              {t('editButton')}
            </Button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
