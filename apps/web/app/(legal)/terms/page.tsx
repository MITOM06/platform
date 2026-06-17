import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function TermsOfServicePage() {
  const t = await getTranslations('legal')
  const tc = await getTranslations('common')

  return (
    <div className="container max-w-4xl py-10 px-4 md:px-8 mx-auto">
      <div className="mb-6">
        <Button variant="ghost" asChild className="pl-0 hover:bg-transparent">
          <Link href="/login" className="flex items-center text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tc('back')}
          </Link>
        </Button>
      </div>

      <Card className="border-border shadow-md">
        <CardHeader className="pb-6">
          <CardTitle className="text-3xl font-bold tracking-tight">{t('termsTitle')}</CardTitle>
          <CardDescription className="text-sm mt-2">{t('lastUpdated')}</CardDescription>
        </CardHeader>

        <Separator className="mb-6" />

        <CardContent className="space-y-8 pb-10">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {t('sections.terms.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('sections.terms.content')}
            </p>
          </div>

          <Separator />

          <p className="text-sm text-muted-foreground">
            <Link href="/privacy" className="text-primary hover:underline">
              {t('viewPrivacy')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
