# Issue #67 — Written Spec: Retire Orphan Legacy Dropbox Store Authority

Date: 2026-10-12  
Issue: #67 — `[REQ] Retire orphan legacy Dropbox store authority`  
Approved architecture: **Option A**  
Functional R-number: **NOT ASSIGNED**  
Status: **WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED**  
Implementation authority: **AUTHORIZED after governance PR #68 merge**

## 1. Objective

Retire the verified-unreferenced legacy Dropbox store authority without changing the current Tasun v5 cloud/data synchronization chain.

The implementation must:
- delete `tasun-store-dropbox.js`;
- add focused regression protection.

No current cloud-kit/cloudwrap/Worker/page/auth/release behavior may be redesigned under this issue.

## 2. Authoritative baseline

Implementation must re-synchronize to latest `main` immediately before RED.

Known drafting baseline:
- main: `702c1ba5eae351e3646ebf7bdefa0238ecb78a3d`
- formal build: `20261012_tasun_v5_xidong_docs_r1153_1a82f9970b1a_release`
- releaseSequence: `1153`

If unrelated legitimate work advances `main`, implementation must start from current `main` and preserve unrelated work.

## 3. Verified orphan authority

`tasun-store-dropbox.js` currently:
- exports/reuses `window.TasunDropboxStore`;
- can obtain a Dropbox token from localStorage or an injected getter;
- directly calls Dropbox API v2 download/upload/get_metadata;
- loads a resource registry;
- maintains payload caches;
- implements cooperative lock files;
- maintains lock TTL / heartbeat state;
- watches remote revisions;
- writes JSON directly to Dropbox paths.

Latest-main repository search finds:
- filename `tasun-store-dropbox.js` only in this file;
- global `TasunDropboxStore` only in this file;
- no reference in `tasun-resources.json`;
- no reference in `tasun-version.json`;
- no current HTML/runtime loader consumer.

## 4. Supported authority that must remain unchanged

Current Tasun v5 cloud/data authority remains with:
- `tasun-cloud-kit.js`;
- `tasun-cloudwrap-v4.js`;
- current page-owned D1/Dropbox/cloud synchronization;
- `tasun-api/worker.js`;
- current auth/session contracts;
- current page lifecycle and migration sequencing.

Issue #64 already retired the orphan Cloud Page v1 sidecars and must remain intact.

## 5. Authorized implementation files

After written-spec approval, manual changes are authorized only as follows:

1. delete `tasun-store-dropbox.js`;
2. add `tests/issue-67-retire-dropbox-store.test.cjs`.

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

If implementation proves any of these must change, stop and return for architecture amendment.

## 7. Pre-implementation synchronization

Before RED:

1. fetch latest `main`;
2. confirm `tasun-store-dropbox.js` still exists;
3. repeat repo-wide search for:
   - `tasun-store-dropbox.js`;
   - `TasunDropboxStore`;
4. confirm no current HTML/runtime/resource/workflow consumer exists;
5. confirm current supported cloud authority files exist;
6. capture locked-file SHAs;
7. capture current formal build / releaseSequence.

If any real consumer is found, stop and amend architecture.

## 8. TDD RED contract

RED must be committed before production deletion.

Create:
`tests/issue-67-retire-dropbox-store.test.cjs`

Required RED assertions:

1. `tasun-store-dropbox.js` must be absent;
2. no live source outside historical docs/tests may define or consume `TasunDropboxStore`;
3. no current HTML/runtime/resource/workflow file may reference `tasun-store-dropbox.js`;
4. `tasun-cloud-kit.js` must remain present;
5. `tasun-cloudwrap-v4.js` must remain present;
6. `tasun-api/worker.js` must remain present;
7. current page-owned cloud files must remain present;
8. regression must distinguish historical governance docs/tests from live runtime sources.

Expected RED:
- failure caused by the existing orphan file/global;
- supported authority presence assertions pass.

Record:
- RED tests-only commit SHA;
- CI run ID;
- total/pass/fail counts;
- exact failing assertions.

## 9. Live-source classification contract

Historical references must not be treated as runtime authority.

Excluded from live-source scan:
- `docs/`;
- `tests/`;
- Markdown/text governance material.

