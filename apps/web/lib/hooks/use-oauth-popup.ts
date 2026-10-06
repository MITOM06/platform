'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useProviderNameSources } from '@/lib/hooks/use-connectors'
import { providerDisplayName } from '@/lib/ai/connector-names'
import {
  oauthCallbackErrorKey,
  parseOAuthReturn,
  type OAuthReturn,
} from '@/lib/integrations/connector-errors'

const POPUP_FEATURES = 'width=520,height=720,menubar=no,toolbar=no'

/**
 * Shared OAuth connect-popup flow used by both the static catalog and the
 * dynamic directory. Opens the provider authorize URL in a popup and polls until
 * the backend redirects it back to our origin with `?connected=<slug>` or
 * `?error=<CODE>&provider=<slug>` (or the user closes it), then reports the
 * outcome. Falls back to a same-tab redirect when the popup is blocked (the
 * integrations page then reads the same query). Tracks which entry id is
 * mid-connect for button spinners.
 */
export function useOAuthPopup(onDone: (result: OAuthReturn | null) => void) {
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current)
    },
    [],
  )

  const open = useCallback(
    (authorizeUrl: string, id: string) => {
      setConnectingId(id)
      const popup = window.open(authorizeUrl, 'pon-oauth', POPUP_FEATURES)
      if (!popup) {
        // Popup blocked — fall back to same-tab redirect.
        window.location.href = authorizeUrl
        return
      }
      if (pollRef.current) clearInterval(pollRef.current)
      const finish = (result: OAuthReturn | null) => {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        setConnectingId(null)
        onDone(result)
      }
      pollRef.current = setInterval(() => {
        try {
          if (popup.closed) {
            finish(null)
            return
          }
          const result = parseOAuthReturn(popup.location.search)
          if (result) {
            popup.close()
            finish(result)
          }
        } catch {
          // Cross-origin while on the provider's domain — ignore until redirect.
        }
      }, 600)
    },
    [onDone],
  )

  const reset = useCallback(() => setConnectingId(null), [])

  return { connectingId, open, reset }
}

/**
 * Toast for an OAuth outcome: "Connected Gmail" or the localized reason it failed
 * (every callback code of HANDOFF §5.4). The provider is shown by its connector
 * name, never the slug; an unknown one gets a generic label.
 */
export function useOAuthReturnNotice() {
  const t = useTranslations('integrations')
  const sources = useProviderNameSources()
  return useCallback(
    (result: OAuthReturn) => {
      if (result.connected) {
        const name = providerDisplayName(result.connected, sources)
        toast.success(name ? t('connectSuccess', { provider: name }) : t('connectSuccessGeneric'))
        return
      }
      if (result.error) {
        const name = providerDisplayName(result.provider, sources)
        const reason = t(oauthCallbackErrorKey(result.error))
        toast.error(name ? t('connectFailedNamed', { provider: name, reason }) : reason)
      }
    },
    [sources, t],
  )
}
