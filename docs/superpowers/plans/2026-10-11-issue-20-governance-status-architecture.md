# Issue #20 — Governance Approval Status Synchronization Architecture Draft

Date: 2026-10-11  
Requirement: GitHub Issue #20 — `[REQ] Synchronize architecture approval status with written spec and closure`  
Functional R-number: NOT ASSIGNED  
Status: DRAFT / RECOMMENDED ARCHITECTURE ONLY / NOT APPROVED / NO IMPLEMENTATION AUTHORITY

## 1. Baseline authority

Architecture tracing baseline:

`main @ 31378f139eaa2a0900c5dd10752be68d5e6bcd02`

Formal release at trace time:

`20261011_tasun_v5_xidong_docs_r1146_b1f24f5d5d63_release`

This requirement is governance-document-only.

No runtime, formal-page, release-version, data, permission, or sync authority is in scope.

## 2. Verified problem

Latest `main` contains contradictory approval-state projections.

### Issue #14

Architecture document:

`docs/superpowers/plans/2026-10-11-issue-14-geometry-architecture.md`

still says:

`ARCHITECTURE APPROVED / WRITTEN SPEC IN PROGRESS / NO IMPLEMENTATION AUTHORITY`

and its approval gate still shows the written spec as incomplete/unapproved.

But the paired written spec:

`docs/superpowers/plans/2026-10-11-issue-14-geometry-written-spec.md`

says:

`WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED`

and Issue #14 has already completed implementation, release, deployed SHA verification, and closure.

### Issue #15

The same contradiction exists between:

- `2026-10-11-issue-15-artifact-abort-architecture.md`
- `2026-10-11-issue-15-artifact-abort-written-spec.md`

Issue #15 is also fully implemented, released, verified, and closed.

Codex independently identified this status contradiction in PR #16 and PR #18.

## 3. Root cause

The current governance template:

`docs/superpowers/plans/TEMPLATE-tasun-architecture-written-spec.md`

defines:

- architecture approval;
- written-spec approval;
- implementation handoff;

but it does not require the architecture document's status header and approval gate to be synchronized when the written spec is later approved.

Therefore approval state is being projected into two documents without an explicit same-change synchronization contract.

The explicit user approval event is the real governance decision; the architecture and written-spec files are documentation projections of that decision.

## 4. Invariants

This requirement must preserve:

- explicit user approval as the only authority for architecture/written-spec approval;
- latest-current-`main` implementation baseline rule;
- no implementation before written-spec approval;
- no functional R-number inference from release sequence;
- `tasun-version.json` as sole release authority;
- existing Issue #14/#15 architecture substance, options, baseline history, TDD plan, and runtime decisions;
- historical traceability.

No historical approval date, baseline SHA, or architecture decision may be rewritten.

## 5. Architecture options

### Option A — Repair only Issue #14 and #15 documents

Update the two architecture documents so their status headers and approval-gate checkboxes match the already-approved written specs.

Advantages:
- smallest immediate edit;
- removes current contradictions.

Risks:
- root cause remains in the template;
- the next architecture/written-spec pair can repeat the same inconsistency;
- governance correctness continues to depend on operator memory.

Assessment: not preferred.

### Option B — Repair current documents and add a durable same-change synchronization rule

Repair Issue #14 and #15 architecture status projections, and update the governance template so written-spec approval requires the architecture document to be synchronized in the same governance change/PR.

Recommended rule:

> When a written spec receives explicit user approval, every paired governance projection that still carries an earlier gate state must be updated in the same approval-record change before that approval PR is merged.

Required synchronized fields:

- architecture document status header;
- architecture document written-spec approval checkbox;
- architecture document implementation-authorization statement;
- written-spec approval record;
- PR/Issue status text as applicable.

Advantages:
- fixes current contradictory documents;
- prevents recurrence;
- preserves explicit user approval as the single decision authority;
- requires no new database, runtime state, release authority, or automation;
- easily reviewable in docs-only CI.

Risks:
- approval PR touches more than one governance document;
- reviewers must reject partial approval-state updates.

Assessment: **RECOMMENDED**.

### Option C — Treat architecture documents as immutable historical snapshots

Leave old architecture status unchanged and add a later closure/supersession note elsewhere.

Advantages:
- architecture files never change after architecture approval.

Risks:
- stale gate text remains directly contradictory;
- maintainers opening the architecture document still receive wrong authorization guidance;
- closure records become required to interpret whether the architecture gate is obsolete;
- weakens source-of-truth clarity.

Assessment: reject.

## 6. Recommended architecture

**Option B — repair current projections + durable same-change synchronization rule.**

Core rule:

> Approval is one governance event. Architecture status, written-spec status, and implementation authorization are projections of that same event and must not disagree after the approval record is merged.

This is a documentation consistency contract, not a new approval authority.

