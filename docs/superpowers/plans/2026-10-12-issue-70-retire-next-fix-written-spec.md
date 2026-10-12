# Issue #70 — Written Spec: Retire No-op tasun-next-fix Bootstrap Marker

Date: 2026-10-12  
Issue: #70 — `[REQ] Retire no-op tasun-next-fix bootstrap marker`  
Approved architecture: **Option A**  
Functional R-number: **NOT ASSIGNED**  
Status: **WRITTEN SPEC COMPLETE / PENDING EXPLICIT APPROVAL / NO IMPLEMENTATION AUTHORITY**

## 1. Objective

Retire the no-op `tasun-next-fix.js` bootstrap marker and remove only the three current loader calls that fetch it, while preserving the supported Tasun v5 bootstrap chain and current runtime behavior.

## 2. Authoritative baseline

Implementation, if approved, must re-synchronize to the latest `main` immediately before RED.

Known written-spec baseline:
- main: `cd00217307e33f5509d1835d3fc57dd7b0f9badd`
- formal build: `20261012_tasun_v5_xidong_docs_r1153_1a82f9970b1a_release`
- current Issue #70 governance branch: `issue-70-retire-next-fix-architecture`

If unrelated legitimate work advances `main`, implementation must branch from the then-current `main` and preserve unrelated work.

## 3. Verified current behavior

`tasun-next-fix.js` contains only:

```js
(function(window){ 'use strict'; window.__TASUN_NEXT_FIX__ = { version: '20260420_tasun_v5_corepack_r1' }; })(window);
```

Current latest-main active loader references exist in:
- `index.html`;
- `inline.js`;
- `tasun-api/index.html`.

Current repository tracing finds no live consumer of:
- `window.__TASUN_NEXT_FIX__`;
- `__TASUN_NEXT_FIX__`.

The marker does not own:
- auth;
- cloud synchronization;
- routing;
- storage;
- migration;
- self-heal;
- current version identity;
- Worker/data authority.

## 4. Supported authority that must remain intact

The current bootstrap/runtime chain remains owned by:
- current version loader / `tasun-version.json`;
- `tasun-cloudwrap-v4.js`;
- `tasun-auth-v4.js`;
- `tasun-guard-v5.js`;
- `tasun-core.js`;
- current page-owned initialization.

Removal of `tasun-next-fix.js` must not change the relative order or semantics of these supported modules beyond closing the gap left by the retired no-op call.

## 5. Authorized implementation files

After written-spec approval and governance merge, manual implementation changes are authorized only as follows:

1. delete `tasun-next-fix.js`;
2. remove the single `tasun-next-fix` loader call from `index.html`;
3. remove the single `tasun-next-fix` loader call from `inline.js`;
4. remove the single `tasun-next-fix` loader call from `tasun-api/index.html`;
5. add `tests/issue-70-retire-next-fix.test.cjs`.

No other production file is authorized for manual mutation.

## 6. Explicit no-change files

Do not manually modify:
- `tasun-cloudwrap-v4.js`;
- `tasun-auth-v4.js`;
- `tasun-guard-v5.js`;
- `tasun-core.js`;
- `tasun-global-core.js`;
- `tasun-resources.json`;
- `tasun-version.json`;
- `tasun-api/worker.js`;
- formal four document pages;
- `publish-version_tasun_project_autoscan.mjs`;
- `.github/workflows/release-version.yml`;
- storage/data schemas.

If implementation proves one of these must change, stop under the project-wide governance failure-boundary rule and return for architecture amendment.

## 7. Pre-implementation synchronization

Before RED:

1. fetch latest `main`;
2. confirm `tasun-next-fix.js` still exists;
3. repeat repository-wide search for:
   - `tasun-next-fix.js`;
   - `__TASUN_NEXT_FIX__`;
4. confirm only the three expected live loader surfaces reference the file;
5. confirm there is no live consumer of the global marker;
6. capture baseline blobs for all authorized and locked files;
7. capture formal build and releaseSequence.

If any real consumer is found, stop and amend architecture.

## 8. TDD RED contract

Create first:

`tests/issue-70-retire-next-fix.test.cjs`

RED assertions must prove:

1. `tasun-next-fix.js` must be absent;
2. no live source may reference `tasun-next-fix.js`;
3. no live source may define or consume `__TASUN_NEXT_FIX__`;
4. `index.html`, `inline.js`, and `tasun-api/index.html` must retain supported cloudwrap/auth/guard loader calls;
5. the supported loader order after retirement must remain:
   - cloudwrap;
   - auth;
   - guard;
   - any subsequent existing supported modules;
6. historical references under `docs/` and tests must not be treated as runtime authority;
7. active runtime-support formats, including JS/HTML/JSON/YAML/TOML where applicable, must be covered.

Expected RED:
- failure because the retired file/global/loader references still exist;
- supported-chain presence assertions pass.

Record:
- RED tests-only commit SHA;
- RED CI run ID;
- total/pass/fail counts;
- exact failing assertions.

