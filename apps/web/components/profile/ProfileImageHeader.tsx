'use client'

import { RefObject } from 'react'
import Image from 'next/image'
import { Camera, ImagePlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type ProfileImageHeaderProps = {
  resolvedCover: string
  resolvedAvatar: string
  initials: string
  displayName: string
  email: string
  changeCoverLabel: string
  coverInputRef: RefObject<HTMLInputElement | null>
  avatarInputRef: RefObject<HTMLInputElement | null>
  onCoverPick: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAvatarPick: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function ProfileImageHeader({
  resolvedCover,
  resolvedAvatar,
  initials,
  displayName,
  email,
  changeCoverLabel,
  coverInputRef,
  avatarInputRef,
  onCoverPick,
  onAvatarPick,
}: ProfileImageHeaderProps) {
  return (
    <div className="max-w-2xl mx-auto px-6 pt-6">
      {/* Cover Photo Section */}
      <div className="relative h-32 rounded-xl overflow-hidden group">
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
          {changeCoverLabel}
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onCoverPick}
        />
      </div>

      {/* Avatar overlapping cover */}
      <div className="flex justify-center -mt-14">
        <div className="relative group">
          <Avatar className="size-28 ring-4 ring-background shadow-xl">
            {resolvedAvatar ? (
              <AvatarImage src={resolvedAvatar} alt={displayName} />
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
            onChange={onAvatarPick}
          />
        </div>
      </div>

        {/* User info */}
      <div className="text-center mt-4 mb-8">
        <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
        <p className="text-sm text-muted-foreground mt-1">{email}</p>
      </div>
    </div>
  )
}
