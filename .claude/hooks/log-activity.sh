#!/bin/bash
# Hook: ghi lại mọi thao tác của AI vào .claude/ai-activity.md
# Chạy sau mỗi Edit/Write/Bash tool call

LOGFILE="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)/.claude/ai-activity.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
TOOL="${CLAUDE_TOOL_NAME:-unknown}"

# Parse stdin (JSON input từ Claude Code)
INPUT=$(cat)

# Lấy thông tin từ tool input
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('file_path', d.get('path', '')))
except: print('')
" 2>/dev/null)

COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    cmd = d.get('command', '')
    print(cmd[:80] + '...' if len(cmd) > 80 else cmd)
except: print('')
" 2>/dev/null)

# Ghi log
if [[ "$TOOL" == "Edit" || "$TOOL" == "Write" ]] && [[ -n "$FILE_PATH" ]]; then
    # Lấy tên file ngắn gọn
    SHORT_PATH=$(echo "$FILE_PATH" | sed "s|$(pwd)/||g" | sed 's|.*/platform/||g')
    echo "- \`[$TIMESTAMP]\` **$TOOL** → \`$SHORT_PATH\`" >> "$LOGFILE"

elif [[ "$TOOL" == "Bash" ]] && [[ -n "$COMMAND" ]]; then
    # Chỉ log bash commands quan trọng (mvn, flutter, docker, git)
    if echo "$COMMAND" | grep -qE '^(mvn|flutter|docker|git|pnpm|npm)'; then
        echo "- \`[$TIMESTAMP]\` **Run** → \`$COMMAND\`" >> "$LOGFILE"
    fi
fi
