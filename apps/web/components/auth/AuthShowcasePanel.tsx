'use client'

import { useTranslations } from 'next-intl'

function PonMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-6">
      <defs>
        <linearGradient id="ponMarkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6AC9FF" />
          <stop offset="50%" stopColor="#FBB68B" />
          <stop offset="100%" stopColor="#FF85B3" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 14.52 2.93 16.82 4.46 18.6L3 21L5.8 20.3C7.54 21.37 9.6 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18Z"
        fill="url(#ponMarkGradient)"
      />
      <circle cx="12" cy="12" r="3" fill="url(#ponMarkGradient)" />
    </svg>
  )
}

/** Looping 2-bubble "conversation" mockup — the animated centerpiece of the panel. */
function ConversationLoop({ otherLabel, otherMsg, ownMsg }: { otherLabel: string; otherMsg: string; ownMsg: string }) {
  return (
    <div className="pon-convo-loop relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-2xl">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium text-white/60">
        <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-pon-cyan to-pon-pink text-[10px] font-bold text-black">
          AI
        </span>
        {otherLabel}
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="pon-convo-bubble-1 max-w-[85%] rounded-2xl rounded-bl-sm bg-white/90 px-3.5 py-2 text-sm text-black/80">
          {otherMsg}
        </div>
        <div className="pon-convo-typing flex w-fit items-center gap-1 rounded-full bg-white/10 px-3 py-2">
          <span className="pon-typing-dot size-1.5 rounded-full bg-white/60" />
          <span className="pon-typing-dot size-1.5 rounded-full bg-white/60" />
          <span className="pon-typing-dot size-1.5 rounded-full bg-white/60" />
        </div>
        <div className="pon-convo-bubble-2 ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink px-3.5 py-2 text-sm font-medium text-black self-end">
          {ownMsg}
        </div>
      </div>
    </div>
  )
}

export function AuthShowcasePanel() {
  const t = useTranslations('auth')
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#181030] via-[#2a1350] to-[#120a24] lg:flex lg:flex-col lg:justify-between lg:p-10">
      {/* Ambient glow, same PON gradient family as the rest of the app */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(106,201,255,0.25), transparent 70%)' }} />
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 size-[28rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(255,133,179,0.2), transparent 70%)' }} />

      <div className="relative z-10 flex items-center gap-2">
        <PonMark />
        <span className="text-lg font-bold text-white">PON</span>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center py-12">
        <ConversationLoop
          otherLabel={t('showcase.convoChannel')}
          otherMsg={t('showcase.convoOtherMsg')}
          ownMsg={t('showcase.convoOwnMsg')}
        />
      </div>

      <div className="relative z-10 space-y-5">
        <h1 className="text-4xl font-black leading-tight text-white">
          {t('showcase.headline')}
        </h1>
        <p className="max-w-md text-sm text-white/60">{t('showcase.subheadline')}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {(['selfHosted', 'governedAi', 'oneWorkspace'] as const).map((key) => (
            <span
              key={key}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70"
            >
              {t(`showcase.chip.${key}`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
