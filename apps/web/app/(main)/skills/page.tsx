'use client'

import Link from 'next/link'
import { ArrowLeft, Plug, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCatalog, useSkills, useSkillToggle } from '@/lib/hooks/use-connectors'
import { SKILLS } from '@/lib/skills'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SkillToggle } from '@/components/integrations/SkillToggle'
import type { CatalogEntry } from '@/lib/api/connector-types'

export default function SkillsPage() {
  const t = useTranslations('skills')
  const { data: catalog = [], isLoading: loadingCatalog } = useCatalog()
  const { data: skillStates = [], isLoading: loadingSkills } = useSkills()
  const toggle = useSkillToggle()

  const catalogById = new Map<string, CatalogEntry>(
    catalog.map((c) => [c.id, c]),
  )
  const enabledById = new Map(skillStates.map((s) => [s.skillId, s.enabled]))
  const isLoading = loadingCatalog || loadingSkills

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 overflow-y-auto">
      <div className="border-b px-6 py-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label={t('back')}
        >
          <Link href="/settings">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="text-[#B47FFF] size-6" /> {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" asChild className="ml-auto">
          <Link href="/integrations">
            <Plug className="size-4 mr-1.5" /> {t('integrationsLink')}
          </Link>
        </Button>
      </div>

      <div className="p-6 pb-tabbar md:pb-6 max-w-4xl w-full mx-auto">
        <div className="mb-5">
          <div className="font-mono text-pon-pink text-xs tracking-[2px]">
            {t('sectionNum')}
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1">{t('heading')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[108px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {SKILLS.map((skill) => {
              const requiredConnectors = skill.requires
                .map((id) => catalogById.get(id))
                .filter((c): c is CatalogEntry => !!c)
              return (
                <SkillToggle
                  key={skill.id}
                  skill={skill}
                  enabled={enabledById.get(skill.id) ?? false}
                  pending={
                    toggle.isPending && toggle.variables?.skillId === skill.id
                  }
                  requiredConnectors={requiredConnectors}
                  onToggle={(skillId, enabled) =>
                    toggle.mutate({ skillId, enabled })
                  }
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
