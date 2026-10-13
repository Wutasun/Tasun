# Issue #93 — Written Spec: Retire Stale R888 Repair Verification Report

Date: 2026-10-13  
Issue: #93 — `[REQ] Retire stale R888 repair verification report`  
Approved architecture: **Option A**  
Implementation baseline at specification time: `efa6499eae0c514d08c1bd5b931d58a334d7a850`  
Formal build at specification time: `20261013_tasun_v5_xidong_docs_r1155_6496a23cb51e_release`  
Release sequence at specification time: `1155`  
Status: **WRITTEN SPEC DRAFTED / IMPLEMENTATION-TDD NOT YET AUTHORIZED**

## 1. Goal

Retire the stale root historical report `汐東收發文三頁_R888_修復驗證報告.txt` so obsolete R888 repair and verification claims cannot be mistaken for current release/runtime/test evidence.

The file is a dated 2026-08-18 R888 repair report. Current formal authority is R1155 and is carried by `tasun-version.json`, publisher/workflows, current source/tests, and Issue/PR/written-spec evidence.

This is a historical-artifact retirement only. It must not alter formal pages, runtime, cloud, authentication, storage, UI, publisher, workflow, release, or data behavior.

## 2. Verified precondition

Before RED implementation begins, re-verify on the latest implementation baseline:

1. root `汐東收發文三頁_R888_修復驗證報告.txt` exists;
2. it is historical R888 verification evidence, not executable/current authority;
3. exact live-source/config search finds no consumer of the filename;
4. current release authority remains:
   - `tasun-version.json`;
   - `publish-version_tasun_project_autoscan.mjs`;
   - `.github/workflows/release-version.yml`;
5. current test/governance evidence remains repository tests, CI runs, Issue/PR history, and `docs/superpowers/`.

If any real current consumer or required automation dependency is discovered, implementation must stop and architecture must be amended.

## 3. Authorized implementation scope

Only these implementation changes are authorized:

1. delete:
   - `汐東收發文三頁_R888_修復驗證報告.txt`

2. add:
   - `tests/issue-93-retire-r888-repair-verification-report.test.cjs`

No replacement report, copied evidence file, compatibility alias, redirect, generated surrogate, publisher mutation, workflow mutation, or release metadata mutation is authorized.

## 4. Explicit no-change boundary

The following are locked unless a failure proves the written spec itself is invalid:

