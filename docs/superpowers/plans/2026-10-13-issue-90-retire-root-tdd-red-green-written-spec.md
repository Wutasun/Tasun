# Issue #90 — Written Spec: Retire Stale Root TDD_RED_GREEN Snapshot

Date: 2026-10-13  
Issue: #90 — `[REQ] Retire stale root TDD_RED_GREEN snapshot`  
Approved architecture: **Option A**  
Implementation baseline at specification time: `3ec5ec3fea1c9a63ee8dd9c4ee40867695d24554`  
Formal build at specification time: `20261013_tasun_v5_xidong_docs_r1155_6496a23cb51e_release`  
Release sequence at specification time: `1155`  
Status: **WRITTEN SPEC DRAFTED / IMPLEMENTATION-TDD NOT YET AUTHORIZED**

## 1. Goal

Retire the stale root `TDD_RED_GREEN.txt` historical TDD snapshot so an old one-off RED/GREEN report cannot be mistaken for current CI or governance evidence.

The file is dated 2026-10-12 and records historical cloud-sync / parent-document-link verification. Current TDD authority is the repository test suite, GitHub Actions runs, PR/Issue review evidence, and written specs under `docs/superpowers/`.

This is a historical-artifact retirement only. It must not change runtime, cloud, authentication, storage, UI, formal pages, publisher, workflow, release, or data behavior.

## 2. Verified precondition

Before RED implementation begins, re-verify on the latest implementation baseline:

1. root `TDD_RED_GREEN.txt` exists;
2. it is historical verification evidence, not executable/current authority;
3. exact live-source/config search finds no consumer of `TDD_RED_GREEN.txt`;
4. current TDD/governance authority remains:
   - repository tests;
   - `.github/workflows/tasun-pr-checks.yml`;
   - Issue/PR review history;
   - `docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md`;
   - current written specs.

If any real current consumer or required automation dependency is discovered, implementation must stop and architecture must be amended.

## 3. Authorized implementation scope

Only these implementation changes are authorized:

1. delete:
   - `TDD_RED_GREEN.txt`

2. add:
   - `tests/issue-90-retire-root-tdd-red-green-snapshot.test.cjs`

No replacement snapshot, copied report, generated surrogate, compatibility alias, redirect, workflow rewrite, or release metadata mutation is authorized.

## 4. Explicit no-change boundary

The following are locked unless a failure proves the written spec itself is invalid:

- `.github/workflows/tasun-pr-checks.yml`
- `.github/workflows/release-version.yml`
- `.github/workflows/r1144-tests.yml`
- `docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md`
- `tasun-version.json`
- `publish-version_tasun_project_autoscan.mjs`
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

No manual R-number, build string, releaseSequence, or release metadata edit is authorized.

## 5. TDD sequence

### 5.1 RED — tests-only commit first

Create only:

`tests/issue-90-retire-root-tdd-red-green-snapshot.test.cjs`

The RED test must contain three independent contracts.

### Contract A — stale root TDD snapshot must be absent

Assert:

`fs.existsSync(path.join(ROOT,'TDD_RED_GREEN.txt')) === false`

On the pre-change baseline this must fail because the stale snapshot still exists.

### Contract B — current TDD/governance authority remains present

Assert all of the following exist as regular files:

- `.github/workflows/tasun-pr-checks.yml`
- `docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md`
- at least one current repository regression test file under `tests/`

Also assert that the PR workflow still executes the repository regression suite and disposable exact-release verification.

This contract is expected to pass already in RED.

### Contract C — no live consumer of TDD_RED_GREEN.txt exists

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
- `TDD_RED_GREEN.txt`
- path joins/resolves that target that filename.

The test must also prove:
- current PR-check workflow authority remains `.github/workflows/tasun-pr-checks.yml`;
- current release authority remains `tasun-version.json` + publisher/workflow;
- no runtime file treats `TDD_RED_GREEN.txt` as test or release metadata.

### Expected RED evidence

The RED run must be recorded before production deletion.

Required RED state:
- exactly Contract A fails because `TDD_RED_GREEN.txt` still exists;
- Contract B passes;
- Contract C passes;
- all pre-existing regression tests remain green.

If RED fails for any additional reason, stop and diagnose before GREEN.

## 6. GREEN implementation

After valid RED evidence:

1. delete exactly root `TDD_RED_GREEN.txt`;
2. do not edit existing tests except the new Issue #90 focused regression;
3. do not edit workflow files;
4. do not edit publisher/release logic;
5. do not edit formal HTML pages;
6. do not create replacement historical TDD reports;
7. do not manually alter release metadata.

The intended semantic production diff is exactly one deletion.

## 7. GREEN acceptance

After deletion, the Issue #90 focused regression must prove:

- root `TDD_RED_GREEN.txt` absent;
- current test/workflow/governance authorities remain present;
- no live consumer/reference exists;
- release/runtime authority remains unchanged.

## 8. Full regression gate

Run the repository's complete regression suite, including all existing Issue protections through Issue #90 and release/runtime tests.

Required outcome:
- all tests PASS;
- Issue #90 focused tests PASS;
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

Focused Issue #90 tests must tolerate legitimate disposable release progression and must not pin the runtime test execution to one exact R-number if the disposable publisher advances release metadata in its temporary worktree.

## 10. Semantic diff gate

Compare the final implementation branch against the implementation baseline.

Allowed changed paths only:
- deleted `TDD_RED_GREEN.txt`;
- added `tests/issue-90-retire-root-tdd-red-green-snapshot.test.cjs`.

Any other file is scope drift and blocks merge unless the written spec is formally amended.

## 11. Locked-file audit

Before merge, compare blob SHAs from baseline and final head for every explicit no-change file in Section 4.

Required result:
- all locked files blob-identical.

This audit is independent of semantic diff summary.

## 12. Independent review gate

Request Codex review on the final head.

Review focus:
- whether any current source/config actually consumes `TDD_RED_GREEN.txt`;
- whether the test distinguishes historical evidence from current TDD/governance authority;
- whether deleting the stale snapshot can affect CI/runtime/release behavior;
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

Because `TDD_RED_GREEN.txt` is a root text artifact and is not part of current publisher `CORE_FILES`, the expected post-merge behavior is:

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
2. verify root `TDD_RED_GREEN.txt` is absent;
3. verify current test/workflow/governance authorities remain present and unchanged;
4. inspect any triggered Exact Auto Release workflow to terminal state;
5. record autoscan release-relevance result;
6. record whether a generated metadata commit was created;
7. verify final `tasun-version.json` blob/build/releaseSequence;
8. verify deployed exact four-page build/sequence/SHA if deployment is triggered;
9. verify all locked authorities remain unchanged except any legitimate workflow-generated release metadata.

## 16. Closure evidence required on Issue #90

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
- proof `TDD_RED_GREEN.txt` is absent;
- proof current TDD/governance authorities remain intact.

Close Issue #90 only when every acceptance item is satisfied.

## 17. Governance gate

Current gate:

- [x] Architecture Option A explicitly approved by user on 2026-10-13
- [x] Written spec drafted
- [ ] Written spec explicitly approved by user
- [ ] Implementation / TDD authorized

**Stop at the written-spec approval gate. Implementation begins only after explicit written-spec approval.**
