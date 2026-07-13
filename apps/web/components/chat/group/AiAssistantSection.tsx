'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bot, BrainCircuit, Sparkles, Plug, Coins, Lock } from 'lucide-react'
import {
  AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { useHasCapability } from '@/lib/hooks/use-capabilities'

const ROW_CLS = 'flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors'
const ROW_DISABLED_CLS = 'flex items-center gap-3 w-full text-left px-2 py-2.5 rounded-lg text-sm opacity-40 cursor-not-allowed select-none'

interface Props {
  conversationId: string
  /** Close the settings drawer before navigating away. */
  onClose: () => void
}

/**
 * AI-assistant-specific settings. Replaces the person-centric items (block,
 * profile, …) that don't apply to a bot. Each row deep-links into the surface
 * that actually governs the assistant's behaviour for this conversation.
 *
 * Persona / Memory / Skills configure the *shared* company assistant, so they
 * are gated to admins/owners (MANAGE_WORKSPACE). Integrations and Token Usage
 * are per-member (each user connects their own tools / sees their own usage),
 * so they stay open to everyone.
 */
export function AiAssistantSection({ conversationId, onClose }: Props) {
  const t = useTranslations('chat')
  const router = useRouter()
  const canManage = useHasCapability('MANAGE_WORKSPACE')

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

        {/* Persona — Admin/Owner only */}
        {canManage ? (
          <button
            onClick={() => go(`/ai-persona?conversationId=${conversationId}`)}
            className={ROW_CLS}
          >
            <Sparkles className="size-4 text-muted-foreground" />
            <span>{t('aiPersonality')}</span>
          </button>
        ) : (
          <div className={ROW_DISABLED_CLS} title={t('adminOwnerOnly')}>
            <Lock className="size-4 text-muted-foreground" />
            <span>{t('aiPersonality')}</span>
          </div>
        )}

        {/* AI Context — Admin/Owner only */}
        {canManage ? (
          <button onClick={() => go('/ai-context')} className={ROW_CLS}>
            <BrainCircuit className="size-4 text-muted-foreground" />
            <span>{t('aiContext')}</span>
          </button>
        ) : (
          <div className={ROW_DISABLED_CLS} title={t('adminOwnerOnly')}>
            <Lock className="size-4 text-muted-foreground" />
            <span>{t('aiContext')}</span>
          </div>
        )}

        {/* Skills — Admin/Owner only */}
        {canManage ? (
          <button onClick={() => go('/skills')} className={ROW_CLS}>
            <Sparkles className="size-4 text-muted-foreground" />
            <span>{t('aiSkills')}</span>
          </button>
        ) : (
          <div className={ROW_DISABLED_CLS} title={t('adminOwnerOnly')}>
            <Lock className="size-4 text-muted-foreground" />
            <span>{t('aiSkills')}</span>
          </div>
        )}

        {/* Connected Apps / Integrations — every member (personal tool connections) */}
        <button onClick={() => go('/integrations')} className={ROW_CLS}>
          <Plug className="size-4 text-muted-foreground" />
          <span>{t('aiConnectedApps')}</span>
        </button>

        {/* Token Usage — every member */}
        <button onClick={() => go('/token-usage')} className={ROW_CLS}>
          <Coins className="size-4 text-muted-foreground" />
          <span>{t('aiUsage')}</span>
        </button>

      </AccordionContent>
    </AccordionItem>
  )
}
