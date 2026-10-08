import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/call_network.dart';

/// Whose network is weak, under the call status (both media paths). Mirrors
/// web `CallConnectionNotice`.
class CallNetworkNotice extends StatelessWidget {
  const CallNetworkNotice(
      {super.key, required this.network, required this.peerName});

  final CallNetworkState network;
  final String peerName;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: network,
      builder: (context, _) {
        final notice = networkNotice(network.selfPoor, network.peerPoor);
        if (notice == null) return const SizedBox.shrink();
        final l10n = context.l10n;
        final text = switch (notice) {
          NetworkNotice.self => l10n.callSelfWeakNetwork,
          NetworkNotice.peer => l10n.callPeerWeakNetwork(peerName),
          NetworkNotice.both => l10n.callUnstableNetwork,
        };
        return Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Semantics(
            liveRegion: true,
            child: Text(text,
                style: const TextStyle(color: Colors.white70, fontSize: 12)),
          ),
        );
      },
    );
  }
}

/// Someone dropped: the call waits up to a minute for them (or for us).
/// Covers the call view with whose connection it waits for and a countdown;
/// the call goes on underneath when the connection comes back. Place it below
/// the controls in the stack so hanging up stays possible. Mirrors web
/// `CallReconnectOverlay`.
class CallReconnectOverlay extends StatefulWidget {
  const CallReconnectOverlay({
    super.key,
    required this.network,
    required this.peerName,
    this.now = DateTime.now,
  });

  final CallNetworkState network;
  final String peerName;

  /// Injectable clock (tests).
  final DateTime Function() now;

  @override
  State<CallReconnectOverlay> createState() => _CallReconnectOverlayState();
}

class _CallReconnectOverlayState extends State<CallReconnectOverlay> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    widget.network.addListener(_onNetwork);
    _onNetwork();
  }

  @override
  void dispose() {
    widget.network.removeListener(_onNetwork);
    _tick?.cancel();
    super.dispose();
  }

  void _onNetwork() {
    final waiting = widget.network.reconnectWho != null;
    if (waiting && _tick == null) {
      _tick = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    } else if (!waiting) {
      _tick?.cancel();
      _tick = null;
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final who = widget.network.reconnectWho;
    if (who == null) return const SizedBox.shrink();
    final l10n = context.l10n;
    final seconds = widget.network
        .secondsLeft(widget.now())
        .clamp(0, ReconnectWatch.reconnectGrace.inSeconds);
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.7),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(color: Colors.white),
                const SizedBox(height: 16),
                Text(
                  who == ReconnectWho.self
                      ? l10n.callReconnectingSelf
                      : l10n.callWaitingForPeer(widget.peerName),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 18),
                ),
                const SizedBox(height: 8),
                Text(
                  l10n.callReconnectCountdown(seconds),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, fontSize: 14),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
