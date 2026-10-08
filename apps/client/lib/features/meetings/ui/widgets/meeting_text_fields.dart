import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/meeting_models.dart';

/// Title + description with a counter near the limit — mirror of web
/// `MeetingTextFields`. No hard maxLength: the validation message explains
/// the limit instead of eating keystrokes.
class MeetingTextFields extends StatefulWidget {
  const MeetingTextFields({
    super.key,
    required this.title,
    required this.description,
    required this.onTitle,
    required this.onDescription,
    this.titleError,
    this.descriptionError,
  });

  final String title;
  final String description;
  final ValueChanged<String> onTitle;
  final ValueChanged<String> onDescription;
  final String? titleError;
  final String? descriptionError;

  @override
  State<MeetingTextFields> createState() => _MeetingTextFieldsState();
}

class _MeetingTextFieldsState extends State<MeetingTextFields> {
  late final _title = TextEditingController(text: widget.title);
  late final _description = TextEditingController(text: widget.description);

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final titleCount = widget.title.trim().length;
    final descCount = widget.description.length;
    return Column(children: [
      TextField(
        controller: _title,
        onChanged: widget.onTitle,
        textInputAction: TextInputAction.next,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(
          labelText: l10n.meetingFieldTitle,
          hintText: l10n.meetingFieldTitlePlaceholder,
          errorText: widget.titleError,
          errorMaxLines: 2,
          counterText: titleCount > MeetingLimits.title - 20
              ? l10n.meetingCharCounter(titleCount, MeetingLimits.title)
              : null,
          counterStyle: TextStyle(color: AppTheme.mutedText(context)),
        ),
      ),
      const SizedBox(height: 16),
      TextField(
        controller: _description,
        onChanged: widget.onDescription,
        minLines: 3,
        maxLines: 6,
        keyboardType: TextInputType.multiline,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(
          labelText: l10n.meetingFieldDescription,
          hintText: l10n.meetingFieldDescriptionPlaceholder,
          alignLabelWithHint: true,
          errorText: widget.descriptionError,
          errorMaxLines: 2,
          counterText: descCount > MeetingLimits.description - 200
              ? l10n.meetingCharCounter(descCount, MeetingLimits.description)
              : null,
          counterStyle: TextStyle(color: AppTheme.mutedText(context)),
        ),
      ),
    ]);
  }
}
