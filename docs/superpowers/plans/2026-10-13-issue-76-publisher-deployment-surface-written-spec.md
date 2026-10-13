# Issue #76 — Written Spec: Deployment-surface-aware Exact Publisher Normalization

Date: 2026-10-13  
Issue: #76 — `[REQ] Prevent exact publisher from restoring non-deployed tasun-api page authority`  
Approved architecture: **Option A**  
Blocker for: **Issue #73**  
Baseline main: `15355f24f0673ec958095bf9e0e8abb27f4be08c`  
Formal build at specification time: `20261012_tasun_v5_xidong_docs_r1154_425da05a1ae8_release`  
Release sequence at specification time: `1154`  
Status: **WRITTEN SPEC COMPLETE / PENDING EXPLICIT APPROVAL / NO IMPLEMENTATION AUTHORITY**

## 1. Goal

Fix the exact publisher so repository HTML that is intentionally excluded from GitHub Pages deployment cannot be promoted back into `tasun-version.json.pages` as public page authority.

The immediate regression is:

`pages["tasun-api/index.html"]`

even though `tasun-api/` is excluded from the deployed Pages artifact.

The fix must restore the Issue #56 A2 invariant and prevent recurrence.

## 2. Root-cause contract

Current publisher logic:
- treats changed HTML as release-relevant;
- expands the formal set with changed HTML;
- rebuilds manifest aliases for those HTML files;
- does not consult deployment exclusion topology before creating page authority.

Therefore a change to `tasun-api/index.html` can recreate a public manifest entry although that path is not deployed.

## 3. Single-source topology rule

The publisher must derive a deterministic deployment-exclusion predicate consistent with the actual Pages packaging rule.

At minimum:

- any path under `tasun-api/` is non-deployed;
- such source files may remain in the repository;
- they may still change for source/runtime reasons;
- they must never be represented as public page authority in `tasun-version.json.pages` or `pageArtifactManifest`;
- they must not be added to the formal HTML set used to generate public page aliases.

The implementation must not create a second unrelated hardcoded topology authority if an existing deploy exclusion list can be reused safely. If exact reuse is impractical, a narrowly-scoped helper in the publisher is allowed, but regression tests must prove it matches the active workflow exclusion for `tasun-api/`.

## 4. Authorized implementation scope

Manual implementation changes are authorized only in:

1. `publish-version_tasun_project_autoscan.mjs`
2. `tests/issue-76-publisher-deployment-surface.test.cjs`

No manual edit to `tasun-version.json` is authorized.

Normal workflow-generated release metadata after merge is allowed.

## 5. Explicit no-change boundary

Do not manually modify:

- `tasun-api/index.html`
- `tasun-resources.json`
- `tasun-cloud-kit.js`
- `tasun-cloudwrap-v4.js`
- `tasun-auth-v4.js`
- `tasun-api/worker.js`
- `index.html`
- `inline.js`
- `.github/workflows/release-version.yml`
- the four formal document pages
- current auth/session logic
- current cloud/storage schemas
- Pages deployment topology
- UI/layout/interaction logic

If implementation requires workflow topology or page source changes, stop and amend architecture.

## 6. Pre-implementation synchronization

Before RED:

1. synchronize to latest `main`;
2. verify `tasun-version.json.pages["tasun-api/index.html"]` still exists;
3. verify `tasun-api/index.html` source still exists;
4. verify active workflow packaging excludes `tasun-api/`;
5. verify Issue #56 A2 tests currently fail for this exact reason;
6. capture baseline blob SHAs for all locked files;
7. capture current build/releaseSequence.

If the regression has already been repaired by unrelated legitimate work, stop and reassess this Issue.

## 7. TDD RED contract

Create first:

`tests/issue-76-publisher-deployment-surface.test.cjs`

RED must reproduce two independent failure modes.

### Contract A — current manifest regression exists

Assert the current baseline incorrectly contains:
- key `tasun-api/index.html`, or
- any `pages` alias whose `file` begins with `tasun-api/`.

This proves current baseline is red.

### Contract B — publisher reintroduction simulation

In an isolated temp directory:

1. copy:
   - current publisher;
   - current `tasun-version.json`;
   - `TASUN_REBUILD`;
   - `TASUN_REBUILD_STAMP`;
   - workflow;
   - formal four pages;
   - `tasun-api/index.html`;
2. seed the temp manifest with no `tasun-api/*` authority;
3. invoke publisher with `TASUN_CHANGED_FILES=tasun-api/index.html`;
4. assert after execution:
   - no `pages` entry points into `tasun-api/`;
   - no `pageArtifactManifest` entry exists for `tasun-api/index.html`;
   - formal four page authority remains valid.

On current publisher this simulation is expected to fail because the publisher will recreate the forbidden authority.

### Contract C — deployment exclusion alignment

Read `.github/workflows/release-version.yml` and prove active Pages packaging excludes `tasun-api/`.

This contract should pass in RED and acts as a topology guard.

## 8. RED acceptance

Expected initial RED:
- current-manifest regression test FAILS;
- publisher reintroduction simulation FAILS;
- deployment exclusion alignment test PASSES.

Existing Issue #56 A2 tests are also expected to remain red before GREEN.

Record:
- RED tests-only commit SHA;
- workflow run ID;
- total/pass/fail counts;
- exact failures.

## 9. GREEN publisher behavior

Implement the minimum publisher change needed to satisfy all of the following:

### 9.1 Formal HTML selection

When collecting changed HTML:
- deployment-excluded HTML must not be added to the public formal set.

### 9.2 Manifest normalization

