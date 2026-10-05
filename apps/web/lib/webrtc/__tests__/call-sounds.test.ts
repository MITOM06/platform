import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playTone, stopTone, toneFor } from '../call-sounds'

class FakeAudio {
  static created: FakeAudio[] = []
  static playResult: () => Promise<void> = () => Promise.resolve()
  loop = false
  src: string
  play = vi.fn(() => FakeAudio.playResult())
  pause = vi.fn()
  constructor(src: string) {
    this.src = src
    FakeAudio.created.push(this)
  }
}

beforeEach(() => {
  FakeAudio.created = []
  FakeAudio.playResult = () => Promise.resolve()
  vi.stubGlobal('Audio', FakeAudio)
})

afterEach(() => {
  stopTone()
  vi.unstubAllGlobals()
})

describe('playTone / stopTone', () => {
  it('loops the requested tone', () => {
    playTone('ringtone')
    expect(FakeAudio.created).toHaveLength(1)
    expect(FakeAudio.created[0].src).toBe('/sounds/ringtone.wav')
    expect(FakeAudio.created[0].loop).toBe(true)
    expect(FakeAudio.created[0].play).toHaveBeenCalledOnce()
  })

  it('does not restart a tone that is already playing', () => {
    playTone('ringback')
    playTone('ringback')
    expect(FakeAudio.created).toHaveLength(1)
  })

  it('switching tones stops the previous one', () => {
    playTone('ringtone')
    playTone('ringback')
    expect(FakeAudio.created[0].pause).toHaveBeenCalled()
    expect(FakeAudio.created[1].src).toBe('/sounds/ringback.wav')
  })

  it('stopTone silences the current tone', () => {
    playTone('ringtone')
    stopTone()
    expect(FakeAudio.created[0].pause).toHaveBeenCalled()
  })

  it('swallows an autoplay rejection (tab never interacted with)', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    FakeAudio.playResult = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))
    playTone('ringtone')
    await new Promise((r) => setTimeout(r, 0))
    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
  })
})

describe('toneFor', () => {
  it('rings the callee and plays ringback to the caller only', () => {
    expect(toneFor('incoming', false)).toBe('ringtone')
    expect(toneFor('outgoing', false)).toBe('ringback')
    expect(toneFor('connected', false)).toBeNull()
    expect(toneFor('idle', false)).toBeNull()
    expect(toneFor('idle', true)).toBe('ringtone') // group-call ring
    expect(toneFor('connected', true)).toBeNull() // never over an active call
  })
})
