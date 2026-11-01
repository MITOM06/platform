/**
 * Some models write LaTeX symbol commands in plain prose (`$\rightarrow$`,
 * `$\times$`). The chat has no math renderer, so they showed up raw. Inline math
 * made only of these commands becomes the Unicode symbol; any other `$…$` (a
 * price, real math) and code spans/blocks are left as written.
 * Mirror: apps/client/lib/features/chat/domain/inline_latex.dart.
 */
const SYMBOLS: Readonly<Record<string, string>> = {
  rightarrow: '→',
  to: '→',
  longrightarrow: '⟶',
  leftarrow: '←',
  gets: '←',
  longleftarrow: '⟵',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  implies: '⇒',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  iff: '⇔',
  uparrow: '↑',
  downarrow: '↓',
  mapsto: '↦',
  times: '×',
  div: '÷',
  cdot: '·',
  pm: '±',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  infty: '∞',
  checkmark: '✓',
  ldots: '…',
  dots: '…',
  cdots: '⋯',
  bullet: '•',
}

const INLINE_MATH = /\$\s*((?:\\[A-Za-z]+\s*)+)\$/g
const COMMAND = /\\([A-Za-z]+)/g
// Capturing, so split() keeps the code segments at the odd indexes.
const CODE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/

function replaceInProse(text: string): string {
  return text.replace(INLINE_MATH, (match, body: string) => {
    const symbols = [...body.matchAll(COMMAND)].map(([, name]) => SYMBOLS[name])
    return symbols.every(Boolean) ? symbols.join(' ') : match
  })
}

export function replaceInlineLatex(text: string): string {
  if (!text.includes('$') || !text.includes('\\')) return text
  return text
    .split(CODE)
    .map((part, i) => (i % 2 === 1 ? part : replaceInProse(part)))
    .join('')
}
