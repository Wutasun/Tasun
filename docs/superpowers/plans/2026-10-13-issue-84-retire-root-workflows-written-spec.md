# Issue #84 — Written Spec: Retire Orphan Empty Root workflows File

Date: 2026-10-13  
Issue: #84 — `[REQ] Retire orphan empty root workflows file`  
Approved architecture: **Option A**  
Implementation baseline at specification time: `d26dab01570b14a973c145e3e5fc5e3b96614211`  
Formal build at specification time: `20261013_tasun_v5_xidong_docs_r1155_6496a23cb51e_release`  
Release sequence at specification time: `1155`  
Status: **WRITTEN SPEC DRAFTED / IMPLEMENTATION-TDD NOT YET AUTHORIZED**

## 1. Goal

Retire the orphan empty root file `workflows` so the repository has one unambiguous GitHub Actions workflow authority under `.github/workflows/`.

This is an orphan-artifact retirement only. It must not alter current release, deployment, page, runtime, cloud, authentication, storage, UI, or formal-build behavior.

## 2. Verified precondition

Before RED implementation begins, re-verify on the latest implementation baseline:

1. root `workflows` exists as a regular blob/file;
2. its content is empty or whitespace-only;
3. `.github/workflows/release-version.yml` exists;
4. `.github/workflows/r1144-tests.yml` exists;
5. no active source/config path treats root `workflows` as an authority or executable workflow source;
6. current publisher/release paths reference `.github/workflows/release-version.yml`, not root `workflows`.

If root `workflows` is found to have a real current consumer or semantic role, implementation must stop and architecture must be amended.

## 3. Authorized implementation scope

Only these implementation changes are authorized:

1. delete:
   - `workflows`

2. add:
   - `tests/issue-84-retire-root-workflows.test.cjs`

No redirect, compatibility alias, symlink, copied file, directory substitution, workflow rewrite, or release-path mutation is authorized.

## 4. Explicit no-change boundary

The following are locked unless a failure proves the written spec itself is invalid:

- `.github/workflows/release-version.yml`
- `.github/workflows/r1144-tests.yml`
- `.github/workflows/tasun-pr-checks.yml`
- `publish-version_tasun_project_autoscan.mjs`
- `tasun-version.json`
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

`tests/issue-84-retire-root-workflows.test.cjs`

The RED test must contain three independent contracts so one failure does not prevent the others from executing.

### Contract A — orphan root workflows file must be absent

Assert:

`fs.existsSync(path.join(ROOT,'workflows')) === false`

On the pre-change baseline this must fail because the orphan root file still exists.

### Contract B — canonical GitHub Actions workflow authority remains present

Assert all of the following exist and remain regular files:

- `.github/workflows/release-version.yml`
- `.github/workflows/r1144-tests.yml`
- `.github/workflows/tasun-pr-checks.yml`

Also assert the root `workflows` path is not a directory.

This contract is expected to pass already in RED.

### Contract C — no live root-workflows authority/consumer

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

The test must reject references that resolve or point to the root file `workflows`, including at minimum patterns equivalent to:
- `./workflows`
- `/workflows` when clearly repository-root-relative
- `path.join(ROOT,'workflows')`
- `path.resolve(ROOT,'workflows')`

The test must not flag legitimate:
- `.github/workflows/...`
- prose mentioning the word “workflows” without path authority semantics.

Additionally assert:
- `publish-version_tasun_project_autoscan.mjs` contains `.github/workflows/release-version.yml`;
- `.github/workflows/release-version.yml` remains the current release workflow authority.

### Expected RED evidence

The RED run must be recorded before production deletion.

Required RED state:
- exactly Contract A fails because root `workflows` still exists;
- Contract B passes;
- Contract C passes;
- all pre-existing regression tests remain green.

If RED fails for any additional reason, stop and diagnose before GREEN.

## 6. GREEN implementation

After valid RED evidence:

1. delete exactly root `workflows`;
2. do not edit any `.github/workflows/*` file;
3. do not edit publisher/release logic;
4. do not modify any formal HTML page;
5. do not manually alter release metadata;
6. do not add compatibility or fallback behavior.

The intended semantic production diff is exactly one deletion.

## 7. GREEN acceptance

After deletion, the Issue #84 focused regression must prove:

- root `workflows` absent;
- canonical `.github/workflows/*` authority files present;
- no live root-workflows authority/consumer exists;
- publisher still names `.github/workflows/release-version.yml`;
- no workflow/runtime/release behavior changed.

## 8. Full regression gate

Run the repository's complete regression suite, including all existing Issue #14 through Issue #84 protections and release/runtime tests.

Required outcome:
- all tests PASS;
- Issue #84 focused tests PASS;
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
- deleted `workflows`;
- added `tests/issue-84-retire-root-workflows.test.cjs`.

Any other file is scope drift and blocks merge unless the written spec is formally amended.

## 11. Locked-file audit

Before merge, compare blob SHAs from baseline and final head for every explicit no-change file in Section 4.

Required result:
- all locked files blob-identical.

This audit is independent of semantic diff summary.

## 12. Independent review gate

Request Codex review on the final head.

Review focus:
- whether root `workflows` has any real current consumer;
- whether the test distinguishes root `workflows` from `.github/workflows/`;
- whether any workflow or publisher authority was changed;
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

If merge commits are disallowed by repository policy, prefer rebase merge over squash when preserving RED→GREEN commit history materially improves auditability.

## 14. Post-merge release behavior

Because root `workflows` has no extension and is not part of publisher `CORE_FILES`, the expected post-merge behavior is:

- the exact release workflow may or may not trigger depending on current path filters;
- if triggered, autoscan should report no formal page/core/manifest change to sync;
- no generated release metadata commit should be required;
- formal build/releaseSequence should remain unchanged unless the current workflow legitimately determines otherwise.

At specification time the expected unchanged formal identity is:
- build: `20261013_tasun_v5_xidong_docs_r1155_6496a23cb51e_release`
- releaseSequence: `1155`

This is an expectation, not authorization to force the result.

## 15. Post-merge verification

After merge:

1. verify implementation merge SHA on `main`;
2. verify root `workflows` is absent;
3. verify canonical `.github/workflows/` files remain present and unchanged;
4. inspect any triggered Exact Auto Release workflow to terminal state;
5. record autoscan release-relevance result;
6. record whether a generated metadata commit was created;
7. verify final `tasun-version.json` build and releaseSequence;
8. verify deployed exact four-page build/sequence/SHA if deployment is triggered;
9. verify all locked authorities remain unchanged except any legitimate workflow-generated release metadata.

## 16. Closure evidence required on Issue #84

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
- proof root `workflows` is absent;
- proof canonical `.github/workflows/` authority remains.

Close Issue #84 only when every acceptance item is satisfied.

## 17. Governance gate

Current gate:

- [x] Architecture Option A explicitly approved by user on 2026-10-13
- [x] Written spec drafted
- [ ] Written spec explicitly approved by user
- [ ] Implementation / TDD authorized

**Stop at the written-spec approval gate. Implementation begins only after explicit written-spec approval.**
