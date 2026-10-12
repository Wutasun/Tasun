# Issue #44 — Written Specification
## Eliminate dropdown critical-path rescans and preserve saved-detail handoff

Status: **WRITTEN SPEC APPROVED — IMPLEMENTATION/TDD AUTHORIZED AFTER GOVERNANCE MERGE**
Architecture: **Option A approved**
Functional R-number: **NOT ASSIGNED**
Implementation authority: **YES AFTER GOVERNANCE PR MERGE**

## 1. Authoritative baseline

Implementation must start from the latest `main` at the moment the user approves this written spec.

Current written-spec baseline:

- Repository: `Wutasun/Tasun`
- Commit: `48e170632f0d66c537267cbf12eab07830178a11`
- Formal build: `20261012_tasun_v5_xidong_docs_r1150_84d0951c475b_release`
- releaseSequence: `1150`
- sole release/version authority: `tasun-version.json`

Before implementation, fetch latest `main` again. If the relevant R603/R787/R950, R953/R715, R1061/R1083, unload-guard, or release authority changed after this baseline, stop and reconcile the written spec before editing.

## 2. Production scope

### Required production files

1. `汐東收發文明細表.html`
2. `汐東收發文登錄表.html`

### Release-identity-only files, if the existing exact four-page release process updates them

3. `汐東文件統計表.html`
4. `汐東文件管理表.html`
5. `tasun-version.json`
6. `TASUN_REBUILD`
7. `TASUN_REBUILD_STAMP`

The latter release identity files must be produced by the existing authorized release process, not hand-edited as an implementation shortcut.

### Tests

Add:

- `tests/issue-44-dropdown-save-handoff.test.cjs`

Do not modify unrelated tests unless an existing regression test contains an intentionally superseded contract that must be updated. If so, document the exact old assertion and why it conflicts with this approved spec.

## 3. Explicit out-of-scope behavior

No change to:

- UI visual design;
- form field order/layout;
- button names;
- roles/permissions;
- formal row schema;
- `uid/rev/updatedAt/deleted`;
- statistics formulas;
- document-manager business logic;
- cloud resource keys / db names / table IDs;
- single-flight sync authority;
- Read → necessary Merge → Readback;
- current exact release algorithm;
- authentication/login inheritance.

No second:
- rows authority;
- search authority;
- dropdown renderer;
- option semantic source;
- sync authority;
- saved-navigation watcher;
- width/geometry authority.

No `setInterval`, unbounded polling, repeated global timers, or click-time full-data rescue scan.

## 4. Detail search dropdown specification

### 4.1 Existing authority to modify

Modify the current R603/R787/R950 chain in-place:

- `r603RowsForOption`
- `r603UniqueOptions`
- `r787ScheduleSearchOptionRefresh`
- `r787CommitSearchInput`
- `r950SearchOptionCache`
- `r950SearchCriteriaSignature`
- `r950ComputeSearchOptions`
- `r950RefreshSearchOptionList`
- `r950ScheduleSearchOptionPrewarm`
- `buildR603DetailSearchForm`
- current R950/SelfHeal contract checks that cover search option performance

Helper functions may be introduced **inside this same R950 authority**, but they must not become a second semantic option source.

### 4.2 Required data model

Search option projection may retain only:

- field index;
- data/projection epoch;
- criteria signature;
- bounded arrays of deduplicated strings;
- ready/pending/scalar timing state.

It must not retain:

- formal row objects;
- stage objects;
- supervisor reply objects;
- cloned formal arrays;
- DOM nodes beyond the existing datalist;
- complete diagnostic payloads.

The current `R950_SEARCH_CACHE_MAX` bounded-cache concept remains.

### 4.3 Cooperative projection rule

For one current data epoch and one current criteria snapshot:

- expensive semantic scanning may run only in cooperative prewarm/projection work;
- stale work is cancelled/ignored by token/generation;
- criteria change invalidates only dependent field projections;
- each field projection must preserve current cascade semantics.

Current semantic behavior must remain:

- direction options include system defaults and values found in document events;
- document-number options obey selected direction;
- later fields obey all prior selected criteria;
- sorting/dedup semantics remain current Traditional-Chinese/numeric behavior.

### 4.4 Click critical path

The dropdown-button click handler in `buildR603DetailSearchForm` must:

1. capture the current draft criteria;
2. read an already-prepared projection/datalist;
3. focus/open the picker;
4. if projection is not yet ready, schedule existing cooperative preparation and return without executing a formal rows/stage scan synchronously.

Forbidden in the button click critical path:

- direct call that can descend to `r603UniqueOptions` on cache miss;
- `r603RowsForOption`;
- `r787DocumentEvents` full projection scan;
- whole-row normalization;
- sync/network work;
- geometry work.

