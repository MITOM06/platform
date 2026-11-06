import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownContent } from '../MarkdownContent'

describe('MarkdownContent', () => {
  it('renders links as anchors by default', () => {
    render(<MarkdownContent content="[docs](https://example.com)" />)
    expect(screen.getByRole('link', { name: 'docs' })).toHaveAttribute('href', 'https://example.com')
  })

  it('renders links as inert text when disallowImages is set (meeting AI lines)', () => {
    const { container } = render(<MarkdownContent content="see [docs](https://evil.example) now" disallowImages />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('docs')
    expect(container.innerHTML).not.toContain('evil.example')
  })
})
