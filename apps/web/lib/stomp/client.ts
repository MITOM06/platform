import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import axios from 'axios'
import { useAuthStore } from '@/lib/store/auth.store'
import { isAuthFailure, refreshAccessToken as postRefresh } from '@/lib/api/axios'

// Single-origin self-host has no NEXT_PUBLIC_WS_URL — derive wss://<host>/ws
// from the page origin at runtime. Cloud Run / local dev set the env explicitly.
export function resolveBrokerURL(): string | undefined {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL
  if (typeof window === 'undefined') return undefined
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}

// Singleton STOMP client — one connection per session
let client: Client | null = null
let connectResolvers: Array<() => void> = []
const stateChangeListeners: Array<(connected: boolean) => void> = []

function notifyStateChange(connected: boolean) {
  stateChangeListeners.forEach((l) => l(connected))
}

function isTokenExpiredOrExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now() + 60_000
  } catch {
    return true
  }
}

type RefreshOutcome =
  | { token: string }
  // authFailed=true → refresh token genuinely rejected (logout). false →
  // transient network error; keep the session and let STOMP retry reconnecting.
  | { token: null; authFailed: boolean }

async function refreshAccessToken(): Promise<RefreshOutcome> {
  try {
    // Shared helper: cross-tab lock + one retry on the benign
    // REFRESH_TOKEN_ROTATED race, so a STOMP reconnect never logs the user out
    // because a sibling tab refreshed a moment earlier.
    const token = await postRefresh()
    const { user } = useAuthStore.getState()
    if (user) useAuthStore.getState().setAuth(user, token)
    return { token }
  } catch (err) {
    return { token: null, authFailed: isAuthFailure(err) }
  }
}

export const stompService = {
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Disconnect any existing client before creating a new one to prevent leaks/loops
      if (client) {
        client.deactivate()
        client = null
      }

      // Capture instance locally — beforeConnect must reference this stable variable,
      // never the module-level `client`, which can be nulled by disconnect().
      const instance = new Client({
        brokerURL: resolveBrokerURL(),
        // Fast reconnect so realtime recovers quickly after Cloud Run severs
        // the socket on its request-timeout. Heartbeats (10s/10s, negotiated
        // with the server) keep the connection alive and detect dead sockets.
        reconnectDelay: 2000,
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,
        beforeConnect: async () => {
          let currentToken = useAuthStore.getState().accessToken ?? token

          // Proactively refresh if token is expired or expiring within 60s so
          // STOMP reconnects succeed even after long idle periods.
          if (isTokenExpiredOrExpiringSoon(currentToken)) {
            const result = await refreshAccessToken()
            if (result.token === null) {
              if (result.authFailed) {
                // Refresh token genuinely rejected — stop reconnect loop and
                // send user to login.
                instance.deactivate()
                client = null
                useAuthStore.getState().clearAuth()
                if (typeof window !== 'undefined') {
                  await axios.post('/api/auth/clear-cookie').catch(() => {})
                  window.location.href = '/login'
                }
                return
              }
              // Transient network error (wifi sleep / ERR_NETWORK_CHANGED).
              // Don't log out — let this connect attempt proceed/fail so STOMP
              // keeps retrying with reconnectDelay until the network recovers.
              return
            }
            currentToken = result.token
          }

          instance.connectHeaders = { Authorization: `Bearer ${currentToken}` }
        },
        onConnect: () => {
          resolve()
          connectResolvers.forEach((r) => r())
          connectResolvers = []
          notifyStateChange(true)
        },
        onStompError: (frame) => reject(new Error(frame.headers['message'])),
        onDisconnect: () => {
          // Do NOT null client here — STOMP manages reconnection internally.
          // Nulling here causes beforeConnect to crash on the next reconnect attempt.
          notifyStateChange(false)
        },
        onWebSocketClose: () => {
          notifyStateChange(false)
        },
      })
      client = instance
      instance.activate()
    })
  },

  disconnect(): void {
    client?.deactivate()
    client = null
    connectResolvers = []
    notifyStateChange(false)
  },

  waitForConnect(): Promise<void> {
    if (client?.connected) return Promise.resolve()
    return new Promise((resolve) => {
      connectResolvers.push(resolve)
    })
  },

  subscribe(
    destination: string,
    callback: (message: IMessage) => void,
  ): StompSubscription | undefined {
    // Only subscribe when the socket is actually connected — subscribing on a
    // CONNECTING/CLOSED client transmits a SUBSCRIBE frame on a dead socket
    // ("WebSocket is already in CLOSING or CLOSED state"). The reconnect path
    // (onConnect) lets callers re-run their subscribe effect, so a skipped
    // subscribe here is re-established on the next successful connect.
    if (!client?.connected) return undefined
    const sub = client.subscribe(destination, callback)
    // Wrap unsubscribe so cleanup after the socket has closed is a no-op
    // instead of throwing while transmitting an UNSUBSCRIBE frame.
    return {
      ...sub,
      unsubscribe: (headers?: Record<string, string>) => {
        if (!client?.connected) return
        try {
          sub.unsubscribe(headers)
        } catch {
          /* socket already closed — nothing to clean up */
        }
      },
    }
  },

  publish(destination: string, body: object): void {
    // Guard every transmit: writing to a CLOSING/CLOSED socket throws
    // "WebSocket is already in CLOSING or CLOSED state". When disconnected this
    // is a no-op; STOMP reconnects and callers re-issue on the next action.
    if (!client?.connected) return
    try {
      client.publish({ destination, body: JSON.stringify(body) })
    } catch {
      /* socket transitioned to closing mid-publish — drop the frame */
    }
  },

  isConnected(): boolean {
    return client?.connected ?? false
  },

  onStateChange(listener: (connected: boolean) => void): () => void {
    stateChangeListeners.push(listener)
    // Initial state
    listener(this.isConnected())
    return () => {
      const index = stateChangeListeners.indexOf(listener)
      if (index > -1) stateChangeListeners.splice(index, 1)
    }
  },
}
