import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import 'meeting_room_scope.dart';

/// A room bottom sheet: surface colour, hairline top, [AppTheme.radiusSheet].
/// [tall] sheets take 85 % of the height (panels); short ones size to their
/// content (menus). The sheet sits on the navigator, above the page, so it
/// re-provides the [MeetingRoomScope] of [context].
Future<T?> showRoomSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool tall = true,
  String? title,
}) {
  final scope = context.getInheritedWidgetOfExactType<MeetingRoomScope>();
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Theme.of(context).colorScheme.surface,
    shape: RoundedRectangleBorder(
      borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppTheme.radiusSheet)),
      side: BorderSide(color: AppTheme.hairline(context)),
    ),
    builder: (sheet) {
      final body = _SheetBody(title: title, tall: tall, builder: builder);
      return scope == null ? body : scope.wrap(body);
    },
  );
}

class _SheetBody extends StatelessWidget {
  const _SheetBody(
      {required this.title, required this.tall, required this.builder});

  final String? title;
  final bool tall;
  final WidgetBuilder builder;

  @override
  Widget build(BuildContext context) {
    final t = title;
    final header = t == null
        ? null
        : Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            decoration: BoxDecoration(
                border: Border(
                    bottom: BorderSide(color: AppTheme.hairline(context)))),
            child: Semantics(
              header: true,
              child: Text(t,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          );
    if (!tall) {
      return SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(top: 8, bottom: 8),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (header != null) header,
            Builder(builder: builder),
          ]),
        ),
      );
    }
    return FractionallySizedBox(
      heightFactor: 0.85,
      child: Column(children: [
        if (header != null) header,
        Expanded(child: Builder(builder: builder)),
      ]),
    );
  }
}
