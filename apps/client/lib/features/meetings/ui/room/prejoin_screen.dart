import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/providers/theme_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../domain/device_prefs.dart';
import '../../domain/permissions.dart';
import '../../domain/schedule.dart';
import '../../state/media_preview.dart';
import '../../state/meeting_room_deps.dart';
import '../../state/meeting_room_providers.dart';
import 'meeting_room_scope.dart';
import 'prejoin_preview.dart';

/// Device check before entering: preview, mic / camera / camera side,
/// loudspeaker, then Join / Ask to join — mirror of web `PreJoinLobby`.
class PrejoinScreen extends ConsumerStatefulWidget {
  const PrejoinScreen({super.key, required this.busy});

  /// joining / connecting: every control disabled, the main button spins.
  final bool busy;

  @override
  ConsumerState<PrejoinScreen> createState() => _PrejoinScreenState();
}

class _PrejoinScreenState extends ConsumerState<PrejoinScreen> {
  late final MediaPreview _preview;
  late DevicePrefs _initial;
  SharedPreferences? _prefs;
  bool _speakerOn = true;
  bool _muteOnEntry = false;

  @override
  void initState() {
    super.initState();
    try {
      _prefs = ref.read(sharedPreferencesProvider);
    } catch (_) {
      _prefs = null; // storage unavailable — defaults, nothing remembered
    }
    final stored = parseDevicePrefs(_readStored());
    final meeting = MeetingRoomScope.read(context).meeting;
    _muteOnEntry =
        meeting.settings.muteOnEntry && !isManagerViewer(meeting.viewerRole);
    _speakerOn = stored.speakerOn;
    _initial = _muteOnEntry ? stored.copyWith(micOn: false) : stored;
    _preview = ref.read(mediaPreviewFactoryProvider)()..addListener(_changed);
    // Busy (a rejoin): LiveKit owns the devices — no preview capture.
    if (!widget.busy) _preview.start(_initial);
  }

  @override
  void didUpdateWidget(PrejoinScreen old) {
    super.didUpdateWidget(old);
    if (widget.busy && !old.busy) _preview.release();
    if (!widget.busy && old.busy) {
      _preview.start(_initial.copyWith(
          micOn: _preview.mic,
          camOn: _preview.camera,
          frontCamera: _preview.frontCamera));
    }
  }

  String? _readStored() {
    try {
      return _prefs?.getString(kDevicePrefsKey);
    } catch (_) {
      return null;
    }
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _preview
      ..removeListener(_changed)
      ..release()
      ..dispose();
    super.dispose();
  }

  Future<void> _join() async {
    final controller = MeetingRoomScope.read(context).controller;
    final mic = _preview.mic;
    final camera = _preview.camera;
    final front = _preview.frontCamera;
    unawaited(saveDevicePrefs(
        DevicePrefs(
            micOn: mic,
            camOn: camera,
            frontCamera: front,
            speakerOn: _speakerOn),
        _prefs));
    _preview.release();
    await controller.setSpeaker(_speakerOn);
    await controller
        .join(JoinMedia(mic: mic, camera: camera, frontCamera: front));
  }

  @override
  Widget build(BuildContext context) {
    final scope = MeetingRoomScope.of(context);
    final inCall = ref.watch(inAnyCallProvider);
    final name = scope.myName.isEmpty ? context.l10n.meetingYou : scope.myName;
    final preview = PrejoinPreview(
      preview: _preview,
      myName: name,
      myAvatarUrl: scope.myAvatarUrl,
      speakerOn: _speakerOn,
      onSpeaker: (on) => setState(() => _speakerOn = on),
      disabled: widget.busy,
    );
    final info = _PrejoinInfo(
      busy: widget.busy,
      inCall: inCall,
      muteOnEntry: _muteOnEntry,
      mediaError: _preview.error,
      onJoin: widget.busy || inCall ? null : () => unawaited(_join()),
    );
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(builder: (context, box) {
          if (box.maxWidth >= 768) {
            return Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1024),
                  child: Row(children: [
                    Expanded(child: preview),
                    const SizedBox(width: 32),
                    SizedBox(width: 320, child: info),
                  ]),
                ),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [preview, const SizedBox(height: 16), info],
          );
        }),
      ),
    );
  }
}

class _PrejoinInfo extends StatelessWidget {
  const _PrejoinInfo({
    required this.busy,
    required this.inCall,
    required this.muteOnEntry,
    required this.mediaError,
    required this.onJoin,
  });

  final bool busy;
  final bool inCall;
  final bool muteOnEntry;
  final MediaPreviewError? mediaError;
  final VoidCallback? onJoin;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scope = MeetingRoomScope.of(context);
    final m = scope.meeting;
    final muted = TextStyle(fontSize: 14, color: AppTheme.mutedText(context));
    final start = m.scheduledStart;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final title = m.title?.trim();
    final intent = prejoinIntent(m);
    final error = mediaError;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.meetingPrejoinTitle,
            style: TextStyle(fontSize: 12, color: AppTheme.mutedText(context))),
        const SizedBox(height: 4),
        Semantics(
          header: true,
          child: Text(
              title == null || title.isEmpty ? l.meetingUntitled : title,
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
        ),
        if (start != null && start.isAfter(DateTime.now()))
          Text(
              l.meetingPrejoinStartsAt(
                  formatMeetingRange(locale, start, null, const DeviceZone())),
              style: muted),
        if (scope.myName.isNotEmpty)
          Text(l.meetingPrejoinJoiningAs(scope.myName), style: muted),
        const SizedBox(height: 12),
        if (inCall) _Notice(l.meetingPrejoinInCall),
        if (intent == PrejoinIntent.locked) _Notice(l.meetingPrejoinLockedHint),
        if (muteOnEntry) _Notice(l.meetingPrejoinMuteOnEntry),
        if (error != null)
          _Notice(error == MediaPreviewError.blocked
              ? l.meetingMediaBlocked
              : l.meetingMediaUnavailable),
        const SizedBox(height: 4),
        PonButton(
          onPressed: onJoin,
          isLoading: busy,
          child: Text(intent == PrejoinIntent.ask
              ? l.meetingAskToJoin
              : l.meetingJoinNow),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: busy ? null : () => context.go('/meetings'),
          child: Text(l.meetingBackToList),
        ),
      ],
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.mutedSurface(context),
          borderRadius: BorderRadius.circular(AppTheme.radiusControl),
          border: Border.all(color: AppTheme.hairline(context)),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.warning_amber_rounded,
              size: 16, color: AppTheme.mutedText(context)),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 14))),
        ]),
      );
}
