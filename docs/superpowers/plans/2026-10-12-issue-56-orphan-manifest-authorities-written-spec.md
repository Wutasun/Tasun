# Issue #56 Written Spec — Retire orphan manifest page authorities

Date: 2026-10-12  
Requirement: GitHub Issue #56 — `[REQ] Retire orphan manifest page authorities`  
Approved architecture: **Option A**  
Functional R-number: **NOT ASSIGNED**  
Status: **WRITTEN SPEC COMPLETE / AWAITING USER APPROVAL / NO IMPLEMENTATION AUTHORITY**

## 1. Objective

Retire exactly three stale `tasun-version.json.pages` authorities whose declared HTML files do not exist in the current repository or deployed GitHub Pages artifact, while preserving all supported runtime pages and the current formal R1152 release identity.

The approved orphan authority keys are:

1. `收發文明細表.html`
2. `收發文登錄表.html`
3. `xidong-official-doc-detail-cloud-step-test-r497`

Their declared file paths are respectively:

- `收發文明細表.html`
- `收發文登錄表.html`
- `汐東收發文明細表_雲端逐步測試_正式版_R497.html`

All three physical files are absent.

## 2. Authoritative baseline

Current governance / implementation baseline:

- repository: `Wutasun/Tasun`
- main: `ccff4b7e64db6d2b9462fd54940767ec62759ff4`
- formal build: `20261012_tasun_v5_xidong_docs_r1152_70f1b5421b9c_release`
- releaseSequence: `1152`
- formal authority: `tasun-version.json`
- architecture governance PR: #57
- architecture Option A: explicitly approved by user on 2026-10-12

If `main` advances before implementation begins, implementation must branch from the then-current latest `main`, re-run the orphan scan, and capture the new valid authority baseline before mutation.

Do not hard-code R1152 if unrelated concurrent work has legitimately advanced the formal release before implementation begins.

## 3. Verified orphan authority set

At the approved baseline, `tasun-version.json.pages` contains exactly these known missing-file authorities:

### 3.1 Legacy unprefixed detail redirect

Key:

`收發文明細表.html`

Relevant fields:

- `file: "收發文明細表.html"`
- `pageKey: "legacy-official-doc-detail-redirect"`
- `redirectTo: "汐東收發文明細表.html"`
- `legacyRedirect: true`

The physical `收發文明細表.html` file is absent.

### 3.2 Legacy unprefixed register redirect

Key:

`收發文登錄表.html`

Relevant fields:

- `file: "收發文登錄表.html"`
- `pageKey: "legacy-official-doc-register-redirect"`
- `redirectTo: "汐東收發文登錄表.html"`
- `legacyRedirect: true`

The physical `收發文登錄表.html` file is absent.

### 3.3 Stale R497 diagnostic authority

Key:

`xidong-official-doc-detail-cloud-step-test-r497`

Relevant fields:

- `file: "汐東收發文明細表_雲端逐步測試_正式版_R497.html"`
- `pageKey: "xidong-official-doc-detail-cloud-step-test-r497"`
- test/diagnostic metadata from the retired R497 lineage

The physical R497 diagnostic file is absent.

## 4. Control case — nested valid path

`pages["tasun-api/index.html"]` points to:

`tasun-api/index.html`

That file exists as a nested repository path and must remain valid.

The new regression must therefore resolve page files against the complete repository tree, not root filenames only.

## 5. Approved production scope

After explicit written-spec approval and governance PR #57 merge, implementation may change only:

1. `tasun-version.json`
   - delete exactly the three approved `pages` keys;
2. `tests/issue-56-orphan-manifest-authorities.test.cjs`
   - add the dedicated recurrence regression.

No other manual production/runtime/release file modification is authorized.

## 6. Exact manifest mutation contract

Parse `tasun-version.json` as JSON.

Delete exactly:

- `manifest.pages["收發文明細表.html"]`
- `manifest.pages["收發文登錄表.html"]`
- `manifest.pages["xidong-official-doc-detail-cloud-step-test-r497"]`

No other key in `manifest.pages` may be manually removed or altered.

Do not manually alter:

- root `version`;
- root `cacheV`;
- root `buildStamp`;
- root `rebuildStamp`;
- root `releaseSequence`;
- `release.releaseSequence`;
- any canonical four-page authority;
- valid nested authority `tasun-api/index.html`;
- `pageArtifactManifest` entries;
- `pageBuildStamp` entries;
- unrelated metadata.

The implementation diff for `tasun-version.json` must be semantically equivalent to only those three key deletions.

## 7. Explicit no-change files

The following must remain byte-identical to the implementation baseline through manual implementation:

- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`
- `權限表.html`
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- `TASUN_REBUILD`
- `TASUN_REBUILD_STAMP`

Also do not modify:

- Worker code;
- auth/session code;
- cloud synchronization business logic;
- permissions/data schema;
- supported application navigation.

## 8. Separate user-facing dead-link requirement

`權限表.html` currently contains several href/entry definitions that point to nonexistent pages, including some of the legacy unprefixed official-document paths.

Those are explicitly **out of scope** for Issue #56.

Issue #56 is authority-only cleanup.

Do not repair, remove, redirect, or remap `權限表.html` entries under this implementation.

That user-facing navigation defect must be handled as a later independent requirement with its own architecture/TDD/release scope.

## 9. Pre-implementation synchronization

After explicit written-spec approval:

1. merge governance PR #57 to `main`;
2. fetch the latest `main`;
3. confirm no concurrent implementation has changed the orphan set;
4. recursively resolve every `tasun-version.json.pages[*].file` path against the repository tree;
5. verify the expected orphan set is still exactly the three approved entries;
6. verify `tasun-api/index.html` still exists;
7. capture baseline blob SHAs for:
   - `tasun-version.json`;
   - four formal pages;
   - publisher;
   - workflow;
   - canonical rebuild files;
8. create implementation branch from that latest `main`.

If the orphan set differs materially, return to architecture review before production mutation.

## 10. TDD RED

Create:

`tests/issue-56-orphan-manifest-authorities.test.cjs`

before editing `tasun-version.json`.

RED assertions must include:

1. every non-empty `manifest.pages[*].file` resolves to an existing repository path;
2. nested paths are supported;
3. `tasun-api/index.html` is explicitly confirmed as a valid nested control case;
4. the three approved orphan keys must be absent;
5. canonical four-page authorities must remain present.

Expected RED result:

- failure reports must identify the three current orphan authorities / files;
- no false failure for `tasun-api/index.html`.

Record:

- RED tests-only commit SHA;
- CI run ID;
- total/pass/fail counts;
- failing orphan names.

Do not mutate `tasun-version.json` before RED evidence exists.

## 11. Repository-path existence algorithm

The regression must validate repository-relative paths safely.

Accepted implementation approach:

- recursively build a set of actual repository file paths from the current checkout, excluding only directories that are not source/deployment content such as:
  - `.git/`;
  - `node_modules/` if present;
- normalize path separators to `/`;
- for every `manifest.pages` entry with a non-empty string `file`:
  - normalize the manifest path;
  - assert that normalized path exists in the actual file-path set.

The regression must not assume all page files live at repository root.

The regression must not use network access.

## 12. TDD GREEN

After RED is captured:

1. edit `tasun-version.json`;
2. remove exactly the three approved `pages` keys;
3. do not change any root build/sequence field;
4. rerun focused Issue #56 test;
5. rerun the full Tasun regression suite.

Expected GREEN:

- zero missing-file manifest page authorities;
- nested control case remains valid;
- canonical formal authority remains intact;
- root build/releaseSequence unchanged.

## 13. Metadata-only publisher regression

Issue #56 changes `tasun-version.json`, so the expected release path is metadata-only rather than deletion-only no-sync.

The Issue #56 regression or an existing reusable release regression must prove, in an isolated workspace, that a `tasun-version.json`-only authority cleanup:

- exits successfully through the publisher;
- retains the pre-run formal build;
- retains the pre-run releaseSequence;
- verifies all four formal pages at that same build;
- does not recreate any of the three orphan authorities.

Publisher-normalized metadata such as timestamps/formal alias refresh is allowed at the same formal build.

Any new functional R-number caused solely by Issue #56 is a failure.

## 14. Full regression and disposable exact-release

Before independent review:

- focused Issue #56 regression must pass;
- full Tasun regression must pass;
- disposable exact-release verification must pass;
- post-disposable full regression must pass.

Record final run IDs and counts.

A disposable test-generated R-number inside an isolated test fixture is not the formal release identity.

## 15. Semantic manifest audit

Before merge, compare implementation-head manifest against implementation-baseline manifest.

Required proof:

- exactly three `pages` keys removed;
- no other semantic manifest change;
- root formal build unchanged;
- root releaseSequence unchanged;
- valid nested `tasun-api/index.html` entry unchanged;
- canonical four-page entries unchanged.

A large line deletion count is acceptable only if the semantic object diff proves exactly these three key removals.

## 16. Locked blob audit

Before merge, compare baseline and implementation-head blobs for:

- four formal HTML pages;
- `權限表.html`;
- publisher;
- workflow;
- `TASUN_REBUILD`;
- `TASUN_REBUILD_STAMP`.

All must be identical.

If any differs because of Issue #56 implementation, stop and investigate.

## 17. Independent review

Request Codex independent review on the final GREEN head.

Review criteria:

- only the three approved orphan manifest authorities are retired;
- the recurrence test validates recursive repository paths;
- nested `tasun-api/index.html` is not falsely rejected;
- no `權限表.html` or supported HTML modification;
- no redirect/shim/replacement page;
- no root build or releaseSequence manual change;
- publisher/workflow unchanged;
- metadata-only release contract is adequately tested.

Resolve all valid major findings and rerun final GREEN before merge.

## 18. Exact implementation diff contract

Expected implementation PR changed files:

1. `tasun-version.json` — modified;
2. `tests/issue-56-orphan-manifest-authorities.test.cjs` — added.

No HTML file should be added, modified, or removed.

No runtime JS should change.

No workflow/publisher file should change.

## 19. Merge contract

Merge only after:

- architecture approved;
- written spec explicitly approved;
- governance PR #57 merged;
- implementation synchronized to latest main;
- RED evidence recorded;
- GREEN full regression complete;
- disposable exact-release complete;
- semantic manifest audit exact;
- locked blob audit exact;
- Codex review clear.

Use the repository-supported squash merge method.

Do not manually assign a functional R-number.

## 20. Expected post-merge Exact Auto Release

Because `tasun-version.json` changes, Exact Auto Release should run.

Required behavior:

1. changed-file set recognizes `tasun-version.json`;
2. publisher uses metadata-only same-build behavior;
3. current formal build remains unchanged unless unrelated main work legitimately advanced it;
4. releaseSequence remains unchanged;
5. four formal pages verify at the same build;
6. publisher may create a generated same-build metadata commit if normalized bytes change;
7. the three orphan authorities must remain absent after publisher normalization.

If the publisher regenerates any of the three orphan entries, stop and treat that as a release-path defect; do not manually delete them repeatedly.

## 21. Post-merge verification

Capture:

- implementation merge SHA;
- generated metadata commit SHA, if any;
- Exact Auto Release run ID;
- run conclusion;
- final formal build;
- final releaseSequence;
- deployed four-page SHA verification result.

Then trigger a fresh deployed verification attempt after the first run is terminal.

The fresh verification must also pass.

## 22. Deployed artifact verification

Inspect the GitHub Pages artifact produced by the post-merge release run.

Require:

- `tasun-version.json` present;
- four formal pages present;
- `TASUN_REBUILD` present;
- `TASUN_REBUILD_STAMP` present;
- `tasun-api/index.html` present;
- `收發文明細表.html` absent;
- `收發文登錄表.html` absent;
- `汐東收發文明細表_雲端逐步測試_正式版_R497.html` absent.

Parse deployed `tasun-version.json` and require:

- all three orphan keys absent;
- every remaining non-empty `pages[*].file` resolves to a file inside the deployed artifact;
- canonical formal page authorities remain valid.

## 23. Failure boundaries

Return to architecture before continuing if any of these occurs:

- one of the three supposedly missing files is proven intentionally generated/required;
- a current supported loader/navigation path requires one of the three orphan manifest keys;
- recursive path validation finds additional materially related orphan authorities not covered by this requirement;
- the publisher restores one of the removed authorities;
- Issue #56 cleanup causes a new functional R-number;
- fixing the defect requires `權限表.html`, a formal HTML page, publisher, workflow, or runtime JS change.

Do not solve such a finding by recreating missing compatibility pages.

## 24. Closure criteria

Issue #56 may close only when all are true:

- [ ] Option A architecture approved;
- [ ] written spec explicitly approved;
- [ ] governance PR #57 merged;
- [ ] RED evidence recorded;
- [ ] exactly three orphan manifest authorities retired;
- [ ] recursive repository-path regression GREEN;
- [ ] valid nested path control GREEN;
- [ ] full regression GREEN;
- [ ] disposable exact-release GREEN;
- [ ] semantic manifest audit exact;
- [ ] locked blob audit exact;
- [ ] independent review clear;
- [ ] implementation PR merged;
- [ ] post-merge Exact Auto Release GREEN;
- [ ] no Issue #56-only functional version increment;
- [ ] fresh deployed verification GREEN;
- [ ] deployed artifact contains no missing-file manifest authority;
- [ ] closure evidence recorded.

## 25. Approval gate

Architecture:

- [x] Option A explicitly approved by user on 2026-10-12

Written spec:

- [x] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after explicit written-spec approval and governance PR #57 merge

No production change is authorized until the written-spec approval gate is satisfied.
