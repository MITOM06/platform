import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { BackButton } from '../back-button'

// Ordered list of privacy sections — keys must exist under `legal.privacy.sections`
// in every messages/*.json locale file.
const SECTIONS = [
  'scope',
  'dataWeCollect',
  'howWeUse',
  'aiProcessing',
  'connectors',
  'subprocessors',
  'retention',
  'security',
  'yourRights',
  'changes',
] as const

export default async function PrivacyPolicyPage() {
  const t = await getTranslations('legal')
  const tc = await getTranslations('common')

  return (
    <div className="container max-w-4xl py-10 px-4 md:px-8 mx-auto">
      <div className="mb-6">
        <BackButton label={tc('back')} />
      </div>

      <Card className="border-border shadow-md">
        <CardHeader className="pb-6">
          <CardTitle className="text-3xl font-bold tracking-tight">{t('privacyTitle')}</CardTitle>
          <CardDescription className="text-sm mt-2">{t('lastUpdated')}</CardDescription>
        </CardHeader>

        <Separator className="mb-6" />

        <CardContent className="space-y-8 pb-10">
          <p className="text-muted-foreground leading-relaxed">{t('privacy.intro')}</p>

          {SECTIONS.map((section) => (
            <div key={section} className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {t(`privacy.sections.${section}.title`)}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t(`privacy.sections.${section}.content`)}
              </p>
            </div>
          ))}

          <div className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {t('privacy.contactTitle')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacy.contactBody')}</p>
          </div>

          <Separator />

          <p className="text-sm text-muted-foreground">
            <Link href="/terms" className="text-primary hover:underline">
              {t('viewTerms')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
