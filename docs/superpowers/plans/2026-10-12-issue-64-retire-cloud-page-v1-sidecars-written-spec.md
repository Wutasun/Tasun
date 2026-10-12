# Issue #64 — Written Spec: Retire Orphan Cloud Page v1 Sidecar Authority

Date: 2026-10-12  
Issue: #64 — `[REQ] Retire orphan cloud-page v1 sidecar authority`  
Approved architecture: **Option A**  
Functional R-number: **NOT ASSIGNED**  
Status: **WRITTEN SPEC COMPLETE / APPROVAL REQUIRED**  
Implementation authority: **BLOCKED pending explicit written-spec approval and governance PR #65 merge**

## 1. Objective

Retire the verified-unreferenced Cloud Page v1 sidecar authority without changing the current Tasun v5 cloud synchronization chain.

The implementation must remove only:
- `tasun-cloud-page-v1.js`
- `tasun-cloud-pages.v1.json`

and add focused regression protection.

No current page/cloud/auth/release behavior may be redesigned under this issue.

## 2. Authoritative baseline

Implementation must re-synchronize to latest `main` immediately before RED work.

Known drafting baseline:
- main: `bff489872d7bf7ffb223b31c824ec65ef2c2318d`
- formal build: `20261012_tasun_v5_xidong_docs_r1153_1a82f9970b1a_release`
- releaseSequence: `1153`

If unrelated legitimate work advances `main`, implementation must start from the new current `main` and preserve unrelated changes.

## 3. Verified orphan sidecars

### 3.1 `tasun-cloud-page-v1.js`

Current behavior includes:
- exports `window.TasunCloudPageV1`;
- reads `window.TASUN_CLOUD_V1`;
- dynamically loads `tasun-cloud-kit.js`;
- mounts `TasunCloudKit`;
- uses default `watch.intervalSec = 10`;
- performs an initial `pullNow()`;
- can reload after cloud apply;
- creates `window.__tasunCloudCtrl__`.

Latest-main repository search finds no consumer outside this file.

### 3.2 `tasun-cloud-pages.v1.json`

Current mappings include:
- `捷運汐東線事項記錄.html`
- `權限表.html`

Latest-main repository search finds no loader or consumer for this JSON file.

Neither sidecar is referenced by:
- `tasun-resources.json`;
- `tasun-version.json`;
- current HTML runtime loaders;
- current workflow files.

## 4. Supported authority that must remain unchanged

The current supported cloud chain remains authoritative:
- `tasun-cloud-kit.js`;
- `tasun-cloudwrap-v4.js`;
- current page-owned D1/Dropbox/cloud load/apply code;
- current Worker/auth/session contracts;
- current page lifecycle and migration sequencing.

No compatibility shim for Cloud Page v1 is authorized.

## 5. Authorized implementation files

After written-spec approval, manual changes are authorized only as follows:

1. delete `tasun-cloud-page-v1.js`;
2. delete `tasun-cloud-pages.v1.json`;
3. add focused test:
   `tests/issue-64-retire-cloud-page-v1-sidecars.test.cjs`.

No other production file is authorized for manual mutation.

## 6. Explicit no-change files

Do not manually modify:
- `tasun-cloud-kit.js`;
- `tasun-cloudwrap-v4.js`;
- `tasun-auth-v4.js`;
- `tasun-api/worker.js`;
- `權限表.html`;
- `捷運汐東線事項記錄.html`;
- `tasun-resources.json`;
- `tasun-version.json`;
- `publish-version_tasun_project_autoscan.mjs`;
- `.github/workflows/release-version.yml`;
- formal four document pages;
- rebuild files.

If implementation proves any of these must change, stop and return to architecture amendment.

## 7. Pre-implementation synchronization

Before RED:

1. fetch latest `main`;
2. confirm both sidecar files still exist;
3. repeat repository-wide search for:
   - `tasun-cloud-page-v1.js`;
   - `tasun-cloud-pages.v1.json`;
   - `TASUN_CLOUD_V1`;
   - `TasunCloudPageV1`;
   - `__tasunCloudCtrl__`;
4. confirm no current HTML/runtime/workflow consumer exists;
5. confirm current supported cloud authority files exist;
6. capture locked-file SHAs;
7. capture current formal build / releaseSequence.

If any real consumer is found, stop and amend architecture.

## 8. TDD RED contract

RED must be committed before any production deletion.

Create:
`tests/issue-64-retire-cloud-page-v1-sidecars.test.cjs`

Required RED assertions:

1. `tasun-cloud-page-v1.js` must be absent;
2. `tasun-cloud-pages.v1.json` must be absent;
3. no live source outside historical docs/tests may define or consume:
   - `TASUN_CLOUD_V1`;
   - `TasunCloudPageV1`;
   - `__tasunCloudCtrl__`;
4. no current HTML/runtime/resource/workflow file may reference either retired filename;
5. `tasun-cloud-kit.js` must remain present;
6. `tasun-cloudwrap-v4.js` must remain present;
7. current page-owned cloud files must remain present;
8. the test must distinguish historical governance docs/tests from live runtime sources.

Expected RED:
- failure caused by the two existing sidecar files;
- current supported cloud files pass presence assertions.

Record:
- RED tests-only commit SHA;
- CI run ID;
- total/pass/fail counts;
- exact failing assertions.

## 9. Live-source classification contract

The regression must not treat historical documentation as production authority.

