---
name: implement-feature
description: Implement a new feature end-to-end with planning, coding, and verification
---

Implement feature: $ARGUMENTS

Follow these steps exactly:

1. **Explore** (read-only first): Identify relevant files, understand existing patterns, check for similar implementations.

2. **Plan**: Write out:
   - Files to create/modify
   - API contracts (if applicable)
   - Data models needed
   - Edge cases to handle

3. **Implement**: Write code following the conventions in the nearest CLAUDE.md. For Spring Boot: constructor injection, DTO separation, @Document entities. For Flutter: feature-based structure, Riverpod providers.

4. **Verify**: 
   - Java: run `mvn compile` then `mvn test -Dtest=<TestClass>`
   - Flutter: run `flutter analyze` then `flutter test`
   - Fix any errors before reporting done

5. **Report**: List files changed and any follow-up tasks needed.

IMPORTANT: Do not implement more than what's asked. Stay focused on the scope.
