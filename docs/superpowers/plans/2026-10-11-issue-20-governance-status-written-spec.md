# Issue #20 — Governance Approval Status Synchronization Written Spec

Date: 2026-10-11  
Requirement: GitHub Issue #20 — `[REQ] Synchronize architecture approval status with written spec and closure`  
Architecture: Option B — APPROVED  
Functional R-number: NOT ASSIGNED  
Status: WRITTEN SPEC DRAFT / AWAITING USER APPROVAL / NO IMPLEMENTATION AUTHORITY

## 1. Objective

Repair contradictory governance approval states for completed Issue #14 and Issue #15 cycles, and prevent recurrence by adding a durable same-change synchronization rule to the Tasun architecture/written-spec template.

This requirement is governance-document-only.

No runtime, formal-page, release-version, data, permission, sync, lifecycle, or UI behavior may change.

## 2. Baseline authority

Architecture tracing baseline:

`main @ 31378f139eaa2a0900c5dd10752be68d5e6bcd02`

Formal release at trace time:

`20261011_tasun_v5_xidong_docs_r1146_b1f24f5d5d63_release`

At written-spec approval time, the implementation/governance repair branch must be created from the latest current `main` after this approved spec is merged.

Historical branches remain reference-only.

## 3. Existing contradiction to repair

### Issue #14

Architecture document:

`docs/superpowers/plans/2026-10-11-issue-14-geometry-architecture.md`

Current stale projection:

- status says written spec in progress;
- status says no implementation authority;
- written-spec approval checkboxes remain unchecked;
- closing statement says implementation remains unauthorized.

Paired written spec:

`docs/superpowers/plans/2026-10-11-issue-14-geometry-written-spec.md`

already records:

- written spec approved;
- implementation/TDD authorized;
- approval date 2026-10-11.

Issue #14 implementation, release, deployed SHA verification, and closure are complete.

### Issue #15

The same contradiction exists between:

- `docs/superpowers/plans/2026-10-11-issue-15-artifact-abort-architecture.md`
- `docs/superpowers/plans/2026-10-11-issue-15-artifact-abort-written-spec.md`

Issue #15 is also fully implemented, released, verified, and closed.

## 4. Root-cause contract

The repository governance template currently allows approval state to be projected independently into:

- architecture document;
- written-spec document;
- PR/Issue status text.

Explicit user approval is the real governance event.

The documents are projections of that event and must not disagree after the approval record is merged.

Therefore this requirement adds a same-change synchronization rule.

## 5. In-scope files

Expected governance targets:

- `docs/superpowers/plans/2026-10-11-issue-14-geometry-architecture.md`
- `docs/superpowers/plans/2026-10-11-issue-15-artifact-abort-architecture.md`
- `docs/superpowers/plans/TEMPLATE-tasun-architecture-written-spec.md`

Expected test target:

- one new governance-status synchronization test under `tests/`, or equivalent executable docs regression coverage.

The already-correct #14/#15 written-spec files should remain unchanged unless a test proves a narrowly necessary parity correction.

## 6. Explicit non-goals

This requirement does not change:

- any HTML;
- any embedded JS/CSS;
- any formal page;
- any data row;
- uid / rev / updatedAt / deleted;
- login / permissions;
- cloud sync;
- SelfHeal runtime;
- release publisher;
- release workflow;
- release sequence;
- `tasun-version.json`;
- Issue #14 or #15 technical architecture substance;
- historical baseline SHA values;
- historical approval dates;
- functional R-number assignment.

## 7. Exact repair for Issue #14 architecture

Change only governance status projection.

Required target state:

Status header:

`ARCHITECTURE APPROVED / WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED`

Approval gate must show:

- architecture approved;
- written spec completed;
- written spec explicitly approved by user on 2026-10-11;
- implementation/TDD authorized by user on 2026-10-11.

Replace the obsolete closing statement that says implementation is unauthorized with a statement that:

- written-spec approval is complete;
- implementation/TDD was authorized;
- the cycle has since been completed and closed;
- closure evidence is recorded in Issue #14 / repository history.

Do not rewrite architecture options, baseline, call chain, TDD plan, acceptance criteria, or technical history.

## 8. Exact repair for Issue #15 architecture

Apply the same governance-only repair.

Required target state:

Status header:

`ARCHITECTURE APPROVED / WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED`

Approval gate must show:

- architecture approved;
- written spec completed;
- written spec explicitly approved by user on 2026-10-11;
- implementation/TDD authorized by user on 2026-10-11.

Replace the obsolete unauthorized closing statement with completed approval/closure wording.

Do not rewrite technical architecture content.

## 9. Template synchronization rule

Update:

`docs/superpowers/plans/TEMPLATE-tasun-architecture-written-spec.md`

Add an explicit durable rule under approval / handoff.

Required contract:

