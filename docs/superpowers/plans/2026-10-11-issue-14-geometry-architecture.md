# Issue #14 — Geometry Dirty Scheduling / Retry Architecture Draft

Date: 2026-10-11  
Requirement: GitHub Issue #14 — `[REQ] Geometry dirty scheduling and retry convergence`  
Functional R-number: NOT ASSIGNED  
Status: ARCHITECTURE APPROVED / WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED

## 1. Baseline authority

Architecture tracing baseline:

`main @ 47b7a75b94cfea648f0155f7129ac34f976acf2b`

Implementation, if later approved, must branch from the latest current `main` at written-spec approval time, not from this draft branch.

## 2. Verified problem definition

PR #6 Codex review identified two geometry convergence risks:

1. `r1144MarkGeometryDirty()` marks geometry dirty/pending but may not itself enqueue the existing geometry scheduler.
2. `r1113RequestGeometry()` may return false when `r1113UserRecentlyActive()` is true; if the heavy-lane job is then cleared without requeue, dirty geometry may remain unresolved.

Observed impact path includes Search / Show All and post-format geometry updates.

## 3. Existing authority contract

Current regression tests establish:

- `r1113RequestGeometry` is the single scheduler allowed to own exact sizing.
- Exact commit remains delegated through `r1065CommitExactGeometryIfIdle`.
- Public scroll bridge exposes:
  - `markGeometryDirty:r1144MarkGeometryDirty`
  - `requestGeometry:r1113RequestGeometry`
- Public bridge must not expose exact commit internals.
- Search / Show All cancel pending heavy geometry before semantic commit.
- Show All success requires semantic terminal parity.
- Current SelfHeal must validate/repair through public bridge only and must not call private geometry symbols.
- Critical paths must not use `setInterval` polling.
- R1122 lifecycle transitions invalidate pending HeavyLane work and old render tickets.

Therefore any fix must preserve one scheduler authority and must not move exact sizing into SelfHeal or create a parallel scheduler.

## 4. Architecture options

### Option A — Repair only known callers

Keep `r1144MarkGeometryDirty` as a pure marker. Update every currently known post-format caller so it calls `requestGeometry` after marking dirty. Separately update the recent-activity path inside `r1113RequestGeometry` to requeue/defer.

Advantages:
- smallest local changes;
- marker semantics remain unchanged.

Risks:
- future or currently missed marker-only callers can reintroduce stale geometry;
- correctness depends on every caller remembering a two-step protocol;
- duplicates orchestration responsibility across callers.

Assessment: not preferred.

### Option B — Dirty marker converges into the existing scheduler

Preserve `r1113RequestGeometry` as the one exact geometry scheduler, but make the public dirty operation guarantee eventual scheduling through that existing authority.

Implementation shape, if approved:

1. introduce or retain a private mark-only primitive that only sets dirty/pending/quality flags;
2. `r1113RequestGeometry(reason)` uses the mark-only primitive, then schedules the existing HeavyLane geometry job;
3. public `r1144MarkGeometryDirty(reason)` performs mark-only state mutation and requests the existing `r1113RequestGeometry` scheduler in a recursion-safe/coalesced way;
4. when recent-user-activity prevents geometry work, preserve the dirty state and requeue/defer through the same HeavyLane scheduler rather than returning terminally and dropping the job;
5. lifecycle invalidation remains authoritative: HIDDEN / BF_CACHE_SUSPENDED / auth changes may cancel stale queued work, and only a valid current lifecycle may requeue.

Advantages:
- every formal dirty operation converges toward one scheduler;
- no caller-specific two-step contract;
- no second scheduler;
- preserves public bridge abstraction;
- future marker-only callers remain safe.

Risks:
- must prevent `markGeometryDirty → requestGeometry → markGeometryDirty` recursion;
- must preserve reason coalescing and HeavyLane cancellation semantics;
- must avoid requeue loops while user remains active.

Assessment: **RECOMMENDED**.

### Option C — Let SelfHeal consume dirty flags

Keep marker and scheduler unchanged; teach current SelfHeal to detect dirty geometry and call the public request path.

Advantages:
- minimal caller changes.

Risks:
- moves normal scheduling correctness into repair logic;
- can delay Search / Show All terminal completion until SelfHeal cadence;
- risks turning SelfHeal into a second scheduling authority;
- conflicts with R1144 direction that current SelfHeal validates/repairs through bounded public controls rather than owning exact scheduling.

Assessment: reject.

## 5. Recommended architecture

**Option B — APPROVED by user on 2026-10-11.**

Core rule:

