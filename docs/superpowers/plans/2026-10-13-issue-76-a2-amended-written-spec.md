# Issue #76 — Amended Written Spec A2: Deployment-surface-aware Publisher + Generated Metadata Cleanup

Date: 2026-10-13  
Issue: #76 — `[REQ] Prevent exact publisher from restoring non-deployed tasun-api page authority`  
Base architecture: **Option A**  
Architecture amendment: **A2 approved**  
Blocker for: **Issue #73**  
Governance baseline: `614a5f57282e38aa3661e9ad94e7d8b1beef74f0`  
Formal build before implementation: `20261012_tasun_v5_xidong_docs_r1154_425da05a1ae8_release`  
Release sequence before implementation: `1154`  
Status: **AMENDED WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD RESUME AUTHORIZED AFTER GOVERNANCE MERGE**

## 1. Purpose of this amendment

The original written spec correctly prohibited manual edits to `tasun-version.json`, but a pre-merge GREEN state cannot be achieved while the branch still contains the already-bad R1154 manifest entry:

`pages["tasun-api/index.html"]`

A2 preserves the no-manual-edit rule and authorizes only a **publisher-generated metadata-only cleanup** after the publisher code itself is repaired.

## 2. Existing RED evidence remains valid

Existing RED evidence from PR #78 remains the official RED record:

- RED commit: `1190038de3d9a9dc14b53f217aee0746eeb3bc07`
- RED CI run: `38327630317`
- 157 tests
- 152 pass
- 5 fail

Expected failures reproduced:
- Issue #76 current forbidden authority exists;
- Issue #76 publisher reintroduction simulation fails.

Expected guard passed:
- Pages packaging excludes `tasun-api/`.

Existing Issue #56 A2 failures are part of the same root cause.

No new RED cycle is required unless implementation materially changes the test contract.

## 3. Authorized manual source changes

Manual implementation changes are limited to:

- modify `publish-version_tasun_project_autoscan.mjs`;
- add/adjust only `tests/issue-76-publisher-deployment-surface.test.cjs`.

No manual edit to generated release metadata is allowed.

## 4. Authorized generated metadata changes

After the publisher fix passes focused simulation, the repaired publisher may generate a cleanup commit affecting only:

- `tasun-version.json`;
- `TASUN_REBUILD`;
- `TASUN_REBUILD_STAMP`.

The cleanup must be produced by executing the repaired publisher, not by editing these files directly.

Expected normal result:
- `tasun-version.json` changes to remove forbidden deployment-excluded authority;
- rebuild files remain unchanged if formal identity is preserved.

If generated cleanup touches any additional path, stop and inspect before commit.

## 5. Locked formal identity during pre-merge cleanup

The pre-merge metadata-only cleanup must preserve exactly:

- version: `20261012_tasun_v5_xidong_docs_r1154_425da05a1ae8_release`;
- cacheV: same build;
- buildStamp: same build;
- rebuildStamp: same build;
- releaseSequence: `1154`;
- release.releaseSequence: `1154`.

No R1155 or other new R-number may be created during this cleanup.

## 6. Locked source and deployment topology

During pre-merge implementation:

- `tasun-api/index.html` source must remain blob-identical to baseline;
- `.github/workflows/release-version.yml` must remain blob-identical;
- the workflow must continue excluding `tasun-api/`;
- the four formal document pages must remain blob-identical;
- no UI, auth, cloud, Worker, data-schema, or Pages topology change is authorized.

## 7. Publisher implementation requirements

The repaired publisher must include a deterministic helper or equivalent logic for public deployment eligibility.

Minimum rule:

`tasun-api/*` is deployment-excluded and therefore cannot be public page authority.

The publisher must apply this rule at all relevant authority-generation points:

### 7.1 Relevant changed-file classification

A changed deployment-excluded HTML file must not be promoted into the public formal HTML set.

### 7.2 Page authority normalization

Before writing `next.pages`:
- remove every entry whose `entry.file` is deployment-excluded.

### 7.3 Page artifact normalization

Before writing `next.pageArtifactManifest`:
- remove every deployment-excluded artifact path.

### 7.4 Page build-stamp normalization

Before writing `next.pageBuildStamp`:
- remove every deployment-excluded path key.

### 7.5 Canonical four pages

The canonical four formal pages must remain mandatory and must never be filtered by the deployment-exclusion helper.

## 8. Metadata-only cleanup mode

After publisher code is repaired, run the publisher with an explicitly metadata-only changed-file input such as:

`TASUN_CHANGED_FILES=tasun-version.json`

The purpose is to force normalization of current generated metadata without introducing a real formal/core source change.

Required behavior:
- preserve R1154;
- preserve releaseSequence 1154;
- remove `tasun-api/index.html` from `pages`;
- remove any `tasun-api/*` entry from `pageArtifactManifest`;
- remove any `tasun-api/*` entry from `pageBuildStamp`;
- preserve formal four-page identities and SHAs;
- leave `tasun-api/index.html` source untouched.

## 9. Cleanup commit classification

The implementation branch may contain two categories of commits:

### Manual implementation commits
- publisher source;
- focused test.

### Publisher-generated cleanup commit
- generated metadata only.

The generated cleanup commit message must clearly state that it is publisher-generated metadata normalization, not a manual version change.

## 10. No PR-branch formal deployment

Do not run or trigger a formal GitHub Pages deployment from the implementation branch.

Allowed before merge:
- repository regression CI;
- isolated publisher simulation;
- metadata-only local publisher execution;
- disposable exact-release verification.

