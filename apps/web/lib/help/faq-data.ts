import { Rocket, MessageCircle, Bot, Users, Shield, type LucideIcon } from 'lucide-react'

/**
 * Static FAQ content model. Holds i18n KEYS only — never literal user-facing
 * text — so the rendered strings resolve against the active locale at runtime
 * via `useTranslations('help')`.
 */
export interface FaqItem {
  /** stable id used for the accordion value + React key, e.g. 'start.whatIsPon' */
  id: string
  /** i18n key for the question, relative to the `help` ns, e.g. 'q.start.whatIsPon' */
  questionKey: string
  /** i18n key for the answer, e.g. 'a.start.whatIsPon' */
  answerKey: string
}

export interface FaqCategory {
  /** 'start' | 'msg' | 'ai' | 'group' | 'account' */
  id: string
  /** i18n key for the category title, e.g. 'categories.gettingStarted' */
  titleKey: string
  icon: LucideIcon
  items: FaqItem[]
}

function item(catId: string, slug: string): FaqItem {
  return {
    id: `${catId}.${slug}`,
    questionKey: `q.${catId}.${slug}`,
    answerKey: `a.${catId}.${slug}`,
  }
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'start',
    titleKey: 'categories.gettingStarted',
    icon: Rocket,
    items: [
      item('start', 'whatIsPon'),
      item('start', 'createAccount'),
      item('start', 'addFriends'),
      item('start', 'startConversation'),
    ],
  },
  {
    id: 'msg',
    titleKey: 'categories.messaging',
    icon: MessageCircle,
    items: [
      item('msg', 'sendMessages'),
      item('msg', 'voiceMessages'),
      item('msg', 'filesImages'),
      item('msg', 'pinMessages'),
      item('msg', 'reactions'),
    ],
  },
  {
    id: 'ai',
    titleKey: 'categories.aiFeatures',
    icon: Bot,
    items: [
      item('ai', 'aiCapabilities'),
      item('ai', 'useAtAi'),
      item('ai', 'aiMemory'),
      item('ai', 'personalAssistant'),
    ],
  },
  {
    id: 'group',
    titleKey: 'categories.groups',
    icon: Users,
    items: [
      item('group', 'createGroup'),
      item('group', 'addMembers'),
      item('group', 'groupRoles'),
    ],
  },
  {
    id: 'account',
    titleKey: 'categories.accountSecurity',
    icon: Shield,
    items: [
      item('account', 'changeAvatar'),
      item('account', 'disappearingMessages'),
      item('account', 'blockUser'),
      item('account', 'deleteHistory'),
    ],
  },
]