- `tasun-version.json`
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- `.github/workflows/tasun-pr-checks.yml`
- `.github/workflows/r1144-tests.yml`
- `docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md`
- `tasun-resources.json`
- `tasun-version-loader.js`
- `tasun-core.js`
- `tasun-boot.js`
- `tasun-auth-v4.js`
- `tasun-cloudwrap-v4.js`
- `tasun-guard-v5.js`
- `tasun-global-core.js`
- `index.html`
- `inline.js`
- `tasun-api/index.html`
- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`
- current storage/data schemas

No manual R-number, build string, releaseSequence, formal-page SHA, or release metadata edit is authorized.

## 5. TDD sequence

### 5.1 RED — tests-only commit first

Create only:

`tests/issue-93-retire-r888-repair-verification-report.test.cjs`

The RED test must contain three independent contracts.

### Contract A — stale R888 report must be absent

Assert:

`fs.existsSync(path.join(ROOT,'汐東收發文三頁_R888_修復驗證報告.txt')) === false`

On the pre-change baseline this must fail because the stale report still exists.

### Contract B — current release/test authority remains present

Assert all of the following exist as regular files:

- `tasun-version.json`
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- `.github/workflows/tasun-pr-checks.yml`
- `docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md`

Also assert:
- current `tasun-version.json` contains a valid formal release build identity;
- releaseSequence is numeric and does not regress below the approved R1155 implementation baseline;
- the PR-check workflow still runs regression tests and disposable exact-release verification.

This contract is expected to pass already in RED and must tolerate legitimate disposable release progression.

### Contract C — no live consumer of stale R888 report exists

Recursively scan live source/config files while excluding:
- `.git/`
- `node_modules/`
- `docs/`
- `tests/`
- historical Markdown/text artifacts

Include active source/config extensions at minimum:
- html / htm
- js / mjs / cjs
- json
- yaml / yml
- toml
- sql

The scan must return zero references to:
- `汐東收發文三頁_R888_修復驗證報告.txt`
- path joins/resolves that target that filename.

The test must also prove:
- no runtime file treats the stale report as release/test metadata;
- publisher/workflow authority remains on current canonical files;
- formal four-page source files remain present.

### Expected RED evidence

The RED run must be recorded before production deletion.

Required RED state:
- exactly Contract A fails because the stale R888 report still exists;
- Contract B passes;
- Contract C passes;
- all pre-existing regression tests remain green.

If RED fails for any additional reason, stop and diagnose before GREEN.

## 6. GREEN implementation

After valid RED evidence:

1. delete exactly root `汐東收發文三頁_R888_修復驗證報告.txt`;
2. do not edit existing tests except the new Issue #93 focused regression;
3. do not edit workflow files;
4. do not edit publisher/release logic;
5. do not edit formal HTML pages;
6. do not create replacement historical reports;
7. do not manually alter release metadata.

The intended semantic production diff is exactly one deletion.

## 7. GREEN acceptance

After deletion, the Issue #93 focused regression must prove:

- stale R888 report absent;
- current release/test/governance authorities remain present;
- no live consumer/reference exists;
- publisher/workflow/formal-page behavior remains unchanged.

## 8. Full regression gate

Run the repository's complete regression suite, including all existing Issue protections through Issue #93 and release/runtime tests.

Required outcome:
- all tests PASS;
- Issue #93 focused tests PASS;
- no pre-existing regression is weakened, skipped, renamed away, or removed to obtain green.

Record:
- workflow run ID;
- total test count;
- pass count;
- fail count.

## 9. Disposable exact-release gate

Run the existing disposable exact-release verification on the final implementation head.

Required outcome:
- disposable exact-release generation/verification PASS;
- post-disposable regression PASS if the workflow performs it;
- no formal Pages deployment from the PR branch.

Focused Issue #93 tests must tolerate legitimate disposable release progression and must not pin execution to exactly R1155 if the disposable publisher legally advances temporary metadata.

## 10. Semantic diff gate

Compare the final implementation branch against the implementation baseline.

Allowed changed paths only:
- deleted `汐東收發文三頁_R888_修復驗證報告.txt`;
- added `tests/issue-93-retire-r888-repair-verification-report.test.cjs`.

Any other file is scope drift and blocks merge unless the written spec is formally amended.

## 11. Locked-file audit

Before merge, compare blob SHAs from baseline and final head for every explicit no-change file in Section 4.

Required result:
- all locked files blob-identical.

This audit is independent of semantic diff summary.

## 12. Independent review gate

Request Codex review on the final head.

Review focus:
- whether any current source/config consumes the stale R888 report;
- whether deletion can affect runtime/release/test behavior;
- whether the focused test correctly distinguishes historical evidence from current authority;
- whether implementation scope is exactly the approved deletion plus focused regression;
- whether RED/GREEN evidence is valid and complete.

All valid findings must be addressed and re-reviewed before merge.

## 13. Merge policy

Only after all gates pass:
- final CI GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- independent review clear;
- no unresolved valid review thread;

then merge the implementation PR using an allowed repository merge method while preserving the verified final head and TDD evidence.

If merge commits are disallowed, prefer rebase merge over squash when preserving RED→GREEN history materially improves auditability.

## 14. Post-merge release behavior

Because `汐東收發文三頁_R888_修復驗證報告.txt` is a root historical text artifact and is not part of current publisher `CORE_FILES`, the expected post-merge behavior is:

- Exact Auto Release may or may not trigger depending on current workflow path filters;
- if triggered, autoscan should report no formal page/core/manifest change to sync;
- no generated release metadata commit should be required;
- formal build/releaseSequence should remain unchanged unless the actual workflow legitimately determines otherwise.

At specification time the expected unchanged formal identity is:
- build: `20261013_tasun_v5_xidong_docs_r1155_6496a23cb51e_release`
- releaseSequence: `1155`

This is an expectation, not authorization to force the result.

## 15. Post-merge verification

After merge:

1. verify implementation merge SHA on `main`;
2. verify root `汐東收發文三頁_R888_修復驗證報告.txt` is absent;
3. verify current release/test/governance authorities remain present and unchanged;
4. inspect any triggered Exact Auto Release workflow to terminal state;
5. record autoscan release-relevance result;
6. record whether a generated metadata commit was created;
7. verify final `tasun-version.json` blob/build/releaseSequence;
8. verify deployed exact four-page build/sequence/SHA if deployment is triggered;
9. verify all locked authorities remain unchanged except any legitimate workflow-generated release metadata.

## 16. Closure evidence required on Issue #93

Before closing, record:

- architecture approval date;
- written-spec approval date;
- implementation baseline SHA;
- RED tests-only commit SHA;
- RED workflow run ID and test counts;
- expected RED failure evidence;
- GREEN/final head SHA;
- full regression workflow run and counts;
- disposable exact-release result;
- semantic diff result;
- locked-file audit result;
- independent review result;
- implementation PR merge SHA;
- post-merge workflow run ID/result or explicit “not triggered”;
- autoscan release-relevance result if applicable;
- generated metadata commit SHA or explicit none;
- final formal build;
- final releaseSequence;
- proof stale R888 report is absent;
- proof current release/test/governance authorities remain intact.

Close Issue #93 only when every acceptance item is satisfied.

## 17. Governance gate

Current gate:

- [x] Architecture Option A explicitly approved by user on 2026-10-13
- [x] Written spec drafted
- [ ] Written spec explicitly approved by user
- [ ] Implementation / TDD authorized

**Stop at the written-spec approval gate. Implementation begins only after explicit written-spec approval.**
