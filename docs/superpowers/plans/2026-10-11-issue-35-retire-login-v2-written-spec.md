# Issue #35 Written Spec — Retire dormant tasun-login-v2 authentication authority

Date: 2026-10-11  
Requirement: GitHub Issue #35 — `[REQ] Retire dormant tasun-login-v2 authentication authority`  
Architecture: Option A APPROVED  
Functional R-number: NOT ASSIGNED  
Status: WRITTEN SPEC AWAITING USER APPROVAL / NO IMPLEMENTATION AUTHORITY

## 1. Implementation objective

Retire the verified-unreferenced executable legacy authentication module:

`tasun-login-v2.js`

by deleting the file without adding a compatibility shim, alias, archive stub, or replacement authority.

The current supported auth/session/token authority `tasun-auth-v4.js` must remain unchanged.

## 2. Implementation baseline

Implementation may begin only after this written spec receives explicit user approval and the synchronized governance record is merged to `main`.

Implementation branch must be created from the latest current `main` at that time.

Architecture tracing baseline:

`main @ c511917bfa8d1d797fb05ac71eb5a63a6cf0b2d7`

If `main` advances before implementation starts, repeat the legacy-reference scan on the new baseline.

## 3. Approved production file scope

Approved production change:

1. delete `tasun-login-v2.js`

Expected test addition:

2. `tests/issue-35-retire-login-v2.test.cjs`

No other production file is approved.

## 4. Legacy authority being retired

`tasun-login-v2.js` currently implements its own:

- Worker base;
- session key `tasunAuthSession_v2`;
- session get/set/clear lifecycle;
- `login()`;
- `logout()`;
- `isLoggedIn()`;
- `requireLogin()`;
- global `window.fetch` wrapper;
- Bearer token injection;
- `window.tasunAuth` global;
- `window.__TASUN_AUTH_FETCH__` guard.

These behaviors must disappear with the file deletion.

Do not migrate any of them into another file under Issue #35.

## 5. Canonical auth authority invariant

`tasun-auth-v4.js` remains the supported authority and must not be edited.

Preserve:

- `login`;
- `logout`;
- `getCurrent`;
- `setCurrent`;
- `getToken`;
- `isLoggedIn`;
- session state;
- token mirroring;
- child-page bridge;
- Worker login.

No new auth alias or fetch wrapper is authorized.

## 6. Pre-implementation reference scan

Before RED/GREEN changes, repeat exact searches for:

- `tasun-login-v2.js`
- `tasunAuthSession_v2`
- `tasunAuth.login`
- `__TASUN_AUTH_FETCH__`

Classify hits as:

- active runtime;
- tests;
- governance/history;
- the legacy file itself.

Expected current result:

- no active runtime consumer outside `tasun-login-v2.js`.

If a real active runtime dependency appears on latest main, stop and return to architecture review.

## 7. TDD sequence

### RED stage

Create:

`tests/issue-35-retire-login-v2.test.cjs`

before deleting the legacy file.

Minimum assertions:

1. `tasun-login-v2.js` must not exist;
2. `tasun-auth-v4.js` must exist;
3. current auth core must still export `login`;
4. current auth core must still export `getCurrent`;
5. current auth core must still export `getToken`;
6. active runtime files must not reference `tasun-login-v2.js`;
7. active runtime files must not reference `tasunAuthSession_v2`;
8. active runtime files must not reference `tasunAuth.login`;
9. active runtime files must not reference `__TASUN_AUTH_FETCH__`.

Expected RED:

- the legacy file still exists.

Record:

- tests-only head SHA;
- RED regression run/result;
- exact failing assertion.

Do not delete the file before RED is confirmed.

### GREEN stage

Delete only:

`tasun-login-v2.js`

Then rerun:

- focused Issue #35 test;
- full Tasun regression suite;
- disposable exact-release verification.

Expected GREEN:

- legacy file absent;
- no active consumer;
- auth core unchanged.

## 8. Active-runtime scan scope

The regression should inspect only current executable/runtime source locations, not governance docs.

At minimum, include repository HTML/JS runtime files while excluding:

- `docs/`;
- `tests/`;
- historical text reports;
- generated evidence documents.

The test must not fail on historical mentions in governance records.

## 9. No-shim contract

Do not add:

- replacement `tasun-login-v2.js`;
- archived executable copy;
- `window.tasunAuth` compatibility global;
- `tasunAuthSession_v2` compatibility storage bridge;
- `__TASUN_AUTH_FETCH__` wrapper in another file.

The retirement must be complete.

## 10. Explicitly forbidden changes

Do not:

