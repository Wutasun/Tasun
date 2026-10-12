# Tasun Project Governance — Automatic Progression with Mandatory Gates

Effective date: 2026-10-12  
Scope: All subsequent Tasun requirements / GitHub Issues unless a user instruction explicitly overrides this rule.  
Status: PROJECT-WIDE GOVERNANCE RULE

## 1. Purpose

Avoid repeatedly asking for approval at every mechanical step while preserving explicit user authority at decisions that can change architecture, scope, risk, or production behavior.

The default operating mode is:

**automatically progress through routine verified steps; stop only at mandatory governance gates or failure boundaries.**

## 2. Governing principle

The assistant/system may automatically execute the next recommended procedural step when:
- the current step is already authorized;
- the next step follows the approved architecture/written spec;
- scope does not expand;
- no failure boundary is crossed;
- tests/review/workflow evidence supports progression.

Do not ask for redundant approval for routine transitions.

## 3. Mandatory explicit user gates

Automatic progression MUST stop for explicit user approval at these points:

### Gate A — architecture selection or architecture amendment

Required when:
- a new requirement has multiple meaningful architecture options;
- a recommended architecture is proposed;
- an approved architecture must change;
- implementation scope must expand beyond the approved architecture.

Typical approval:
`核准 Issue #NN 方案 A 架構，開始 written spec`

### Gate B — written-spec approval

Required after the written spec is complete and synchronized with the approved architecture.

Typical approval:
`Issue #NN written spec 核准，進入 implementation / TDD`

Implementation must not begin before this approval and the synchronized governance record is merged to `main`.

### Gate C — failure-boundary decision

Required when implementation discovers evidence that invalidates the approved assumptions, including:
- hidden real consumers/dependencies;
- need to modify explicit no-change files;
- new data/schema changes;
- new permission/auth/cloud/release authority changes;
- need for a compatibility shim or second authority;
- semantic scope expansion;
- unresolved safety/data-loss risk;
- conflicting legitimate requirements.

Return to architecture/amended written spec instead of silently broadening work.

## 4. Steps that proceed automatically after authorization

After Gate B is approved and governance is merged, the following proceed automatically unless a failure boundary occurs:

1. resynchronize to latest `main`;
2. create fresh implementation/TDD branch;
3. capture baseline and locked-file evidence;
4. create and commit RED tests;
5. confirm expected RED;
6. implement the minimum approved change;
7. reach focused GREEN;
8. run full regression;
9. run disposable exact-release where applicable;
10. run semantic diff audit;
11. run locked-file audit;
12. open/update implementation PR;
13. request independent Codex review;
14. address valid review findings within approved scope;
15. rerun affected validation automatically;
16. resolve review threads when evidence supports resolution;
17. merge when all written-spec merge criteria are satisfied;
18. verify post-merge workflow/release/deployment;
19. record closure evidence;
20. close the Issue;
21. if no open requirement remains, perform next requirement-intake scan and propose the next architecture candidate.

No separate user approval is required between these routine steps.

## 5. Review finding rule

A review finding does not automatically require user approval.

The system may fix it automatically when:
- the finding is valid;
- the fix stays entirely within approved files/scope;
- it does not alter the approved architecture;
- it does not introduce new user-visible behavior;
- regression/release verification can re-establish correctness.

Stop at Gate C if the finding requires broader architecture or scope.

## 6. CI / workflow failure rule

For ordinary CI failures, automatically:
- inspect logs;
- identify root cause;
- fix only within approved scope;
- rerun validation.

User approval is not needed for mechanical test corrections or exact-scope bug fixes.

Stop at Gate C when the failure proves an architecture assumption wrong or requires unauthorized files/behavior to change.

## 7. Merge rule

Merge automatically only when every written-spec merge condition is satisfied, including where applicable:
- required approval record merged;
- RED evidence captured;
- focused GREEN;
- full regression GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- independent review clear;
- required review threads resolved;
- PR mergeable and current with expected baseline.

Use the repository-supported merge strategy specified by the Issue/spec; default to the established Tasun strategy when already defined.

## 8. Release rule

`tasun-version.json` remains the sole formal version authority.

Automatic progression may run and verify release workflows but must not:
- manually invent a releaseSequence;
- manually hardcode an R-number;
- override normal publisher behavior to force an expected version.

After merge, verify actual workflow behavior and record:
- run ID/result;
- autoscan classification;
- generated metadata commit if any;
- final formal build/releaseSequence;
- deploy result;
- deployed SHA/build parity when applicable.

## 9. Requirement-intake continuation

After an Issue is fully closed, the system may automatically scan latest `main` for the next high-value requirement candidate.

It may automatically:
- collect evidence;
- create a new requirement Issue;
- draft architecture options;
- open a governance PR.

It must stop at Gate A before selecting/implementing a new architecture.

This prevents silent production changes while removing repetitive intake prompts.

## 10. No-scope-creep rule

Automatic progression never authorizes scope expansion.

Each Issue must retain:
- explicit affected files;
- explicit no-change files;
- single-authority ownership;
- failure boundaries;
- observable acceptance criteria.

A newly discovered adjacent defect should normally become a separate requirement unless fixing it is strictly necessary to satisfy the approved Issue and remains inside its architecture.

## 11. Latest-main authority

Before implementation and before merge:
- synchronize against latest legitimate `main`;
- preserve unrelated legitimate work;
- never revive an old PR branch as production authority;
- never use historical release files as a replacement for current main.

If main advances and causes a material architecture conflict, stop at Gate C.

## 12. Tasun fixed principles retained

This governance rule does not weaken existing Tasun rules:
- Tasun v5 fixed global principles;
- TasunSelfHealV5;
- R268 unified self-heal standard;
- single formal data authority;
- dedupe before sync;
- existing UI/layout/primary interaction preservation unless explicitly approved;
- current auth/permission inheritance;
- current release authority;
- minimal exact-scope mutation;
- regression-first verification.

## 13. Required Issue documents

Future Issues should reference this project-wide rule instead of restating the entire workflow.

Each architecture/written spec needs only to define:
- Issue-specific architecture;
- affected/locked files;
- RED/GREEN tests;
- release impact;
- failure boundaries;
- any Issue-specific deviations.

Standard automatic progression is inherited from this document.

## 14. Override rule

A direct user instruction in the current Issue may override the automatic progression behavior for that Issue.

Examples:
- “每一步都要先核准” → require step-by-step approval.
- “後續直接照建議做到完成” → continue automatically under this governance rule.
- “不要自動 merge” → stop before merge.

The newest explicit user instruction controls, provided it does not conflict with required safety/system constraints.

## 15. Canonical shorthand

For future Tasun work, the phrase:

**「依 Tasun 自動治理規則執行」**

means:
- automatically progress through all routine authorized steps;
- stop only at architecture/written-spec/failure-boundary gates;
- preserve exact scope and current authority;
- automatically validate, review, merge, release-check, close, and continue intake when allowed.
