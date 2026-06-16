'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Palette, SmilePlus, PenLine, Image as ImageIcon2 } from 'lucide-react'
import {
  AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const QUICK_REACTION_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '😍', '👏', '💯', '😎',
]

const ROW_CLS = 'flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors'

interface Props {
  isDirect: boolean
  isGroup: boolean
  otherUserId?: string | null
  currentUserId: string
  saving: boolean
  quickReaction: string
  initialOtherNickname: string
  initialSelfNickname: string
  onOpenWallpaper: () => void
  onPickQuickReaction: (emoji: string) => void
  onSaveNickname: (targetId: string, value: string) => void
  onOpenGroupInfo?: () => void
  onCloseDrawer: () => void
}

export function CustomizeChatSection({
  isDirect,
  isGroup,
  otherUserId,
  currentUserId,
  saving,
  quickReaction,
  initialOtherNickname,
  initialSelfNickname,
  onOpenWallpaper,
  onPickQuickReaction,
  onSaveNickname,
  onOpenGroupInfo,
  onCloseDrawer,
}: Props) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const [nicknameOtherValue, setNicknameOtherValue] = useState(initialOtherNickname)
  const [nicknameSelfValue, setNicknameSelfValue] = useState(initialSelfNickname)

  return (
    <AccordionItem value="customize" className="border-none">
      <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
        <span className="font-semibold text-sm">{t('customizeChatCategory')}</span>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-1 space-y-1">
        <button onClick={onOpenWallpaper} className={ROW_CLS}>
          <Palette className="size-4 text-muted-foreground" />
          <span>{t('wallpaper')}</span>
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button className={ROW_CLS}>
              <SmilePlus className="size-4 text-muted-foreground" />
              <span className="flex-1">{t('quickReaction')}</span>
              <span className="text-lg leading-none">{quickReaction}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end" side="top">
            <p className="text-xs text-muted-foreground px-1 pb-2">{t('quickReactionPickTitle')}</p>
            <div className="grid grid-cols-6 gap-1">
              {QUICK_REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onPickQuickReaction(emoji)}
                  className={`p-1.5 rounded-lg text-lg flex items-center justify-center transition-colors hover:bg-muted ${
                    quickReaction === emoji ? 'bg-pon-cyan/15 ring-1 ring-pon-cyan' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {isDirect && otherUserId && (
          <div className="px-2 py-2 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <PenLine className="size-4 text-muted-foreground" />
              <span>{t('nicknames')}</span>
            </div>
            <NicknameRow
              label={t('nicknameOther')}
              placeholder={t('nicknamePlaceholder')}
              saveLabel={tCommon('save')}
              value={nicknameOtherValue}
              onChange={setNicknameOtherValue}
              onSave={() => onSaveNickname(otherUserId, nicknameOtherValue)}
              saving={saving}
            />
            <NicknameRow
              label={t('nicknameYou')}
              placeholder={t('nicknamePlaceholder')}
              saveLabel={tCommon('save')}
              value={nicknameSelfValue}
              onChange={setNicknameSelfValue}
              onSave={() => onSaveNickname(currentUserId, nicknameSelfValue)}
              saving={saving}
            />
          </div>
        )}

        {isGroup && onOpenGroupInfo && (
          <>
            <button onClick={() => { onOpenGroupInfo(); onCloseDrawer() }} className={ROW_CLS}>
              <PenLine className="size-4 text-muted-foreground" />
              <span>{t('renameGroup')}</span>
            </button>
            <button onClick={() => { onOpenGroupInfo(); onCloseDrawer() }} className={ROW_CLS}>
              <ImageIcon2 className="size-4 text-muted-foreground" />
              <span>{t('changeAvatar')}</span>
            </button>
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

function NicknameRow({
  label, placeholder, saveLabel, value, onChange, onSave, saving,
}: {
  label: string
  placeholder: string
  saveLabel: string
  value: string
  onChange: (v: string) => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={40}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
