import 'package:flutter/material.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Resolves a localized string from the active-locale [AppLocalizations].
///
/// Flutter's generated `AppLocalizations` exposes one getter per ARB key and
/// has no string-keyed lookup map, so FAQ content references the getters via
/// closures. This keeps the data static while still resolving text for the
/// current locale at build time — satisfying the i18n rule (no hardcoded
/// display strings).
typedef L10nResolve = String Function(AppLocalizations l);

/// A single FAQ entry (question + answer), both resolved from l10n.
class FaqItem {
  final String id;
  final L10nResolve question;
  final L10nResolve answer;

  const FaqItem({
    required this.id,
    required this.question,
    required this.answer,
  });
}

/// A group of related [FaqItem]s shown under one section header.
class FaqCategory {
  final String id;
  final L10nResolve title;
  final IconData icon;
  final List<FaqItem> items;

  const FaqCategory({
    required this.id,
    required this.title,
    required this.icon,
    required this.items,
  });
}

/// Static FAQ content — 5 categories, 20 items. Mirrors the web help page so
/// both platforms stay in sync (same categories, same order, same Q/A copy).
final List<FaqCategory> kFaqData = [
  FaqCategory(
    id: 'gettingStarted',
    icon: Icons.rocket_launch_outlined,
    title: (l) => l.helpCatGettingStarted,
    items: [
      FaqItem(
        id: 'gettingStarted.q1',
        question: (l) => l.helpGettingStartedQ1,
        answer: (l) => l.helpGettingStartedA1,
      ),
      FaqItem(
        id: 'gettingStarted.q2',
        question: (l) => l.helpGettingStartedQ2,
        answer: (l) => l.helpGettingStartedA2,
      ),
      FaqItem(
        id: 'gettingStarted.q3',
        question: (l) => l.helpGettingStartedQ3,
        answer: (l) => l.helpGettingStartedA3,
      ),
      FaqItem(
        id: 'gettingStarted.q4',
        question: (l) => l.helpGettingStartedQ4,
        answer: (l) => l.helpGettingStartedA4,
      ),
    ],
  ),
  FaqCategory(
    id: 'messaging',
    icon: Icons.chat_bubble_outline_rounded,
    title: (l) => l.helpCatMessaging,
    items: [
      FaqItem(
        id: 'messaging.q1',
        question: (l) => l.helpMessagingQ1,
        answer: (l) => l.helpMessagingA1,
      ),
      FaqItem(
        id: 'messaging.q2',
        question: (l) => l.helpMessagingQ2,
        answer: (l) => l.helpMessagingA2,
      ),
      FaqItem(
        id: 'messaging.q3',
        question: (l) => l.helpMessagingQ3,
        answer: (l) => l.helpMessagingA3,
      ),
      FaqItem(
        id: 'messaging.q4',
        question: (l) => l.helpMessagingQ4,
        answer: (l) => l.helpMessagingA4,
      ),
      FaqItem(
        id: 'messaging.q5',
        question: (l) => l.helpMessagingQ5,
        answer: (l) => l.helpMessagingA5,
      ),
    ],
  ),
  FaqCategory(
    id: 'aiFeatures',
    icon: Icons.auto_awesome_outlined,
    title: (l) => l.helpCatAiFeatures,
    items: [
      FaqItem(
        id: 'aiFeatures.q1',
        question: (l) => l.helpAiFeaturesQ1,
        answer: (l) => l.helpAiFeaturesA1,
      ),
      FaqItem(
        id: 'aiFeatures.q2',
        question: (l) => l.helpAiFeaturesQ2,
        answer: (l) => l.helpAiFeaturesA2,
      ),
      FaqItem(
        id: 'aiFeatures.q3',
        question: (l) => l.helpAiFeaturesQ3,
        answer: (l) => l.helpAiFeaturesA3,
      ),
      FaqItem(
        id: 'aiFeatures.q4',
        question: (l) => l.helpAiFeaturesQ4,
        answer: (l) => l.helpAiFeaturesA4,
      ),
    ],
  ),
  FaqCategory(
    id: 'groups',
    icon: Icons.groups_outlined,
    title: (l) => l.helpCatGroups,
    items: [
      FaqItem(
        id: 'groups.q1',
        question: (l) => l.helpGroupsQ1,
        answer: (l) => l.helpGroupsA1,
      ),
      FaqItem(
        id: 'groups.q2',
        question: (l) => l.helpGroupsQ2,
        answer: (l) => l.helpGroupsA2,
      ),
      FaqItem(
        id: 'groups.q3',
        question: (l) => l.helpGroupsQ3,
        answer: (l) => l.helpGroupsA3,
      ),
    ],
  ),
  FaqCategory(
    id: 'accountSecurity',
    icon: Icons.shield_outlined,
    title: (l) => l.helpCatAccountSecurity,
    items: [
      FaqItem(
        id: 'accountSecurity.q1',
        question: (l) => l.helpAccountSecurityQ1,
        answer: (l) => l.helpAccountSecurityA1,
      ),
      FaqItem(
        id: 'accountSecurity.q2',
        question: (l) => l.helpAccountSecurityQ2,
        answer: (l) => l.helpAccountSecurityA2,
      ),
      FaqItem(
        id: 'accountSecurity.q3',
        question: (l) => l.helpAccountSecurityQ3,
        answer: (l) => l.helpAccountSecurityA3,
      ),
      FaqItem(
        id: 'accountSecurity.q4',
        question: (l) => l.helpAccountSecurityQ4,
        answer: (l) => l.helpAccountSecurityA4,
      ),
    ],
  ),
];
