# Issue #56 — A2 Amended Written Spec: Pages-deployment authority convergence

Date: 2026-10-12  
Requirement: GitHub Issue #56 — `[REQ] Retire orphan manifest page authorities`  
Approved amendment architecture: **Option A2**  
Functional R-number: **NOT ASSIGNED**  
Status: **AMENDED WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED**  
Implementation authority: **AUTHORIZED after governance PR #59 merge**

## 1. Objective

Complete Issue #56 by making `tasun-version.json.pages` describe the actual GitHub Pages deployment surface, not merely files that exist somewhere in the repository.

The original Option A correctly removed three repository-missing authorities. Post-merge artifact verification then proved one remaining mismatch:

`pages["tasun-api/index.html"]`

The source file exists in the repository but the formal Pages workflow excludes the entire `tasun-api/` directory. Therefore this entry must no longer be classified as a deployable page authority.

Option A2 retires only that manifest page authority while preserving the repository source, backend code, workflow exclusion, supported pages, and R1152 release identity.

## 2. Authoritative baseline

Implementation must synchronize to the latest `main` immediately before RED work begins.

Known post-Option-A baseline at amendment drafting time:

- repository: `Wutasun/Tasun`
- main: `f878249cdaf72ada51ba86b559a44b4226206097`
- formal build: `20261012_tasun_v5_xidong_docs_r1152_70f1b5421b9c_release`
- releaseSequence: `1152`
- manifest page count: `42`
- Issue #56 implementation merge: `2b65d4fa400cf889664a8a2c7284a02118379e6b`
- post-merge release run: `38248451114`
- verified Pages artifact: `11746905417`

If unrelated work legitimately advances `main` before implementation, do not hard-code the SHA, build, sequence, or page count above. Re-baseline first and preserve the then-current legitimate formal identity.

## 3. Defect definition

A `tasun-version.json.pages` entry is a valid public page authority only when its declared `file`:

1. exists as a repository source path; and
2. is included in the GitHub Pages deployment surface produced by the formal release workflow.

Current defect:

- key: `tasun-api/index.html`
- declared file: `tasun-api/index.html`
- repository source: present
- Pages artifact: absent
- exclusion cause: workflow excludes `tasun-api/`
- public manifest authority: present

This is an authority-classification mismatch, not a missing source-file defect.

## 4. Approved production change

After explicit approval of this amended written spec, manual implementation may change only:

1. `tasun-version.json`
   - remove exactly `pages["tasun-api/index.html"]`;
2. `tests/issue-56-orphan-manifest-authorities.test.cjs`
   - replace the obsolete nested-authority control with source-preservation + non-deployable-authority rejection;
   - add deployment-surface validation required by A2.

No other manual production, runtime, workflow, page, backend, or release-publisher file modification is authorized.

## 5. Exact manifest mutation contract

Parse `tasun-version.json` as JSON and delete exactly:

`manifest.pages["tasun-api/index.html"]`

No other `pages` key may be removed or altered as part of A2.

Do not manually alter:

- root `version`;
- root `cacheV`;
- root `buildStamp`;
- root `rebuildStamp`;
- root `releaseSequence`;
- `release.releaseSequence`;
- any canonical formal-page authority;
- `pageArtifactManifest`;
- `pageBuildStamp`;
- unrelated metadata.

Expected semantic page count at the known R1152 baseline: `42 -> 41`.

If the synchronized baseline page count differs because of unrelated legitimate work, the required semantic delta remains exactly one removed key.

## 6. Source-preservation contract

The repository file:

`tasun-api/index.html`

must remain present and byte-identical to the implementation baseline.

Also preserve:

`tasun-api/worker.js`

A2 changes only the public Pages authority classification. It does not retire, rename, move, publish, or modify either source file.

Existing source-level tests for `tasun-api/index.html` must continue to pass unless they incorrectly require a public manifest page authority. Any such unexpected dependency crosses the failure boundary in Section 21.

## 7. Deployment-surface authority rule

The Issue #56 regression must no longer equate repository existence with Pages deployability.

The test must encode the actual formal deployment exclusion relevant to this defect.

At minimum:

- repository path existence is still checked for remaining declared page files;
- any manifest page target underneath `tasun-api/` is rejected because the formal Pages workflow excludes that directory;
- `tasun-api/index.html` source existence is independently asserted;
- `manifest.pages["tasun-api/index.html"]` is independently asserted absent.

The regression should avoid pretending to be a complete shell/workflow interpreter. It must instead encode the known deployment boundary deterministically and fail clearly if workflow semantics change in a way that invalidates the assumption.

## 8. Workflow drift guard

Because deployment-surface validity depends on the release workflow, the focused regression must verify that the current workflow still contains the expected exclusion for `tasun-api/`, or otherwise fail with a message requiring architecture review.

Required behavior:

