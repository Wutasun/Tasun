# Issue #73 — Written Spec: Retire Orphan Legacy Root resources.json Manifest

Date: 2026-10-12  
Issue: #73 — `[REQ] Retire orphan legacy root resources.json manifest`  
Approved architecture: **Option A**  
Implementation baseline before governance merge: `d426bf83b20759a4c9e408501a465eb19a91f1fd`  
Formal build at specification time: `20261012_tasun_v5_xidong_docs_r1154_425da05a1ae8_release`  
Release sequence at specification time: `1154`  
Status: **WRITTEN SPEC COMPLETE / PENDING EXPLICIT APPROVAL / NO IMPLEMENTATION AUTHORITY**

## 1. Goal

Retire the dormant root `resources.json` file so that the repository has one supported resource-manifest authority: `tasun-resources.json`.

This is a legacy-authority retirement only. It must not alter current cloud, Worker, authentication, navigation, page, storage, or release behavior.

## 2. Verified precondition

Before RED implementation begins, re-verify on the latest implementation baseline:

1. root `resources.json` exists;
2. exact live-source search finds no standalone root `resources.json` reference;
3. `tasun-resources.json` exists;
4. supported runtime consumers still reference `tasun-resources.json`;
5. the release publisher's `CORE_FILES` contains `tasun-resources.json` and does not contain root `resources.json`.

If any real current consumer of root `resources.json` is discovered, implementation must stop and the architecture must be amended.

## 3. Authorized implementation scope

Only these implementation changes are authorized:

1. delete:
   - `resources.json`

2. add:
   - `tests/issue-73-retire-root-resources.test.cjs`

No compatibility alias, redirect, copied manifest, fallback manifest, or renamed replacement is authorized.

## 4. Explicit no-change boundary

The following are locked unless a failure proves the written spec itself is invalid:

