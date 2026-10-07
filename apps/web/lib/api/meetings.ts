import { chatApi } from './axios'
import type {
  LobbyEntry,
  Meeting,
  MeetingHand,
  MeetingInput,
  MeetingJoinResponse,
  MeetingListScope,
  MeetingMessagePage,
  MeetingNote,
  MeetingNoteInput,
  MeetingPage,
  NoteScope,
} from './meeting-types'

// chat-service meetings REST API (docs/api-spec.md § Meetings). Every path
// segment that comes from data goes through encodeURIComponent.
const enc = encodeURIComponent
const base = (id: string) => `/api/meetings/${enc(id)}`

export const meetingsApi = {
  /** Cursor = id of the last row of the previous page; absent ⇒ first page. */
  list: (scope: MeetingListScope, cursor?: string, size = 20): Promise<MeetingPage> =>
    chatApi
      .get<MeetingPage>('/api/meetings', { params: { scope, cursor, size } })
      .then((r) => r.data),

  get: (id: string): Promise<Meeting> => chatApi.get<Meeting>(base(id)).then((r) => r.data),

  byCode: (code: string): Promise<Meeting> =>
    chatApi.get<Meeting>(`/api/meetings/by-code/${enc(code)}`).then((r) => r.data),

  /** Empty body = instant meeting. */
  create: (input: MeetingInput = {}): Promise<Meeting> =>
    chatApi.post<Meeting>('/api/meetings', input).then((r) => r.data),

  update: (id: string, input: MeetingInput): Promise<Meeting> =>
    chatApi.patch<Meeting>(base(id), input).then((r) => r.data),

  cancel: (id: string): Promise<void> => chatApi.delete(base(id)).then(() => undefined),

  join: (id: string): Promise<MeetingJoinResponse> =>
    chatApi.post<MeetingJoinResponse>(`${base(id)}/join`).then((r) => r.data),

  /** Host/co-host: who is waiting right now (resync after a missed `meet.lobby`). */
  lobby: (id: string): Promise<LobbyEntry[]> =>
    chatApi
      .get<{ entries?: LobbyEntry[] }>(`${base(id)}/lobby`)
      .then((r) => (Array.isArray(r.data?.entries) ? r.data.entries : [])),

  leaveLobby: (id: string): Promise<void> =>
    chatApi.delete(`${base(id)}/lobby`).then(() => undefined),

  admit: (id: string, userId: string): Promise<void> =>
    chatApi.post(`${base(id)}/lobby/${enc(userId)}/admit`).then(() => undefined),

  deny: (id: string, userId: string): Promise<void> =>
    chatApi.post(`${base(id)}/lobby/${enc(userId)}/deny`).then(() => undefined),

  end: (id: string): Promise<void> => chatApi.post(`${base(id)}/end`).then(() => undefined),

  /** Newest first; `before` = id of the oldest line already loaded. */
  messages: (id: string, before?: string, size = 50): Promise<MeetingMessagePage> =>
    chatApi
      .get<MeetingMessagePage>(`${base(id)}/messages`, { params: { before, size } })
      .then((r) => r.data),

  getNote: (id: string, scope: NoteScope): Promise<MeetingNote> =>
    chatApi.get<MeetingNote>(`${base(id)}/notes/${scope}`).then((r) => r.data),

  putNote: (id: string, scope: NoteScope, input: MeetingNoteInput): Promise<MeetingNote> =>
    chatApi.put<MeetingNote>(`${base(id)}/notes/${scope}`, input).then((r) => r.data),

  hands: (id: string): Promise<MeetingHand[]> =>
    chatApi
      .get<{ hands?: MeetingHand[] }>(`${base(id)}/hands`)
      .then((r) => (Array.isArray(r.data?.hands) ? r.data.hands : [])),
}
