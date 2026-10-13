# Issue #87 — Written Spec: Retire Stale Issue #41 Release Snapshot

Date: 2026-10-13  
Issue: #87 — `[REQ] Retire stale Issue #41 release snapshot`  
Approved architecture: **Option A**  
Implementation baseline at specification time: `f48cd7b670d6c04362ae0255292adee1411e807c`  
Formal build at specification time: `20261013_tasun_v5_xidong_docs_r1155_6496a23cb51e_release`  
Release sequence at specification time: `1155`  
Status: **WRITTEN SPEC DRAFTED / IMPLEMENTATION-TDD NOT YET AUTHORIZED**

## 1. Goal

Retire the stale root `ISSUE41_RELEASE_INFO.txt` snapshot so historical Issue #41 closure evidence cannot be mistaken for current release authority.

The file currently embeds R1149-era release information while the repository formal authority is R1155. This is a historical-artifact retirement only. It must not alter current release, deployment, page, runtime, cloud, authentication, storage, UI, or data behavior.

## 2. Verified precondition

Before RED implementation begins, re-verify on the latest implementation baseline:

1. root `ISSUE41_RELEASE_INFO.txt` exists;
2. it is a historical Issue #41 closure/release snapshot;
3. its embedded build/release identity is stale relative to current `tasun-version.json`;
4. exact live-source/config search finds no consumer of `ISSUE41_RELEASE_INFO.txt`;
5. current release authority remains `tasun-version.json` plus `publish-version_tasun_project_autoscan.mjs` and `.github/workflows/release-version.yml`.

If any real current consumer or release dependency is discovered, implementation must stop and architecture must be amended.

## 3. Authorized implementation scope

Only these implementation changes are authorized:

1. delete:
   - `ISSUE41_RELEASE_INFO.txt`

2. add:
   - `tests/issue-87-retire-issue41-release-snapshot.test.cjs`

No replacement snapshot, copied release note, compatibility alias, redirect, generated surrogate, or version metadata mutation is authorized.

## 4. Explicit no-change boundary

The following are locked unless a failure proves the written spec itself is invalid:

- `tasun-version.json`
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- `.github/workflows/r1144-tests.yml`
- `.github/workflows/tasun-pr-checks.yml`
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

`tests/issue-87-retire-issue41-release-snapshot.test.cjs`

The RED test must contain three independent contracts.

### Contract A — stale root snapshot must be absent

Assert:

`fs.existsSync(path.join(ROOT,'ISSUE41_RELEASE_INFO.txt')) === false`

On the pre-change baseline this must fail because the stale snapshot still exists.

### Contract B — current release authority remains present

Assert:
- `tasun-version.json` exists;
- `publish-version_tasun_project_autoscan.mjs` exists;
- `.github/workflows/release-version.yml` exists.

Additionally verify current `tasun-version.json` still reflects the formal R1155 identity / releaseSequence 1155 at the implementation baseline, without hard-coding an authorization to rewrite those values.

This contract is expected to pass already in RED.

### Contract C — no live consumer of ISSUE41_RELEASE_INFO.txt exists

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
- `ISSUE41_RELEASE_INFO.txt`
- path joins/resolves that target that filename.

The test must also prove:
- publisher authority is still `publish-version_tasun_project_autoscan.mjs`;
- release workflow authority is still `.github/workflows/release-version.yml`;
- no runtime file treats the stale snapshot as release metadata.

### Expected RED evidence

The RED run must be recorded before production deletion.

Required RED state:
- exactly Contract A fails because `ISSUE41_RELEASE_INFO.txt` still exists;
- Contract B passes;
- Contract C passes;
- all pre-existing regression tests remain green.

If RED fails for any additional reason, stop and diagnose before GREEN.

## 6. GREEN implementation

After valid RED evidence:

1. delete exactly root `ISSUE41_RELEASE_INFO.txt`;
2. do not edit `tasun-version.json`;
3. do not edit publisher/workflow files;
4. do not edit formal HTML pages;
5. do not create replacement historical release snapshots;
6. do not manually alter release metadata.

The intended semantic production diff is exactly one deletion.

## 7. GREEN acceptance

After deletion, the Issue #87 focused regression must prove:

- root `ISSUE41_RELEASE_INFO.txt` absent;
- current release authority files remain present;
- no live consumer/reference exists;
- `tasun-version.json` authority remains unchanged;
- publisher/workflow behavior remains unchanged.

## 8. Full regression gate

Run the repository's complete regression suite, including all existing Issue #14 through Issue #87 protections and release/runtime tests.

Required outcome:
- all tests PASS;
- Issue #87 focused tests PASS;
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

## 10. Semantic diff gate

Compare the final implementation branch against the implementation baseline.

Allowed changed paths only:
- deleted `ISSUE41_RELEASE_INFO.txt`;
- added `tests/issue-87-retire-issue41-release-snapshot.test.cjs`.

Any other file is scope drift and blocks merge unless the written spec is formally amended.

## 11. Locked-file audit

Before merge, compare blob SHAs from baseline and final head for every explicit no-change file in Section 4.

Required result:
- all locked files blob-identical.

This audit is independent of semantic diff summary.

## 12. Independent review gate

Request Codex review on the final head.

Review focus:
- whether any current source/config actually consumes `ISSUE41_RELEASE_INFO.txt`;
- whether deleting the stale snapshot could affect release/runtime behavior;
- whether current release authority remains exclusively `tasun-version.json` + publisher/workflow;
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

Because `ISSUE41_RELEASE_INFO.txt` is a root text artifact and is not part of current publisher `CORE_FILES`, the expected post-merge behavior is:

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
2. verify root `ISSUE41_RELEASE_INFO.txt` is absent;
3. verify current release authority files remain present and unchanged;
4. inspect any triggered Exact Auto Release workflow to terminal state;
5. record autoscan release-relevance result;
6. record whether a generated metadata commit was created;
7. verify final `tasun-version.json` blob/build/releaseSequence;
8. verify deployed exact four-page build/sequence/SHA if deployment is triggered;
9. verify all locked authorities remain unchanged except any legitimate workflow-generated release metadata.

## 16. Closure evidence required on Issue #87

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
- proof `ISSUE41_RELEASE_INFO.txt` is absent;
- proof current release authority remains intact.

Close Issue #87 only when every acceptance item is satisfied.

## 17. Governance gate

Current gate:

- [x] Architecture Option A explicitly approved by user on 2026-10-13
- [x] Written spec drafted
- [ ] Written spec explicitly approved by user
- [ ] Implementation / TDD authorized

**Stop at the written-spec approval gate. Implementation begins only after explicit written-spec approval.**
