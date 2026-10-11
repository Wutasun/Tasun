# Issue #38 Written Spec — Retire dormant Tasun Security v3 repository mutators

Date: 2026-10-11  
Requirement: GitHub Issue #38 — `[REQ] Retire dormant Tasun Security v3 repository mutators`  
Architecture: Option A APPROVED  
Functional R-number: NOT ASSIGNED  
Status: WRITTEN SPEC AWAITING USER APPROVAL / NO IMPLEMENTATION AUTHORITY

## 1. Implementation objective

Retire the two verified-unreferenced executable legacy repository-mutator scripts:

- `inject-index-login-v3.js`
- `guard-all-html-security-v3.js`

by deleting them without adding replacement mutators, compatibility shims, executable archives, or alternate v3 injection paths.

The current v4/v5 runtime authority must remain unchanged.

## 2. Implementation baseline

Implementation may begin only after this written spec receives explicit user approval and the synchronized governance record is merged to `main`.

Implementation branch must be created from the latest current `main` at that time.

Architecture tracing baseline:

`main @ f52f5ec19abe694c72deb0788c50c0a78bd352a5`

If `main` advances before implementation starts, repeat the exact mutator/reference scan on the new baseline.

## 3. Approved production file scope

Approved production changes:

1. delete `inject-index-login-v3.js`;
2. delete `guard-all-html-security-v3.js`.

Expected test addition:

3. `tests/issue-38-retire-v3-mutators.test.cjs`.

No HTML or active runtime authority file is approved for modification.

## 4. Legacy mutator retirement contract

### 4.1 inject-index-login-v3.js

This file must be deleted.

Do not preserve or recreate logic that can:

- inject `tasun-auth-v3.js`;
- inject `tasun-cloudwrap-v3.js`;
- add `TasunAuthV3` login glue;
- rewrite `index.html` toward the old v3 auth chain.

### 4.2 guard-all-html-security-v3.js

This file must be deleted.

Do not preserve or recreate logic that can:

- recursively rewrite repository HTML;
- inject `tasunAuthSession_v3` guards;
- inject `tasun-auth-v3.js`;
- inject `tasun-cloudwrap-v3.js`;
- inject `tasun-guard-v3.js`.

## 5. Obsolete v3 runtime absence invariant

The following runtime files are already absent and must remain absent:

- `tasun-auth-v3.js`;
- `tasun-cloudwrap-v3.js`;
- `tasun-guard-v3.js`.

No compatibility versions, stubs, aliases, or archived executable copies are authorized.

## 6. Current authority invariants

The implementation must not modify:

- `tasun-auth-v4.js`;
- `tasun-boot.js`;
- `tasun-guard-v5.js`;
- `tasun-global-core.js`.

Current v4/v5 auth/session/guard/self-heal behavior must remain unchanged.

## 7. Pre-implementation reference scan

Before RED/GREEN changes, repeat exact searches for:

- `inject-index-login-v3.js`;
- `guard-all-html-security-v3.js`;
- `tasun-auth-v3.js`;
- `tasun-cloudwrap-v3.js`;
- `tasun-guard-v3.js`;
- `tasunAuthSession_v3`;
- `TasunAuthV3`.

Classify hits as:

- active runtime/workflow;
- tests;
- governance/history;
- the legacy mutator files themselves.

Expected current result:

- no active current runtime/workflow dependency outside the two legacy mutators.

If a real active dependency appears on latest `main`, stop and return to architecture review.

## 8. TDD sequence

### RED stage

Create:

`tests/issue-38-retire-v3-mutators.test.cjs`

before deleting either mutator.

Minimum RED assertions:

1. `inject-index-login-v3.js` must not exist;
2. `guard-all-html-security-v3.js` must not exist;
3. `tasun-auth-v3.js` must remain absent;
4. `tasun-cloudwrap-v3.js` must remain absent;
5. `tasun-guard-v3.js` must remain absent;
6. `tasun-auth-v4.js` must exist;
7. `tasun-boot.js` must exist;
8. `tasun-guard-v5.js` must exist;
9. active runtime/workflow files must not depend on either mutator.

Expected RED:

- both legacy mutator files still exist.

Record:

- tests-only head SHA;
- RED regression run/result;
- exact failing assertions.

Do not delete production files before RED is confirmed.

### GREEN stage

Delete only:

- `inject-index-login-v3.js`;
- `guard-all-html-security-v3.js`.

Then rerun:

- focused Issue #38 regression;
- full Tasun regression suite;
- disposable exact-release verification.

Expected GREEN:

- both mutators absent;
- v3 runtime files still absent;
- current v4/v5 authority files unchanged.

## 9. Active dependency scan scope

The dedicated regression should inspect current executable/runtime/build sources while excluding:

- `docs/`;
- `tests/`;
- historical text reports;
- evidence-only artifacts.

The test should not fail on historical mentions in governance documents.

At minimum, inspect current:

- HTML;
- JS/MJS/CJS;
- JSON;
- workflow YAML;
- package/script metadata if present.

## 10. No-replacement contract

Do not add:

- replacement v3 injector scripts;
- renamed copies of the two mutators;
- archived executable copies;
- shell wrappers that reproduce the same injections;
- `TasunAuthV3` compatibility glue;
- `tasunAuthSession_v3` compatibility session bridge.

Retirement must remove executable downgrade capability.

## 11. Explicitly forbidden changes

