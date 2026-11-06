import type { MeetingSettings } from '@/lib/api/meeting-types'
import { ScreenShareError } from '@/lib/rtc/livekit-session'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { canShareScreen } from './permissions'
import type { JoinMedia, MeetingRoomDeps, RoomSession } from './room-session'

const store = () => useMeetingRoomStore.getState()

/**
 * Mic / camera / screen-share / device commands of one open room. Owns `media` — what a
 * (re)join publishes: the pre-join choice, then every in-room toggle / server mute.
 */
export class RoomMedia {
  media: JoinMedia = { mic: true, camera: true }

  constructor(
    private readonly deps: MeetingRoomDeps,
    private readonly getSession: () => RoomSession | null,
    private readonly getSettings: () => MeetingSettings,
  ) {}

  private async toggle(key: 'mic' | 'camera', apply: (s: RoomSession, on: boolean) => Promise<void>) {
    const session = this.getSession()
    if (!session || store().phase !== 'inRoom') return
    const next = !store()[key]
    useMeetingRoomStore.setState({ [key]: next })
    try {
      await apply(session, next)
      if (this.getSession() === session) this.media = { ...this.media, [key]: next }
    } catch {
      if (this.getSession() === session) useMeetingRoomStore.setState({ [key]: !next })
      this.deps.notify('error', { key: 'mediaFailed' })
    }
  }

  toggleMic(): Promise<void> {
    return this.toggle('mic', (s, on) => s.setMic(on))
  }

  toggleCamera(): Promise<void> {
    return this.toggle('camera', (s, on) => s.setCamera(on))
  }

  async toggleScreenShare(): Promise<void> {
    const session = this.getSession()
    if (!session || store().phase !== 'inRoom') return
    const next = !store().screen
    if (next && !canShareScreen(store().myRole, this.getSettings())) return
    useMeetingRoomStore.setState({ screen: next })
    try {
      await session.setScreenShare(next)
    } catch (err) {
      if (this.getSession() === session) useMeetingRoomStore.setState({ screen: !next })
      if (!(err instanceof ScreenShareError)) this.deps.notify('error', { key: 'shareFailed' })
    }
  }

  async switchDevice(kind: 'audioinput' | 'videoinput', deviceId: string): Promise<void> {
    this.media = { ...this.media, [kind === 'audioinput' ? 'audioDeviceId' : 'videoDeviceId']: deviceId }
    try {
      await this.getSession()?.switchDevice(kind, deviceId)
    } catch {
      this.deps.notify('error', { key: 'mediaFailed' })
    }
  }

  setPeerVideoEnabled(identity: string, enabled: boolean): void {
    this.getSession()?.setPeerVideoEnabled(identity, enabled)
  }
}
