'use client'

import { useTranslations } from 'next-intl'

function PonMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="size-6 text-primary"
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 14.52 2.93 16.82 4.46 18.6L3 21L5.8 20.3C7.54 21.37 9.6 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18Z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  )
}

/** Looping 2-bubble "conversation" mockup — the animated centerpiece of the panel. */
function ConversationLoop({ otherLabel, otherMsg, ownMsg }: { otherLabel: string; otherMsg: string; ownMsg: string }) {
  return (
    <div className="pon-convo-loop relative w-full max-w-sm rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          AI
        </span>
        {otherLabel}
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="pon-convo-bubble-1 max-w-[85%] rounded-[14px] rounded-bl-[4px] border border-border bg-secondary px-3.5 py-2 text-sm text-foreground">
          {otherMsg}
        </div>
        <div className="pon-convo-typing flex w-fit items-center gap-1 rounded-full border border-border bg-secondary px-3 py-2">
          <span className="pon-typing-dot size-1.5 rounded-full bg-muted-foreground" />
          <span className="pon-typing-dot size-1.5 rounded-full bg-muted-foreground" />
          <span className="pon-typing-dot size-1.5 rounded-full bg-muted-foreground" />
        </div>
        <div className="pon-convo-bubble-2 ml-auto max-w-[85%] self-end rounded-[14px] rounded-br-[4px] bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground">
          {ownMsg}
        </div>
      </div>
    </div>
  )
}

export function AuthShowcasePanel() {
  const t = useTranslations('auth')
  // The panel deliberately commits to a single dark treatment regardless of the
  // viewer's theme. The `dark` class scopes the dark token set to this subtree,
  // so everything below stays token-driven — no hardcoded panel colours, no
  // gradient, no glassmorphism, no glow (UI-REDESIGN-DIRECTION.md §2).
  return (
    <div className="dark relative hidden overflow-hidden bg-background lg:flex lg:flex-col lg:justify-between lg:p-10">
      <div className="relative z-10 flex items-center gap-2">
        <PonMark />
        <span className="text-lg font-bold text-foreground">PON</span>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center py-12">
        <ConversationLoop
          otherLabel={t('showcase.convoChannel')}
          otherMsg={t('showcase.convoOtherMsg')}
          ownMsg={t('showcase.convoOwnMsg')}
        />
      </div>

      <div className="relative z-10 space-y-5">
        <h1 className="text-4xl font-black leading-tight text-foreground">
          {t('showcase.headline')}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">{t('showcase.subheadline')}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {(['selfHosted', 'governedAi', 'oneWorkspace'] as const).map((key) => (
            <span
              key={key}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
            >
              {t(`showcase.chip.${key}`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
