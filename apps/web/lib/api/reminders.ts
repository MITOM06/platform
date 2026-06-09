import { chatApi } from './axios'

export interface Reminder {
  id: string
  userId: string
  conversationId: string
  text: string
  remindAt: string
  done: boolean
  createdAt: string
}

export const reminderService = {
  getReminders: () =>
    chatApi.get<Reminder[]>('/api/reminders').then((r) => r.data),

  markDone: (id: string) =>
    chatApi.patch<Reminder>(`/api/reminders/${id}/done`).then((r) => r.data),

  deleteReminder: (id: string) => chatApi.delete(`/api/reminders/${id}`),
}
