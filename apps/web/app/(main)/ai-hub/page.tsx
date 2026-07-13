'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Bot,
  Loader2,
  BrainCircuit,
  Plug,
  Sparkles,
  Coins,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AiHubCard } from '@/components/ai/AiHubCard'
import { useOpenAiChat } from '@/lib/hooks/use-open-ai-chat'

export default function AiHubPage() {
  const t = useTranslations('aiHub')
  const router = useRouter()
  const { openAiChat, loading } = useOpenAiChat()

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-pon-cyan/5 blur-3xl pointer-events-none dark:bg-pon-cyan/8" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-pon-pink/5 blur-3xl pointer-events-none dark:bg-pon-pink/8" />

          <div className="relative max-w-5xl mx-auto px-6 md:px-10 py-8 pb-tabbar md:pb-12">
            {/* Hero — Start chat with PON AI */}
            <div className="mb-8 rounded-2xl border bg-card overflow-hidden relative">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 20% 30%, rgba(106,201,255,0.12), transparent 60%), radial-gradient(circle at 80% 70%, rgba(255,133,179,0.10), transparent 60%)',
                }}
              />
              <div className="relative flex flex-col items-center text-center px-6 py-10">
                <div className="size-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink shadow-lg">
                  <Bot className="size-8 text-white" />
                </div>
                <h2 className="mt-5 text-xl font-bold text-foreground">{t('subtitle')}</h2>
                <Button
                  onClick={openAiChat}
                  disabled={loading}
                  size="lg"
                  className="mt-5 gap-2"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Bot className="size-4" />
                  )}
                  {t('startChat')}
                </Button>
              </div>
            </div>

            {/* Destination cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AiHubCard
                icon={<BrainCircuit className="size-5 text-[#B47FFF]" />}
                iconBg="rgba(180,127,255,0.12)"
                title={t('memory')}
                onClick={() => router.push('/ai-context')}
              />
              <AiHubCard
                icon={<Plug className="size-5 text-pon-cyan" />}
                iconBg="rgba(106,201,255,0.12)"
                title={t('integrations')}
                onClick={() => router.push('/integrations')}
              />
              <AiHubCard
                icon={<Sparkles className="size-5 text-[#B47FFF]" />}
                iconBg="rgba(180,127,255,0.12)"
                title={t('skills')}
                onClick={() => router.push('/skills')}
              />
              <AiHubCard
                icon={<Coins className="size-5 text-pon-peach" />}
                iconBg="rgba(251,182,139,0.12)"
                title={t('tokenUsage')}
                onClick={() => router.push('/token-usage')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
