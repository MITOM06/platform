import { describe, it, expect } from 'vitest'
import { replaceInlineLatex } from '@/lib/ai/inline-latex'

describe('replaceInlineLatex', () => {
  it('turns the LaTeX arrows a model wrote in prose into symbols', () => {
    expect(
      replaceInlineLatex('mở trang $\\rightarrow$ bấm ••• $\\rightarrow$ **Connections**'),
    ).toBe('mở trang → bấm ••• → **Connections**')
  })

  it('maps several commands inside one span', () => {
    expect(replaceInlineLatex('$\\le \\infty$ and $\\times$')).toBe('≤ ∞ and ×')
  })

  it('leaves prices, real math and unknown commands alone', () => {
    const text = 'costs $5 or $10; $x^2 + 1$; $\\frac{a}{b}$; $\\rightarrow \\alpha$'
    expect(replaceInlineLatex(text)).toBe(text)
  })

  it('never touches code spans or blocks', () => {
    const text = 'use `$\\rightarrow$` here\n```\nprint("$\\to$")\n```\nthen $\\to$ done'
    expect(replaceInlineLatex(text)).toBe(
      'use `$\\rightarrow$` here\n```\nprint("$\\to$")\n```\nthen → done',
    )
  })
})
