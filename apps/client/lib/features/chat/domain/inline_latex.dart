/// Some models write LaTeX symbol commands in plain prose (`$\rightarrow$`,
/// `$\times$`). The chat has no math renderer, so they showed up raw. Inline
/// math made only of these commands becomes the Unicode symbol; any other
/// `$…$` (a price, real math) and code spans/blocks are left as written.
/// Mirror: apps/web/lib/ai/inline-latex.ts.
const Map<String, String> _symbols = {
  'rightarrow': '→',
  'to': '→',
  'longrightarrow': '⟶',
  'leftarrow': '←',
  'gets': '←',
  'longleftarrow': '⟵',
  'leftrightarrow': '↔',
  'Rightarrow': '⇒',
  'implies': '⇒',
  'Leftarrow': '⇐',
  'Leftrightarrow': '⇔',
  'iff': '⇔',
  'uparrow': '↑',
  'downarrow': '↓',
  'mapsto': '↦',
  'times': '×',
  'div': '÷',
  'cdot': '·',
  'pm': '±',
  'le': '≤',
  'leq': '≤',
  'ge': '≥',
  'geq': '≥',
  'ne': '≠',
  'neq': '≠',
  'approx': '≈',
  'equiv': '≡',
  'infty': '∞',
  'checkmark': '✓',
  'ldots': '…',
  'dots': '…',
  'cdots': '⋯',
  'bullet': '•',
};

final RegExp _inlineMath = RegExp(r'\$\s*((?:\\[A-Za-z]+\s*)+)\$');
final RegExp _command = RegExp(r'\\([A-Za-z]+)');
final RegExp _code = RegExp(r'```[\s\S]*?(?:```|$)|`[^`\n]*`');

String _replaceInProse(String text) => text.replaceAllMapped(_inlineMath, (m) {
      // `!`: group 0 and the (non-optional) group 1 always take part in a match.
      final symbols = _command.allMatches(m.group(1)!).map((c) => _symbols[c.group(1)]).toList();
      return symbols.every((s) => s != null) ? symbols.join(' ') : m.group(0)!;
    });

String replaceInlineLatex(String text) {
  if (!text.contains(r'$') || !text.contains(r'\')) return text;
  final out = StringBuffer();
  var last = 0;
  for (final code in _code.allMatches(text)) {
    out
      ..write(_replaceInProse(text.substring(last, code.start)))
      ..write(code.group(0));
    last = code.end;
  }
  out.write(_replaceInProse(text.substring(last)));
  return out.toString();
}