- if workflow still excludes `tasun-api/`, page authorities under that path are invalid;
- if the exclusion disappears or materially changes, do not silently keep the A2 assumption;
- do not modify the workflow under Issue #56 A2.

This guard prevents the test from becoming stale if future packaging topology changes.

## 9. Explicit no-change files

The following must remain byte-identical through manual A2 implementation:

- `tasun-api/index.html`
- `tasun-api/worker.js`
- `.github/workflows/release-version.yml`
- `publish-version_tasun_project_autoscan.mjs`
- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`
- `權限表.html`
- `TASUN_REBUILD`
- `TASUN_REBUILD_STAMP`

Also do not alter Worker authorization, authentication/session flow, cloud synchronization logic, permissions schema, data schema, or user-facing navigation.

## 10. Pre-implementation synchronization

After amended written-spec approval:

1. fetch latest `main`;
2. confirm PR #59 governance content is based on or reconcilable with that main;
3. verify the original three orphan authorities remain absent;
4. verify `pages["tasun-api/index.html"]` is still present;
5. verify repository source `tasun-api/index.html` still exists;
6. verify formal workflow still excludes `tasun-api/`;
7. verify artifact/topology evidence has not been invalidated by unrelated work;
8. capture baseline blob SHAs for all locked files;
9. capture baseline manifest semantic values;
10. branch implementation from latest main.

If `tasun-api/index.html` authority is already legitimately removed by concurrent work, do not duplicate the mutation; reconcile and rerun the acceptance suite.

## 11. TDD RED

RED must occur before any A2 manifest mutation.

Modify only the focused Issue #56 test so that the new A2 expectations are active while the manifest still contains the `tasun-api/index.html` authority.

Required RED assertions:

1. repository source `tasun-api/index.html` exists;
2. workflow exclusion for `tasun-api/` is recognized;
3. no page authority may target an excluded Pages path;
4. `manifest.pages["tasun-api/index.html"]` must be absent;
5. the original three orphan authorities remain absent;
6. canonical formal four-page authorities remain present and aligned with root formal identity;
7. every remaining deployable page authority resolves to an eligible source/deployment path.

Expected RED:

- failure identifies `tasun-api/index.html` as a non-deployable manifest authority;
- source existence itself must not be reported as a defect;
- no unrelated formal page should fail.

Record:

- RED tests-only commit SHA;
- CI run ID;
- total/pass/fail counts;
- exact failing A2 assertion(s).

Do not edit `tasun-version.json` before RED evidence exists.

## 12. TDD GREEN

After RED is captured:

1. edit `tasun-version.json`;
2. remove exactly `pages["tasun-api/index.html"]`;
3. change no root formal identity field;
4. rerun focused Issue #56 test;
5. rerun the full Tasun regression suite.

Expected GREEN:

- source `tasun-api/index.html` remains present;
- public manifest authority for it is absent;
- no manifest page authority targets a currently excluded `tasun-api/` path;
- original three orphan authorities remain absent;
- four formal authorities remain valid;
- root build and releaseSequence remain unchanged.

## 13. Existing Issue #56 regression preservation

Do not discard the useful protections introduced by Option A.

The amended test must continue to prove:

- the three original missing-file authorities remain retired;
- canonical formal four-page authorities remain present;
- publisher metadata-only behavior does not restore retired authorities;
- all relevant remaining manifest page targets satisfy the refined authority invariant.

Only the obsolete assertion that `tasun-api/index.html` must remain a manifest page authority is reversed.

## 14. Metadata-only publisher regression

A2 changes `tasun-version.json`, so release behavior must remain metadata-only.

In an isolated workspace, prove that processing the A2 manifest-only cleanup:

- exits successfully;
- keeps the pre-run formal build;
- keeps the pre-run releaseSequence;
- verifies the formal four pages at that same build;
- does not restore any of the original three orphan authorities;
- does not restore `pages["tasun-api/index.html"]`;
- does not create a new functional R-number solely for A2.

Publisher-normalized same-build metadata is allowed.

## 15. Full regression and disposable exact-release

Before independent review:

- focused Issue #56 A2 regression GREEN;
- full Tasun regression GREEN;
- disposable exact-release GREEN;
- post-disposable full regression GREEN.

Record final run IDs and counts.

A disposable fixture R-number is not the formal release identity and must not alter the production expectation.

## 16. Semantic manifest audit

Compare implementation-head manifest to the synchronized implementation baseline.

Required proof:

- exactly one `pages` key removed: `tasun-api/index.html`;
- no other `pages` authority changed because of A2;
- root formal build unchanged;
- root releaseSequence unchanged;
- four formal authorities unchanged;
- original three Issue #56 orphan authorities remain absent;
- no new compatibility/redirect/test authority is added.

## 17. Locked blob audit

Compare baseline and final implementation blobs for every no-change file in Section 9.

All must be identical.

In particular:

- `tasun-api/index.html` source blob unchanged;
- `tasun-api/worker.js` unchanged;
- workflow unchanged;
- publisher unchanged;
- four formal HTML files unchanged;
- `權限表.html` unchanged.

Any A2-caused difference is a stop condition.

## 18. Independent review

Request Codex independent review on final GREEN head.

Review focus:

- A2 removes only the non-deployed `tasun-api/index.html` page authority;
- repository source remains untouched;
- workflow exclusion remains untouched;
- test distinguishes repository existence from Pages deployability;
- workflow drift is guarded;
- original Issue #56 protections remain;
- no public `tasun-api/` exposure is introduced;
- no functional version increment is introduced;
- metadata-only release behavior is proven.

Resolve valid findings and rerun final GREEN before merge.

## 19. Expected implementation diff

Expected implementation PR changed files:

1. `tasun-version.json` — modified;
2. `tests/issue-56-orphan-manifest-authorities.test.cjs` — modified.

No HTML file added, modified, or removed.

No runtime JS modified.

No workflow or publisher modified.

No backend/Worker source modified.

## 20. Merge and post-merge release contract

Merge only after:

- A2 architecture approved;
- amended written spec explicitly approved;
- governance PR #59 merged or otherwise incorporated according to repository governance flow;
- RED evidence captured;
- GREEN full regression complete;
- disposable exact-release GREEN;
- semantic manifest audit exact;
- locked blob audit exact;
- independent review clear.

Use repository-supported merge behavior.

Post-merge Exact Auto Release must:

- recognize the manifest metadata change;
- keep the current functional build unless unrelated work has legitimately advanced it;
- keep releaseSequence unchanged for A2 alone;
- verify the formal four pages;
- not restore `tasun-api/index.html` authority;
- produce a Pages artifact in which every remaining non-empty `pages[*].file` resolves to an included artifact file.

## 21. Failure boundaries

Stop and return to architecture if any occurs:

- a supported public route is proven to depend on `pages["tasun-api/index.html"]`;
- source/runtime tests reveal a legitimate runtime dependency on the manifest authority;
- formal workflow no longer excludes `tasun-api/`;
- fixing A2 requires exposing `tasun-api/` publicly;
- fixing A2 requires changing the workflow, publisher, Worker/auth/cloud logic, or supported HTML pages;
- additional deployment-surface authority mismatches are discovered that are materially distinct from the approved A2 scope;
- publisher restores the retired authority;
- A2 alone causes a functional R-number increment.

Do not work around a failure by publishing backend/source directories.

## 22. Post-merge deployed artifact verification

Inspect the fresh GitHub Pages artifact after A2 merge/release.

Require:

- `tasun-version.json` present;
- four formal pages present;
- `TASUN_REBUILD` present;
- `TASUN_REBUILD_STAMP` present;
- `tasun-api/index.html` absent from artifact, consistent with workflow;
- original three retired files absent;
- deployed manifest contains no `pages["tasun-api/index.html"]`;
- original three orphan keys remain absent;
- every remaining non-empty `pages[*].file` resolves to an actual file in the artifact.

Trigger a fresh deployed verification attempt after the initial release run is terminal and require it to pass as well.

## 23. Closure evidence

Before closing Issue #56 record:

- A2 implementation merge SHA;
- generated metadata commit SHA if any;
- Exact Auto Release run ID;
- run conclusion;
- final formal build;
- final releaseSequence;
- focused/full regression counts;
- disposable exact-release result;
- Codex review outcome;
- Pages artifact ID and digest;
- fresh verification result;
- deployed manifest page count;
- proof of zero deployed missing-file page authorities.

## 24. Closure criteria

Issue #56 may close only when all are true:

- [x] original Option A architecture approved;
- [x] original written spec approved;
- [x] original implementation merged and verified;
- [x] Option A2 architecture amendment explicitly approved;
- [x] A2 amended written spec completed;
- [x] A2 amended written spec explicitly approved;
- [ ] A2 RED evidence recorded;
- [ ] exactly `pages["tasun-api/index.html"]` retired;
- [ ] deployment-surface regression GREEN;
- [ ] repository source preserved;
- [ ] full regression GREEN;
- [ ] disposable exact-release GREEN;
- [ ] semantic manifest audit exact;
- [ ] locked blob audit exact;
- [ ] independent review clear;
- [ ] A2 implementation merged;
- [ ] post-merge Exact Auto Release GREEN;
- [ ] no A2-only functional version increment;
- [ ] fresh deployed verification GREEN;
- [ ] deployed artifact has zero missing-file manifest page authorities;
- [ ] closure evidence recorded.

## 25. Approval gate

Architecture amendment:

- [x] Option A2 explicitly approved by user on 2026-10-12

Amended written spec:

- [x] completed after A2 approval
- [x] explicitly approved by user

Implementation / TDD:

- [x] authorized by user on 2026-10-12; execution resumes after governance PR #59 merge

**A2 production mutation is authorized after governance PR #59 is merged; execution remains RED-first.**
