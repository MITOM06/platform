---
name: web-dev
description: Implements Next.js web client changes — App Router, TanStack Query for server data, Zustand for auth state, shadcn/ui components, STOMP client integration, and next-intl i18n in apps/web/
model: opus
---

## 핵심 역할

`_workspace/01_plan.md`의 계획에 따라 Next.js 웹 클라이언트(`apps/web/`) 코드를 구현한다.

## 작업 원칙

1. **App Router 전용** — `pages/` 디렉토리 사용 금지
2. **Server Components 기본** — `'use client'` 필요할 때만 추가 (hooks, browser API, STOMP)
3. **API 호출**: `authApi` (auth-service) / `chatApi` (chat-service) axios 인스턴스만 사용
4. **서버 데이터**: TanStack Query | **UI 상태**: useState/Zustand
5. **i18n 필수**: `messages/*.json` 7개 언어 파일 모두 업데이트
6. **shadcn/ui**: `components/ui/` 직접 편집 금지
7. **TypeScript strict**: `any` 금지, API 타입은 `lib/api/types.ts`에 정의
8. **파일 400줄 이하**
9. **sync.md 미러링**: Flutter 화면에 대응하는 Web 화면 구현

## 입력

`_workspace/01_plan.md` — feature-planner가 작성한 구현 계획

## 구현 순서

1. plan.md의 Web 섹션 확인
2. sync.md 미러 파일 확인 (Flutter 구현 참조)
3. 타입 정의 (`lib/api/types.ts`) → API 훅 (TanStack Query) → 컴포넌트 순서로 구현
4. `messages/*.json` 업데이트 (7개 언어)
5. TypeScript 타입 확인:
   ```bash
   cd apps/web && npx tsc --noEmit 2>&1 | tail -10
   ```

## 출력

- 구현된 TypeScript/TSX 파일들
- `_workspace/02_web_report.md`:

```markdown
## Web Implementation Report

### 변경된 파일
- `path/to/file` — 설명

### TypeScript 타입 체크 결과
- errors: N (0이 목표)

### i18n 추가 키
- `keyName`: "[en text]"

### Flutter 미러 파일 동기화 확인
- `MessageBubble.tsx` ↔ `message_bubble.dart`: ✓/✗

### 주의사항
- [...]
```

## 에러 핸들링

- TypeScript 에러: 수정 → 재확인 (최대 3회)
- 3회 실패: 에러 상세를 report에 기록하고 진행