Formal Exact Auto Release / Pages deployment occurs only after merge to `main`.

## 11. Focused GREEN gate

Before metadata cleanup commit, the focused isolated publisher simulation must prove:

- a changed `tasun-api/index.html` does not create public page authority;
- `pageArtifactManifest` does not gain `tasun-api/index.html`;
- `pageBuildStamp` does not gain `tasun-api/index.html`;
- formal four-page authorities remain.

## 12. Repository GREEN gate after generated cleanup

After publisher-generated metadata cleanup is committed:

Required:
- Issue #76 focused tests PASS;
- Issue #56 A2 tests PASS;
- full regression suite PASS;
- no forbidden `tasun-api/*` authority remains anywhere in generated manifest authority structures.

This is the first point at which PR #78 is eligible for full merge-gate evaluation.

## 13. Full regression evidence

Record:
- workflow run ID;
- total tests;
- pass count;
- fail count.

Required:
- fail count = 0.

No skip/removal/weakening of existing tests is permitted.

## 14. Disposable exact-release gate

Run the existing disposable exact-release verification on the final implementation head.

Required:
- PASS;
- formal four-page exact contract PASS;
- no forbidden deployment-excluded page authority;
- no publication from branch;
- no unexpected formal identity drift caused by the pre-merge cleanup.

## 15. Semantic diff audit

Against implementation baseline `614a5f57282e38aa3661e9ad94e7d8b1beef74f0`, allowed changed paths are:

Manual:
- `publish-version_tasun_project_autoscan.mjs`
- `tests/issue-76-publisher-deployment-surface.test.cjs`

Publisher-generated:
- `tasun-version.json`
- `TASUN_REBUILD`
- `TASUN_REBUILD_STAMP`

No other path is allowed.

The audit must identify which changes are manual and which are generated.

## 16. Locked-file audit

The following must remain blob-identical to baseline before merge:

- `tasun-api/index.html`
- `tasun-resources.json`
- `tasun-cloud-kit.js`
- `tasun-cloudwrap-v4.js`
- `tasun-auth-v4.js`
- `tasun-api/worker.js`
- `index.html`
- `inline.js`
- `.github/workflows/release-version.yml`
- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`

## 17. Independent review gate

Request Codex review after the final generated cleanup state is committed.

Review must verify:
- publisher eligibility logic matches current Pages exclusion;
- no legitimate formal page is excluded;
- forbidden authority cleanup is complete across all manifest structures;
- metadata-only execution preserves R1154/1154;
- no hand-edited generated metadata;
- no four-page mutation;
- no source deletion;
- tests reproduce the original recurrence path.

Valid in-scope findings may be fixed automatically, followed by rerun and re-review.

## 18. Merge gate

PR #78 may merge only when all are true:

- publisher focused GREEN;
- publisher-generated cleanup committed;
- Issue #56 A2 GREEN;
- full regression GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- independent review clear;
- no unresolved valid review thread.

Squash merge using verified final head SHA.

## 19. Post-merge Exact Auto Release

After merge to `main`, the publisher source change is a release-relevant core change.

The normal Exact Auto Release workflow may generate the next formal release.

Rules:
- do not predict or force the R-number in implementation;
- record actual run ID;
- record actual generated metadata commit;
- record final build and releaseSequence;
- verify four-page deployment exactness.

## 20. Post-merge authority verification

Final `main` must prove:

- no `pages` entry points into `tasun-api/`;
- no `pageArtifactManifest` entry exists for `tasun-api/*`;
- no `pageBuildStamp` entry exists for `tasun-api/*`;
- `tasun-api/index.html` source still exists;
- Pages packaging still excludes `tasun-api/`;
- Issue #56 A2 tests are GREEN;
- full regression is GREEN.

## 21. Issue #73 resume contract

Only after Issue #76 post-merge verification succeeds:

1. update Issue #73 blocker status;
2. resynchronize Issue #73 implementation branch from latest repaired `main`;
3. preserve its existing test-only intent;
4. rerun RED;
5. required RED state:
   - only root `resources.json` absence contract fails;
   - all Issue #56/Issue #76 regressions pass;
6. proceed automatically to Issue #73 GREEN;
7. no new architecture or written-spec approval is needed unless Issue #73 scope changes.

## 22. Closure evidence

Before closing Issue #76, record:

- Option A approval;
- original written-spec approval;
- A2 architecture approval;
- amended written-spec approval;
- governance merge SHAs;
- RED commit/run/counts;
- publisher source fix commit;
- generated metadata cleanup commit;
- proof pre-merge build stayed R1154/1154;
- final full regression run/counts;
- disposable exact-release;
- semantic diff;
- locked-file audit;
- Codex review;
- merge SHA;
- post-merge Exact Auto Release run;
- generated release metadata commit;
- final formal build/releaseSequence;
- proof forbidden authority absent;
- proof source retained;
- proof Issue #56 A2 GREEN;
- proof Issue #73 unblocked.

## 23. Governance gate

Current gate:
- [x] Original Option A architecture approved
- [x] Original written spec approved
- [x] A2 architecture amendment explicitly approved by user on 2026-10-13
- [x] Amended written spec drafted
- [x] Amended written spec explicitly approved by user on 2026-10-13
- [x] Implementation / TDD authorized to resume after governance PR merge

**Amended written-spec gate passed. After governance PR merge, continue automatically under the project-wide automatic progression rule.**
