# Issue #14 — Geometry Dirty Scheduling / Retry Written Spec

Date: 2026-10-11  
Requirement: GitHub Issue #14 — `[REQ] Geometry dirty scheduling and retry convergence`  
Architecture: Option B — APPROVED  
Functional R-number: NOT ASSIGNED  
Status: WRITTEN SPEC DRAFT / AWAITING USER APPROVAL / NO IMPLEMENTATION AUTHORITY

## 1. Objective

Ensure every formal geometry-dirty path eventually converges through the existing single geometry scheduler without relying on unrelated resize/navigation events, while preserving the R1144 authority-convergence contract.

The fix must address two failure modes:

1. a caller may mark geometry dirty without reliably enqueueing geometry work;
2. the existing geometry job may encounter recent-user-activity protection and exit without preserving a future retry, leaving dirty state unresolved.

The implementation must preserve all existing UI, data, permission, synchronization, lifecycle, and release authorities unless this spec explicitly says otherwise.

## 2. Baseline and authority rules

Architecture tracing baseline:

`main @ 47b7a75b94cfea648f0155f7129ac34f976acf2b`

At implementation approval time, the implementation branch must be created from the latest current `main`, even if `main` has advanced through documentation-only governance commits.

Historical branches, PR branches, and prior release branches are reference-only.

The following authorities remain singular:

- geometry scheduling authority: `r1113RequestGeometry`;
- HeavyLane arbitration: `r1113HeavyLaneSchedule`;
- exact geometry commit authority: `r1065CommitExactGeometryIfIdle`;
- lifecycle invalidation authority: R1122 lifecycle transition logic;
- current SelfHeal authority: public-bridge-only R1144 current leaf;
- release version authority: `tasun-version.json`.

No second geometry scheduler, exact commit path, lifecycle owner, SelfHeal loop, or release authority may be introduced.

## 3. In-scope files

Primary expected implementation target:

- `汐東收發文明細表.html`

Expected test targets:

- existing `tests/r1144-authority-convergence.test.cjs`;
- existing `tests/r1122-lifecycle.test.cjs`;
- one new Issue #14-focused test file if needed for executable behavior coverage.

Other formal pages must not be modified unless implementation tracing proves they duplicate the same geometry authority and a change is required to maintain four-page consistency.

## 4. Explicit non-goals

This requirement does not change:

- visible UI design;
- table column definitions;
- row ordering;
- Search matching semantics;
- Show All semantic meaning;
- formal row identity;
- `uid`;
- `rev`;
- `updatedAt`;
- `deleted`;
- permissions;
- login inheritance;
- cloud data authority;
- dedupe rules;
- synchronization protocol;
- statistics formulas;
- release-version selection;
- exact artifact verification rules;
- current public prohibition on exposing exact commit internals.

It also does not authorize Issue #15 work.

## 5. Existing behavior contract

### 5.1 Public scroll bridge

The public scroll bridge currently exposes:

- `markGeometryDirty` → `r1144MarkGeometryDirty`;
- `requestGeometry` → `r1113RequestGeometry`.

The bridge must continue to expose control-level operations only.

It must not expose:

- `r1065RequestExactGeometry`;
- `r1065CommitExactGeometryIfIdle`;
- private measurement functions;
- private scheduler internals.

### 5.2 Existing exact geometry scheduler

`r1113RequestGeometry(reason)` remains the only normal-path scheduler for exact geometry.

It must continue to:

1. normalize/retain a geometry reason;
2. mark geometry state as pending/dirty;
3. schedule through the existing HeavyLane geometry lane;
4. measure geometry only when the lifecycle and interaction state permit;
5. delegate exact commit to `r1065CommitExactGeometryIfIdle`;
6. perform bounded verification / second-round behavior using the existing authority;
7. update quality-ready state;
8. update dirty/pending status from the final verification result.

### 5.3 Lifecycle authority

R1122 lifecycle invalidation continues to cancel stale HeavyLane work and invalidate stale render tickets.

The fix must not cause a cancelled HIDDEN / BF_CACHE_SUSPENDED / auth-stale job to later commit.

## 6. New required contract

### 6.1 Dirty means eventual scheduling

After this change, a formal call to public `markGeometryDirty(reason)` must guarantee:

- dirty state becomes pending;
- quality-ready becomes false as appropriate;
- the existing `r1113RequestGeometry` scheduler is requested;
- duplicate calls are coalesced by existing scheduler/HeavyLane semantics;
- exact sizing is still performed only by the existing exact authority.

A formal caller must no longer be required to know a fragile two-step protocol of:

`markGeometryDirty()` then separately `requestGeometry()`.

### 6.2 Private mark-only primitive

To prevent recursion, implementation should separate:

- a private mark-only primitive; and
- the public scheduling operation.

