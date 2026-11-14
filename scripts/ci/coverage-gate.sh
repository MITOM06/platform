#!/usr/bin/env bash
# Cổng coverage dạng "ratchet" cho PON (docs/engineering/test-gate.md).
#
# Đọc % dòng (lines) đã đo của một phần, so với ngưỡng trong scripts/ci/coverage-thresholds.txt:
#   thấp hơn ngưỡng  → exit 1 (CI đỏ, không được làm tụt coverage)
#   floor(%) − 1 > ngưỡng   → vẫn qua, in gợi ý nâng ngưỡng (ratchet lên)
#
# Phải chạy test có coverage TRƯỚC (xem bảng trong test-gate.md), rồi:
#   bash scripts/ci/coverage-gate.sh <phần>        # auth | ai | connector | chat | web | flutter
#   bash scripts/ci/coverage-gate.sh --all          # mọi phần đã có báo cáo
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
THRESHOLDS="$ROOT/scripts/ci/coverage-thresholds.txt"

# Đường dẫn báo cáo coverage của từng phần.
report_of() {
  case "$1" in
    auth) echo "$ROOT/apps/server/auth-service/coverage/coverage-summary.json" ;;
    ai) echo "$ROOT/apps/server/ai-service/coverage/coverage-summary.json" ;;
    connector) echo "$ROOT/apps/server/connector-service/coverage/coverage-summary.json" ;;
    web) echo "$ROOT/apps/web/coverage/coverage-summary.json" ;;
    chat) echo "$ROOT/apps/server/chat-service/target/site/jacoco/jacoco.csv" ;;
    flutter) echo "$ROOT/apps/client/coverage/lcov.info" ;;
    *) echo "" ;;
  esac
}

# % dòng đã phủ (2 chữ số thập phân) từ báo cáo; file sinh tự động của Flutter không tính.
measure() {
  local part="$1" file="$2"
  case "$part" in
    chat)
      awk -F, 'NR > 1 { m += $8; c += $9 } END { if (m + c == 0) print "0.00"; else printf "%.2f\n", 100 * c / (m + c) }' "$file" ;;
    flutter)
      awk '
        /^SF:/ { skip = ($0 ~ /\.g\.dart$|\.freezed\.dart$|\.gr\.dart$|\.config\.dart$|\/l10n\//) }
        /^LF:/ && !skip { lf += substr($0, 4) }
        /^LH:/ && !skip { lh += substr($0, 4) }
        END { if (lf == 0) print "0.00"; else printf "%.2f\n", 100 * lh / lf }' "$file" ;;
    *)
      node -e 'const t = require(process.argv[1]).total; console.log(t.lines.pct.toFixed(2))' "$file" ;;
  esac
}

threshold_of() {
  awk -F= -v p="$1" '$1 == p { print $2 }' "$THRESHOLDS" | tr -d '[:space:]'
}

check() {
  local part="$1" file min pct
  file="$(report_of "$part")"
  [ -n "$file" ] || { echo "❓ phần lạ: $part"; return 2; }
  [ -f "$file" ] || { echo "❓ $part: chưa có báo cáo $file — chạy test có coverage trước"; return 2; }
  min="$(threshold_of "$part")"
  [ -n "$min" ] || { echo "❓ $part: thiếu ngưỡng trong $THRESHOLDS"; return 2; }
  pct="$(measure "$part" "$file")"
  if awk -v p="$pct" -v m="$min" 'BEGIN { exit !(p + 0 < m + 0) }'; then
    echo "🚫 $part: ${pct}% < ngưỡng ${min}% — coverage bị tụt, thêm test cho code vừa sửa"
    return 1
  fi
  # Ngưỡng = floor(%) − 1 (biên lệch CI ↔ local); gợi ý nâng khi coverage đã vượt ngưỡng đó ≥ 1 điểm thật.
  local next
  next="$(awk -v p="$pct" 'BEGIN { printf "%d", int(p) - 1 }')"
  if [ "$next" -gt "$min" ]; then
    echo "✅ $part: ${pct}% (ngưỡng ${min}%) — coverage đã tăng, nâng ngưỡng: $part=$next"
  else
    echo "✅ $part: ${pct}% (ngưỡng ${min}%)"
  fi
}

if [ "${1:-}" = "--all" ]; then
  rc=0
  for part in auth ai connector chat web flutter; do
    [ -f "$(report_of "$part")" ] || { echo "·  $part: bỏ qua (chưa có báo cáo)"; continue; }
    check "$part" || rc=1
  done
  exit "$rc"
fi
[ "$#" -eq 1 ] || { echo "dùng: $0 <auth|ai|connector|chat|web|flutter> | --all" >&2; exit 2; }
check "$1"