Live-source scan should include:
- root/runtime JS;
- HTML;
- JSON resource/config files;
- workflow files;
- active runtime-support files.

## 10. GREEN implementation

Delete only:
- `tasun-store-dropbox.js`.

Do not:
- add a compatibility shim;
- move `TasunDropboxStore` into another file;
- relocate its direct Dropbox read/write/lock/watch implementation;
- add a second token/cache/lock namespace.

## 11. GREEN acceptance assertions

After deletion:

1. `tasun-store-dropbox.js` is absent;
2. no live source exports or consumes `TasunDropboxStore`;
3. no active runtime/resource/workflow references the retired filename;
4. `tasun-cloud-kit.js` remains unchanged;
5. `tasun-cloudwrap-v4.js` remains unchanged;
6. `tasun-api/worker.js` remains unchanged;
7. current page-owned cloud/data behavior files remain unchanged;
8. no compatibility shim exists.

## 12. Full regression

After focused GREEN:
- run the full Tasun regression suite;
- all existing Issue #14–#64 tests must remain GREEN;
- release-contract/workflow tests must remain GREEN;
- runtime/HTML tests must remain GREEN.

Any current cloud/data regression must be diagnosed before proceeding.

## 13. Disposable exact-release

Run the normal disposable exact-release verification on the final implementation head.

Expected:
- succeeds;
- current exact-release contract remains valid;
- any disposable next-R identity is test-only;
- no manual version edit.

## 14. Semantic diff audit

Relative to synchronized implementation baseline, exact expected diff:

Deleted:
1. `tasun-store-dropbox.js`

Added:
2. `tests/issue-67-retire-dropbox-store.test.cjs`

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
- formal pages.

All must remain identical through manual implementation.

## 16. Independent review

Request Codex review on final GREEN head.

Review focus:
- no real consumer was missed;
- live-source classifier correctly excludes historical docs/tests;
- deletion is exact;
- no compatibility shim or relocated direct-Dropbox authority is introduced;
- current cloud/Worker/auth/release files remain untouched;
- no manual version mutation.

Resolve valid findings and rerun final GREEN.

## 17. Merge contract

Merge only after:
- Option A architecture approved;
- written spec explicitly approved;
- governance PR #68 merged;
- RED evidence captured;
- focused GREEN;
- full regression GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- independent review clear.

## 18. Expected post-merge release behavior

Because the retired file is JS, Exact Auto Release may trigger by path filter.

Expected publisher result if current rules remain unchanged:
- autoscan finds no surviving formal page/core/manifest change attributable to Issue #67;
- no generated production release metadata commit;
- formal build remains R1153;
- releaseSequence remains 1153;
- read-only exact release verification passes.

This must be verified from actual workflow logs.

If current publisher legitimately behaves differently, do not manually override it; document the behavior and evaluate whether it crosses a failure boundary.

## 19. Post-merge verification

After merge:

1. wait for Exact Auto Release workflow terminal state;
2. verify workflow SUCCESS;
3. inspect autoscan result;
4. confirm whether any generated release metadata commit occurred;
5. verify main formal build / releaseSequence;
6. verify `tasun-store-dropbox.js` remains absent on main;
7. verify current cloud authority files remain present and unchanged;
8. verify deployed formal exact release remains healthy.

## 20. Failure boundaries / architecture amendment triggers

Stop and return to architecture if:
- any current page/runtime/workflow consumes `tasun-store-dropbox.js`;
- another live source legitimately depends on `TasunDropboxStore`;
- deletion requires current cloud-kit/page/Worker/auth changes;
- another dormant Dropbox module must also change to avoid breakage;
- release behavior requires production changes to reconcile.

Do not silently broaden Issue #67.

## 21. Closure evidence

Before closing Issue #67, record:
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
- whether generated release metadata occurred;
- final formal build;
- final releaseSequence;
- proof `tasun-store-dropbox.js` is absent;
- proof current cloud authority files remain unchanged.

## 22. Approval gate

- [x] Option A architecture explicitly approved by user on 2026-10-12
- [x] written spec completed
- [x] written spec explicitly approved by user on 2026-10-12
- [x] implementation / TDD authorized after governance PR #68 merge

**No production deletion is authorized until the written spec is explicitly approved and governance PR #68 is merged.**
