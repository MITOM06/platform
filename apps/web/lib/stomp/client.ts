import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'

// Singleton STOMP client — one connection per session
let client: Client | null = null
let connectResolvers: Array<() => void> = []

export const stompService = {
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      client = new Client({
        brokerURL: process.env.NEXT_PUBLIC_WS_URL,
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 5000,
        onConnect: () => {
          resolve()
          connectResolvers.forEach((r) => r())
          connectResolvers = []
        },
        onStompError: (frame) => reject(new Error(frame.headers['message'])),
        onDisconnect: () => {
          client = null
        },
      })
      client.activate()
    })
  },

  disconnect(): void {
    client?.deactivate()
    client = null
    connectResolvers = []
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
    return client?.subscribe(destination, callback)
  },

  publish(destination: string, body: object): void {
    if (client?.connected) {
      client.publish({ destination, body: JSON.stringify(body) })
    }
  },

  isConnected(): boolean {
    return client?.connected ?? false
  },
}
