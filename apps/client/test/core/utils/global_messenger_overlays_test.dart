import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/theme/app_theme.dart';
import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/core/utils/global_messenger_overlays.dart';

Future<void> _host(WidgetTester tester, {bool dark = false}) =>
    tester.pumpWidget(MaterialApp(
      navigatorKey: rootNavigatorKey,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: dark ? ThemeMode.dark : ThemeMode.light,
      home: const Scaffold(body: Text('page')),
    ));

void main() {
  group('top banner (showErrorSnackBar / showInfoSnackBar)', () {
    testWidgets('shows, then auto-dismisses after 3 s', (tester) async {
      await _host(tester);
      showErrorSnackBar('Wrong password');
      await tester.pump();
      expect(find.text('Wrong password'), findsOneWidget);
      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 2900));
      expect(find.text('Wrong password'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pumpAndSettle();
      expect(find.byType(TopSlideBannerWidget), findsNothing);
    });

    testWidgets('a new banner replaces the one on screen', (tester) async {
      await _host(tester, dark: true);
      showInfoSnackBar('First');
      await tester.pump();
      showInfoSnackBar('Second');
      await tester.pump();
      expect(find.text('First'), findsNothing);
      expect(find.text('Second'), findsOneWidget);
      expect(find.byIcon(Icons.info_outline_rounded), findsOneWidget);
      // The replaced banner's own timer must not remove the new one early.
      await tester.pump(const Duration(seconds: 2));
      expect(find.text('Second'), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(find.byType(TopSlideBannerWidget), findsNothing);
    });

    testWidgets('close button dismisses at once', (tester) async {
      await _host(tester);
      showInfoSnackBar('Saved');
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.close_rounded));
      await tester.pumpAndSettle();
      expect(find.text('Saved'), findsNothing);
    });

    testWidgets('swipe up dismisses', (tester) async {
      await _host(tester);
      showInfoSnackBar('Swipe me');
      await tester.pumpAndSettle();
      await tester.fling(find.text('Swipe me'), const Offset(0, -300), 1000);
      await tester.pumpAndSettle();
      expect(find.byType(TopSlideBannerWidget), findsNothing);
    });

    testWidgets('no navigator mounted → silently no-op', (tester) async {
      await tester.pumpWidget(const SizedBox());
      showErrorSnackBar('nowhere');
      showInAppNotification('t', 'b');
      await tester.pump();
      expect(find.text('nowhere'), findsNothing);
    });
  });

  group('in-app notification', () {
    testWidgets('tap runs onTap and dismisses', (tester) async {
      await _host(tester);
      var taps = 0;
      showInAppNotification('Bob', 'Hi there', onTap: () => taps++);
      await tester.pumpAndSettle();
      expect(find.text('Bob'), findsOneWidget);
      expect(find.text('Hi there'), findsOneWidget);
      await tester.tap(find.text('Hi there'));
      await tester.pumpAndSettle();
      expect(taps, 1);
      expect(find.byType(TopSlideNotification), findsNothing);
    });

    testWidgets('auto-dismisses after 4 s; a newer one replaces it',
        (tester) async {
      await _host(tester, dark: true);
      showInAppNotification('A', 'one');
      await tester.pump();
      showInAppNotification('B', 'two');
      await tester.pump();
      expect(find.text('one'), findsNothing);
      expect(find.text('two'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 3900));
      expect(find.text('two'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pumpAndSettle();
      expect(find.byType(TopSlideNotification), findsNothing);
    });

    testWidgets('a tap without onTap still dismisses; swipe up too',
        (tester) async {
      await _host(tester);
      showInAppNotification('A', 'tap');
      await tester.pumpAndSettle();
      await tester.tap(find.text('tap'));
      await tester.pumpAndSettle();
      expect(find.byType(TopSlideNotification), findsNothing);

      showInAppNotification('B', 'swipe');
      await tester.pumpAndSettle();
      await tester.fling(find.text('swipe'), const Offset(0, -300), 1000);
      await tester.pumpAndSettle();
      expect(find.byType(TopSlideNotification), findsNothing);
    });
  });
}
