---
name: sync-check
description: Checks and verifies that Flutter mobile and Next.js web clients are in sync — same message types handled, same STOMP events subscribed, same API endpoints called, same i18n keys present. Use when: "플랫폼 동기화 확인", "Flutter와 Web 동기화 확인", "sync check", "모바일/웹 차이점 찾아줘", "한쪽에만 구현된 기능 찾아줘", after implementing a feature on one platform only.
---

# Cross-Platform Sync Checker

Flutter(`apps/client/`) + Next.js(`apps/web/`)가 동일한 기능을 구현하고 있는지 체계적으로 검증한다.

## 체크 1: 메시지 타입 처리

```bash
echo "=== Flutter ===" && \
grep -n "MessageType\|'text'\|'image'\|'file'\|'system'\|'ai'\|case " \
  apps/client/lib/features/chat/ui/widgets/message_bubble.dart | head -20

echo "=== Web ===" && \
grep -n "MessageType\|'text'\|'image'\|'file'\|'system'\|'ai'\|case " \
  apps/web/components/chat/MessageBubble.tsx | head -20
```

비교: 양쪽이 동일한 타입 목록을 처리하는지 확인. 한쪽에만 있는 타입 = 불일치.

## 체크 2: STOMP 이벤트 구독

```bash
echo "=== Flutter STOMP ===" && \
grep -rn "subscribe\|/topic/\|/user/" \
  apps/client/lib/core/services/stomp_service.dart \
  apps/client/lib/features/chat/ui/chat_screen.dart

echo "=== Web STOMP ===" && \
grep -rn "subscribe\|/topic/\|/user/" \
  apps/web/lib/stomp/client.ts \
  "apps/web/app/(main)/conversations/[id]/page.tsx"
```

비교: 구독하는 destination이 양쪽에 모두 있는지

## 체크 3: API 엔드포인트

```bash
echo "=== Flutter API calls ===" && \
grep -rn "\.get\|\.post\|\.put\|\.delete\|\.patch" \
  apps/client/lib/features/ | grep -v "//\|test\|_test" | head -30

echo "=== Web API calls ===" && \
grep -rn "chatApi\.\|authApi\." \
  apps/web/lib/api/ apps/web/components/ "apps/web/app/(main)/" 2>/dev/null | \
  grep -v "//\|test\|node_modules" | head -30
```

비교: 동일한 엔드포인트를 양쪽이 호출하는지

## 체크 4: i18n 키

```bash
echo "=== Flutter ARB keys ===" && \
grep -o '"[a-z][a-zA-Z]*"' apps/client/lib/l10n/app_en.arb | \
  grep -v '"@' | sort > /tmp/flutter_keys.txt && cat /tmp/flutter_keys.txt | wc -l

echo "=== Web i18n keys ===" && \
python3 -c "
import json
with open('apps/web/messages/en.json') as f:
    keys = list(json.load(f).keys())
print('\n'.join(sorted(keys)))
" | wc -l

# 7개 언어 ARB 파일 키 수 비교
for lang in en vi zh ja ko es fr; do
  count=$(grep -c '"[a-z]' apps/client/lib/l10n/app_$lang.arb 2>/dev/null || echo "0")
  echo "Flutter $lang: $count keys"
done
```

## 체크 5: 미러 파일 존재 (sync.md 매핑)

```bash
# 주요 미러 파일 쌍 존재 확인
pairs=(
  "apps/web/components/chat/MessageBubble.tsx:apps/client/lib/features/chat/ui/widgets/message_bubble.dart"
  "apps/web/components/chat/MessageInput.tsx:apps/client/lib/features/chat/ui/widgets/chat_input_bar.dart"
  "apps/web/app/(main)/conversations/[id]/page.tsx:apps/client/lib/features/chat/ui/chat_screen.dart"
  "apps/web/app/(main)/friends/page.tsx:apps/client/lib/features/friends/ui/friends_screen.dart"
  "apps/web/app/(main)/settings/page.tsx:apps/client/lib/features/settings/ui/settings_screen.dart"
)

for pair in "${pairs[@]}"; do
  web="${pair%%:*}"
  mobile="${pair##*:}"
  web_exists=$([ -f "$web" ] && echo "✓" || echo "✗ MISSING")
  mobile_exists=$([ -f "$mobile" ] && echo "✓" || echo "✗ MISSING")
  echo "Web: $web_exists | Mobile: $mobile_exists"
done
```

## 출력 형식

```markdown
## Sync Check Report — [날짜]

### 메시지 타입 처리
| 타입 | Flutter | Web | 상태 |
|------|---------|-----|------|
| text | ✓ | ✓ | OK |
| image | ✓ | ✗ | **불일치** |

### STOMP 구독
| Destination | Flutter | Web | 상태 |
|-------------|---------|-----|------|

### API 엔드포인트
[불일치 항목만 기록]

### i18n
[불일치 항목만 기록]

### 미러 파일
[누락된 파일만 기록]

### 결론
**PASS** / **N개 불일치 발견**

### 권장 수정
- [구체적 파일:라인 + 수정 방법]
```