Required behavior:

- private mark-only primitive: state mutation only;
- `r1113RequestGeometry`: invokes mark-only primitive, then schedules;
- `r1144MarkGeometryDirty`: invokes mark-only primitive, then requests `r1113RequestGeometry` through a recursion-safe path.

The implementation may use a guard, internal option, or dedicated helper naming, but there must be no recursive loop:

`markGeometryDirty → requestGeometry → markGeometryDirty → ...`

## 7. Recent-user-activity defer contract

### 7.1 Current risk

When geometry work starts shortly after a click/keypress/interaction, the existing recent-activity guard may return false from the HeavyLane callback.

If the scheduler treats this as a terminal completion, dirty work may be dropped.

### 7.2 Required behavior

Recent user activity may delay heavy geometry work, but it must not terminate the geometry obligation.

When the recent-activity guard is true:

- do not perform heavy measurement;
- keep geometry dirty/pending;
- do not mark quality ready;
- request a bounded future retry through the same geometry scheduler authority;
- coalesce retries with existing pending geometry work;
- do not create polling;
- do not create an independent timer loop that bypasses HeavyLane;
- do not allow retry storms.

### 7.3 Retry timing

The retry mechanism must be bounded and interaction-friendly.

Preferred implementation behavior:

- defer until the existing recent-activity quiet window can expire;
- schedule through the same HeavyLane/requestGeometry path;
- at most one active deferred geometry obligation per geometry lane/coalesced reason family.

The implementation must not use `setInterval`.

A single bounded `setTimeout`, requestIdleCallback handoff, or existing HeavyLane rescheduling primitive is acceptable only if it re-enters the single `r1113RequestGeometry` authority rather than performing geometry itself.

## 8. Reason coalescing

Existing geometry reasons must remain diagnostic and bounded.

Requirements:

- repeated dirty calls during one active geometry obligation must not create unbounded queues;
- latest/aggregated reason semantics may be retained from existing implementation;
- reason handling must not affect formal data;
- reason coalescing must not suppress the fact that geometry remains dirty;
- terminal verification must clear pending only when geometry is actually verified.

No new reason-based second scheduler is allowed.

## 9. Search / Show All contract

Search and Show All remain semantic interaction operations.

Existing contract remains:

- pending heavy geometry is preempted before semantic commit;
- semantic rows/projection commit occurs first;
- geometry convergence follows through the single scheduler;
- Show All success occurs only after semantic terminal parity.

New requirement:

If Search/Show All causes geometry dirty state, terminal success must not require an unrelated resize, navigation, or later interaction to complete.

If recent-user-activity defers geometry:

- the interaction may remain in a pending terminal-seal state;
- geometry must automatically retry through the existing scheduler;
- once geometry verifies, terminal parity may complete normally.

## 10. Projection visibility contract

The frozen projection remains atomic:

- unsealed projection: hidden;
- verified/sealed projection: visible.

This requirement must not introduce intermediate partially visible exact-geometry states.

If geometry remains dirty due to deferred work, the existing projection-readiness contract remains authoritative.

## 11. Cancellation and stale-work contract

The following remain legitimate cancellation causes:

- lifecycle transition to HIDDEN;
- BF_CACHE_SUSPENDED;
- auth identity/role revision invalidation;
- newer projection/render generation superseding stale work;
- explicit Search/Show All preemption of pending heavy geometry.

For stale/cancelled work:

- it must not commit;
- it must not mark geometry verified;
- it must not reveal a stale projection;
- it must not force a retry if the lifecycle is not active.

When lifecycle becomes valid again, only a current valid request may schedule new geometry work.

## 12. SelfHeal contract

Current SelfHeal remains bounded and public-bridge-only.

SelfHeal may:

- detect that geometry public contract is not satisfied;
- request bounded public repair using the public bridge;
- verify recovery.

SelfHeal must not:

- measure geometry directly;
- call exact commit directly;
- schedule a private independent geometry loop;
- poll with `setInterval`;
- become the normal-path reason geometry eventually runs.

Normal-path scheduling correctness must be solved in the scheduler contract itself.

## 13. Performance contract

The fix must preserve interaction responsiveness.

Requirements:

- no synchronous heavy geometry on Search/Show All click path;
- no forced exact sizing from current SelfHeal;
- no geometry scheduling on native vertical scroll;
- no unbounded retry loop;
- no duplicate scheduler per caller;
- duplicate dirty signals must coalesce.

The recent-user-activity guard remains valid as a performance protection; only its terminal/drop semantics change.

## 14. TDD specification

Implementation must follow RED → GREEN.

### 14.1 RED — marker-only scheduling

Add an executable test that:

1. sets up the current geometry scheduling fixture;
2. invokes the public dirty operation without separately calling requestGeometry;
3. asserts that a geometry-lane job is eventually queued through the existing scheduler.