The control must remain usable while preparation completes.

### 4.5 Focus/input/change behavior

- `focus`: may request cooperative preparation only; no synchronous full scan.
- `input/change`: update draft state, clear following criteria exactly as current behavior requires, invalidate dependent projection signatures, and schedule bounded cooperative preparation.
- no repeated scan for focus + click + change when the same signature is already ready.

## 5. Register dropdown specification

### 5.1 Existing authority to modify

Modify in-place:

- `r953RegisterProjectionEpoch`
- `r953RegisterFieldOptionCache`
- `r953RegisterParentOptionCache`
- `r953InvalidateRegisterProjection`
- `r953CachedRegisterFieldOptions`
- `r953CachedParentOptions`
- `r953ReleaseRegisterProjectionCaches`
- `r1048WarmRegisterDropdownCaches`
- `r715WriteStore` / `r715OptionRecord` invalidation call path
- `r715CreateCombo`
- `r923RegisterRenderIfBusinessChanged`
- current register performance SelfHeal contracts

Do not create a parallel combo component.

### 5.2 Invalidation scopes

The existing all-or-nothing invalidation must be split semantically inside the R953 authority.

Required scopes:

#### A. Formal rows business change

Triggered by actual formal rows business-state change.

Must invalidate:
- field option projections;
- parent-document projections;
- any visible-form projection signature that depends on formal rows.

`r923RegisterRenderIfBusinessChanged` remains the canonical trigger after formal rows business change.

#### B. Single option-store field mutation

Triggered by add/delete/update of one dropdown-option field.

Must invalidate:
- only that field's option projection;
- any open panel for that field may rerender from the updated projection.

Must not invalidate:
- unrelated field projections;
- parent-document projection, unless the changed field is itself a documented source dependency for the parent projection.

#### C. Full release/hidden cleanup

Existing visibility/pagehide cache release may clear all transient projections because the page is leaving/hidden. It must not preserve formal rows in the cache.

### 5.3 Form prewarm

After current register form build/rebuild:

- discover the actual visible editable combo fields already created by the existing form renderer;
- cooperatively warm their R953 projections;
- separately warm the current parent-document projection;
- use bounded idle/time-sliced work;
- obsolete generation is cancelled/ignored when rows/form epoch changes.

The prewarm must not hard-code only `文號`, `主旨`, `上階文號`.

### 5.4 Combo open critical path

When the existing `r715CreateCombo` button is clicked:

- close other panels as current behavior does;
- obtain already-prepared normalized option items;
- filter only the compact projection by the current query;
- build the existing dropdown DOM;
- mount/align/open the existing panel.

Forbidden from this click path:

- `r844FieldOptionValues` full rows/stages/replies scan on cache miss;
- `r916ParentDocumentOptions` full formal projection scan on cache miss;
- formal sync/network wait;
- full form rebuild.

If not ready:
- render a bounded “preparing/no ready projection” state using the existing panel;
- schedule cooperative preparation;
- replace contents when the same panel/generation is still current;
- do not freeze the click waiting for a full scan.

### 5.5 Semantic parity

Option content must remain identical to current business rules:

- system defaults preserved;
- stored active options preserved;
- tombstones respected;
- project option remains derived from official detail rows only;
- review/deadline special options preserved;
- all-stage same-title option union preserved;
- reply-unit multi-select semantics preserved;
- parent document options remain current active/latest/allowed-stage logic.

## 6. Register saved-detail navigation specification

### 6.1 Existing save authority

Keep:

- `saveRegister`
- `r1061CommitTransportFirst`
- `r1061WriteSaveTransport`
- `r950ResolveSavedDetailTarget`
- `r950ShowRegisterSaveComplete`
- `r950LeaveRegisterForSavedDetail`
- background `r1061ScheduleBackgroundSaveSync`

Foreground success condition remains:

- local application row committed;
- canonical transport ready/readback;
- exact saved target resolvable.

Cloud verified Readback is still background and is not fabricated.

### 6.2 Trusted saved-detail departure token

Implement one in-memory, one-shot scalar departure state **inside the existing save-complete/navigation controller**.

It may contain only compact scalar identity, for example:

- armed boolean/generation;
- exact rowUid;
- canonical docNo key;
- timestamp/expiry;
- consumed flag.

It must not contain a formal row object.

Arm only inside the explicit **Yes** path after:

1. target re-resolution succeeds;
2. canonical transport rewrite succeeds;
3. exact locator URL is ready;
4. immediately before `location.replace`.

If any step fails, do not arm.

### 6.3 Unload guard behavior

The existing `beforeunload` guard remains authoritative.