## 7. Authority convergence

### Authority retained

- explicit user approval in the conversation / approved PR record;
- repository merge history as durable evidence;
- paired architecture/written-spec documents as human-readable projections.

### Authority retired

- the implicit practice that written-spec approval may update only the written-spec document while leaving the architecture gate stale.

### Duplicate-authority prevention

Do not create:

- a new JSON approval database;
- a release-version field for governance approval;
- a runtime approval flag;
- an automation that can self-approve.

The template rule is sufficient.

## 8. Target state model

For a paired architecture/written-spec cycle:

### State 1 — Architecture draft

Architecture:
- DRAFT / NOT APPROVED
- written spec not started
- implementation unauthorized.

### State 2 — Architecture approved

Architecture:
- ARCHITECTURE APPROVED
- WRITTEN SPEC IN PROGRESS
- implementation unauthorized.

Written spec:
- draft / awaiting approval.

### State 3 — Written spec approved

In the **same approval-record change**:

Architecture:
- ARCHITECTURE APPROVED
- WRITTEN SPEC APPROVED
- IMPLEMENTATION-TDD AUTHORIZED.

Written spec:
- WRITTEN SPEC APPROVED
- IMPLEMENTATION-TDD AUTHORIZED.

Both approval gates must agree.

### State 4 — Implementation/release complete

Closure record is the completion authority.

Architecture/written-spec documents do not need to rewrite historical technical content. They may retain the approved authorization status, while closure evidence records completion.

## 9. Current repair scope

Expected governance files:

- `docs/superpowers/plans/2026-10-11-issue-14-geometry-architecture.md`
- `docs/superpowers/plans/2026-10-11-issue-15-artifact-abort-architecture.md`
- `docs/superpowers/plans/TEMPLATE-tasun-architecture-written-spec.md`

Potentially no changes are required to the already-correct written specs.

The implementation must not touch formal HTML pages.

## 10. Exact repair semantics

For Issue #14 and #15 architecture documents:

- keep architecture option, baseline SHA, authority analysis, and approval date unchanged;
- change status from written-spec-in-progress/unauthorized to written-spec-approved/implementation-authorized;
- check the written-spec approval boxes using the existing approval date;
- check implementation authorization;
- remove the obsolete sentence saying implementation remains unauthorized.

Do not mark a functional R-number.

## 11. Template guard

Add a durable section/rule to the architecture/written-spec template.

Required contract:

1. explicit written-spec approval is recorded;
2. paired architecture document status is updated in the same PR/commit;
3. architecture and written-spec gates are reviewed for parity before merge;
4. implementation branch may be created only after the synchronized approval record is merged to `main`;
5. implementation still branches from latest current `main`.

A reviewer should be able to detect a partial approval update by reading the diff.

## 12. Release impact

Docs-only governance change.

Expected behavior:

- no formal Exact Auto Release;
- no manual `tasun-version.json` change;
- no formal HTML build stamp change;
- normal PR regression required;
- disposable exact-release verification required as a non-publishing regression check.

If the existing workflow unexpectedly treats docs-only change as release-triggering, that is not authorized by this requirement and must be investigated rather than accepted as intended behavior.

## 13. TDD / verification plan

This requirement does not need runtime behavioral TDD.

Verification should be executable as documentation/governance regression.

### RED checks

Before repair, prove:

1. Issue #14 architecture says written spec pending while paired written spec says approved;
2. Issue #15 architecture says written spec pending while paired written spec says approved;
3. template lacks a same-change synchronization requirement.

### GREEN checks

After repair, prove:

1. Issue #14 architecture and written spec approval states agree;
2. Issue #15 architecture and written spec approval states agree;
3. template contains explicit same-change synchronization rule;
4. template still requires explicit user approvals;
5. template still requires latest-current-`main` implementation baseline;
6. no formal HTML or `tasun-version.json` file changed.

## 14. Acceptance criteria

- [ ] #14 architecture status matches its approved written spec.
- [ ] #15 architecture status matches its approved written spec.
- [ ] #14 architecture approval gate no longer says implementation unauthorized.
- [ ] #15 architecture approval gate no longer says implementation unauthorized.
- [ ] template requires paired architecture synchronization when written spec is approved.
- [ ] explicit user approval remains the approval authority.
- [ ] latest-current-`main` implementation rule remains unchanged.
- [ ] no runtime/formal-page/version changes.
- [ ] full regression GREEN.
- [ ] disposable exact-release verification GREEN.

## 15. Approval gate

Architecture:

- [ ] user approved Option B

Written spec:

- [ ] completed after architecture approval
- [ ] explicitly approved by user

Implementation:

- [ ] authorized only after written-spec approval

Until architecture is explicitly approved, no governance implementation branch/change is authorized beyond this architecture draft.
