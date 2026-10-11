# Tasun Architecture Decision and Written Spec Template

Date: YYYY-MM-DD  
Requirement / Issue: TBD  
Functional R-number: NOT ASSIGNED until user approval  
Status: DRAFT / NOT APPROVED / NO IMPLEMENTATION AUTHORITY

## 1. Baseline authority

Implementation, if later approved, must branch from the **latest current `main` at the moment the written spec is approved**.

Historical PR branches, merged feature branches, and old release branches are reference-only and must not become the new authority.

Record at approval time:

- main SHA:
- formal release build:
- related issue:
- approved functional R-number:

## 2. Problem definition

### User-visible problem

TBD.

### Reproduction path

1.
2.
3.

### Current behavior

TBD.

### Required behavior

TBD.

### Explicitly unchanged behavior

TBD.

## 3. Affected scope

### Formal pages / modules

- [ ] 汐東收發文明細表
- [ ] 汐東收發文登錄表
- [ ] 汐東文件統計表
- [ ] 汐東文件管理表
- [ ] 登入 / 權限
- [ ] 雲端同步
- [ ] 手機 / 表格 / 舞台
- [ ] 發布 / 版本
- [ ] 其他：

### Data contract impact

Describe whether the requirement affects:

- uid
- rev
- updatedAt
- deleted
- formal row identity
- dedupe
- sync ownership
- permission inheritance

If none, state NONE.

## 4. Existing original authority

Identify the existing original authority that owns the behavior today.

- File:
- Function / module:
- State authority:
- Event source:
- Public bridge / API:
- Lifecycle owner:

Do not create a second authority when the existing one can be corrected.

## 5. Architecture options

### Option A

- approach:
- authority modified:
- advantages:
- risks:
- compatibility impact:
- testability:

### Option B

- approach:
- authority modified:
- advantages:
- risks:
- compatibility impact:
- testability:

### Option C, if needed

- approach:
- authority modified:
- advantages:
- risks:
- compatibility impact:
- testability:

## 6. Selected architecture

Selected option: TBD

Reason:

TBD.

The decision must explain why this option best preserves:

- Tasun v5 fixed global rules;
- TasunSelfHealV5;
- R268 unified self-heal standard;
- single formal data authority;
- existing UI / layout / primary operation logic;
- permission inheritance;
- dedupe-before-sync behavior;
- current lifecycle and release authority.

## 7. Authority convergence

### Authority retained

TBD.

### Authority retired

TBD.

### Legacy residue removed or disabled

TBD.

### Duplicate-authority prevention

TBD.

No shadow state, compatibility patch authority, hidden second scheduler, or parallel release authority may be introduced.

## 8. Call chain and data flow

Document the complete affected path.

Example structure:

`user action → event producer → canonical metadata → state authority → projection/render → sync → persistence`

Actual chain:

TBD.

## 9. Lifecycle / SelfHeal contract

Document impact to:

- initial load;
- authenticated load;
- BFCache / pageshow;
- pagehide / visibility;
- CRUD;
- upload;
- download;
- cloud refresh;
- abort / cancellation;
- retry;
- heavy work / scheduler;
- TasunSelfHealV5.

Required behavior:

TBD.

## 10. Desktop / mobile contract

### Desktop

TBD.

### Mobile

TBD.

### Geometry / scrolling / table behavior

TBD.

## 11. Failure behavior

Define explicit behavior for:

- stale work;
- aborted work;
- duplicate events;
- partial cloud failure;
- invalid identity;
- permission denial;
- outdated lifecycle ticket;
- retryable vs non-retryable failure.

TBD.

## 12. Release contract

`tasun-version.json` remains the sole formal release-version authority.

If release-triggering files change, the implementation must verify:

1. exact four-page release artifact;
2. build-sequence parity;
3. SHA parity;
4. formal deploy;
5. deployed four-page verification.

Do not manually hardcode release sequence or infer a functional R-number from automatic publishing.

## 13. TDD plan

### RED tests

List the new behavioral tests that must fail before implementation.

1.
2.
3.

### GREEN implementation

Describe the minimum original-authority change required.

TBD.

### Full regression

Required suites:

- new requirement tests;
- existing Tasun regression;
- relevant lifecycle / stage-jump / release tests;
- embedded script syntax checks where applicable;
- disposable exact-release verification where applicable.

## 14. Acceptance criteria

- [ ]
- [ ]
- [ ]
- [ ]

Acceptance criteria must be observable and testable.

## 15. Non-goals

Explicitly list what this requirement does not change.

-

## 16. Approval record

Architecture decision:

- [ ] approved by user

Written spec:

- [ ] approved by user

Approval statement / date:

TBD.

Only after both approvals are explicit may implementation / TDD begin.

## 17. Implementation handoff

When approved:

1. read the latest current `main`;
2. record the exact baseline SHA;
3. create a fresh implementation branch;
4. write RED tests first;
5. modify the original authority only;
6. reach GREEN;
7. run full regression;
8. review for duplicate authority / legacy residue;
9. open PR;
10. require CI GREEN;
11. merge using the repository-supported strategy;
12. trigger formal release only when release-triggering files changed;
13. verify deployed four-page sequence / SHA when applicable;
14. create closure and delivery record.

This template is a governance artifact only. It does not authorize any functional implementation.
