import { describe, expect, it } from 'vitest'
import { attributeQuality, networkNotice, receiveQuality, showsVideo } from '../call-network'

describe('receiveQuality', () => {
  const sample = (packetsReceived: number, packetsLost: number, jitter = 0.01) => ({
    packetsReceived,
    packetsLost,
    jitter,
  })

  it('is good with no previous sample to compare', () => {
    expect(receiveQuality(null, sample(100, 0))).toBe('good')
  })

  it('is poor from 8% loss or 80 ms jitter in the window', () => {
    expect(receiveQuality(sample(100, 0), sample(192, 8))).toBe('poor') // 8 / 100
    expect(receiveQuality(sample(100, 0), sample(197, 3))).toBe('good') // 3 / 100
    expect(receiveQuality(sample(100, 0), sample(200, 0, 0.09))).toBe('poor')
  })

  it('is poor when nothing arrives while connected', () => {
    expect(receiveQuality(sample(100, 0), sample(100, 0))).toBe('poor')
  })
})

describe('attributeQuality (peer-to-peer)', () => {
  it('blames the side whose media arrives badly at the other end', () => {
    // I receive you badly, you receive me fine → your uplink is weak.
    expect(attributeQuality('poor', 'good')).toEqual({ selfPoor: false, peerPoor: true })
    // You receive me badly, I receive you fine → my uplink is weak.
    expect(attributeQuality('good', 'poor')).toEqual({ selfPoor: true, peerPoor: false })
  })

  it('both directions bad → an unstable connection, not one side', () => {
    expect(attributeQuality('poor', 'poor')).toEqual({ selfPoor: true, peerPoor: true })
  })

  it('without a report from the other side (older app) it cannot tell whose', () => {
    expect(attributeQuality('poor', null)).toEqual({ selfPoor: true, peerPoor: true })
    expect(attributeQuality('good', null)).toEqual({ selfPoor: false, peerPoor: false })
  })
})

describe('networkNotice', () => {
  it('names the weak side', () => {
    expect(networkNotice(true, false)).toBe('self')
    expect(networkNotice(false, true)).toBe('peer')
    expect(networkNotice(true, true)).toBe('both')
    expect(networkNotice(false, false)).toBeNull()
  })
})

describe('showsVideo', () => {
  it('shows the video layout while either camera is on', () => {
    expect(showsVideo(false, false)).toBe(false)
    expect(showsVideo(true, false)).toBe(true)
    expect(showsVideo(false, true)).toBe(true)
  })
})