Pre-fix expectation: FAIL if marker-only does not schedule.

Post-fix expectation: PASS.

### 14.2 RED — recent activity does not drop work

Add an executable test that:

1. schedules geometry;
2. simulates recent user activity;
3. executes the queued geometry callback;
4. confirms heavy measurement/commit does not run immediately;
5. confirms dirty/pending state remains;
6. confirms a bounded future scheduler obligation exists.

Pre-fix expectation: FAIL if the callback simply returns false and no future work remains.

Post-fix expectation: PASS.

### 14.3 RED — recursion safety

Add a test that invokes public dirty scheduling and verifies:

- no recursive stack growth;
- no repeated immediate self-calls;
- only one scheduler lane obligation is active/coalesced.

### 14.4 RED — lifecycle cancellation

Extend or reuse R1122 lifecycle tests to verify:

- deferred geometry created before HIDDEN/BFCache/auth invalidation is cancelled;
- stale callback cannot commit after resume;
- new active-lifecycle geometry request can schedule fresh work.

### 14.5 RED — Search / Show All convergence

Add behavior assertions proving:

- Search and Show All still preempt old geometry before semantic render;
- newly dirty post-render geometry is scheduled;
- terminal parity no longer depends on an unrelated resize/navigation trigger.

### 14.6 Existing regression constraints

Existing tests must continue passing, including:

- R1144 public bridge test;
- R1144 single exact scheduler ownership;
- R1144 no polling;
- R1144 Show All semantic parity;
- R1144 Search/Show All preemption;
- R1144 projection visibility atomicity;
- R1144 SelfHeal public-bridge-only;
- R1144 native vertical scroll isolation;
- R1122 lifecycle invalidation;
- R1122 auth revision invalidation;
- R1122 BFCache resume-only contract.

## 15. Implementation shape

The implementation should be minimal and localized.

Expected structure:

1. add/rename a private mark-only helper around the current dirty-state mutation;
2. update `r1113RequestGeometry` to use mark-only helper;
3. update public `r1144MarkGeometryDirty` to guarantee scheduling through `r1113RequestGeometry`;
4. update recent-activity guard handling so the obligation is deferred/requeued rather than dropped;
5. add tests;
6. do not modify unrelated render/data/sync logic.

No caller-wide rewrite should be required if the public dirty contract becomes reliable.

## 16. Implementation invariants

The implementation is invalid if any of the following occurs:

- `forceExactSizing:true` is reintroduced;
- public bridge exposes exact commit internals;
- SelfHeal directly calls private geometry internals;
- a second scheduler function becomes authoritative;
- `setInterval` is introduced in the critical path;
- native vertical scroll schedules exact geometry;
- Search/Show All semantic behavior changes;
- lifecycle cancellation no longer invalidates stale work;
- formal data identity changes;
- release version is manually hardcoded.

## 17. Verification sequence

Before PR:

1. new Issue #14 tests GREEN;
2. existing R1144 tests GREEN;
3. existing R1122 lifecycle tests GREEN;
4. full Tasun regression GREEN;
5. embedded script syntax checks GREEN;
6. disposable exact-release verification GREEN.

Before merge:

7. independent review for duplicate authority / recursion / retry storms;
8. confirm only approved files changed;
9. confirm no manual `tasun-version.json` edit.

After merge, because formal HTML is expected to change:

10. Exact Auto Release must run;
11. build/deploy jobs must succeed;
12. four formal pages must share the expected build sequence;
13. deployed SHA verification must succeed;
14. closure/delivery record must be created.

## 18. Acceptance criteria

The requirement is complete only when all are true:

- [ ] public formal `markGeometryDirty` guarantees eventual scheduling;
- [ ] `r1113RequestGeometry` remains the single scheduler;
- [ ] exact commit authority remains `r1065CommitExactGeometryIfIdle`;
- [ ] recent activity defers but never silently drops geometry work;
- [ ] retries are bounded/coalesced and non-polling;
- [ ] recursion is impossible;
- [ ] lifecycle invalidation cancels stale deferred geometry;
- [ ] Search / Show All reaches terminal parity without unrelated triggers;
- [ ] projection visibility remains atomic;
- [ ] current SelfHeal remains public-bridge-only and bounded;
- [ ] no UI/data/permission/sync semantics change;
- [ ] all new tests GREEN;
- [ ] full regression GREEN;
- [ ] disposable exact release GREEN;
- [ ] formal release succeeds after merge;
- [ ] four-page deployed SHA verification succeeds.

## 19. Approval gate

Architecture:

- [x] Option B approved by user on 2026-10-11

Written spec:

- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after written spec approval

Until the written spec is explicitly approved, no implementation branch, runtime change, functional R-number, or production release is authorized.
