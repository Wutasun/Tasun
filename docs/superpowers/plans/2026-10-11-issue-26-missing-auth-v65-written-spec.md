# Issue #26 Written Spec — Remove Broken tasun-global-auth-v65 Page References

Date: 2026-10-11  
Requirement: GitHub Issue #26 — `[REQ] Remove broken tasun-global-auth-v65 page references`  
Architecture: Option A APPROVED  
Functional R-number: NOT ASSIGNED  
Status: WRITTEN SPEC AWAITING USER APPROVAL / NO IMPLEMENTATION AUTHORITY

## 1. Implementation objective

Remove stale references to the missing authentication asset:

`tasun-global-auth-v65.js`

from the six approved affected pages, while preserving the existing `tasun-auth-v4.js` authority and all current login/session/permission behavior.

The missing v65 file must not be recreated.

## 2. Implementation baseline

Implementation may begin only after this written spec receives explicit user approval and the synchronized governance record is merged to `main`.

Implementation branch must be created from the latest current `main` at that time.

Architecture tracing baseline:

`main @ 97e77d7e456ac81b8c086f2fb313c981f12498e6`

If `main` advances before implementation starts, the implementation baseline must advance with it.

## 3. Approved file scope

Approved HTML pages:

1. `權限表.html`
2. `工程資料查詢.html`
3. `工程資料登錄.html`
4. `工程資料明細表.html`
5. `捷運汐止東湖線統包工程-資料明細表查詢.html`
6. `捷運汐止東湖線統包工程-資料明細表登錄.html`

Expected implementation change:

- remove only the `tasun-global-auth-v65.js` script reference/load from each affected page;
- preserve each page's existing `tasun-auth-v4.js` load;
- do not otherwise refactor auth/session code unless RED evidence proves a direct dependency that contradicts the approved architecture.

## 4. Explicitly forbidden changes

Do not:

- recreate `tasun-global-auth-v65.js`;
- add a compatibility shim under that filename;
- change `tasun-auth-v4.js`;
- change `tasun-global-auth.js`;
- modify Worker login endpoint behavior;
- change login UI;
- change user/password/role model;
- change session/token key semantics;
- change permission inheritance;
- change formal row data;
- change statistics formulas;
- change cloud synchronization behavior;
- manually edit `tasun-version.json`;
- assign a functional R-number.

## 5. TDD sequence

### RED stage

Create a dedicated regression test first, expected path:

`tests/issue-26-missing-auth-v65-reference.test.cjs`

Before changing any HTML, the test must assert:

- all six approved pages must not contain `tasun-global-auth-v65.js`;
- all six must still contain/load `tasun-auth-v4.js`;
- repository root must not contain `tasun-global-auth-v65.js`;
- no `TasunGlobalAuthV65` consumer is introduced.

Expected RED:

The test fails because the six pages still reference the missing v65 file.

Record:

- tests-only commit SHA;
- focused test result;
- full regression run result;
- exact failing assertion(s).

Do not change HTML before RED is confirmed.

### GREEN stage

Remove the stale v65 reference from the six approved pages only.

Re-run:

- focused Issue #26 regression;
- full Tasun regression suite;
- disposable exact-release verification.

Expected GREEN:

- all six stale references absent;
- all six current v4 auth loads preserved;
- no new v65 file;
- no auth-core changes.

## 6. Auth authority contract

Current supported auth authority remains:

affected page
→ existing page login/session logic
→ `tasun-auth-v4.js`
→ Worker login/session/token bridge.

The implementation must preserve:

- `window.TasunAuthV4`;
- current-user/session/session-bridge semantics;
- current token mirroring behavior;
- existing role normalization;
- child-page session bridge;
- direct-open target bridge.

No second auth authority may be created.

## 7. Existing page-local auth behavior

Several affected pages contain page-local login or permission code using keys such as:

- `tasunCurrentUser_v1`
- `tasunSessionBridge_v1`
- `tasunSession_v1`
- `tasunAuthTable_v1`
- index-login verification bridge keys.

Removing the missing v65 script reference must not alter that page-local behavior.

The implementation must not use this Issue as a reason to consolidate or rewrite page-local auth logic.

## 8. Missing-file invariant

The repository must continue to have no:

`tasun-global-auth-v65.js`

file.

Regression must prevent both:

- reintroducing the missing file;
- reintroducing references to it in the approved pages.

Historical governance documents may mention the filename as evidence and must not cause false-positive test failures.

## 9. Release impact

This implementation changes existing HTML files.

Therefore it is release-triggering under the Exact Auto Release workflow.

Expected release behavior after merge:

1. `.github/workflows/release-version.yml` triggers.
2. changed HTML is included as relevant release input.
3. `publish-version_tasun_project_autoscan.mjs` generates the next automatic build/releaseSequence.
4. formal four-page release group is synchronized.
5. changed auxiliary HTML pages are included in exact release processing as applicable.
6. `tasun-version.json` is updated only by the publisher workflow.
7. Pages deployment occurs.
8. deployed build/sequence/SHA verification must pass.

Any manual `tasun-version.json` edit is a failure.

## 10. Formal release group impact

The standard four formal pages remain governed by the existing release chain:

- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`

Issue #26 does not directly modify these four unless one is separately proven to contain the stale reference on the latest implementation baseline.

If the implementation baseline differs from architecture tracing and any formal-page reference appears, stop and return to architecture review before expanding scope.

## 11. Release-sequence contract

The post-merge automatic release sequence is expected to increment because changed HTML exists.

That sequence:

- is an automatic release identifier;
- is not the Issue #26 functional R-number;
- must not be manually chosen;
- must come only from `publish-version_tasun_project_autoscan.mjs`.

Functional R-number remains NOT ASSIGNED.

## 12. Regression design

The Issue #26 test should use Node built-ins and deterministic repository reads.

Minimum assertions:

1. the six approved page files exist;
2. each does not contain `tasun-global-auth-v65.js`;
3. each does contain `tasun-auth-v4.js`;
4. root `tasun-global-auth-v65.js` does not exist;
5. `tasun-auth-v4.js` exists;
6. `tasun-auth-v4.js` still exposes `TasunAuthV4`;
7. current `tasun-auth-v4.js` still contains core session/token bridge markers;
8. no approved page references `TasunGlobalAuthV65`.

The test should not scan governance docs as active runtime sources.

## 13. Reference-scan contract

Before implementation, repeat exact current-main searches for:

- `tasun-global-auth-v65.js`
- `TasunGlobalAuthV65`

Classify all hits.

Expected active hits before GREEN:

- the six approved HTML filename references.

Expected active hits after GREEN:

- zero.

Historical docs may retain filename mentions if clearly non-executable.

## 14. Diff-scope contract

Expected implementation PR changed files:

- six approved HTML pages;
- one dedicated Issue #26 regression test.

No auth-core file change is expected.

Any additional production file must have direct RED evidence and must be reviewed before merge.

## 15. Review criteria

Independent review must confirm:

- only stale script loads were removed;
- `tasun-auth-v4.js` remains loaded on all six pages;
- no login UI or auth behavior was rewritten;
- no fallback v65 file was created;
- no `tasun-global-auth.js` migration was introduced;
- no manual version file change exists in implementation commits;
- tests cover all six pages rather than a subset;
- release-trigger implications are correctly documented.

## 16. Verification matrix

Before implementation PR merge, all must be GREEN:

- focused Issue #26 test;
- full Tasun regression suite;
- disposable exact-release verification;
- diff-scope review;
- exact active-reference scan;
- auth authority invariant review.

Implementation PR must record:

- RED head SHA;
- RED run ID/result;
- GREEN head SHA;
- GREEN run ID/result;
- disposable exact-release result;
- changed-file list;
- confirmation that auth core files are unchanged;
- confirmation that `tasun-version.json` was not manually edited.

## 17. Merge contract

Only merge after:

- RED→GREEN evidence complete;
- full regression GREEN;
- disposable exact-release verification GREEN;
- no unresolved major review finding;
- changed-file scope matches the approved written spec.

Use the repository's current merge practice.

## 18. Post-merge release verification

After merge to `main`:

1. capture merge SHA;
2. inspect the Exact Auto Release workflow associated with the merge;
3. capture generated formal build;
4. capture automatic releaseSequence;
5. confirm `tasun-version.json` update was generated by workflow, not manual commit logic;
6. confirm four formal pages report the expected build;
7. confirm manifest SHA values match deployed bytes;
8. confirm the six affected pages no longer request the missing v65 asset;
9. record closure evidence in Issue #26;
10. close Issue #26 when acceptance criteria are satisfied.

## 19. Failure handling

If after removing the stale reference any regression shows actual behavior depended on a v65-produced global:

- do not recreate the v65 file;
- do not add ad hoc fallback logic;
- stop implementation;
- return to architecture review with the exact failing consumer/call chain.

## 20. Acceptance criteria

Implementation is complete only when all are true:

- [ ] all six approved pages no longer reference `tasun-global-auth-v65.js`;
- [ ] `tasun-global-auth-v65.js` remains absent from repository root;
- [ ] all six pages retain `tasun-auth-v4.js`;
- [ ] no `TasunGlobalAuthV65` active consumer exists;
- [ ] existing login/permission behavior remains unchanged;
- [ ] no second auth authority is introduced;
- [ ] regression locks all six page invariants;
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
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after explicit written-spec approval

Until the user explicitly approves this written spec, implementation/TDD remains unauthorized.