- edit `tasun-auth-v4.js`;
- edit `tasun-global-core.js`;
- change active Worker endpoint;
- change session/token keys;
- change active fetch behavior;
- change login UI;
- change role/permission behavior;
- change formal row data;
- change statistics;
- change cloud synchronization;
- change release algorithm;
- manually edit `tasun-version.json`;
- assign a functional R-number.

## 11. Diff-scope contract

Expected implementation PR changed files:

- deleted `tasun-login-v2.js`;
- added `tests/issue-35-retire-login-v2.test.cjs`.

Expected production diff:

- exactly one deleted dormant JS authority;
- no active runtime file edits.

Any additional production file requires architecture review.

## 12. Release workflow behavior

Current workflow push paths include:

`**/*.js`

Therefore deletion of `tasun-login-v2.js` is expected to trigger the Exact Auto Release workflow.

However current autoscan relevance logic requires changed files to:

- still exist after the change; and
- be a formal HTML page, listed core file, or generated authority file.

`tasun-login-v2.js`:

- is not in `CORE_FILES`;
- is not a formal page;
- is not a generated authority file;
- will not exist after deletion.

Expected production behavior:

1. merge triggers workflow;
2. workflow reaches changed-file resolution;
3. autoscan finds no surviving relevant file;
4. logs `no formal page/core/manifest change; nothing to sync.`;
5. formal build remains unchanged;
6. releaseSequence remains unchanged;
7. `tasun-version.json` remains unchanged;
8. no forced release is created.

## 13. Disposable exact-release behavior

Branch regression/disposable exact-release must still succeed.

The disposable release verification must confirm that deletion of the dormant non-core JS authority does not create an unexpected formal release mutation.

## 14. Version authority contract

Formal version authority remains:

`.github/workflows/release-version.yml`
→ `publish-version_tasun_project_autoscan.mjs`
→ `tasun-version.json`.

No manual version edit is allowed.

If post-merge workflow unexpectedly generates a new formal build, inspect the actual relevance classification before closure.

Do not manually revert or fabricate a version.

## 15. Review criteria

Independent review must verify:

- only `tasun-login-v2.js` is deleted from production;
- no shim/alias was introduced;
- `tasun-auth-v4.js` is byte-identical to baseline;
- no active runtime consumer exists;
- regression covers file absence and stale authority symbols;
- no version manifest edit exists in implementation commits.

## 16. Verification matrix

Before merge, all must be GREEN:

- focused Issue #35 regression;
- full regression suite;
- disposable exact-release verification;
- exact reference scan;
- diff-scope review;
- auth-core unchanged check;
- version-manifest unchanged check.

Implementation PR must record:

- RED head SHA;
- RED run/result;
- GREEN head SHA;
- GREEN run/result;
- disposable exact-release result;
- changed-file list;
- auth-core blob comparison;
- version blob comparison.

## 17. Merge contract

Only merge after:

- RED→GREEN evidence complete;
- full regression GREEN;
- disposable exact-release GREEN;
- no unresolved major review issue;
- diff scope matches the approved written spec.

Use current repository merge practice.

## 18. Post-merge verification

After merge:

1. capture implementation merge SHA;
2. inspect Exact Auto Release workflow triggered by the JS deletion;
3. confirm workflow conclusion;
4. inspect autoscan logs for relevance result;
5. verify `tasun-login-v2.js` is absent on current `main`;
6. verify `tasun-auth-v4.js` remains unchanged;
7. verify formal build;
8. verify releaseSequence;
9. verify `tasun-version.json` blob;
10. if no relevant change was found, confirm all three version values remain unchanged from pre-merge authority;
11. record closure evidence in Issue #35;
12. close Issue #35 when acceptance criteria are satisfied.

## 19. Failure handling

If new runtime dependency evidence appears:

- do not delete the file;
- do not add compatibility logic;
- record the exact consumer/call chain;
- return to architecture review.

If production autoscan unexpectedly treats the deletion as relevant:

- inspect the exact workflow/publisher evidence;
- do not manually modify the manifest;
- complete or correct the release chain according to actual current rules before closure.

## 20. Acceptance criteria

Implementation is complete only when all are true:

- [ ] `tasun-login-v2.js` deleted;
- [ ] no compatibility shim added;
- [ ] no active runtime consumer remains;
- [ ] `tasun-auth-v4.js` unchanged;
- [ ] no legacy session/fetch-wrapper authority reintroduced;
- [ ] regression locks retirement;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] post-merge workflow behavior verified;
- [ ] formal build/releaseSequence unchanged if autoscan finds no relevant file;
- [ ] no manual `tasun-version.json` edit;
- [ ] closure evidence recorded.

## 21. Approval gate

Architecture:

- [x] Option A explicitly approved by user on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after explicit written-spec approval

Until the user explicitly approves this written spec, implementation/TDD remains unauthorized.
