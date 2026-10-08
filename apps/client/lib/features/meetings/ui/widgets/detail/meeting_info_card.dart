import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/l10n/l10n_ext.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../chat/ui/widgets/conversation_avatar.dart';
import '../../../domain/display.dart';
import '../../../domain/meeting_models.dart';
import '../../../domain/schedule.dart';
import '../../../state/meetings_providers.dart';

const _maxPeopleShown = 6;

/// When, code, description and people — mirror of web `MeetingInfoCard`.
/// Names only: never a user id, `removedIds` or a department id.
class MeetingInfoCard extends StatelessWidget {
  const MeetingInfoCard({super.key, required this.meeting});

  final Meeting meeting;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final m = meeting;
    final locale = Localizations.localeOf(context).toLanguageTag();
    const zone = DeviceZone();
    final start = m.scheduledStart;
    final when = start != null
        ? formatMeetingRange(locale, start, m.scheduledEnd, zone)
        : '${l10n.meetingInstantMeeting} · '
            '${l10n.meetingCreatedAt(formatMeetingRange(locale, m.createdAt, null, zone))}';
    final muted = TextStyle(fontSize: 12, color: AppTheme.mutedText(context));
    final description = m.description?.trim() ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _IconLine(icon: Icons.schedule_rounded, child: Text(when)),
        if (m.status != MeetingStatus.ended) ...[
          const SizedBox(height: 12),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            children: [
              Text(l10n.meetingMeetingCode, style: muted),
              SelectableText(m.code,
                  style: const TextStyle(
                      fontFamily: AppTheme.fontMono, fontSize: 14)),
            ],
          ),
        ],
        if (description.isNotEmpty) ...[
          const SizedBox(height: 12),
          SelectableText(m.description ?? '',
              style: const TextStyle(fontSize: 14)),
        ],
        const SizedBox(height: 16),
        Text(l10n.meetingSectionPeople,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 8),
        _PersonLine(person: m.host, role: l10n.meetingRoleHost),
        _PeopleGroup(
            label: l10n.meetingCoHosts,
            people: m.coHosts,
            role: l10n.meetingRoleCohost),
        _PeopleGroup(label: l10n.meetingInvitees, people: m.invitees),
        if (m.departmentId case final id?) _DepartmentLine(departmentId: id),
      ],
    );
  }
}

class _IconLine extends StatelessWidget {
  const _IconLine({required this.icon, required this.child});

  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) => Row(children: [
        Icon(icon, size: 16, color: AppTheme.mutedText(context)),
        const SizedBox(width: 8),
        Expanded(
          child: DefaultTextStyle.merge(
              style: const TextStyle(fontSize: 14), child: child),
        ),
      ]);
}

class _PersonLine extends StatelessWidget {
  const _PersonLine({required this.person, this.role});

  final MeetingPerson person;
  final String? role;

  @override
  Widget build(BuildContext context) {
    final name = personName(person, context.l10n.meetingSomeone);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        ConversationAvatar(
            avatarUrl: person.avatarUrl,
            fallbackLetter: name.characters.first.toUpperCase(),
            size: 24),
        const SizedBox(width: 8),
        Flexible(
          child: Text(name,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 14)),
        ),
        if (role case final r?) ...[
          const SizedBox(width: 8),
          Text(r,
              style:
                  TextStyle(fontSize: 12, color: AppTheme.mutedText(context))),
        ],
      ]),
    );
  }
}

class _PeopleGroup extends StatelessWidget {
  const _PeopleGroup({required this.label, required this.people, this.role});

  final String label;
  final List<MeetingPerson> people;
  final String? role;

  @override
  Widget build(BuildContext context) {
    if (people.isEmpty) return const SizedBox.shrink();
    final muted = TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AppTheme.mutedText(context));
    final more = people.length - _maxPeopleShown;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: muted),
          for (final p in people.take(_maxPeopleShown))
            _PersonLine(person: p, role: role),
          if (more > 0) Text(context.l10n.meetingMoreCount(more), style: muted),
        ],
      ),
    );
  }
}

/// Department name from the departments the caller can see, else a generic
/// label — never the id.
class _DepartmentLine extends ConsumerWidget {
  const _DepartmentLine({required this.departmentId});

  final String departmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final departments = ref.watch(meetingDepartmentOptionsProvider);
    final name = departments
            .where((d) => d.id == departmentId)
            .map((d) => d.name)
            .firstOrNull ??
        l10n.meetingDepartmentGeneric;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: _IconLine(
        icon: Icons.apartment_rounded,
        child: Wrap(spacing: 6, children: [
          Text(l10n.meetingFieldDepartment,
              style: TextStyle(color: AppTheme.mutedText(context))),
          Text(name, overflow: TextOverflow.ellipsis),
        ]),
      ),
    );
  }
}
