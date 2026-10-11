# Issue #32 Written Spec — Retire dead TasunGlobalAuth token fallback and dormant auth authority

Date: 2026-10-11  
Requirement: GitHub Issue #32 — `[REQ] Retire dead TasunGlobalAuth token fallback and dormant auth authority`  
Architecture: Option A APPROVED  
Functional R-number: NOT ASSIGNED  
Status: WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED

## 1. Implementation objective

Converge token authority by:

1. removing the dead legacy/global token fallback block from `tasun-api/index.html`;
2. preserving the canonical `TasunAuthV4.getToken()` path;
3. preserving the existing cookie fallback;
4. deleting the dormant executable legacy auth artifact `tasun-global-auth.js`;
5. adding regression coverage preventing either dead fallback or dormant authority from returning.

No auth-core compatibility alias or replacement legacy authority is authorized.

## 2. Implementation baseline

Implementation may begin only after this written spec receives explicit user approval and the synchronized governance record is merged to `main`.

Implementation branch must be created from the latest current `main` at that time.

Architecture tracing baseline:

`main @ bc3af2d1ea555237c9728b9500d947f6d81b0307`

If `main` advances before implementation begins, re-run exact reference scans before modifying files.

## 3. Approved production file scope

Approved runtime changes:

1. `tasun-api/index.html`
2. delete `tasun-global-auth.js`

Expected test addition:

3. `tests/issue-32-dead-global-auth-retirement.test.cjs`

No additional production file is approved in this spec.

## 4. tasun-api token-resolution contract

Current intended token resolution order must remain:

1. read canonical token keys from session/local storage;
2. extract token from existing session/current-user bridge objects;
3. call `TasunAuthV4.getToken()`;
4. read existing token cookies.

The dead legacy/global block between steps 3 and 4 must be removed.

The following probes must be eliminated from active runtime code in `tasun-api/index.html`:

- `window.TasunGlobalAuth`
- `window.tasunGlobalAuth`
- `window.TASUN_AUTH`
- token/accessToken/authToken/apiKey/getToken reads from that legacy/global object.

## 5. Legacy artifact retirement contract

`tasun-global-auth.js` must be deleted.

Do not:

- replace it with a shim;
- retain it as an inert executable stub;
- move it to another runtime path;
- copy its APIs into another auth file;
- create `TasunGlobalAuth` compatibility globals elsewhere.

Historical documentation may continue mentioning the file as evidence.

## 6. Canonical auth authority invariants

`tasun-auth-v4.js` remains the supported auth/token authority and must not be modified.

The implementation must preserve:

- `TasunAuthV4.getToken()`;
- token mirroring;
- Worker token login;
- current-user/session/session-bridge persistence;
- child-page session bridge;
- login/logout behavior.

No compatibility alias is authorized.

## 7. TDD sequence

### RED stage

Create the dedicated regression test before changing production files.

Expected path:

`tests/issue-32-dead-global-auth-retirement.test.cjs`

Minimum RED assertions:

1. `tasun-api/index.html` must not contain `window.TasunGlobalAuth`;
2. `tasun-api/index.html` must not contain `window.tasunGlobalAuth`;
3. `tasun-api/index.html` must not contain `window.TASUN_AUTH`;
4. `tasun-api/index.html` must still contain `TasunAuthV4.getToken`;
5. `tasun-api/index.html` must still contain the existing cookie fallback keys;
6. `tasun-global-auth.js` must not exist;
7. `tasun-auth-v4.js` must exist and still expose `getToken:getToken`.

Expected RED:

- the legacy/global token fallback still exists;
- `tasun-global-auth.js` still exists.

Record:

- tests-only commit SHA;
- focused failure;
- full regression run ID/result;
- exact failing assertion.

Do not modify production files before RED is confirmed.

### GREEN stage

Perform only:

- remove the legacy/global token fallback block from `tasun-api/index.html`;
- delete `tasun-global-auth.js`.

Then re-run:

- focused Issue #32 regression;
- full Tasun regression suite;
- disposable exact-release verification.

## 8. Reference-scan requirement

Before GREEN, repeat exact current-main/branch search for:

- `tasun-global-auth.js`
- `window.TasunGlobalAuth`
- `window.tasunGlobalAuth`
- `window.TASUN_AUTH`

Classify hits as:

- active runtime;
- tests;
- governance/history.

If any new active runtime loader/provider appears outside the approved two production files, stop and return to architecture review before expanding scope.

## 9. Cookie fallback invariant

The current cookie fallback in `tasun-api/index.html` must remain present and in the same logical position after `TasunAuthV4.getToken()`.

Expected cookie keys include:

- `tasun_bearer_token`
- `tasun_token`
- `token`
- `tasun_auth_token`

This issue does not authorize cookie-contract changes.

## 10. Explicitly forbidden changes

Do not:

- edit `tasun-auth-v4.js`;
- change token keys;
- change token mirroring;
- change Worker login endpoint;
- change session/current-user bridge shape;
- change login UI;
- change password/role model;
- change permissions;
- change formal row data;
- change statistics formulas;
- change cloud synchronization;
- change release algorithm;
- manually edit `tasun-version.json`;
- assign a functional R-number.