## 9. GREEN implementation

Perform only:

1. delete `tasun-next-fix.js`;
2. remove its loader call from `index.html`;
3. remove its loader call from `inline.js`;
4. remove its loader call from `tasun-api/index.html`.

Do not:
- add a compatibility shim;
- move `__TASUN_NEXT_FIX__` elsewhere;
- replace it with another marker;
- reorder cloudwrap/auth/guard;
- change loader error handling;
- change auth/cloud/version semantics.

## 10. Focused GREEN assertions

After implementation:

- `tasun-next-fix.js` absent;
- no live `tasun-next-fix.js` reference;
- no live `__TASUN_NEXT_FIX__` definition/consumer;
- all three loader surfaces still load cloudwrap/auth/guard;
- loader order remains correct;
- no compatibility replacement exists.

## 11. Full regression

Run the complete Tasun regression suite after focused GREEN.

Required:
- all existing tests GREEN;
- Issue #70 test GREEN;
- release-contract tests GREEN;
- runtime/HTML syntax tests GREEN;
- previous authority-retirement regressions remain GREEN.

Any regression in supported bootstrap/auth/cloud behavior must be diagnosed before proceeding.

## 12. Disposable exact-release

Run normal disposable exact-release verification on final implementation head.

Because `index.html` changes, release classification may be release-relevant.

Rules:
- no manual `tasun-version.json` edit;
- no manual R-number assignment;
- disposable generated identity is test-only;
- accept normal publisher semantics;
- verify output exactness before merge.

## 13. Semantic diff audit

Relative to synchronized implementation baseline, expected manual diff is exactly:

Deleted:
1. `tasun-next-fix.js`

Modified:
2. `index.html` — remove one obsolete loader call only;
3. `inline.js` — remove one obsolete loader call only;
4. `tasun-api/index.html` — remove one obsolete loader call only.

Added:
5. `tests/issue-70-retire-next-fix.test.cjs`

Any additional manual production diff is a failure boundary.

## 14. Locked-file audit

Before merge, verify baseline/final blobs remain identical for all explicit no-change files, including:
- cloudwrap;
- auth;
- guard;
- core/global-core;
- resources;
- version;
- Worker;
- publisher/workflow;
- formal four document pages.

## 15. Independent review

Request Codex review on the final GREEN head.

Review focus:
- no hidden real consumer was missed;
- exact three loader calls removed and no more;
- supported loader order intact;
- no compatibility marker relocated;
- no unauthorized production file changed;
- no manual version mutation;
- regression live-source classification is sufficiently complete.

Valid findings must be fixed, followed by rerun of full regression and disposable exact-release.

## 16. Merge contract

Merge only after:
- Option A architecture approved;
- written spec explicitly approved;
- synchronized governance PR merged;
- RED evidence captured;
- focused GREEN;
- full regression GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- independent review clear.

## 17. Post-merge release verification

After merge:

1. inspect the actual Exact Auto Release workflow triggered by the merge;
2. verify terminal SUCCESS;
3. inspect autoscan classification;
4. record whether a generated release metadata commit occurred;
5. verify final `main` version/build/releaseSequence;
6. verify GitHub Pages deploy if triggered;
7. verify deployed four-page build/sequence/SHA when applicable;
8. verify `tasun-next-fix.js` remains absent on `main`;
9. verify all three loader surfaces no longer request it;
10. verify supported bootstrap modules remain present.

Do not override legitimate publisher behavior manually.

## 18. Failure boundaries / architecture amendment triggers

Stop automatic progression and require explicit architecture amendment if:

- any real runtime consumer of `__TASUN_NEXT_FIX__` is found;
- removing the marker requires changes to cloudwrap/auth/guard/core;
- loader behavior beyond the exact three calls must change;
- a compatibility replacement becomes necessary;
- Worker/data schema changes become necessary;
- current formal document page behavior must change;
- release infrastructure itself must be modified.

## 19. Closure evidence

Before closing Issue #70 record:
- architecture approval;
- written-spec approval;
- governance PR merge SHA;
- RED commit/run/counts;
- final implementation head;
- full regression result;
- disposable exact-release result;
- semantic diff result;
- locked-file audit;
- independent review outcome;
- implementation merge SHA;
- post-merge workflow run/result;
- release metadata behavior;
- final formal build/releaseSequence;
- proof file/global/loader references are absent;
- proof supported bootstrap chain remains intact.

## 20. Project-wide automatic progression rule

Issue #70 is governed by:

`docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md`

Accordingly, once this written spec is explicitly approved and the governance PR is merged, all ordinary implementation/TDD/review/merge/release/closure steps proceed automatically without repeated user approval.

Only the defined mandatory gates and failure boundaries stop progression.

## 21. Approval record

- [x] Option A architecture explicitly approved by user on 2026-10-12
- [x] written spec completed
- [ ] written spec explicitly approved by user
- [ ] implementation / TDD authorized

**Next mandatory gate: explicit written-spec approval.**
