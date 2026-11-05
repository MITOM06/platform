import { vi } from 'vitest'

export interface FakeResult {
  isFinal: boolean
  0: { transcript: string }
}

export class FakeRecognition {
  static instances: FakeRecognition[] = []
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: { resultIndex: number; results: FakeResult[] }) => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  constructor() {
    FakeRecognition.instances.push(this)
  }
  emit(transcript: string, isFinal: boolean) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript } }] })
  }
}

export function installFakeSpeech() {
  FakeRecognition.instances = []
  ;(window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRecognition
}
export function removeFakeSpeech() {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
}