Allowed historical references include:
- architecture/written-spec documents;
- Issue #64 focused test;
- old reports or changelog material.

Production/live-source scan must focus on:
- root/runtime JS;
- HTML;
- JSON resources/config;
- workflow files;
- active runtime-support files.

A historical mention of `TASUN_CLOUD_V1` in documentation must not fail the test.

## 10. GREEN implementation

Delete only:
- `tasun-cloud-page-v1.js`;
- `tasun-cloud-pages.v1.json`.

Do not:
- replace them with redirect/loader/shim files;
- move their logic into another file;
- copy their polling/reload behavior elsewhere;
- add a compatibility global;
- add a second config map.

## 11. GREEN acceptance assertions

After deletion:

1. both retired sidecar files are absent;
2. no live source exports `TasunCloudPageV1`;
3. no live source reads `TASUN_CLOUD_V1`;
4. no live source creates `__tasunCloudCtrl__`;
5. no HTML/runtime/resource/workflow references either retired filename;
6. `tasun-cloud-kit.js` remains unchanged;
7. `tasun-cloudwrap-v4.js` remains unchanged;
8. current page-owned cloud behavior files remain unchanged;
9. no compatibility shim exists.

## 12. Full regression

After focused GREEN:
- run the full Tasun regression suite;
- all existing Issue #14–#61 tests must remain GREEN;
- release-contract and workflow tests must remain GREEN;
- HTML syntax/runtime tests must remain GREEN.

Any failure affecting current cloud or permission behavior must be diagnosed before proceeding.

## 13. Disposable exact-release

Run the repository's normal disposable exact-release verification on the final implementation head.

Expected:
- succeeds;
- verifies current exact release contract;
- disposable generated R-number is test-only;
- no manual version edit.

## 14. Semantic diff audit

Relative to synchronized implementation baseline, exact expected diff:

Deleted:
1. `tasun-cloud-page-v1.js`
2. `tasun-cloud-pages.v1.json`

Added:
3. `tests/issue-64-retire-cloud-page-v1-sidecars.test.cjs`

No other file changes.

## 15. Locked-file audit

Before merge, compare baseline/final blobs for:
- `tasun-cloud-kit.js`;
- `tasun-cloudwrap-v4.js`;
- `tasun-auth-v4.js`;
- `tasun-api/worker.js`;
- `權限表.html`;
- `捷運汐東線事項記錄.html`;
- `tasun-resources.json`;
- `tasun-version.json`;
- publisher/workflow;
- formal document pages.

All must remain identical through manual implementation.

## 16. Independent review

Request Codex review on final GREEN head.

Review focus:
- no real consumer was missed;
- live-source search excludes historical docs correctly;
- deletion is exact and no compatibility shim is introduced;
- current cloud authority files are untouched;
- no polling/reload logic is relocated;
- no version/release authority is manually modified.

Resolve valid findings and rerun final GREEN.

## 17. Merge contract

Merge only after:
- Option A architecture approved;
- written spec explicitly approved;
- governance PR #65 merged;
- RED evidence captured;
- focused GREEN;
- full regression GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- independent review clear.

## 18. Expected post-merge release behavior

Because `tasun-cloud-page-v1.js` is a JS file, the Exact Auto Release workflow may trigger by path filter.

Expected publisher result if current rules are unchanged:
- autoscan finds no surviving formal page/core/manifest change attributable to Issue #64;
- no generated production release identity is required;
- formal build remains `R1153`;
- releaseSequence remains `1153`;
- read-only exact release verification passes.

This must be verified from actual workflow logs; do not assume it.

If the existing publisher instead legitimately creates a release due to current rules, do not manually override it; document the behavior and evaluate whether it violates this written spec's failure boundary.

## 19. Post-merge verification

After merge:

1. wait for Exact Auto Release workflow to reach terminal state;
2. verify workflow SUCCESS;
3. inspect autoscan result;
4. confirm no unexpected release metadata commit;
5. verify main formal build / releaseSequence;
6. verify retired files remain absent on main;
7. verify current cloud authority files remain present and unchanged;
8. verify deployed formal exact release remains healthy.

## 20. Failure boundaries / architecture amendment triggers

Stop and return to architecture if:
- a current page or workflow actually consumes either sidecar;
- Cloud Page v1 symbols are supplied by another live source for a legitimate purpose;
- current cloud behavior depends on the sidecar JSON mapping;
- deletion requires any current cloud-kit/page/Worker/auth changes;
- deletion causes a functional release increment that cannot be explained by existing release rules;
- another coupled sidecar must be changed to avoid breakage.

Do not silently broaden Issue #64.

## 21. Closure evidence

Before closing Issue #64, record:
- architecture approval;
- written-spec approval;
- governance PR merge SHA;
- RED commit/run and failure counts;
- final implementation head;
- full regression counts;
- disposable exact-release result;
- semantic diff result;
- locked-file audit result;
- Codex review outcome;
- implementation merge SHA;
- post-merge workflow run ID/result;
- whether a generated release metadata commit occurred;
- final formal build;
- final releaseSequence;
- proof both sidecars are absent;
- proof current cloud authority files remain unchanged.

## 22. Approval gate

- [x] Option A architecture explicitly approved by user on 2026-10-12
- [x] written spec completed
- [ ] written spec explicitly approved by user
- [ ] implementation / TDD authorized

**No production deletion is authorized until the written spec is explicitly approved and governance PR #65 is merged.**
