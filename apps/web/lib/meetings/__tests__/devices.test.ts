import { describe, it, expect, vi } from 'vitest'
import {
  DEVICE_PREFS_KEY, deviceLabel, loadDevicePrefs, pickDeviceId, safeLocalStorage, saveDevicePrefs,
} from '@/lib/meetings/devices'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key

describe('device preferences', () => {
  it('defaults to mic and camera on when nothing is stored, storage is blocked or the value is junk', () => {
    const defaults = { micOn: true, camOn: true }
    expect(loadDevicePrefs(null)).toEqual(defaults)
    expect(loadDevicePrefs({ getItem: () => { throw new Error('SecurityError') } })).toEqual(defaults)
    expect(loadDevicePrefs({ getItem: () => '{nope' })).toEqual(defaults)
    expect(loadDevicePrefs({ getItem: () => JSON.stringify({ micOn: 'yes', audioInput: 42 }) })).toEqual(defaults)
  })

  it('round-trips stored choices and never throws on save', () => {
    const prefs = { audioInput: 'mic-2', videoInput: 'cam-1', audioOutput: 'spk-3', micOn: false, camOn: true }
    const store = new Map<string, string>()
    saveDevicePrefs(prefs, { setItem: (k, v) => void store.set(k, v) })
    expect(loadDevicePrefs({ getItem: (k) => store.get(k) ?? null })).toEqual(prefs)
    expect(store.has(DEVICE_PREFS_KEY)).toBe(true)
    expect(() => saveDevicePrefs(prefs, { setItem: vi.fn(() => { throw new Error('QuotaExceeded') }) })).not.toThrow()
  })

  it('keeps the preferred device only if it is still plugged in', () => {
    const devices = [{ deviceId: 'a' }, { deviceId: 'b' }]
    expect(pickDeviceId(devices, 'b')).toBe('b')
    expect(pickDeviceId(devices, 'gone')).toBe('a')
    expect(pickDeviceId([], 'b')).toBeUndefined()
  })

  it('names unlabeled devices (no permission yet) with a localized label', () => {
    expect(deviceLabel({ label: 'MacBook Microphone', kind: 'audioinput' }, 0, t)).toBe('MacBook Microphone')
    expect(deviceLabel({ label: '', kind: 'audioinput' }, 0, t)).toBe('deviceUnnamedMic(1)')
    expect(deviceLabel({ label: '', kind: 'videoinput' }, 1, t)).toBe('deviceUnnamedCamera(2)')
    expect(deviceLabel({ label: '', kind: 'audiooutput' }, 2, t)).toBe('deviceUnnamedSpeaker(3)')
  })
})

describe('safeLocalStorage', () => {
  it('returns the storage, or null when the browser blocks it', () => {
    expect(safeLocalStorage()).toBe(window.localStorage)
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(safeLocalStorage()).toBeNull()
    spy.mockRestore()
  })
})
