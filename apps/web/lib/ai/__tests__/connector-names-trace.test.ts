import { describe, it, expect } from 'vitest'
import {
  humanizeToolName,
  isCustomProvider,
  providerDisplayName,
  providerOfTool,
  toolCallLabel,
  toolDisplayLabel,
} from '@/lib/ai/connector-names'
import { modelDisplayName, toolCallStatus } from '@/lib/ai/trace'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${JSON.stringify(values)}` : key

const sources = {
  catalog: [{ id: 'gmail', name: 'Gmail' }],
  directory: [{ slug: 'linear', name: 'Linear' }],
  customMcp: [{ id: '0123456789abcdef01234567', name: 'Acme tools' }],
}

describe('connector display names', () => {
  it('resolves catalog, directory and custom providers', () => {
    expect(providerDisplayName('gmail', sources)).toBe('Gmail')
    expect(providerDisplayName('linear', sources)).toBe('Linear')
    expect(providerDisplayName('custom_0123456789abcdef01234567', sources)).toBe('Acme tools')
  })

  it('never returns a raw id for an unknown provider', () => {
    expect(providerDisplayName('custom_ffffffffffffffffffffffff', sources)).toBeNull()
    expect(providerDisplayName('mystery', sources)).toBeNull()
    expect(providerDisplayName(undefined)).toBeNull()
    // Built-ins are named even before the catalog loads.
    expect(providerDisplayName('calendar')).toBe('Google Calendar')
  })

  it('a connector tool call reads "<Tool> on <Connector>", as on mobile — never the raw id', () => {
    expect(toolCallLabel('mcp__calendar__list_events', t)).toBe(
      'aiToolOnConnector:{"tool":"List events","connector":"Google Calendar"}',
    )
    expect(toolCallLabel('mcp__gmail__send_email', t, sources)).toBe(
      'aiToolOnConnector:{"tool":"Send email","connector":"Gmail"}',
    )
    expect(toolCallLabel('web_search', t)).toBe('toolWebSearch') // built-ins keep their label
    expect(toolCallLabel('mcp__gmail__', t)).toBe('Gmail')
    expect(humanizeToolName('createIssue')).toBe('Create issue')
    expect(humanizeToolName('notion-create-pages')).toBe('Notion create pages')
  })

  it('parses namespaced tool names', () => {
    expect(providerOfTool('mcp__gmail__send_email')).toBe('gmail')
    expect(providerOfTool('mcp__custom_0123__do')).toBe('custom_0123')
    expect(providerOfTool('web_search')).toBeNull()
    expect(isCustomProvider('custom_abc')).toBe(true)
    expect(isCustomProvider('custom:abc')).toBe(true)
    expect(isCustomProvider('gmail')).toBe(false)
  })

  it('tool labels: built-in key, connector name, or generic — never mcp__…', () => {
    expect(toolDisplayLabel('web_search', t, sources)).toBe('toolWebSearch')
    expect(toolDisplayLabel('mcp__gmail__send_email', t, sources)).toBe('Gmail')
    expect(toolDisplayLabel('mcp__custom_ffff__x', t, sources)).toBe('aiToolConnector')
    expect(toolDisplayLabel('something_else', t, sources)).toBe('aiToolGeneric')
  })
})

describe('trace helpers', () => {
  it('derives a status from ai-service result markers without showing them', () => {
    expect(toolCallStatus('Awaiting user confirmation')).toBe('awaiting')
    expect(toolCallStatus('Not available')).toBe('skipped')
    expect(toolCallStatus('Not performed')).toBe('failed')
    expect(toolCallStatus('Tool error: [AUTH_FAILED] …')).toBe('failed')
    expect(toolCallStatus('{"ok":true}')).toBe('done')
    expect(toolCallStatus(null)).toBe('done')
  })

  it('humanizes Claude model ids', () => {
    expect(modelDisplayName('claude-sonnet-4-5-20250929')).toBe('Claude Sonnet 4.5')
    expect(modelDisplayName('claude-opus-4-8')).toBe('Claude Opus 4.8')
    expect(modelDisplayName('gpt-4o')).toBe('gpt-4o')
    expect(modelDisplayName('')).toBeNull()
  })
})