Normal behavior remains unchanged for:

- unsaved form;
- stage dirty state;
- local mutation;
- pending/unverified cloud state;
- arbitrary links;
- reload;
- close tab/window;
- file-manager navigation;
- project-manager navigation.

Exception:

- when the one-shot trusted saved-detail departure state matches the exact current saved target and is within its short validity window, the guard allows that one departure without prompting.

The bypass must not:

- clear `r1089` local mutation marker;
- alter `__TASUN_REGISTER_R852_ROUNDTRIP_STATE__` to verified;
- cancel background sync;
- set a fake receipt;
- suppress future guards;
- survive unrelated navigation.

Consume/clear it on the actual departure path and clear it on navigation failure/pagehide as appropriate.

### 6.4 Background cloud contract

After local save:

- `r1061ScheduleBackgroundSaveSync` still runs.
- Read → necessary Merge → Readback remains required.
- local mutation stays present until the existing verified cloud path clears it.
- “trusted navigation” means only “do not show the generic browser leave confirmation for this exact saved-detail transition”; it does not mean “cloud verified”.

## 7. Detail saved-target visibility specification

### 7.1 Existing authority to modify

Modify `r1058TargetVisible` in-place.

Current identity requirements remain:

- rowUid exact;
- stageUid exact when supplied;
- replyUid exact when supplied.

Change only business document-number comparison:

- compare with the existing current canonical document value-key behavior (same normalization family already used by the page, e.g. current `r715ValueKey`/canonical text key);
- do not weaken UID identity matching;
- do not fall back to arbitrary text search if UID locator fails.

### 7.2 Transport consume terminal

Keep `r1083FinalizeTransportAfterVisibleRender` as the consume terminal.

Transport must not be consumed until all are true:

1. exact transport row is committed in formal rows;
2. `r1058TargetVisible` passes;
3. formal table render complete;
4. existing `r832RevealSearchedDocNo(... requireExactDocNo:true)` succeeds in current formal DOM.

If not ready:
- retain transport;
- allow existing startup/post-visible/terminal render paths to try again;
- no new polling loop.

## 8. SelfHeal specification

SelfHeal must verify contracts, not implement duplicate behavior.

### Detail current SelfHeal must assert

- search option cache is bounded and string-only;
- click handler cannot synchronously descend to full formal option scan;
- focus only schedules cooperative work;
- stale prewarm generation is bounded/cancellable;
- no `setInterval`.

### Register current SelfHeal must assert

- field and parent projections are distinct invalidation scopes;
- rows business change invalidates both;
- field option-store mutation invalidates only that field;
- combo open does not synchronously execute full formal option source scan;
- trusted saved-detail departure is one-shot/scalar;
- bypass does not set verified or clear local mutation;
- existing R1061 transport + R1083 consume terminal remain in use;
- no `setInterval`.

Repair must delegate to existing cache invalidation/prewarm/bind paths only.

## 9. TDD plan

Implementation must follow **RED → GREEN**.

### 9.1 New test file

Create:

`tests/issue-44-dropdown-save-handoff.test.cjs`

Use Node `node:test` + `assert/strict`, consistent with existing repository tests.

### 9.2 RED assertions — detail search

At minimum, initial RED must prove current R1150 violates:

1. dropdown button click still directly invokes `r950RefreshSearchOptionList(idx,false)`, whose cache-miss chain can execute `r603UniqueOptions`;
2. click/focus contract has no explicit “projection ready only / schedule on miss” separation;
3. new Issue #44 current SelfHeal contract is absent.

GREEN must prove:

- click handler uses ready projection/open path and cannot call the full scan fallback;
- expensive scan function is reachable only from cooperative projection/prewarm path;
- criteria-change cascade semantics remain present;
- cache bounded/string-only/no formal row storage.

### 9.3 RED assertions — register dropdown

Initial RED must prove:

1. `r715CreateCombo` open path calls `render` → `source` and can synchronously reach `r844FieldOptionValues` / parent projection on miss;
2. `r1048WarmRegisterDropdownCaches` is hard-coded to only a subset of fields;
3. `r953InvalidateRegisterProjection` clears both field and parent caches for field-only option mutation.

GREEN must prove:

- open path reads prepared projection only;
- form prewarm derives actual visible combos;
- field-only invalidation is field-scoped;
- rows-business invalidation clears both projection classes;
- semantic option-source functions remain the sole calculators.

### 9.4 RED assertions — saved-detail handoff

Initial RED must prove:

1. `r950LeaveRegisterForSavedDetail` has no trusted one-shot departure arm;
2. generic `beforeunload` still blocks on mutation/pending/unverified even for explicit successful Yes navigation;
3. `r1058TargetVisible` compares docNo by raw trimmed exact equality.

