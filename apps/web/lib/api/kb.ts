import { chatApi } from './axios'

export interface KbDocument {
  documentId: string
  fileName: string
  mimeType: string
  status: 'pending' | 'processing' | 'done' | 'error'
  chunkCount: number
  uploadedAt?: string
}

export const kbService = {
  getDocuments: (conversationId: string) =>
    chatApi
      .get<KbDocument[]>('/api/kb/documents', { params: { conversationId } })
      .then((r) => r.data),

  uploadDocument: (data: {
    conversationId: string
    fileUrl: string
    fileName: string
    mimeType: string
  }) =>
    chatApi
      .post<KbDocument>('/api/kb/documents', data)
      .then((r) => r.data),

  deleteDocument: (documentId: string) =>
    chatApi.delete(`/api/kb/documents/${documentId}`),
}
