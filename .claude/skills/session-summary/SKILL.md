---
name: session-summary
description: Appends a summary of the current session to ai-activity.md. Call when finishing the session or prior to running /clear.
---

Based on the work accomplished during this session, append a session summary to `.claude/ai-activity.md` in the following format:

---

## Session: [DATE YYYY-MM-DD] — [ONE LINE TITLE]

**Summary:** [2-3 sentences describing the session]

**Files Created/Modified:**
- `path/to/file` — [reason]

**Decisions:**
- [Technical decision made]

**Results:**
- ✅ [Completed items]
- ❌ [Unfinished or blocked items]

**Next:** [Specific next step]

---

After appending, read it back and confirm with the user.
