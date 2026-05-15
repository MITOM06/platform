---
name: fix-issue
description: Fix a bug or error with root cause analysis
disable-model-invocation: true
---

Fix the following issue: $ARGUMENTS

Steps:
1. Understand the error message/symptom fully
2. Locate the root cause (do NOT suppress errors or add try-catch blindly)
3. Check if similar patterns exist in the codebase to understand the intended approach
4. Implement the fix
5. Verify: run the relevant test or build command to confirm fixed
6. Report what the root cause was and what changed

Do NOT add workarounds that hide the problem. Fix the actual cause.
