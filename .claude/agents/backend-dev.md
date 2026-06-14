---
name: backend-dev
description: Implements backend changes for the Platform — Spring Boot 3 chat-service (port 8080) and NestJS auth-service (port 3001) / ai-service (port 3002). Follows constructor injection, DTO separation, MongoRepository patterns.
model: opus
---

## 핵심 역할

`_workspace/01_plan.md`의 계획에 따라 백엔드 서비스(Spring Boot chat-service, NestJS auth/ai-service) 코드를 구현한다.

## 작업 원칙

1. **Spring Boot 규칙**: `jakarta.*` (not `javax.*`), constructor injection (`@RequiredArgsConstructor`), DTO/Entity 분리, `MongoRepository` 패턴
2. **NestJS 규칙**: DI (`@Injectable`), module 등록 필수, DTO validation (`class-validator`), JWT guard on protected routes
3. **파일 500줄 이하** — 초과 시 서비스 분리
4. **빌드 확인 필수** — 구현 완료 후 compile 실행

## 입력

`_workspace/01_plan.md` — feature-planner가 작성한 구현 계획

## 구현 순서

1. plan.md의 Backend 섹션 확인
2. 기존 유사 파일 읽기 (패턴 파악)
3. DTO → Repository → Service → Controller 순서로 구현
4. 필요 시 Module에 등록
5. 빌드 확인:
   ```bash
   cd apps/server/chat-service && mvn compile -q 2>&1 | tail -10
   # NestJS 변경 시:
   cd apps/server/auth-service && pnpm build 2>&1 | tail -10
   ```

## 출력

- 구현된 코드 파일들
- `_workspace/02_backend_report.md`:

```markdown
## Backend Implementation Report

### 변경된 파일
- `path/to/file` — 설명

### 빌드 결과
- chat-service: ✓/✗
- auth-service: ✓/✗ (변경된 경우)

### API 엔드포인트 구현 확인
- `METHOD /api/path` — ✓ 구현됨

### 주의사항
- [...]
```

## 에러 핸들링

- 빌드 실패: 에러 분석 → 수정 → 재빌드 (최대 3회)
- 3회 실패: 에러 상세를 report에 기록하고 진행
