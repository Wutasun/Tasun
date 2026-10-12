# Issue #44 — Dropdown Critical-Path Rescan + Saved-Detail Handoff Architecture

Status: **APPROVED**
Approval: user explicitly approved **Option A** on 2026-10-12.
Functional R-number: **NOT ASSIGNED**
Implementation authority: **YES — implementation/TDD authorized after governance PR merge**

## 1. Baseline

Authoritative implementation baseline:

- Repository: `Wutasun/Tasun`
- Branch: `main`
- Baseline commit: `48e170632f0d66c537267cbf12eab07830178a11`
- Formal build: `20261012_tasun_v5_xidong_docs_r1150_84d0951c475b_release`
- Release sequence: `1150`
- Version authority: `tasun-version.json`

User-provided R1150 files and current `main` agree on the formal build identity.

## 2. Problem statement

The 2026-10-12 15:22 reproduction video and the R1150 source establish three connected defects:

1. Detail-page search dropdowns may pause before opening.
2. Register-page dropdowns may pause before opening.
3. A register save may complete locally and produce the existing “saved / leave?” decision UI, but the subsequent same-tab handoff to the detail page can still be intercepted by the generic unload guard or fail the detail visible-gate even when the exact saved identity exists.

These are not separate UI redesign requests. They are authority/concurrency defects in the existing search projection, register dropdown projection, and saved-detail navigation handoff.

## 3. Root-cause trace

### 3.1 Detail search dropdown

Existing authority:

`R603/R787/R950`

Current click path:

`drop button click`
→ `r950RefreshSearchOptionList(index,false)`
→ cache lookup
→ on miss `r950ComputeSearchOptions`
→ `r603UniqueOptions`
→ `r603RowsForOption` and/or `r787DocumentEvents`
→ active formal rows / stage events scan

The existing idle prewarm is useful but not authoritative for click latency because cache miss still falls back to a synchronous full projection scan in the input event path.

### 3.2 Register dropdown

Existing authority:

`R953/R715`

Current open path:

`r715CreateCombo button click`
→ `render("")`
→ `source()`
→ cached source
→ on miss `r953CachedRegisterFieldOptions`
→ `r844FieldOptionValues`
→ active rows + stages + supervisor replies + legacy compatibility scan

Current warm-up only covers a subset of fields. First open of other fields may still perform the expensive scan in the click path.

Current invalidation is also over-broad:

`r953InvalidateRegisterProjection`
clears both:
- field option cache
- parent option cache

A field-specific option-store mutation can therefore destroy unrelated parent projection state and recreate first-open latency.

### 3.3 Saved-detail navigation

Existing save authority:

`R1061`

Existing same-tab handoff:

`r950LeaveRegisterForSavedDetail`
→ refresh exact canonical single-row transport
→ build exact locator URL
→ `location.replace(...)`

Existing generic departure guard:

`beforeunload`
blocks when:
- form is unsaved, or
- local mutation marker exists, or
- sync is pending, or
- cloud round-trip has not yet reached verified terminal state.

After a valid R1061 local application commit + canonical transport readback, this generic guard conflicts with the user's explicit “Yes, leave to detail” action.

Detail visible-gate also compares the business document number as surface text while register identity resolution already uses canonical document-number keys. Exact UID locator can therefore exist while the visible gate rejects a formatting-equivalent document number.

## 4. Approved architecture — Option A

### 4.1 Detail search projection authority

Keep **R603/R787/R950** as the only search-option authority.

Change the existing projection behavior so that:

- one data epoch + one criteria snapshot produces one cooperative option projection;
- projection state stores only bounded deduplicated strings / compact signatures;
- no rows, stages, replies, DOM nodes, Response objects, or second formal dataset are cached;
- criteria changes invalidate only dependent projections and cancel obsolete prewarm work by token/generation;
- dropdown click reads already-prepared projection only;
- cache-miss handling from a click must not synchronously call full formal-row/stage scanning;
- incomplete projection may schedule cooperative preparation, but the user interaction path must remain bounded and non-blocking.

The current option calculation functions remain the semantic authority; they are moved out of the click critical path rather than replaced by a second algorithm.

### 4.2 Register dropdown projection authority

Keep **R953/R715** as the only register-dropdown projection/render authority.

Refine it to two invalidation scopes:

1. **formal rows business epoch**
   - invalidates all field projections and parent-document projections.

2. **single field option-store epoch**
   - invalidates only that field's option projection.
   - does not invalidate the parent-document projection unless the parent source itself changed.

After register form build/rebuild:

- cooperatively prewarm the actual visible dropdown fields;
- parent-document projection is warmed separately by its own source key;
- click/open path may filter an existing string/metadata projection;
- click/open path must not execute an active-row/stage/reply full scan.

No duplicate option source, no second dropdown renderer, and no long-lived formal-row cache may be introduced.

### 4.3 Saved-detail handoff

Keep **R1061** as the sole save transport authority.

After:
- application row commit succeeds, and
- canonical single-row transport validates/readbacks successfully, and
- save-complete modal is shown,

the user's explicit **Yes** action may arm a **single-use scalar trusted saved-detail navigation flag**.

That flag:

- is valid only for the exact saved-detail same-tab navigation;
- is consumed/cleared immediately by the navigation path / unload decision;
- only bypasses the generic `beforeunload` confirmation for that one trusted transition;
- must not clear the local mutation marker;
- must not set cloud verified;
- must not bypass background `Read → necessary Merge → Readback`;
- must not bypass unsaved form protection for any other navigation;
- must not add polling or another navigation watcher.

The detail-page visible identity gate is aligned with the existing canonical business-key contract:

- docNo: canonical key equality;
- rowUid: exact;
- stageUid: exact when present;
- replyUid: exact when present.

Transport consumption remains under the existing R1083 terminal:

- formal row committed,
- table render complete,
- exact target found in formal DOM by existing reveal logic,
- only then consume transport.

## 5. Authority map

| Concern | Sole authority after change |
|---|---|
| Detail search state | existing R603/R787 |
| Detail search option projection | existing R950 |
| Formal detail rows | existing detail `rows` authority |
| Register dropdown rendering | existing R715 |
| Register option projection/cache | existing R953 |
| Register formal rows | existing register `rows` authority |
| Register save commit/transport | existing R1061 |
| Detail saved transport visibility/consume | existing R1083 + current reveal path |
| Cloud synchronization | existing sync authority |
| Version/release | `tasun-version.json` + existing release workflow |

No new authority is permitted.

## 6. Explicit non-goals

Do not:

- redesign UI;
- change field names, button names, permissions, role behavior, or form layout;
- change `uid/rev/updatedAt/deleted`;
- change row schema;
- change statistics formulas;
- change document-manager business logic;
- create a second rows array, renderer, search engine, option source, sync engine, or handoff watcher;
- manually write a new formal R build into `tasun-version.json`;
- use `setInterval` or unbounded polling;
- weaken normal unsaved/unverified departure protection beyond the exact saved-detail transition.

## 7. Failure behavior

### Projection preparation failure

- keep controls usable;
- do not block the click path with synchronous full-data recovery;
- record bounded scalar diagnostics;
- allow existing cooperative retry/rebuild authority;
- do not retain failed large intermediate structures.

### Trusted navigation failure

- if exact saved target cannot be resolved or transport refresh fails, do not arm trusted bypass;
- keep current user-visible warning;
- generic unload guard remains active.

### Detail target not visible

- do not consume transport;
- leave existing bounded startup/post-visible/terminal paths able to retry visibility;
- no infinite retry.

## 8. SelfHeal boundary

Current SelfHeal must verify the **existing authority contracts**, not implement a replacement:

- detail dropdown click has no synchronous full option scan;
- cooperative projection token/generation is bounded;
- register projection invalidation is scoped;
- register dropdown click reads projection only;
- saved-detail bypass is one-shot scalar state;
- bypass does not mutate cloud verification/mutation state;
- R1083 still owns final consume-after-visible behavior.

Repair must delegate to existing projection/rebind paths and must not rebuild a second data authority.

## 9. Release impact

Implementation is release-triggering because it modifies formal HTML pages:

- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`

`汐東文件統計表.html` and `汐東文件管理表.html` business logic are out of scope. They may only receive release-identity synchronization if required by the existing exact four-page release process.

## 10. Approval record

Architecture option A: **APPROVED**.

Next gate:
- written spec completed;
- user explicitly approved the written spec on 2026-10-12;
- implementation/TDD is authorized after the synchronized governance PR is merged to `main`.