1. architecture approval may update the architecture document alone because the written spec is not yet approved;
2. when written spec receives explicit user approval, the same governance PR/commit must update:
   - written-spec status;
   - written-spec approval checkbox;
   - paired architecture status header;
   - paired architecture written-spec approval checkbox;
   - paired architecture implementation-authorization statement;
3. PR / Issue status text must not contradict the paired files;
4. implementation branch may be created only after the synchronized approval record is merged to `main`;
5. implementation branch still starts from latest current `main`;
6. partial approval-state updates are invalid and must fail review.

The template must explicitly state:

> Do not merge a written-spec approval record if its paired architecture document still carries an earlier gate state.

## 10. Approval state model

The template must preserve these states.

### State A — Draft

Architecture:
- not approved;
- implementation unauthorized.

### State B — Architecture approved

Architecture:
- architecture approved;
- written spec in progress;
- implementation unauthorized.

### State C — Written spec approved

Architecture and written spec must both say:

- written spec approved;
- implementation/TDD authorized.

The transition from State B to State C is atomic at governance-document level.

### State D — Completed

Closure evidence records completion.

Architecture/written-spec documents retain the approved authorization state; they are not required to duplicate full closure evidence.

## 11. Single-authority rule

No new approval database or runtime state is allowed.

Explicit user approval remains the decision authority.

Repository documents provide durable projections and traceability.

Prohibited:

- JSON approval registry;
- release-version field for approval state;
- runtime approval flag;
- bot/self-approval;
- inferring approval from a merged branch without explicit user approval.

## 12. RED verification plan

Before governance repair, executable tests must prove at least:

1. #14 architecture status does not match #14 written spec;
2. #15 architecture status does not match #15 written spec;
3. #14 architecture approval gate leaves written spec unapproved;
4. #15 architecture approval gate leaves written spec unapproved;
5. template does not contain same-change synchronization requirement.

These tests must fail against the pre-fix baseline.

## 13. GREEN implementation boundary

Minimum allowed changes:

1. repair #14 architecture approval projection;
2. repair #15 architecture approval projection;
3. add same-change synchronization rule to the governance template;
4. add/update docs regression tests.

Do not modify runtime or release files.

## 14. Governance regression contract

After repair, tests must assert:

- #14 architecture and written spec both indicate written-spec approval;
- #14 architecture and written spec both indicate implementation authorization;
- #15 architecture and written spec both indicate written-spec approval;
- #15 architecture and written spec both indicate implementation authorization;
- the template contains the same-change synchronization rule;
- the template still requires explicit user approval;
- the template still requires latest-current-`main` implementation branching;
- the template does not authorize self-approval;
- no formal page or `tasun-version.json` is changed.

## 15. Release behavior

This is a docs/tests-only governance repair.

Expected release behavior:

- no formal Exact Auto Release;
- no production deploy;
- no formal page build-stamp change;
- no `tasun-version.json` mutation;
- no release-sequence increment.

Required CI:

- full Tasun regression;
- disposable exact-release verification without publishing.

If the repository attempts a formal release solely because of these docs/tests changes, stop and inspect the release trigger rather than accepting it as intended.

## 16. Changed-file gate

Before merge, allowed changed files should be limited to:

- #14 architecture doc;
- #15 architecture doc;
- governance template;
- governance synchronization test(s);
- Issue #20 own architecture/written-spec docs as approval records, if merged together.

Disallowed without separate approval:

- formal HTML pages;
- `tasun-version.json`;
- release scripts/workflows;
- cloud/runtime modules.

## 17. Review gate

Before merge:

1. RED evidence recorded;
2. GREEN docs regression recorded;
3. full Tasun regression GREEN;
4. disposable exact-release verification GREEN;
5. changed-file review confirms docs/tests-only scope;
6. independent Codex review has no blocking finding;
7. no conflicting approval wording remains for #14/#15.

## 18. Acceptance criteria

- [ ] #14 architecture status says written spec approved / implementation authorized.
- [ ] #14 architecture approval gate matches its written spec.
- [ ] #15 architecture status says written spec approved / implementation authorized.
- [ ] #15 architecture approval gate matches its written spec.
- [ ] template requires same-change synchronization at written-spec approval.
- [ ] template rejects partial approval-state updates.
- [ ] explicit user approval remains sole approval authority.
- [ ] latest-current-`main` implementation baseline rule remains.
- [ ] no runtime/formal-page/version changes.
- [ ] RED governance tests fail before repair.
- [ ] GREEN governance tests pass after repair.
- [ ] full regression GREEN.
- [ ] disposable exact-release verification GREEN.
- [ ] independent review GREEN.
- [ ] Issue #20 closure record created after merge.

## 19. Approval gate

Architecture:

- [x] Option B approved by user on 2026-10-11

Written spec:

- [ ] explicitly approved by user

Governance implementation / docs TDD:

- [ ] authorized only after written-spec approval

Until the written spec is explicitly approved, do not repair #14/#15 production governance documents, do not modify the template, and do not merge any implementation of this requirement.
