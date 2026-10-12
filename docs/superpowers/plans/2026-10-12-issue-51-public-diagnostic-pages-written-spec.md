# Issue #51 Written Spec — Retire publicly deployed legacy cloud diagnostic pages

Date: 2026-10-12  
Requirement: GitHub Issue #51 — `[REQ] Retire publicly deployed legacy cloud diagnostic pages`  
Architecture: **Option A APPROVED**  
Functional R-number: **NOT ASSIGNED**  
Status: **WRITTEN SPEC COMPLETE / AWAITING USER APPROVAL / NO IMPLEMENTATION AUTHORITY**

## 1. Implementation objective

Retire the two dormant legacy browser diagnostic pages currently published from repository root:

- `汐東收發文明細表_雲端逐步測試_正式版.html`
- `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`

The implementation must remove only those public diagnostic root pages and add regression coverage that locks their retirement/non-authority.

Do not replace them with:

- another public root diagnostic HTML;
- a redirect/shim;
- an alternate “正式版” diagnostic filename;
- a new release/runtime authority;
- a new Worker/auth diagnostic subsystem.

The maintained verification authority remains the current automated regression + Exact Auto Release chain.

## 2. Implementation baseline

Implementation may begin only after:

1. this written spec receives explicit user approval;
2. the synchronized governance record is merged to `main`;
3. the implementation branch is created from the then-latest `main`.

Architecture tracing baseline:

- main SHA: `88acc327503813219d93dc6314a6cde5e6a9aa36`
- formal build: `20261012_tasun_v5_xidong_docs_r1152_70f1b5421b9c_release`
- releaseSequence: `1152`
- sole formal version authority: `tasun-version.json`

If `main` advances before implementation starts, repeat the exact consumer/deployment scan on latest `main` before deleting either page.

## 3. Approved production file scope

Approved production changes under Option A:

1. delete `汐東收發文明細表_雲端逐步測試_正式版.html`;
2. delete `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`.

Expected dedicated test addition:

3. `tests/issue-51-retire-public-diagnostic-pages.test.cjs`.

No other production/runtime/release file is approved for manual modification.

## 4. Official-document diagnostic retirement contract

The R880-era page:

`汐東收發文明細表_雲端逐步測試_正式版.html`

must be deleted.

Its historical behaviors must not be preserved in a replacement page, including:

- `window.__TASUN_REQUIRE_LOGIN__ = false`;
- `window.__TASUN_TEST_PAGE_PUBLIC_DIRECT_OPEN__ = true`;
- `window.__TASUN_CLOUD_STEP_TEST_AUTH_OPTIONAL__ = true`;
- browser-driven Health / Read / Merge / readback controls;
- `deleted:true` cloud Merge probe;
- iframe-based inspection of formal pages;
- localStorage / IndexedDB browser diagnostic tooling.

Git history remains the archival source if the old diagnostic implementation must be inspected later.

## 5. R442 package-detail diagnostic retirement contract

The R442-era page:

`捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`

must be deleted.

Do not rename, redirect, or recreate its browser-driven Health / Read / Merge / deleted-probe workflow elsewhere under this requirement.

## 6. Current verification-authority invariants

The maintained verification path remains:

- current `tests/*.test.*`;
- Tasun regression checks;
- disposable exact-release verification;
- Exact Auto Release deployed four-page build / sequence / SHA verification.

The following files must remain byte-identical to the implementation baseline unless latest `main` legitimately advances before implementation:

- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- `tasun-version.json`
- `TASUN_REBUILD`
- `TASUN_REBUILD_STAMP`
- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`

No Worker, auth, cloud sync, row schema, permission, or supported-page UI behavior is expected to change.

## 7. Pre-implementation consumer and deployment scan

Before RED/GREEN changes, repeat exact repository searches for:

- `汐東收發文明細表_雲端逐步測試_正式版.html`
- `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`
- `__TASUN_TEST_PAGE_PUBLIC_DIRECT_OPEN__`
- `__TASUN_CLOUD_STEP_TEST_AUTH_OPTIONAL__`

Classify hits as:

- active application navigation;
- active loader/runtime dependency;
- workflow/build dependency;
- maintained test dependency;
- historical governance/evidence;
- the legacy diagnostic page itself.

Also re-check:

- whether either filename appears in `tasun-version.json`;
- Pages artifact packaging;
- current automated regression authority;
- current Exact Auto Release verifier.

Expected result:

- no active consumer of either diagnostic filename;
- neither diagnostic filename is a formal manifest entry;
- both root files are deployable by current Pages artifact preparation;
- current automated verification does not require either page.

If a real active consumer appears on latest `main`, stop and return to architecture review.

## 8. TDD sequence

### RED stage

Create:

`tests/issue-51-retire-public-diagnostic-pages.test.cjs`

before deleting either production page.

Minimum RED assertions:

1. repository root must not contain `汐東收發文明細表_雲端逐步測試_正式版.html`;
2. repository root must not contain `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`;
3. all four formal document pages must still exist;
4. `tasun-version.json`, `TASUN_REBUILD`, and `TASUN_REBUILD_STAMP` must still exist;
5. current publisher/workflow verification authority must still exist;
6. active application/runtime/build sources must not depend on either retired filename;
7. no active root diagnostic page may reintroduce `__TASUN_TEST_PAGE_PUBLIC_DIRECT_OPEN__` or `__TASUN_CLOUD_STEP_TEST_AUTH_OPTIONAL__`;
8. neither retired filename may be present in `tasun-version.json`;
9. cleanup-only deleted diagnostic paths must not advance the formal build or releaseSequence.

Expected RED:

- at least the two legacy diagnostic root files still exist.

Record:

- tests-only head SHA;
- RED regression run/result;
- exact failing assertion(s).

Do not delete either diagnostic page before RED is confirmed.

### GREEN stage

Delete only:

- `汐東收發文明細表_雲端逐步測試_正式版.html`;
- `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`.

Then rerun:

- focused Issue #51 regression;
- full Tasun regression suite;
- disposable exact-release verification;
- exact consumer/deployment scan;
- diff-scope audit.

## 9. Active reference scan scope

The dedicated regression should inspect current executable/runtime/build sources while excluding historical evidence where appropriate.

At minimum inspect:

- root HTML;
- JS/MJS/CJS;
- JSON;
- active workflow YAML;
- active release scripts.

Historical mentions in:

- `docs/superpowers/`;
- old reports;
- issue/closure evidence;
- the dedicated test itself

must not be treated as active consumers merely because a retired filename or marker appears there.

The test must distinguish **current executable dependency** from historical evidence.

## 10. No-replacement / no-shim contract

Do not add:

- redirects from either retired filename;
- zero-content compatibility HTML;
- renamed “正式版” browser diagnostics;
- a new public root test page;
- a new browser Merge-probe utility;
- a second version/release verifier;
- a second release authority.

If interactive diagnostics are later required, that is a separate architecture decision with explicit auth/deployment/ownership requirements.

## 11. Cleanup-only no-release proof

The dedicated regression must include an isolated publisher execution with an actual newline-separated changed-file list containing exactly:

`汐東收發文明細表_雲端逐步測試_正式版.html`
`捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`

In the isolated workspace, those files must be absent, matching post-deletion state.

Required assertions:

- publisher exits successfully;
- output contains `no formal page/core/manifest change; nothing to sync.`;
- `tasun-version.json` remains byte-identical;
- formal build remains unchanged;
- releaseSequence remains unchanged.

This prevents the Issue #51 cleanup from silently becoming a functional release.

## 12. Explicitly forbidden changes

Do not:

- edit the four formal document pages;
- edit other supported application pages;
- edit `publish-version_tasun_project_autoscan.mjs`;
- edit `.github/workflows/release-version.yml`;
- manually edit `tasun-version.json`;
- edit `TASUN_REBUILD`;
- edit `TASUN_REBUILD_STAMP`;
- modify Worker endpoints;
- modify Worker authorization;
- modify auth/session policy;
- modify cloud sync business logic;
- modify row schemas or permissions;
- create a replacement diagnostic page;
- add redirect/shim behavior;
- assign a functional R-number.

Any such need requires return to architecture review.

## 13. Diff-scope contract

Expected implementation PR changed files:

- deleted `汐東收發文明細表_雲端逐步測試_正式版.html`;
- deleted `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`;
- added `tests/issue-51-retire-public-diagnostic-pages.test.cjs`.

No other production file is expected.

Any additional production change fails scope audit until explicitly re-reviewed.

## 14. Disposable exact-release behavior

Before merge, run the repository's normal PR regression workflow, including disposable exact-release verification.

It must confirm:

- current release authority remains valid;
- verify-only behavior remains read-only;
- four formal pages remain internally synchronized;
- no Issue #51 production file outside the two approved deletions is needed.

The dedicated Issue #51 no-release test provides the exact deletion-only changed-file proof.

## 15. Independent review criteria

Independent review must verify:

- only the two approved legacy diagnostic pages are deleted from production;
- no replacement diagnostic/shim is introduced;
- the test correctly distinguishes active dependencies from historical mentions;
- the cleanup-only publisher test uses an actual newline-separated two-path input;
- publisher/workflow/version/canonical rebuild files are byte-identical to baseline;
- four formal pages are byte-identical to baseline;
- no Worker/auth/cloud/runtime behavior changed.

Any major finding must be resolved before merge.

## 16. Verification matrix before merge

All must be GREEN:

- focused Issue #51 regression;
- full Tasun regression suite;
- disposable exact-release verification;
- exact consumer/deployment scan;
- diff-scope audit;
- canonical release-authority blob comparisons;
- four formal page blob comparisons;
- independent review with no unresolved major finding.

Implementation PR must record:

- RED head SHA;
- RED run/result;
- GREEN head SHA;
- GREEN run/result;
- disposable exact-release result;
- changed-file list;
- authority/formal-page blob comparisons;
- independent review findings and resolutions.

## 17. Merge contract

Merge only after:

- RED→GREEN evidence is complete;
- all regressions are GREEN;
- disposable exact-release verification is GREEN;
- independent review has no unresolved major finding;
- diff scope exactly matches this written spec.

Use the repository-supported merge method.

Do not manually force a new formal release.

## 18. Post-merge Exact Auto Release verification

After merge:

1. capture implementation merge SHA;
2. confirm Exact Auto Release triggers from the deleted `.html` paths;
3. capture workflow conclusion;
4. inspect changed-file list and autoscan relevance result;
5. require `no formal page/core/manifest change; nothing to sync.` or equivalent no-sync evidence;
6. require no generated release changes to commit;
7. verify `tasun-version.json` remains the pre-implementation formal blob unless unrelated concurrent work legitimately advanced `main`;
8. verify `TASUN_REBUILD` remains unchanged;
9. verify `TASUN_REBUILD_STAMP` remains unchanged;
10. verify four formal page blobs remain unchanged;
11. verify releaseSequence did not increment solely from Issue #51 cleanup;
12. verify deployed four-page build/sequence/SHA succeeds;
13. rerun a fresh deployed verification after the workflow reaches terminal state;
14. inspect the newly generated GitHub Pages artifact and confirm both retired diagnostic HTML files are absent;
15. record closure evidence in Issue #51;
16. close Issue #51 only after all acceptance criteria are satisfied.

If unrelated concurrent work legitimately advances `main`, compare against that valid current authority instead of hard-coding R1152, while still proving Issue #51 itself caused no extra sequence.

## 19. Deployed artifact absence verification

Use the actual GitHub Pages workflow artifact from the post-merge run.

Inspect the packaged site contents directly.

Expected result:

- `汐東收發文明細表_雲端逐步測試_正式版.html`: absent;
- `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`: absent;
- `tasun-version.json`: present;
- `TASUN_REBUILD`: present;
- `TASUN_REBUILD_STAMP`: present;
- four formal document pages: present.

This artifact inspection is the Issue #51 closure proof that the public Pages deployment no longer exposes the retired diagnostics.

## 20. Failure handling

If a current active consumer appears before deletion:

- do not delete the affected page;
- capture the exact consumer and dependency;
- return to architecture review;
- do not add a redirect/shim.

If cleanup unexpectedly increments formal releaseSequence:

- do not accept the increment as normal cleanup behavior;
- inspect autoscan relevance classification;
- do not manually roll version files backward;
- return to architecture review if publisher/workflow changes appear necessary.

If the deployed artifact still contains a retired page after successful merge:

- inspect Pages artifact composition;
- do not alter formal application pages;
- do not add route-level hacks;
- return to architecture if deployment packaging must be changed.

## 21. Acceptance criteria

Implementation is complete only when all are true:

- [ ] `汐東收發文明細表_雲端逐步測試_正式版.html` deleted;
- [ ] `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html` deleted;
- [ ] no replacement diagnostic page/shim added;
- [ ] no active dependency on either retired filename;
- [ ] no active public-direct diagnostic marker remains in a root diagnostic page;
- [ ] publisher unchanged;
- [ ] workflow unchanged;
- [ ] `tasun-version.json` not manually modified;
- [ ] canonical rebuild files unchanged by implementation;
- [ ] four formal pages unchanged by implementation;
- [ ] focused regression locks retirement/non-authority;
- [ ] cleanup-only deletion test proves no release mutation;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] independent review has no unresolved major finding;
- [ ] post-merge autoscan no-sync behavior verified;
- [ ] no Issue #51-only releaseSequence increment;
- [ ] deployed four-page build/sequence/SHA verified;
- [ ] fresh deployed verification completed;
- [ ] fresh GitHub Pages artifact excludes both retired diagnostic pages;
- [ ] closure evidence recorded.

## 22. Approval gate

Architecture:

- [x] Option A explicitly approved by user on 2026-10-12

Written spec:

- [x] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after explicit written-spec approval

Implementation/TDD remains blocked until this written spec is explicitly approved by the user and the synchronized governance PR is merged to `main`.
