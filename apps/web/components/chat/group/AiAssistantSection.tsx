'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bot, BrainCircuit, Sparkles, Plug, Coins } from 'lucide-react'
import {
  AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'

const ROW_CLS = 'flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors'

interface Props {
  conversationId: string
  /** Close the settings drawer before navigating away. */
  onClose: () => void
}

/**
 * AI-assistant-specific settings. Replaces the person-centric items (block,
 * profile, …) that don't apply to a bot. Each row deep-links into the surface
 * that actually governs the assistant's behaviour for this conversation.
 */
export function AiAssistantSection({ conversationId, onClose }: Props) {
  const t = useTranslations('chat')
  const router = useRouter()

  const go = (href: string) => {
    onClose()
    router.push(href)
  }

  return (
    <AccordionItem value="ai" className="border-none">
      <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
        <span className="font-semibold text-sm flex items-center gap-2">
          <Bot className="size-4" /> {t('aiAssistant')}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-1 space-y-1">
        <button
          onClick={() => go(`/ai-persona?conversationId=${conversationId}`)}
          className={ROW_CLS}
        >
          <Sparkles className="size-4 text-muted-foreground" />
          <span>{t('aiPersonality')}</span>
        </button>
        <button onClick={() => go('/ai-memory')} className={ROW_CLS}>
          <BrainCircuit className="size-4 text-muted-foreground" />
          <span>{t('aiMemory')}</span>
        </button>
        <button onClick={() => go('/skills')} className={ROW_CLS}>
          <Sparkles className="size-4 text-muted-foreground" />
          <span>{t('aiSkills')}</span>
        </button>
        <button onClick={() => go('/integrations')} className={ROW_CLS}>
          <Plug className="size-4 text-muted-foreground" />
          <span>{t('aiConnectedApps')}</span>
        </button>
        <button onClick={() => go('/token-usage')} className={ROW_CLS}>
          <Coins className="size-4 text-muted-foreground" />
          <span>{t('aiUsage')}</span>
        </button>
      </AccordionContent>
    </AccordionItem>
  )
}
