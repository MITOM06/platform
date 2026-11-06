import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const h = vi.hoisted(() => ({
  upload: vi.fn(),
  toastError: vi.fn(),
  sendChat: vi.fn(() => 'c-1'),
}))
vi.mock('sonner', () => ({ toast: { error: h.toastError } }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/lib/api/chat', () => ({
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  chatService: { uploadFile: h.upload },
}))
vi.mock('@/components/meeting/room/room-context', () => ({
  useRoom: () => ({ controller: { sendChat: h.sendChat }, realtimeConnected: true }),
}))

import { MeetingChatComposer } from '@/components/meeting/room/MeetingChatComposer'

const file = new File(['x'], 'plan.pdf', { type: 'application/pdf' })
const pick = (f: File = file) => userEvent.upload(screen.getByTestId('chat-file-input'), f)

beforeEach(() => vi.clearAllMocks())

describe('MeetingChatComposer attach', () => {
  it('uploads the file, then sends it with the typed text as one line', async () => {
    h.upload.mockResolvedValue({ url: '/api/uploads/abc', filename: 'plan.pdf', size: '1234' })
    render(<MeetingChatComposer />)
    await userEvent.type(screen.getByRole('textbox'), 'see this')
    await pick()
    await waitFor(() => expect(h.sendChat).toHaveBeenCalled())
    expect(h.upload).toHaveBeenCalledWith(file)
    expect(h.sendChat).toHaveBeenCalledWith('see this', { url: '/api/uploads/abc', name: 'plan.pdf', size: 1234 })
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('a file alone is sent with empty text', async () => {
    h.upload.mockResolvedValue({ url: '/api/uploads/abc', filename: 'plan.pdf', size: '1' })
    render(<MeetingChatComposer />)
    await pick()
    await waitFor(() => expect(h.sendChat).toHaveBeenCalledWith('', expect.objectContaining({ name: 'plan.pdf' })))
  })

  it.each([
    ['FILE_TOO_LARGE', 'chatFileTooLarge'],
    ['Network Error', 'chatUploadFailed'],
  ])('upload error %s shows a translated toast and sends nothing', async (message, key) => {
    h.upload.mockRejectedValue(new Error(message))
    render(<MeetingChatComposer />)
    await pick()
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(key))
    expect(h.sendChat).not.toHaveBeenCalled()
  })

  it('locks send and attach while uploading', async () => {
    let done: (v: unknown) => void = () => {}
    h.upload.mockReturnValue(new Promise((r) => { done = r }))
    render(<MeetingChatComposer />)
    await userEvent.type(screen.getByRole('textbox'), 'hi')
    await pick()
    expect(await screen.findByText('chatUploading')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'chatSend' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'chatAttach' })).toBeDisabled()
    await act(async () => { done({ url: '/api/uploads/a', filename: 'plan.pdf', size: '1' }) })
    await waitFor(() => expect(screen.queryByText('chatUploading')).not.toBeInTheDocument())
  })

  it('keeps the uploaded file staged when the controller refuses, and sends it on the next Send without re-uploading', async () => {
    h.upload.mockResolvedValue({ url: '/api/uploads/abc', filename: 'plan.pdf', size: '5' })
    h.sendChat.mockReturnValueOnce(null as unknown as string)
    render(<MeetingChatComposer />)
    await pick()
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith('chatNotSent'))
    expect(screen.getByText('plan.pdf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'chatSend' }))
    expect(h.sendChat).toHaveBeenLastCalledWith('', { url: '/api/uploads/abc', name: 'plan.pdf', size: 5 })
    expect(h.upload).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('plan.pdf')).not.toBeInTheDocument()
  })

  it('the staged file can be removed', async () => {
    h.upload.mockResolvedValue({ url: '/api/uploads/abc', filename: 'plan.pdf', size: '5' })
    h.sendChat.mockReturnValueOnce(null as unknown as string)
    render(<MeetingChatComposer />)
    await pick()
    await userEvent.click(await screen.findByRole('button', { name: 'chatRemoveFile' }))
    expect(screen.queryByText('plan.pdf')).not.toBeInTheDocument()
  })

  it('attaching with a too-long draft shows the too-long toast and uploads nothing', async () => {
    render(<MeetingChatComposer />)
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('x'.repeat(2001))
    await pick()
    expect(h.toastError).toHaveBeenCalledWith('errChatTooLong')
    expect(h.upload).not.toHaveBeenCalled()
  })

  it('normalizes an absolute upload url to its path', async () => {
    h.upload.mockResolvedValue({ url: 'https://api.example.com/api/uploads/abc', filename: 'plan.pdf', size: '5' })
    render(<MeetingChatComposer />)
    await pick()
    await waitFor(() => expect(h.sendChat).toHaveBeenCalledWith('', expect.objectContaining({ url: '/api/uploads/abc' })))
  })
})