GREEN must prove:

- Yes path arms exact one-shot trusted departure only after transport refresh success;
- unload guard exempts only that exact departure;
- guard still protects ordinary unsaved/unverified departure;
- bypass code does not clear local mutation or write verified status/receipt;
- detail docNo check uses canonical key;
- UID identity remains exact;
- R1083 consumes only after visible formal DOM.

### 9.5 Existing regressions

Run:

`node --test tests/*.test.*`

Expected:
- RED branch: exactly the new Issue #44 assertions fail for the intended missing behavior; unrelated existing tests remain GREEN.
- GREEN branch: all tests GREEN.

Do not “fix” RED by weakening the new assertions.

## 10. Implementation sequence

After user explicitly approves this written spec:

1. Fetch latest `main`; compare relevant authority regions to this spec.
2. Create implementation branch from latest `main`.
3. Add only `tests/issue-44-dropdown-save-handoff.test.cjs`.
4. Run full regression and capture expected RED evidence.
5. Modify `汐東收發文明細表.html` existing R603/R787/R950 and `r1058TargetVisible`/current SelfHeal.
6. Modify `汐東收發文登錄表.html` existing R953/R715, R1061 save-complete departure controller, unload guard, current SelfHeal.
7. Run targeted Issue #44 test.
8. Run full regression.
9. Run disposable exact release:
   - `TASUN_CHANGED_FILES=publish-version_tasun_project_autoscan.mjs node publish-version_tasun_project_autoscan.mjs`
   - `node publish-version_tasun_project_autoscan.mjs --verify-only`
   - rerun `node --test tests/*.test.*`
10. Perform scope diff:
    - no unrelated business/UI/data-contract changes;
    - no manual release-number hard-code;
    - statistics/manager business logic unchanged.
11. Independent review.
12. Merge only after GREEN/review.
13. Execute formal Exact Auto Release.
14. Verify deployed exact four-page build sequence and SHA.
15. Fresh-verify final `main` bytes and close Issue #44.

## 11. Performance acceptance

Because the user-visible defect is interaction delay, correctness is not enough.

Required qualitative acceptance:

- dropdown open event no longer performs a synchronous formal rows/stage/reply scan;
- no interaction handler waits on cloud sync;
- no new geometry work is introduced by this requirement;
- only compact option projections are filtered on open;
- stale projection work is bounded/cancellable.

Do not claim browser timing/E2E passed unless an actual browser run is performed and recorded.

## 12. Scope-diff acceptance

Expected production business changes are limited to:

### `汐東收發文明細表.html`
- existing search option projection scheduling/open behavior;
- existing detail saved-target canonical docNo equality;
- related current SelfHeal contract.

### `汐東收發文登錄表.html`
- existing register option projection cache/prewarm/invalidation/open behavior;
- existing save-complete same-tab departure guard integration;
- related current SelfHeal contract.

Everything else remains unchanged except authorized release identity generated by release automation.

## 13. Final acceptance checklist

- [ ] New Issue #44 test RED on implementation baseline.
- [ ] Detail click/focus no full formal option scan.
- [ ] Detail cascade option semantics preserved.
- [ ] Register first-open no synchronous formal option scan.
- [ ] Register prewarm covers actual visible combos.
- [ ] Field-only option invalidation does not clear parent projection.
- [ ] Rows business change invalidates field + parent projections.
- [ ] Explicit successful saved-detail Yes navigation bypasses only its own unload warning.
- [ ] Normal unsaved/unverified departure guard remains.
- [ ] Bypass does not clear mutation or fabricate cloud verification.
- [ ] Canonical docNo + exact UID visible gate works.
- [ ] Transport remains until visible formal DOM.
- [ ] No second rows/search/dropdown/sync/navigation authority.
- [ ] No `setInterval` / unbounded polling.
- [ ] `uid/rev/updatedAt/deleted` preserved.
- [ ] Full regression GREEN.
- [ ] Disposable exact-release verification GREEN.
- [ ] Scope diff clean.
- [ ] Independent review complete.
- [ ] Formal Exact Auto Release successful.
- [ ] Four-page deployed build/releaseSequence/SHA verified.
- [ ] Final fresh verification performed.

## 14. Approval gate

Current state:

- [x] Requirement intake recorded — Issue #44
- [x] Architecture Option A approved
- [x] Written spec completed
- [x] **User explicitly approved written spec on 2026-10-12**
- [x] Implementation / TDD authorized after governance PR merge

**User approval is recorded. Enter implementation/TDD only after the synchronized governance PR is merged to `main`, and branch from the then-latest `main`.**
