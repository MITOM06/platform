import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/utils/ai_tool_names.dart';
import 'package:platform_client/l10n/app_localizations.dart';

void main() {
  final l = lookupAppLocalizations(const Locale('en'));

  group('parseConnectorToolName', () {
    test('splits mcp__<provider>__<tool>', () {
      final p = parseConnectorToolName('mcp__gmail__search_threads');
      expect(p?.provider, 'gmail');
      expect(p?.tool, 'search_threads');
    });

    test('keeps later separators inside the tool name', () {
      final p = parseConnectorToolName('mcp__custom_ab12__list__all');
      expect(p?.provider, 'custom_ab12');
      expect(p?.tool, 'list__all');
    });

    test('null for built-ins and malformed names', () {
      expect(parseConnectorToolName('web_search'), isNull);
      expect(parseConnectorToolName('mcp____tool'), isNull); // empty provider
      expect(parseConnectorToolName('mcp__gmail__'), isNull); // empty tool
      expect(parseConnectorToolName('mcp__gmail'), isNull); // no separator
    });
  });

  group('humanizeToolName', () {
    test('snake, kebab, dotted and camel case become a sentence', () {
      expect(humanizeToolName('search_threads'), 'Search threads');
      expect(humanizeToolName('list-open.issues'), 'List open issues');
      expect(humanizeToolName('getUserProfile'), 'Get user profile');
      expect(humanizeToolName('mcp__github__createPullRequest'),
          'Create pull request');
    });

    test('a name of only separators is returned unchanged', () {
      expect(humanizeToolName('__'), '__');
      expect(humanizeToolName(''), '');
    });
  });

  group('aiToolDisplayName', () {
    test('built-in tools use their own localized wording', () {
      expect(aiToolDisplayName(l, 'search_messages'), l.aiToolSearchMessages);
      expect(aiToolDisplayName(l, 'get_user_info'), l.aiToolGetUserInfo);
      expect(aiToolDisplayName(l, 'search_knowledge_base'),
          l.aiToolSearchKnowledgeBase);
      expect(aiToolDisplayName(l, 'summarize_conversation'),
          l.aiToolSummarizeConversation);
      expect(aiToolDisplayName(l, 'create_reminder'), l.aiToolCreateReminder);
      expect(aiToolDisplayName(l, 'remember_fact'), l.aiToolRememberFact);
      expect(aiToolDisplayName(l, 'web_search'), l.aiToolWebSearch);
    });

    test('unknown non-connector tools are humanized', () {
      expect(aiToolDisplayName(l, 'translate_text'), 'Translate text');
    });

    test('connector tools read "<Tool> on <Connector>" with the given name',
        () {
      expect(
          aiToolDisplayName(l, 'mcp__acme__send_mail',
              connectorNames: const {'acme': 'Acme Mail'}),
          'Send mail on Acme Mail');
    });

    test('custom server without a known name gets the generic custom label',
        () {
      final s = aiToolDisplayName(l, 'mcp__custom_9f3a__run_query');
      expect(s, l.aiToolOnConnector('Run query', l.connectorCustomName));
      expect(s, isNot(contains('custom_9f3a')));
    });
  });
}
