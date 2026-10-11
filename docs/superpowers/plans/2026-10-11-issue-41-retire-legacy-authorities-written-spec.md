# Issue #41 Written Spec — Retire dormant legacy guard security and cloudwrap authorities

Date: 2026-10-11  
Requirement: GitHub Issue #41 — `[REQ] Retire dormant legacy guard security and cloudwrap authorities`  
Architecture: Option A APPROVED  
Functional R-number: NOT ASSIGNED  
Status: WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED

## 1. Implementation objective

Retire the three verified-unreferenced executable legacy authority files:

- `tasun-guard.js`
- `tasun-security.js`
- `tasun-cloudwrap.js`

by deleting them without compatibility shims, renamed copies, executable archives, or replacement legacy authority layers.

Current v4/v5 runtime authority must remain unchanged.

## 2. Implementation baseline

Implementation may begin only after this written spec receives explicit user approval and the synchronized governance record is merged to `main`.

Implementation branch must be created from the latest current `main` at that time.

Architecture tracing baseline:

`main @ 0134e692d7cc9a7436a1d2d027de868aec318563`

If `main` advances before implementation begins, repeat the exact reference scan before deleting production files.

## 3. Approved production file scope

Approved production changes:

1. delete `tasun-guard.js`;
2. delete `tasun-security.js`;
3. delete `tasun-cloudwrap.js`.

Expected test addition:

4. `tests/issue-41-retire-legacy-authorities.test.cjs`.

No HTML or current authority file is approved for modification.

## 4. tasun-guard.js retirement contract

`tasun-guard.js` must be deleted.

Do not preserve or recreate logic that:

- depends on `window.tasunLogin`;
- calls legacy `requireLogin()` through a retired login authority;
- adds a compatibility global solely to satisfy this obsolete guard.

The current supported guard remains `tasun-guard-v5.js`.

## 5. tasun-security.js retirement contract

`tasun-security.js` must be deleted.

Do not preserve or recreate its legacy authority surface:

- `tasunGlobalPassHash_v1`;
- `tasunSessionAuth_v1`;
- `window.TasunSecurity`;
- redirect-based v1.2 session gate.

Do not migrate these storage keys or globals into another active file under Issue #41.

## 6. tasun-cloudwrap.js retirement contract

`tasun-cloudwrap.js` must be deleted.

Do not preserve or recreate the older implementation that exports:

`window.TasunCloudWrapV4`

The supported implementation remains:

`tasun-cloudwrap-v4.js`

which owns the current cloud wrapper contract including:

- `loadResources()`;
- `getApiBase()`;
- `getApiBaseAsync()`;
- `getPageResource()`;
- current version-aware resource resolution;
- current cache-busting behavior;
- `TasunCloudWrapV4` / `TasunCloudwrapV4` aliases.

No other runtime file may be introduced that duplicates or overwrites this supported global.

## 7. Current authority invariants

The following files must remain byte-identical to the implementation baseline:

- `tasun-auth-v4.js`;
- `tasun-cloudwrap-v4.js`;
- `tasun-guard-v5.js`;
- `tasun-boot.js`;
- `tasun-global-core.js`.

No caller migration is expected because no current active consumer of the deleted filenames exists.

## 8. Pre-implementation reference scan

Before RED/GREEN changes, repeat exact searches for:

- `tasun-guard.js`;
- `tasun-security.js`;
- `tasun-cloudwrap.js`;
- `window.tasunLogin`;
- `TasunSecurity`;
- `tasunSessionAuth_v1`;
- `TasunCloudWrapV4`.

Classify hits as:

- active runtime/workflow;
- current supported authority;
- tests;
- governance/history;
- legacy file itself.

Expected result:

- no active current runtime/workflow loader for any of the three legacy filenames;
- `window.tasunLogin`, `TasunSecurity`, and `tasunSessionAuth_v1` have no active current consumer/provider outside the legacy files;
- `TasunCloudWrapV4` active usage resolves to the supported `tasun-cloudwrap-v4.js`.

If a real active dependency appears on latest `main`, stop and return to architecture review.

## 9. TDD sequence

### RED stage

Create:

`tests/issue-41-retire-legacy-authorities.test.cjs`

before deleting any production file.

Minimum RED assertions:

1. `tasun-guard.js` must not exist;
2. `tasun-security.js` must not exist;
3. `tasun-cloudwrap.js` must not exist;
4. `tasun-auth-v4.js` must exist;
5. `tasun-cloudwrap-v4.js` must exist;
6. `tasun-guard-v5.js` must exist;
7. `tasun-boot.js` must exist;
8. `tasun-global-core.js` must exist;
9. active runtime/workflow files must not depend on the three retired filenames;
10. no active current file outside supported authority may introduce the legacy `tasunSessionAuth_v1` or `TasunSecurity` authority.

Expected RED:

- at least `tasun-guard.js` still exists.

Record:

- tests-only head SHA;
- RED regression run/result;
- exact failing assertion.

Do not delete production files before RED is confirmed.

### GREEN stage

Delete only:

- `tasun-guard.js`;
- `tasun-security.js`;
- `tasun-cloudwrap.js`.

Then rerun:

- focused Issue #41 regression;
- full Tasun regression suite;
- disposable exact-release verification.

## 10. Active dependency scan scope

The dedicated regression should inspect current executable/runtime/build sources while excluding:

- `docs/`;
- `tests/`;
- historical text reports;
- evidence-only artifacts.

At minimum inspect:

- HTML;
- JS/MJS/CJS;
- JSON;
- workflow YAML;
- package/script metadata if present.

Historical mentions in governance documents must not fail the regression.

## 11. No-shim / no-duplicate-global contract

Do not add:

- renamed legacy guard/security/cloudwrap files;
- executable archive copies;
- `window.tasunLogin` compatibility provider;
- `window.TasunSecurity` compatibility provider;
- `tasunSessionAuth_v1` bridge;
- alternate runtime file exporting `TasunCloudWrapV4`.

After implementation, the supported cloud wrapper implementation must remain `tasun-cloudwrap-v4.js`.

## 12. Explicitly forbidden changes

Do not:

- edit any HTML;
- edit `tasun-auth-v4.js`;
- edit `tasun-cloudwrap-v4.js`;
- edit `tasun-guard-v5.js`;
- edit `tasun-boot.js`;
- edit `tasun-global-core.js`;
- edit release workflow;
- edit autoscan publisher;
- change auth/session/token keys;
- change Worker endpoints;
- change UI;
- change permissions;
- change formal data/statistics;
- change cloud synchronization;
- manually edit `tasun-version.json`;
- assign a functional R-number.

## 13. Diff-scope contract

Expected implementation PR changed files:

- deleted `tasun-guard.js`;
- deleted `tasun-security.js`;
- deleted `tasun-cloudwrap.js`;
- added `tests/issue-41-retire-legacy-authorities.test.cjs`.

No other production file is expected.

Any additional production file requires architecture review.

## 14. Release workflow behavior

Current workflow push paths include:

`**/*.js`

Therefore deleting the three legacy files is expected to trigger the Exact Auto Release workflow.

Current autoscan relevance only includes changed files that:

- still exist after the change; and
- are a formal HTML/HTM page, listed `CORE_FILES` file, or generated authority file.

The three legacy files:

- are not in `CORE_FILES`;
- are not formal HTML pages;
- are not generated authority files;
- will not exist after deletion.

Expected production behavior:

1. implementation PR merges to `main`;
2. workflow triggers due to JS path changes;
3. autoscan sees deleted paths;
4. no surviving relevant formal/core/generated file remains;
5. autoscan logs `no formal page/core/manifest change; nothing to sync.`;
6. formal build remains unchanged;
7. releaseSequence remains unchanged;
8. `tasun-version.json` remains unchanged;
9. existing deployed four-page verification still succeeds.

Do not force a new release.

## 15. Disposable exact-release behavior

Branch regression/disposable exact-release verification must succeed.

It should confirm that deletion of dormant non-core JS authority files does not produce an unexpected formal release mutation.

## 16. Version authority contract

Formal version authority remains:

`.github/workflows/release-version.yml`
→ `publish-version_tasun_project_autoscan.mjs`
→ `tasun-version.json`.

Implementation commits must not manually modify `tasun-version.json`.

If post-merge behavior differs from the expected no-sync path, inspect actual workflow/publisher evidence before closure.

## 17. Independent review criteria

Independent review must verify:

- only the three approved legacy files are deleted from production;
- no shim/alias/replacement authority is introduced;
- current v4/v5 authority files are byte-identical to baseline;
- current `tasun-cloudwrap-v4.js` remains unchanged;
- regression covers deleted files and dormant legacy symbols;
- no version manifest edit exists.

## 18. Verification matrix

Before merge, all must be GREEN:

- focused Issue #41 regression;
- full regression suite;
- disposable exact-release verification;
- exact dependency/reference scan;
- diff-scope review;
- current authority unchanged checks;
- version-manifest unchanged check.

Implementation PR must record:

- RED head SHA;
- RED run/result;
- GREEN head SHA;
- GREEN run/result;
- disposable exact-release result;
- changed-file list;
- authority blob comparisons;
- version blob comparison.

## 19. Merge contract

Only merge after:

- RED→GREEN evidence complete;
- full regression GREEN;
- disposable exact-release GREEN;
- no unresolved major review finding;
- diff scope matches this written spec.

Use current repository merge practice.

## 20. Post-merge verification

After merge:

1. capture implementation merge SHA;
2. inspect Exact Auto Release workflow triggered by the JS deletions;
3. capture workflow conclusion;
4. inspect autoscan relevance result;
5. verify all three legacy files are absent on current `main`;
6. verify current authority files remain unchanged;
7. verify formal build;
8. verify releaseSequence;
9. verify `tasun-version.json` blob;
10. if no relevant change was found, confirm version authority remains unchanged;
11. verify deployed four-page build/sequence/SHA;
12. record closure evidence in Issue #41;
13. close Issue #41 when all acceptance criteria are satisfied.

## 21. Failure handling

If a new active dependency on any legacy file appears:

- do not delete that file;
- do not add compatibility shims;
- capture the exact consumer/call chain;
- return to architecture review.

If production autoscan unexpectedly treats a deletion as relevant:

- inspect actual workflow/publisher evidence;
- do not manually alter the version manifest;
- complete or correct the release chain according to actual current rules before closure.

## 22. Acceptance criteria

Implementation is complete only when all are true:

- [ ] `tasun-guard.js` deleted;
- [ ] `tasun-security.js` deleted;
- [ ] `tasun-cloudwrap.js` deleted;
- [ ] no compatibility shim added;
- [ ] current v4/v5 authority files unchanged;
- [ ] supported `tasun-cloudwrap-v4.js` remains unchanged;
- [ ] regression locks retirement;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] post-merge workflow behavior verified;
- [ ] formal build/releaseSequence unchanged if autoscan finds no relevant file;
- [ ] no manual `tasun-version.json` edit;
- [ ] closure evidence recorded.

## 23. Approval gate

Architecture:

- [x] Option A explicitly approved by user on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [x] explicitly approved by user on 2026-10-11

Implementation / TDD:

- [x] authorized by user on 2026-10-11

Implementation/TDD is authorized after this synchronized governance PR is merged to `main`; the implementation branch must then start from the latest current `main`.
