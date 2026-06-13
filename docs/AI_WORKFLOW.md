# AI_WORKFLOW.md — Semi-Automated Loop
> **Note for Tech Lead:** Workflow process between Gemini (Planner) and Claude (Coder).

## 1. Roles

| Agent | Tool | Role & Responsibility |
|-------|------|----------|
| **Gemini 2.0 Pro** | VS Code Extension (Enterprise) | **Planner + QC** — Reads .md files → writes specs → reviews Claude's output |
| **Claude** | CLI Terminal (`claude`) | **Coder + Tester** — Reads specs → writes code across all layers → runs build/test/fix |
| **Tech Lead** | VS Code | **Bridge + Approver** — Decides features, passes info between the two AIs |

---

## 2. Full Workflow Loop

```text
① IDENTIFY → ② GEMINI SPEC → ③ CLAUDE CODE → ④ GEMINI QC → ⑤ REPORT
                                     ↑________________________|
                                        (if fail: Claude fixes)
```

---

## STEP ① — Identify Missing Features

**Method 1 — Ask Claude:**
> "Claude, what is the PON project currently missing to reach production-ready status?"

**Method 2 — Manual UI Testing:**
Run the app → identify missing/buggy features → note the feature name.

---

## STEP ② — Gemini Writes Spec into TODO.md

**Prompt for Gemini** (paste into VS Code Extension):
```text
Read the following files to grasp the project context (save tokens, do not read the whole repo):
- CLAUDE.md
- apps/server/chat-service/CLAUDE.md
- apps/client/CLAUDE.md
- .claude/ai-activity.md  (check recent sessions to see what was done)
- docs/api-spec.md
- TODO.md  (check current sprint)

After reading, write a full technical spec for the feature: [FEATURE NAME]
into TODO.md, under "## SPRINT X — [feature name]", following the exact template:

### TASK [N] — [task name] `PENDING`
#### SPEC
- **Data model:** (schema, new fields if any)
- **Backend:** (file path, class, method, specific logic)
- **Frontend:** (file path, widget/screen, Riverpod provider, API call)
- **Test:** (mvn test case / flutter test case to pass)
```

→ Tech Lead **reviews the spec**, confirms, then proceeds to Step 3.

---

## STEP ③ — Claude Implements Everything

**Prompt for Claude** (type into Terminal):
```text
Read TODO.md, implement TASK [N]: [task name].
Write all layers according to the spec (data → BE → FE).
After writing, automatically run: `mvn clean compile && mvn test` (for BE)
or `flutter analyze && flutter test` (for FE).
Fix all errors until BUILD SUCCESS / No issues.
Log the results into the QA LOG section of TODO.md.
```

→ Claude self-loops in the terminal until passing, no need to monitor.

---

## STEP ④ — Gemini QC

**Prompt for Gemini** (after Claude reports finishing):
```text
Claude just implemented TASK [N]. Read TODO.md (QA LOG section)
and the following code files to review:
- [list of files Claude just wrote — Claude will report this]

Evaluate:
1. Does the code follow the spec correctly?
2. Are there logic bugs / security gaps / missing edge cases?
3. If fixes are needed: write clear instructions in TODO.md under "## FIX NOTES"
4. If passed: write "✅ QC PASS" in TODO.md and inform Tech Lead
```

---

## STEP ⑤ — If Gemini Requests Fixes

**Prompt for Claude:**
```text
Read TODO.md under "## FIX NOTES" from Gemini, and fix exactly as instructed.
After fixing, rerun tests and update the QA LOG.
```

→ Repeat steps ④ → ⑤ until Gemini writes "✅ QC PASS".

---

## TODO.md Structure per Sprint

```markdown
## 🔴 SPRINT X — [Feature Name] — IN PROGRESS

### TASK N — [name] `PENDING / IN_PROGRESS / DONE`
#### SPEC         ← Gemini writes
#### FIX NOTES    ← Gemini writes if QC fails
#### IMPL NOTES   ← Claude writes after coding

## 🧪 QA LOG
[timestamp] mvn test → ...
[timestamp] Gemini QC → PASS / FAIL + reason
```

---

## Token Saving Principles

- Gemini **does not need to read the whole repo** — reading 5 .md files is enough context.
- Claude **does not need to read chat history** — reading `TODO.md` is enough to know the task.
- `ai-activity.md` is the only memory across sessions — always append to it after each sprint.
