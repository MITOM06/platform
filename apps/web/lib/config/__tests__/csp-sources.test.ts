import { describe, it, expect } from 'vitest'
import { cspSources } from '../csp-sources'

describe('cspSources', () => {
  // A CSP source expression carrying a path only matches that exact path
  // (CSP3 §6.6.2.10: a path not ending in '/' must equal the URL's path).
  // The mini serves every backend from one host under a per-service path, so
  // passing the service base URL through verbatim allowed exactly one URL per
  // service and blocked every real call — including POST /api/auth/auth/login,
  // which is why nobody could log in or register.
  it('reduces a service base URL carrying a path to its origin', () => {
    expect(cspSources(['https://api.example.com/api/auth'])).toEqual([
      'https://api.example.com',
    ])
  })

  it('collapses services that share one origin into a single source', () => {
    expect(
      cspSources([
        'https://api.example.com/api/auth',
        'https://api.example.com/api/chat',
        'https://api.example.com/api/ai',
        'https://api.example.com/api/connector',
      ]),
    ).toEqual(['https://api.example.com'])
  })

  it('keeps distinct per-service hosts apart (one host per service, as before)', () => {
    expect(
      cspSources(['https://auth.example.com', 'https://chat.example.com']),
    ).toEqual(['https://auth.example.com', 'https://chat.example.com'])
  })

  it('preserves a non-default port', () => {
    expect(cspSources(['http://localhost:8080/api/chat'])).toEqual(['http://localhost:8080'])
  })

  it("drops same-origin relative fallbacks, which 'self' already covers", () => {
    expect(cspSources(['/api/chat', ''])).toEqual([])
  })

  it('drops a malformed URL rather than emitting a broken source', () => {
    expect(cspSources(['http://'])).toEqual([])
  })
})
