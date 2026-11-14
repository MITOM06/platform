// Shared core widgets with behaviour: the 6-box OTP input (digits only, max 6,
// onCompleted once full, fits narrow screens) and the typing dots animation.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/widgets/bouncing_dots.dart';
import 'package:platform_client/core/widgets/otp_6box_input.dart';

Widget _host(Widget child, {double width = 400}) => MaterialApp(
      home: Scaffold(
        body: Center(child: SizedBox(width: width, child: child)),
      ),
    );

void main() {
  group('Otp6BoxInput', () {
    testWidgets('typing fills the boxes; onCompleted fires with 6 digits',
        (tester) async {
      final ctrl = TextEditingController();
      addTearDown(ctrl.dispose);
      final done = <String>[];
      await tester.pumpWidget(
          _host(Otp6BoxInput(controller: ctrl, onCompleted: done.add)));

      await tester.tap(find.byType(Otp6BoxInput));
      await tester.pump();
      await tester.enterText(find.byType(TextField), '12a3');
      await tester.pump();
      expect(ctrl.text, '123'); // digits only
      expect(find.text('1'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(done, isEmpty);

      await tester.enterText(find.byType(TextField), '12345678');
      await tester.pump(const Duration(milliseconds: 200));
      expect(ctrl.text, '123456'); // max 6
      expect(done, ['123456']);
      expect(find.text('6'), findsOneWidget);
    });

    testWidgets('six boxes always fit a narrow screen', (tester) async {
      final ctrl = TextEditingController(text: '12');
      addTearDown(ctrl.dispose);
      await tester.pumpWidget(_host(
          Otp6BoxInput(controller: ctrl, accentColor: Colors.red),
          width: 300));
      expect(tester.takeException(), isNull); // no overflow
      final boxes = find.byType(AnimatedContainer);
      expect(boxes, findsNWidgets(6));
      final w = tester.getSize(boxes.first).width;
      expect(w, greaterThanOrEqualTo(36));
      expect(w * 6 + 8 * 5, lessThanOrEqualTo(300.5));
    });

    testWidgets('unbounded width falls back to the max box size',
        (tester) async {
      final ctrl = TextEditingController();
      addTearDown(ctrl.dispose);
      await tester.pumpWidget(MaterialApp(
        theme: ThemeData(brightness: Brightness.dark),
        home: Scaffold(
          body: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Otp6BoxInput(controller: ctrl),
          ),
        ),
      ));
      expect(tester.getSize(find.byType(AnimatedContainer).first).width, 48);
    });

    testWidgets('removes its listener on dispose', (tester) async {
      final ctrl = TextEditingController();
      addTearDown(ctrl.dispose);
      final done = <String>[];
      await tester.pumpWidget(
          _host(Otp6BoxInput(controller: ctrl, onCompleted: done.add)));
      await tester.pumpWidget(const SizedBox());
      ctrl.text = '123456';
      expect(done, isEmpty);
    });
  });

  group('BouncingDots', () {
    testWidgets('three dots bounce up and back over the 1.2 s cycle',
        (tester) async {
      await tester.pumpWidget(_host(const BouncingDots(size: 8)));
      final dots = find.descendant(
          of: find.byType(BouncingDots), matching: find.byType(Transform));
      expect(dots, findsNWidgets(3));

      double dy(int i) =>
          tester.widget<Transform>(dots.at(i)).transform.getTranslation().y;
      expect(dy(0), 0); // first dot starts at rest
      await tester.pump(const Duration(milliseconds: 300)); // value 0.25
      expect(dy(0), closeTo(-3, 0.01)); // going up
      expect(dy(1), closeTo(0, 0.01)); // offset by a quarter
      await tester.pump(const Duration(milliseconds: 600)); // value 0.75
      expect(dy(0), closeTo(-3, 0.01)); // coming down
      expect(
          tester.getSize(find
              .descendant(
                  of: find.byType(BouncingDots),
                  matching: find.byType(Container))
              .first),
          const Size(8, 8));
      await tester.pumpWidget(const SizedBox()); // stops the ticker
    });
  });
}
