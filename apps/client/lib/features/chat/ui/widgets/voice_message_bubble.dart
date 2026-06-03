import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class VoiceMessageBubble extends StatefulWidget {
  final String audioUrl;
  final bool isSentByMe;

  const VoiceMessageBubble({
    super.key,
    required this.audioUrl,
    required this.isSentByMe,
  });

  @override
  State<VoiceMessageBubble> createState() => _VoiceMessageBubbleState();
}

class _VoiceMessageBubbleState extends State<VoiceMessageBubble> {
  final AudioPlayer _player = AudioPlayer();
  PlayerState _state = PlayerState.stopped;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  @override
  void initState() {
    super.initState();
    _player.onPlayerStateChanged.listen((s) {
      if (mounted) setState(() => _state = s);
    });
    _player.onPositionChanged.listen((p) {
      if (mounted) setState(() => _position = p);
    });
    _player.onDurationChanged.listen((d) {
      if (mounted) setState(() => _duration = d);
    });
    _player.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _state = PlayerState.stopped;
          _position = Duration.zero;
        });
      }
    });
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _togglePlay() async {
    if (_state == PlayerState.playing) {
      await _player.pause();
    } else {
      await _player.play(UrlSource(widget.audioUrl));
    }
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final isPlaying = _state == PlayerState.playing;
    final totalMs = _duration.inMilliseconds;
    final posMs = _position.inMilliseconds;
    final sliderVal = totalMs > 0 ? (posMs / totalMs).clamp(0.0, 1.0) : 0.0;

    final iconColor = widget.isSentByMe ? Colors.white : Colors.white70;
    final trackActive =
        widget.isSentByMe ? Colors.white : AppTheme.ponCyan;
    final trackInactive = widget.isSentByMe
        ? Colors.white.withValues(alpha: 0.3)
        : Colors.white.withValues(alpha: 0.2);

    return SizedBox(
      width: 220,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: _togglePlay,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: (widget.isSentByMe ? Colors.white : AppTheme.ponCyan)
                    .withValues(alpha: 0.18),
              ),
              child: Icon(
                isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                color: iconColor,
                size: 22,
              ),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 3,
                    thumbShape:
                        const RoundSliderThumbShape(enabledThumbRadius: 5),
                    overlayShape:
                        const RoundSliderOverlayShape(overlayRadius: 9),
                    activeTrackColor: trackActive,
                    inactiveTrackColor: trackInactive,
                    thumbColor: trackActive,
                    overlayColor: trackActive.withValues(alpha: 0.15),
                  ),
                  child: Slider(
                    value: sliderVal,
                    onChanged: (v) {
                      if (totalMs > 0) {
                        _player.seek(
                          Duration(milliseconds: (v * totalMs).round()),
                        );
                      }
                    },
                    min: 0,
                    max: 1,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Text(
                    isPlaying ? _fmt(_position) : _fmt(_duration),
                    style: TextStyle(fontSize: 11, color: iconColor),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
