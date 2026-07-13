import { authApi } from './axios'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AiUserContext {
  userId: string
  jobTitle: string
  projects: string[]
  style: string
  preferences: string
  updatedBy: string
}

export interface AiContextEntry {
  _id: string
  scope: 'company' | 'department'
  scopeId: string | null
  label: string
  text: string
  requiredCapability: string | null
  createdBy: string
  updatedBy: string
  updatedAt?: string
}

export interface MyAiContext {
  context: AiUserContext
  identity: { role: string | null; departmentNames: string[] }
  entries: AiContextEntry[]
}

export type ContextTier = 'public' | 'internal' | 'confidential'

export function tierToCapability(tier: ContextTier): string | null {
  if (tier === 'internal') return 'VIEW_INTERNAL_CONTEXT'
  if (tier === 'confidential') return 'VIEW_CONFIDENTIAL_CONTEXT'
  return null
}

export function capabilityToTier(cap: string | null): ContextTier {
  if (cap === 'VIEW_CONFIDENTIAL_CONTEXT') return 'confidential'
  if (cap === 'VIEW_INTERNAL_CONTEXT') return 'internal'
  return 'public'
}

export interface UpsertEntryInput {
  scope: 'company' | 'department'
  scopeId?: string | null
  label: string
  text: string
  requiredCapability?: string | null
}

// ── Service (auth-service, port 3001, no global prefix) ─────────────────────────

export const aiContextService = {
  getMine: () => authApi.get<MyAiContext>('/ai-context/me').then((r) => r.data),

  updateMyStyle: (body: { style?: string; preferences?: string }) =>
    authApi.patch<AiUserContext>('/ai-context/me/style', body).then((r) => r.data),

  getUser: (userId: string) =>
    authApi.get<AiUserContext>(`/ai-context/users/${userId}`).then((r) => r.data),

  updateUserHard: (userId: string, body: { jobTitle?: string; projects?: string[] }) =>
    authApi.patch<AiUserContext>(`/ai-context/users/${userId}/hard`, body).then((r) => r.data),

  listEntries: (scope: 'company' | 'department', scopeId?: string) =>
    authApi
      .get<AiContextEntry[]>('/ai-context/entries', { params: { scope, scopeId } })
      .then((r) => r.data),

  createEntry: (dto: UpsertEntryInput) =>
    authApi.post<AiContextEntry>('/ai-context/entries', dto).then((r) => r.data),

  updateEntry: (id: string, dto: UpsertEntryInput) =>
    authApi.patch<AiContextEntry>(`/ai-context/entries/${id}`, dto).then((r) => r.data),

  deleteEntry: (id: string) => authApi.delete(`/ai-context/entries/${id}`).then(() => undefined),
}