- `tasun-resources.json`
- `tasun-cloud-kit.js`
- `tasun-cloudwrap-v4.js`
- `tasun-auth-v4.js`
- `tasun-api/worker.js`
- `index.html`
- `inline.js`
- `tasun-api/index.html`
- `tasun-version.json`
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`
- current storage/data schemas

No manual R-number or release metadata edit is authorized.

## 5. TDD sequence

### 5.1 RED — tests-only commit first

Create only:

`tests/issue-73-retire-root-resources.test.cjs`

The RED test must contain three contracts.

### Contract A — retired root manifest must be absent

Assert:

`fs.existsSync(path.join(ROOT,'resources.json')) === false`

On the pre-change baseline this must fail because the legacy file still exists.

### Contract B — no live standalone root resources.json reference

Recursively scan live repository source files while excluding:
- `.git/`
- `node_modules/`
- `docs/`
- `tests/`
- Markdown/text historical material

Include active source/config extensions at minimum:
- html / htm
- js / mjs / cjs
- json
- yaml / yml
- toml

The matcher must distinguish standalone `resources.json` from the valid current filename `tasun-resources.json`.

A suitable contract is a boundary-aware pattern equivalent to:

`/(^|[^A-Za-z0-9_-])resources\.json(?=$|[^A-Za-z0-9_.-])/`

The live-source scan must return zero hits.

This contract is expected to pass already in RED. It protects against future reintroduction of a root-manifest consumer.

### Contract C — current supported resource authority remains present and consumed

Assert:
- `tasun-resources.json` exists;
- the following current consumers still contain `tasun-resources.json`:
  - `tasun-cloud-kit.js`
  - `tasun-cloudwrap-v4.js`
  - `index.html`
  - `inline.js`
  - `tasun-api/index.html`
- `publish-version_tasun_project_autoscan.mjs` contains `tasun-resources.json` in current release authority and does not promote standalone root `resources.json`.

Do not merely search for the substring `resources.json` because that would create false positives from `tasun-resources.json`.

### Expected RED evidence

The RED run must be recorded before production deletion.

Expected focused/full-suite state:
- exactly the new absence contract fails because `resources.json` still exists;
- the no-live-reference contract passes;
- current-authority-presence contract passes;
- all pre-existing regression tests remain green.

If RED fails for an additional reason, stop and diagnose before GREEN.

## 6. GREEN implementation

After valid RED evidence:

1. delete exactly `resources.json`;
2. do not edit `tasun-resources.json`;
3. do not rewrite any consumer;
4. do not add fallback/alias compatibility code;
5. do not manually alter release metadata.

The intended semantic production diff is exactly one deletion.

## 7. GREEN acceptance

After deletion, the Issue #73 focused regression must prove:

- root `resources.json` absent;
- zero live standalone references;
- `tasun-resources.json` present;
- supported consumers still reference `tasun-resources.json`;
- publisher authority still names `tasun-resources.json`, not root `resources.json`.

## 8. Full regression gate

Run the repository's complete regression suite, including all existing Issue #14 through Issue #70 protections and release/runtime tests.

Required outcome:
- all tests PASS;
- Issue #73 focused tests PASS;
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
- no formal release publication from the PR branch.

## 10. Semantic diff gate

Compare the final implementation branch against the post-governance implementation baseline.

Allowed changed paths only:
- deleted `resources.json`;
- added `tests/issue-73-retire-root-resources.test.cjs`.

Any other file is scope drift and blocks merge unless the written spec is formally amended.

## 11. Locked-file audit

Before merge, fetch blob SHAs from the implementation baseline and final head for every explicit no-change file in Section 4.

Required result:
- all locked files are blob-identical.

This audit is independent of the semantic diff summary.

## 12. Independent review gate

Request Codex review on the final head.

Review focus:
- whether a real current root-`resources.json` consumer was missed;
- whether the test matcher correctly distinguishes `resources.json` from `tasun-resources.json`;
- whether the supported resource authority remains unchanged;
- whether any compatibility alias or second authority was introduced;
- whether implementation scope is exactly the approved deletion plus focused regression.

All valid findings must be addressed and re-reviewed before merge.

## 13. Merge policy

Only after all gates pass:
- final CI GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- independent review clear;
- no unresolved valid review thread;

then squash-merge the implementation PR using the verified final head SHA.

## 14. Post-merge release behavior

Because `resources.json` is a JSON file, the current workflow path filter is expected to trigger the Exact Auto Release workflow on merge.

However, root `resources.json` is not in the publisher's current `CORE_FILES` set. Therefore the expected publisher behavior is:

- workflow triggers;
- autoscan reports no formal page/core/manifest change to sync;
- no generated release metadata commit is required;
- formal build remains the current build unless the actual workflow legitimately determines otherwise.

At specification time the expected unchanged formal identity is:
- build: `20261012_tasun_v5_xidong_docs_r1154_425da05a1ae8_release`
- releaseSequence: `1154`

This is an expectation, not an authorization to force the result. Post-merge verification must report the actual workflow outcome.

## 15. Post-merge verification

After merge:

1. verify implementation merge SHA on `main`;
2. verify Exact Auto Release workflow reaches terminal SUCCESS;
3. inspect autoscan logs for actual release relevance decision;
4. record whether a generated metadata commit was created;
5. verify final `tasun-version.json` build and releaseSequence;
6. verify root `resources.json` is absent on `main`;
7. verify `tasun-resources.json` is present;
8. verify supported consumer references remain;
9. verify deployed exact four-page release build/sequence/SHA succeeds;
10. confirm locked authorities remain unchanged except any legitimate workflow-generated release metadata.

## 16. Closure evidence required on Issue #73

Before closing, record:

- architecture approval date;
- written-spec approval date;
- governance PR merge SHA;
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
- post-merge Exact Auto Release run ID/result;
- autoscan release-relevance result;
- generated metadata commit SHA or explicit none;
- final formal build;
- final releaseSequence;
- proof root `resources.json` is absent;
- proof `tasun-resources.json` and supported consumers remain.

Close Issue #73 only when every acceptance item is satisfied.

## 17. Governance gate

Current gate:

- [x] Architecture Option A explicitly approved by user on 2026-10-12
- [x] Written spec drafted
- [ ] Written spec explicitly approved by user
- [ ] Implementation / TDD authorized

**Next mandatory gate: explicit written-spec approval.**

Recommended decision:

`Issue #73 written spec 核准，進入 implementation / TDD`
