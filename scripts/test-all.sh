#!/usr/bin/env bash
# Chạy test + coverage của PON giống CI (kể cả tsc của web, flutter analyze) rồi kiểm cổng coverage
# (.claude/rules/test-gate.md).
#
#   bash scripts/test-all.sh                 # mọi phần
#   bash scripts/test-all.sh auth web        # chỉ các phần đã sửa
#
# Phần: auth ai connector chat web flutter. Thoát 1 nếu có test lỗi hoặc coverage tụt dưới ngưỡng.
# Cần: pnpm install ở gốc; Docker chạy (chat-service dùng Testcontainers); Flutter SDK cho phần flutter.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PARTS=("$@")
[ "${#PARTS[@]}" -gt 0 ] || PARTS=(auth ai connector chat web flutter)

# Node ≥ 22 bật Web Storage thử nghiệm làm vỡ test jsdom (localStorage.clear undefined); CI dùng Node 20.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -ge 22 ]; then export NODE_OPTIONS="${NODE_OPTIONS:-} --no-experimental-webstorage"; fi

JEST_COV=(--ci --coverage --coverageReporters=json-summary --coverageReporters=text-summary)
failed=()

run() { # run <phần> <thư mục> <lệnh…>
  local part="$1" dir="$2"; shift 2
  echo
  echo "━━━ $part ($dir) ━━━"
  if (cd "$dir" && "$@"); then
    bash scripts/ci/coverage-gate.sh "$part" || failed+=("$part:coverage")
  else
    failed+=("$part:test")
  fi
}

for part in "${PARTS[@]}"; do
  case "$part" in
    auth) run auth apps/server/auth-service pnpm exec jest "${JEST_COV[@]}" ;;
    ai) run ai apps/server/ai-service pnpm exec jest "${JEST_COV[@]}" ;;
    connector) run connector apps/server/connector-service pnpm exec jest "${JEST_COV[@]}" ;;
    chat) JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-ci_test_secret_must_be_at_least_32_chars_long}" \
          run chat apps/server/chat-service mvn -q clean test ;;
    web) run web apps/web sh -c 'pnpm exec tsc --noEmit && pnpm run test:cov' ;;
    flutter) run flutter apps/client sh -c 'dart run build_runner build --delete-conflicting-outputs >/dev/null && flutter analyze && flutter test --coverage' ;;
    *) echo "phần lạ: $part (auth ai connector chat web flutter)"; failed+=("$part:unknown") ;;
  esac
done

echo
if [ "${#failed[@]}" -gt 0 ]; then
  echo "🚫 Không đạt: ${failed[*]}"
  exit 1
fi
echo "✅ Mọi phần đạt: ${PARTS[*]}"
