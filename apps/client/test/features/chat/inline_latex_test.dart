import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/inline_latex.dart';

void main() {
  test('turns the LaTeX arrows a model wrote in prose into symbols', () {
    expect(
      replaceInlineLatex(r'mở trang $\rightarrow$ bấm ••• $\rightarrow$ **Connections**'),
      'mở trang → bấm ••• → **Connections**',
    );
  });

  test('maps several commands inside one span', () {
    expect(replaceInlineLatex(r'$\le \infty$ and $\times$'), '≤ ∞ and ×');
  });

  test('leaves prices, real math and unknown commands alone', () {
    const text = r'costs $5 or $10; $x^2 + 1$; $\frac{a}{b}$; $\rightarrow \alpha$';
    expect(replaceInlineLatex(text), text);
  });

  test('never touches code spans or blocks', () {
    const text = 'use `\$\\rightarrow\$` here\n```\nprint("\$\\to\$")\n```\nthen \$\\to\$ done';
    expect(
      replaceInlineLatex(text),
      'use `\$\\rightarrow\$` here\n```\nprint("\$\\to\$")\n```\nthen → done',
    );
  });
}