## 11. Regression design

The dedicated test should use deterministic repository reads with Node built-ins.

Minimum assertions:

- `tasun-global-auth.js` absent;
- no active legacy/global token alias probes in `tasun-api/index.html`;
- `TasunAuthV4.getToken()` remains present;
- cookie fallback remains present;
- `tasun-auth-v4.js` still exports `getToken:getToken`;
- no replacement `TasunGlobalAuth` executable runtime file is introduced.

The test must not fail solely because historical docs mention the retired file or global names.

## 12. Diff-scope contract

Expected implementation PR changed files:

- `tasun-api/index.html`
- deleted `tasun-global-auth.js`
- `tests/issue-32-dead-global-auth-retirement.test.cjs`

Expected production change character:

- one dead fallback block removed;
- one dormant legacy file deleted;
- no unrelated runtime refactor.

Any additional production file requires architecture review.

## 13. Release impact

Because `tasun-api/index.html` is an existing HTML file, the implementation is release-triggering.

Expected post-merge flow:

1. implementation PR merges to `main`;
2. Exact Auto Release triggers;
3. autoscan recognizes the HTML change;
4. next automatic build/releaseSequence is generated;
5. `tasun-version.json` is updated only by the publisher workflow;
6. formal four-page group is synchronized;
7. Pages deployment completes;
8. deployed four-page build/sequence/SHA verification passes.

The automatic release sequence is not the functional Issue #32 R-number.

## 14. Version authority contract

Formal version authority remains:

`.github/workflows/release-version.yml`
→ `publish-version_tasun_project_autoscan.mjs`
→ `tasun-version.json`
→ exact four-page deployment and verification.

Implementation commits must not manually modify `tasun-version.json`.

## 15. Review criteria

Independent review must verify:

- only the dead token fallback block was removed from `tasun-api/index.html`;
- cookie fallback is unchanged;
- `TasunAuthV4.getToken()` is unchanged;
- `tasun-global-auth.js` is deleted;
- no compatibility/global replacement is introduced;
- `tasun-auth-v4.js` is unchanged;
- regression covers both dead-fallback and deleted-file invariants;
- no unrelated auth cleanup is bundled.

## 16. Verification matrix

Before implementation PR merge, all must be GREEN:

- focused Issue #32 test;
- full Tasun regression suite;
- disposable exact-release verification;
- exact active-reference scan;
- diff-scope review;
- auth-core unchanged check.

Implementation PR must record:

- RED head SHA;
- RED run/result;
- GREEN head SHA;
- GREEN run/result;
- disposable exact-release result;
- changed-file list;
- `tasun-auth-v4.js` unchanged evidence;
- no manual version edit confirmation.

## 17. Merge contract

Only merge after:

- RED→GREEN evidence complete;
- full regression GREEN;
- disposable exact-release verification GREEN;
- no unresolved major review finding;
- changed-file scope matches this written spec.

Use current repository merge practice.

## 18. Post-merge verification

After merge:

1. capture implementation merge SHA;
2. inspect the Exact Auto Release run associated with that merge;
3. capture generated release commit;
4. capture formal build;
5. capture automatic releaseSequence;
6. verify four formal pages report the expected build;
7. verify deployed manifest SHA values;
8. verify `tasun-api/index.html` no longer contains the legacy/global token probes;
9. verify `tasun-global-auth.js` is absent on current `main`;
10. verify `tasun-auth-v4.js` remains unchanged except for release build stamping if the publisher never touches it (normally unchanged);
11. record closure evidence in Issue #32;
12. close Issue #32 once acceptance criteria are satisfied.

## 19. Failure handling

If implementation testing or a new reference scan proves a current dependency on `tasun-global-auth.js` or one of the legacy globals:

- do not recreate compatibility behavior ad hoc;
- do not continue deletion;
- capture the exact loader/consumer;
- stop and return to architecture review.

## 20. Acceptance criteria

Implementation is complete only when all are true:

- [ ] dead legacy/global token fallback removed from `tasun-api/index.html`;
- [ ] `TasunAuthV4.getToken()` retained;
- [ ] cookie fallback retained;
- [ ] `tasun-global-auth.js` deleted;
- [ ] no replacement compatibility auth authority introduced;
- [ ] `tasun-auth-v4.js` unchanged;
- [ ] regression locks retirement invariants;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] formal Exact Auto Release GREEN;
- [ ] deployed four-page build/sequence/SHA verification GREEN;
- [ ] no manual `tasun-version.json` edit;
- [ ] closure evidence recorded.

## 21. Approval gate

Architecture:

- [x] Option A explicitly approved by user on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [x] explicitly approved by user on 2026-10-11

Implementation / TDD:

- [x] authorized by user on 2026-10-11

Implementation/TDD is authorized after this synchronized governance PR is merged to `main`; the implementation branch must then start from the latest current `main`.
