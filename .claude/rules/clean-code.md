# Clean Code & Code Structure Rules
> Guidelines for maintaining clean, modular, and easy-to-maintain codebases in both Flutter and Spring Boot/NestJS services.

## 1. File Length Limits
To prevent "God classes" and ensure code remains readable:
* **Flutter UI Screens/Widgets:** Maximum **400 lines** per file.
* **Spring Boot/NestJS Services/Controllers:** Maximum **500 lines** per file.
* If a file exceeds these thresholds, it MUST be refactored and split into smaller, single-responsibility files.

---

## 2. Flutter Modularization Rules

### A. UI and Business Logic Separation
* **View/UI Layer:** Widgets must focus strictly on layout, themes, and rendering. They should not contain complex calculations, heavy data parsing, or direct API orchestration.
* **Logic Layer (Riverpod):** Use providers (`Notifier`, `AsyncNotifier`) to manage state and business logic.
* **Repository Layer:** Abstract API calls (Dio, Stomp) into dedicated repository classes.

### B. Widget Splitting
* **No Nesting Deeper than 5 Levels:** If a widget tree has deep nested structures, extract sub-trees into separate local private widgets (e.g., `_MySubWidget`) or move them to a separate file in `widgets/` if they are reusable.
* **Extract Helper Widgets:** Move long helper builders (e.g., `Widget _buildChatHeader()`) out into separate stateless/stateful widget classes when they exceed 100 lines.

---

## 3. Backend (Spring Boot & NestJS) Modularization Rules

### A. Controller Simplicity
* Controllers should ONLY parse request variables, call the corresponding service, and return DTO responses.
* **NO business logic in Controllers.**

### B. Service Decomposition
* A service should fulfill one primary domain responsibility.
* If a service has too many dependencies or performs multiple distinct workflows, split it (e.g., instead of a generic `MessageService`, separate it into `MessageService` and `LinkPreviewService`).

---

## 4. Refactoring Protocol
When splitting files, ensure:
1. All relative imports are correctly updated.
2. Private classes (`_ClassName`) are converted to public (`ClassName`) if moved to a different file.
3. Regression tests (`mvn test`, `flutter test`) are run immediately to verify that refactoring did not break existing functionality.
