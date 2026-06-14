---
name: orchestrate-feature
description: Orchestrates end-to-end feature development for the Platform monorepo (NestJS auth + Spring Boot chat + NestJS AI + Flutter mobile + Next.js web). Use when asked to implement a feature, add functionality, build a new screen, create a new API endpoint, or add any new capability to the app. Also triggers for "다시 구현", "재실행", "이전 결과 개선", "일부만 수정", "백엔드만", "Flutter만", "Web만" re-run requests.
---

# Feature Development Orchestrator

**실행 모드:** 하이브리드
- Phase 1: 서브 에이전트 (순차) — 계획 수립
- Phase 2: 서브 에이전트 3개 (병렬) — 구현
- Phase 3: 서브 에이전트 (순차) — QA 검증

## Phase 0: 컨텍스트 확인

`_workspace/` 존재 여부 확인:

```bash
ls _workspace/ 2>/dev/null && echo "EXISTS" || echo "NEW"
```

- **NEW**: 초기 실행 → Phase 1로 진행
- **EXISTS + 부분 수정 요청** ("백엔드만", "QA만 다시"): 해당 Phase만 재실행
- **EXISTS + 새 기능 요청**: 기존 workspace를 `_workspace_prev/`로 이동 후 초기 실행

## Phase 1: 기능 계획 (순차)

에이전트: `.claude/agents/feature-planner.md`

```
Agent({
  description: "Feature planning: [기능명]",
  subagent_type: "general-purpose",
  model: "opus",
  prompt: "
    너는 feature-planner다. 역할과 출력 형식은 .claude/agents/feature-planner.md를 따른다.
    
    기능 요청: [사용자 요청 원문]
    
    프로젝트:
    - chat-service: apps/server/chat-service/ (Spring Boot 3, port 8080)
    - auth-service: apps/server/auth-service/ (NestJS, port 3001)
    - ai-service: apps/server/ai-service/ (NestJS, port 3002)
    - Flutter: apps/client/
    - Next.js: apps/web/
    - MongoDB port 27018, Redis port 6379
    
    CLAUDE.md와 .claude/rules/sync.md를 먼저 읽어라.
    _workspace/ 디렉토리를 생성하고 _workspace/01_plan.md를 작성하라.
  "
})
```

완료 조건: `_workspace/01_plan.md` 생성

## Phase 2: 구현 (병렬 — 3개 동시 실행)

**Phase 1 완료 후** 3개 에이전트를 동시에 실행한다.

에이전트 정의:
- `.claude/agents/backend-dev.md`
- `.claude/agents/mobile-dev.md`
- `.claude/agents/web-dev.md`

```
# 세 에이전트를 단일 메시지에서 모두 실행 (run_in_background: true)

Agent({
  description: "Backend implementation",
  subagent_type: "general-purpose",
  model: "opus",
  run_in_background: true,
  prompt: "
    너는 backend-dev다. 역할과 원칙은 .claude/agents/backend-dev.md를 따른다.
    _workspace/01_plan.md를 읽고 Backend 섹션을 구현하라.
    완료 후 _workspace/02_backend_report.md를 작성하라.
  "
})

Agent({
  description: "Mobile (Flutter) implementation",
  subagent_type: "general-purpose",
  model: "opus",
  run_in_background: true,
  prompt: "
    너는 mobile-dev다. 역할과 원칙은 .claude/agents/mobile-dev.md를 따른다.
    _workspace/01_plan.md를 읽고 Mobile 섹션을 구현하라.
    완료 후 _workspace/02_mobile_report.md를 작성하라.
  "
})

Agent({
  description: "Web (Next.js) implementation",
  subagent_type: "general-purpose",
  model: "opus",
  run_in_background: true,
  prompt: "
    너는 web-dev다. 역할과 원칙은 .claude/agents/web-dev.md를 따른다.
    _workspace/01_plan.md를 읽고 Web 섹션을 구현하라.
    완료 후 _workspace/02_web_report.md를 작성하라.
  "
})
```

완료 조건: 3개 report 파일 생성
- `_workspace/02_backend_report.md`
- `_workspace/02_mobile_report.md`
- `_workspace/02_web_report.md`

## Phase 3: QA 검증 (순차)

에이전트: `.claude/agents/qa-agent.md`

```
Agent({
  description: "QA verification",
  subagent_type: "general-purpose",
  model: "opus",
  prompt: "
    너는 qa-agent다. 역할과 체크리스트는 .claude/agents/qa-agent.md를 따른다.
    _workspace/ 디렉토리의 모든 보고서를 읽고 QA 검증을 수행하라.
    완료 후 _workspace/03_qa_report.md를 작성하라.
  "
})
```

완료 조건: `_workspace/03_qa_report.md` 생성

## Phase 4: 결과 요약

`_workspace/03_qa_report.md`를 읽어 사용자에게 요약:
- 구현된 기능 및 변경 파일 목록
- QA 결과 (PASS/FAIL)
- 잔여 이슈 (있을 경우)

## 데이터 흐름

```
사용자 요청
    ↓
[feature-planner] → _workspace/01_plan.md
    ↓
[backend-dev]  ─→ _workspace/02_backend_report.md ─┐
[mobile-dev]   ─→ _workspace/02_mobile_report.md  ─┤→ [qa-agent] → _workspace/03_qa_report.md → 사용자
[web-dev]      ─→ _workspace/02_web_report.md     ─┘
```

## 에러 핸들링

- Phase 1 실패 (plan.md 미생성): 1회 재시도, 실패 시 수동 계획 요청
- Phase 2 에이전트 개별 실패: 해당 report 누락 상태로 Phase 3 진행, 누락 명시
- Phase 3 QA FAIL: 이슈 목록 그대로 사용자에게 전달

## 테스트 시나리오

**정상 흐름:**
- 입력: "메시지에 이모지 리액션 기능을 추가해줘"
- 예상: plan.md 생성 → 3개 플랫폼 구현 → QA PASS

**부분 재실행:**
- 입력: "백엔드만 다시 구현해줘"
- 예상: Phase 0에서 existing workspace 감지 → backend-dev만 재실행 → QA 업데이트