Do not:

- edit any HTML page;
- edit `tasun-auth-v4.js`;
- edit `tasun-boot.js`;
- edit `tasun-guard-v5.js`;
- edit `tasun-global-core.js`;
- edit release workflow;
- edit autoscan publisher;
- change auth/session/token keys;
- change Worker endpoints;
- change UI;
- change permissions;
- change formal data;
- change statistics;
- change cloud synchronization;
- manually edit `tasun-version.json`;
- assign a functional R-number.

## 12. Diff-scope contract

Expected implementation PR changed files:

- deleted `inject-index-login-v3.js`;
- deleted `guard-all-html-security-v3.js`;
- added `tests/issue-38-retire-v3-mutators.test.cjs`.

No active runtime file edits are expected.

Any additional production file requires architecture review.

## 13. Release workflow behavior

Current workflow push paths include:

`**/*.js`

Therefore deleting either mutator is expected to trigger the Exact Auto Release workflow.

However current autoscan relevance logic only treats a changed file as relevant when it:

- still exists after the change; and
- is a formal HTML/HTM page, listed `CORE_FILES` authority, or generated authority file.

Both legacy mutators:

- are not in `CORE_FILES`;
- are not formal HTML pages;
- are not generated authority files;
- will not exist after deletion.

Expected production behavior:

1. implementation PR merges to `main`;
2. workflow triggers due to JS path change;
3. changed-file resolution sees the deleted mutator paths;
4. autoscan finds no surviving relevant formal/core/generated file;
5. autoscan logs `no formal page/core/manifest change; nothing to sync.`;
6. formal build remains unchanged;
7. releaseSequence remains unchanged;
8. `tasun-version.json` remains unchanged;
9. existing deployed four-page verification still succeeds.

Do not force a new release merely to increment sequence.

## 14. Disposable exact-release behavior

Branch regression/disposable exact-release verification must still succeed.

The disposable verification should confirm that removing dormant non-core JS mutators does not unexpectedly mutate formal release authority.

## 15. Version authority contract

Formal version authority remains:

`.github/workflows/release-version.yml`
→ `publish-version_tasun_project_autoscan.mjs`
→ `tasun-version.json`.

Implementation commits must not manually modify the version manifest.

If post-merge behavior differs from the expected no-sync path, inspect actual workflow/publisher evidence before closure.

## 16. Review criteria

Independent review must verify:

- only the two legacy mutators are deleted from production;
- no replacement injector or v3 shim was added;
- obsolete v3 runtime files remain absent;
- current v4/v5 authority files are byte-identical to baseline;
- regression covers both deleted files and stale v3 targets;
- no version manifest edit is present.

## 17. Verification matrix

Before merge, all must be GREEN:

- focused Issue #38 regression;
- full regression suite;
- disposable exact-release verification;
- exact dependency/reference scan;
- diff-scope review;
- current v4/v5 authority unchanged checks;
- version manifest unchanged check.

Implementation PR must record:

- RED head SHA;
- RED run/result;
- GREEN head SHA;
- GREEN run/result;
- disposable exact-release result;
- changed-file list;
- authority blob comparisons;
- version blob comparison.

## 18. Merge contract

Only merge after:

- RED→GREEN evidence complete;
- full regression GREEN;
- disposable exact-release GREEN;
- no unresolved major review issue;
- diff scope matches this written spec.

Use current repository merge practice.

## 19. Post-merge verification

After merge:

1. capture implementation merge SHA;
2. inspect Exact Auto Release workflow triggered by the JS deletions;
3. capture workflow conclusion;
4. inspect autoscan logs for relevance result;
5. verify both mutators are absent on current `main`;
6. verify all three obsolete v3 runtime files remain absent;
7. verify `tasun-auth-v4.js`, `tasun-boot.js`, and `tasun-guard-v5.js` remain unchanged;
8. verify formal build;
9. verify releaseSequence;
10. verify `tasun-version.json` blob;
11. if no relevant change was found, confirm version authority values remain unchanged;
12. record closure evidence in Issue #38;
13. close Issue #38 when acceptance criteria are satisfied.

## 20. Failure handling

If a new active dependency on either mutator appears:

- do not delete the mutators;
- do not add compatibility shims;
- record the exact consumer/call chain;
- return to architecture review.

If production autoscan unexpectedly treats the deletion as relevant:

- inspect exact workflow/publisher evidence;
- do not manually edit or revert the manifest;
- complete or correct the release chain according to actual current rules before closure.

## 21. Acceptance criteria

Implementation is complete only when all are true:

- [ ] `inject-index-login-v3.js` deleted;
- [ ] `guard-all-html-security-v3.js` deleted;
- [ ] no replacement mutator or v3 compatibility shim added;
- [ ] `tasun-auth-v3.js` remains absent;
- [ ] `tasun-cloudwrap-v3.js` remains absent;
- [ ] `tasun-guard-v3.js` remains absent;
- [ ] current v4/v5 authority files unchanged;
- [ ] regression locks retirement;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] post-merge workflow behavior verified;
- [ ] formal build/releaseSequence unchanged if autoscan finds no relevant file;
- [ ] no manual `tasun-version.json` edit;
- [ ] closure evidence recorded.

## 22. Approval gate

Architecture:

- [x] Option A explicitly approved by user on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after explicit written-spec approval

Until the user explicitly approves this written spec, implementation/TDD remains unauthorized.
