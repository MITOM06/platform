'use server'

import { cookies } from 'next/headers'
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config'

export async function setLocaleAction(locale: Locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return
  const cookieStore = await cookies()
  cookieStore.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    httpOnly: false, // client-readable so JS can show current locale
  })
}