Before writing the next manifest:
- remove all `pages` entries whose resolved `file` is deployment-excluded;
- remove matching `pageArtifactManifest` entries for deployment-excluded files;
- remove matching `pageBuildStamp` entries if present.

### 9.3 Preserve source

Do not delete or mutate `tasun-api/index.html`.

### 9.4 Preserve canonical formal release contract

The four formal pages remain mandatory and continue to receive exact:
- build;
- releaseSequence;
- aliases;
- SHA;
- page build stamp.

### 9.5 Metadata-only cleanup behavior

When the only effective result is retiring forbidden manifest authorities and no formal/core source change requires a new release:
- preserve existing formal build;
- preserve releaseSequence;
- update only generated metadata required to restore the authority contract.

### 9.6 Changed excluded HTML behavior

When `tasun-api/index.html` itself changes:
- the publisher may classify the publisher/core change or other legitimate changes normally;
- but `tasun-api/index.html` must never become public page authority.

## 10. No manual manifest repair

Do not hand-edit `tasun-version.json` on the implementation branch as the fix.

The implementation must prove the publisher itself removes/prevents forbidden authority.

Any manifest change used in tests must occur only inside isolated temporary fixtures.

## 11. GREEN acceptance

After implementation:

- Issue #76 focused tests PASS;
- Issue #56 A2 regression tests PASS;
- `tasun-api/index.html` source remains;
- active Pages workflow still excludes `tasun-api/`;
- publisher cannot recreate `tasun-api/*` authority;
- formal four-page contract remains valid.

## 12. Full regression gate

Run the entire Tasun regression suite.

Required:
- all tests PASS;
- Issue #56 A2 tests GREEN;
- Issue #73 test-only branch blocker reason is eliminated at baseline level after merge;
- no unrelated existing regression is suppressed.

Record:
- run ID;
- test count;
- pass count;
- fail count.

## 13. Disposable exact-release gate

Run disposable exact-release verification using final implementation head.

Required:
- publisher successfully builds/verifies exact formal artifact;
- no forbidden `tasun-api/*` authority exists in disposable manifest;
- four formal pages verify exactly;
- no branch publication occurs.

## 14. Semantic diff gate

Expected manual diff is exactly:

Modified:
- `publish-version_tasun_project_autoscan.mjs`

Added:
- `tests/issue-76-publisher-deployment-surface.test.cjs`

No other manual file change is allowed.

## 15. Locked-file audit

Verify final head blob-identical to implementation baseline for all Section 5 locked files.

The only permitted generated differences are those produced by the normal post-merge release workflow on `main`.

## 16. Independent review

Request Codex review on final GREEN head.

Review focus:
- deployment exclusion predicate correctness;
- no accidental exclusion of legitimate formal HTML;
- no duplicate topology authority that can drift silently;
- manifest cleanup completeness across `pages`, `pageArtifactManifest`, and `pageBuildStamp`;
- metadata-only identity preservation;
- no manual version mutation;
- test simulation truly reproduces the original regression.

Valid findings may be fixed automatically if within approved scope.

## 17. Merge contract

Merge only when:
- RED evidence captured;
- focused GREEN;
- full regression GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- independent review clear;
- no unresolved valid review thread.

Squash merge using verified final head SHA.

## 18. Post-merge release expectation

Because `publish-version_tasun_project_autoscan.mjs` is a current core release authority, merging Issue #76 is release-relevant.

Normal Exact Auto Release may therefore generate the next formal release, expected to advance from R1154 according to actual publisher rules.

Do not manually assign or force an R-number.

## 19. Post-merge verification

After merge:

1. verify Exact Auto Release workflow terminal SUCCESS;
2. inspect autoscan classification;
3. record generated release metadata commit;
4. verify final build/releaseSequence;
5. verify `tasun-version.json` contains no `tasun-api/*` page authority;
6. verify `tasun-api/index.html` source still exists;
7. verify Pages deployment still excludes `tasun-api/`;
8. verify deployed four-page build/sequence/SHA;
9. rerun/confirm Issue #56 A2 regression is GREEN on final `main`.

## 20. Issue #73 unblock contract

Issue #73 may resume only after Issue #76 is fully merged and post-merge verification proves:

- current `main` regression suite is GREEN before Issue #73 production deletion;
- no `tasun-api/*` public manifest authority remains;
- Issue #56 A2 tests pass.

Then Issue #73 must:
- rebase/resynchronize from the repaired latest `main`;
- preserve its existing RED test intent;
- capture a fresh RED run where only the root `resources.json` absence test fails;
- continue to GREEN under its already-approved written spec.

No new Issue #73 architecture approval is required if its scope remains unchanged.

## 21. Closure evidence

Before closing Issue #76 record:

- architecture approval;
- written-spec approval;
- governance PR merge SHA;
- RED commit/run/counts;
- root-cause reproduction;
- final GREEN head;
- full regression result;
- disposable exact-release result;
- semantic diff;
- locked-file audit;
- Codex final review;
- implementation merge SHA;
- post-merge release run;
- generated metadata commit;
- final build/releaseSequence;
- proof `tasun-api/*` authority absent;
- proof source still present;
- proof Issue #56 A2 GREEN;
- proof Issue #73 is unblocked.

## 22. Governance gate

Current gate:
- [x] Architecture Option A explicitly approved by user on 2026-10-13
- [x] Written spec drafted
- [ ] Written spec explicitly approved by user
- [ ] Implementation / TDD authorized

**Next mandatory gate: explicit written-spec approval.**

Recommended decision:

`Issue #76 written spec 核准，進入 implementation / TDD`