> Marking formal geometry dirty must guarantee eventual convergence through the existing `r1113RequestGeometry` scheduler, while exact geometry commit remains owned by the existing exact authority. Recent activity may defer work but may not silently drop it.

No second scheduler, no polling, no direct exact commit from public callers, and no SelfHeal-owned geometry loop.

## 6. Proposed authority convergence

Authority retained:

- dirty state: existing R1113/R1144 geometry dirty state;
- scheduling: `r1113RequestGeometry`;
- HeavyLane arbitration: existing `r1113HeavyLaneSchedule`;
- exact commit: `r1065CommitExactGeometryIfIdle`;
- terminal validation: existing verify / semantic parity path;
- lifecycle invalidation: R1122 lifecycle authority.

Authority to retire:

- the implicit assumption that callers may safely stop after mark-only dirty state;
- the behavior where recent-activity deferral can become terminal job loss.

Legacy/private exact commit paths remain retired.

## 7. Call chain

Recommended target chain:

`post-format/Search/Show All effect`
→ `public markGeometryDirty(reason)`
→ `private mark-only state update`
→ `existing requestGeometry(reason)`
→ `existing HeavyLane geometry lane`
→ if recent activity: bounded defer/requeue through same lane
→ `r1065CommitExactGeometryIfIdle`
→ verify
→ quality ready / projection seal
→ semantic terminal success.

Lifecycle cancellation remains able to invalidate stale work before commit.

## 8. Failure / defer / retry contract

Recent user activity:
- may defer geometry work;
- must keep dirty state true;
- must schedule a bounded future retry/defer through the same scheduler authority;
- must coalesce duplicate geometry reasons/jobs;
- must not spin or poll.

Lifecycle invalidation:
- hidden/BFCache/auth-revision invalidation cancels stale queued work;
- cancelled stale work must not later commit;
- a new valid lifecycle/request may create new work.

Geometry verify failure:
- use existing bounded second-round / verification behavior;
- do not add an independent retry loop.

## 9. SelfHeal boundary

Current SelfHeal may:
- detect failure of the public geometry contract;
- invoke bounded public bridge controls according to the approved contract;
- verify recovery.

Current SelfHeal must not:
- call `r1065CommitExactGeometryIfIdle` directly;
- call private measurement/commit internals;
- own an independent scheduler;
- poll indefinitely.

## 10. Data / permission / UI contract

No intended changes to:

- uid / rev / updatedAt / deleted;
- formal rows;
- permissions;
- sync authority;
- statistics formulas;
- visible UI layout;
- Search / Show All semantic meaning.

Only geometry scheduling convergence changes.

## 11. Release impact

Expected implementation touches formal HTML/embedded JS and is release-triggering.

If implemented:
- Exact Auto Release required;
- four-page release artifact required;
- build sequence parity required;
- SHA parity required;
- deployed four-page verification required.

`tasun-version.json` remains sole release-version authority.

## 12. RED test plan

Before implementation, tests should demonstrate:

1. a marker-only formal dirty path eventually schedules the existing geometry authority;
2. the current pre-fix behavior fails this expectation;
3. recent-user-activity deferral does not drop dirty geometry;
4. duplicate dirty requests coalesce rather than create a second scheduler;
5. lifecycle invalidation still cancels stale queued work;
6. Search / Show All terminal parity does not depend on unrelated resize/navigation.

Existing R1144/R1122 tests remain regression constraints.

## 13. GREEN implementation boundary

Minimum intended authority changes:

- `汐東收發文明細表.html` only, unless tracing proves another formal page duplicates this authority;
- existing dirty marker / requestGeometry / HeavyLane path only;
- tests covering the approved contract.

Do not modify unrelated UI/data/cloud logic.

## 14. Acceptance criteria

- [ ] every formal geometry dirty path guarantees eventual scheduling through one existing scheduler;
- [ ] recent activity defers rather than drops geometry work;
- [ ] no recursion between dirty marker and requestGeometry;
- [ ] duplicate geometry requests are coalesced/bounded;
- [ ] lifecycle invalidation still prevents stale work commits;
- [ ] Search / Show All reaches terminal parity without unrelated triggers;
- [ ] no polling;
- [ ] no second scheduler;
- [ ] no public exact-commit internals;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] formal release + four-page SHA verification after merge.

## 15. Approval gate

Architecture status:

- [x] user approved Option B

Written spec:

- [x] completed after architecture approval
- [x] explicitly approved by user on 2026-10-11

Implementation / TDD:

- [x] authorized by user on 2026-10-11

Written-spec approval is complete and implementation/TDD was authorized. Issue #14 has since completed implementation, formal release, deployed verification, and closure; closure evidence remains in Issue #14 and repository history.
