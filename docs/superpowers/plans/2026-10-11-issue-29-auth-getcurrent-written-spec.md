# Issue #29 Written Spec — Align stale TasunAuthV4 getCurrentUser callers with current API

Date: 2026-10-11  
Requirement: GitHub Issue #29 — `[REQ] Align stale TasunAuthV4 getCurrentUser callers with current API`  
Architecture: Option A APPROVED  
Functional R-number: NOT ASSIGNED  
Status: WRITTEN SPEC AWAITING USER APPROVAL / NO IMPLEMENTATION AUTHORITY

## 1. Implementation objective

Update the approved stale internal TasunAuthV4 callers to use the current canonical API:

`TasunAuthV4.getCurrent()`

instead of the nonexistent:

`TasunAuthV4.getCurrentUser()`

The implementation must preserve existing storage/session-first fallback ordering, user/role normalization, token/session bridge behavior, login UI, permissions, and auth-core implementation.

## 2. Implementation baseline

Implementation may begin only after this written spec receives explicit user approval and the synchronized governance record is merged to `main`.

Implementation branch must be created from the latest current `main` at that time.

Architecture tracing baseline:

`main @ 696b69332a3c749b73c269e480b46259c2e114e0`

If `main` advances before implementation starts, re-run the caller scan on the new baseline before changing files.

## 3. Approved production file scope

Approved runtime files:

1. `tasun-api/index.html`
2. `名詞解釋.html`

Expected production diff:

- replace the stale `TasunAuthV4.getCurrentUser` guard/call with `TasunAuthV4.getCurrent`;
- preserve the surrounding storage/session lookup, normalization, fallback order, and downstream behavior;
- no unrelated refactor.

No additional runtime page is approved in this spec.

## 4. Auth-core invariants

`tasun-auth-v4.js` is the current authority and must remain unchanged.

The implementation must preserve its exported contract:

- `login`
- `logout`
- `getCurrent`
- `setCurrent`
- `getToken`
- `isLoggedIn`
- `setSessionState`
- `getSessionState`
- `clearSessionState`
- `bridgeCurrentToChild`

Do not add a `getCurrentUser` compatibility alias.

## 5. TDD sequence

### RED stage

Create a dedicated regression test first, expected path:

`tests/issue-29-auth-getcurrent-contract.test.cjs`

Before changing the two HTML files, the test must assert:

1. `tasun-auth-v4.js` exports `getCurrent`;
2. `tasun-auth-v4.js` does not need/export a `getCurrentUser` compatibility alias;
3. `tasun-api/index.html` uses `TasunAuthV4.getCurrent()`;
4. `名詞解釋.html` uses `TasunAuthV4.getCurrent()`;
5. neither approved page invokes `TasunAuthV4.getCurrentUser()`;
6. each page still contains its existing storage/session lookup path before the auth-core fallback.

Expected RED:

The tests fail because both approved pages still reference the stale `getCurrentUser` API.

Record:

- tests-only commit SHA;
- focused failure;
- regression run ID/result;
- exact failing assertion.

Do not change production HTML before RED is confirmed.

### GREEN stage

Modify only the two approved HTML files.

Re-run:

- focused Issue #29 regression;
- full Tasun regression suite;
- disposable exact-release verification.

Expected GREEN:

- both stale callers migrated to `getCurrent()`;
- storage/session-first resolution remains unchanged;
- auth core unchanged;
- no compatibility alias added.

## 6. tasun-api/index.html contract

Current local resolver must retain this logical order:

1. read normalized user from existing storage/session bridge keys;
2. if no user, call `TasunAuthV4.getCurrent()`;
3. normalize the returned current user/role;
4. if still unresolved, continue existing downstream fallback behavior.

Do not:

- reorder token resolution;
- remove storage/session keys;
- alter Worker login behavior;
- alter `getAnyToken()` logic except where separately required by another approved issue.

## 7. 名詞解釋.html contract

Current resolver must retain this logical order:

1. normalize user from existing `AUTH_BRIDGE_KEYS`;
2. if none, call `TasunAuthV4.getCurrent()`;
3. if none, retain the existing `TasunGlobalCore.getCurrentUser()` fallback;
4. otherwise remain in current read-only/no-user state.

Do not remove or reorder the `TasunGlobalCore` fallback in this issue.

## 8. Return-shape compatibility

`TasunAuthV4.getCurrent()` returns normalized current-session data containing user identity and role-compatible fields.

Existing caller normalization must remain responsible for adapting that object.

Do not modify `tasun-auth-v4.js` return shape.

If implementation testing proves a caller cannot normalize the `getCurrent()` return object, stop and return to architecture review rather than expanding scope.

## 9. Additional caller scan

Before implementation, repeat exact search for:

- `TasunAuthV4.getCurrentUser`
- `getCurrentUser === "function"` variants referencing TasunAuthV4.

If additional active runtime callers appear on the latest baseline:

- record them;
- do not silently modify them;
- return to architecture review if production scope must expand.

Historical governance docs and test text may mention the stale API and are not active runtime callers.

## 10. Explicitly forbidden changes

Do not:

- edit `tasun-auth-v4.js`;
- add `getCurrentUser` alias to auth core;
- edit `tasun-global-auth.js`;
- edit `tasun-global-core.js`;
- change login UI;
- change password/role semantics;
- change Worker login endpoint;
- change session/token key names;
- change token mirroring;
- change permission matrix behavior;
- change formal row data;
- change statistics formulas;
- change cloud synchronization behavior;
- manually edit `tasun-version.json`;
- assign a functional R-number.

## 11. Regression design

The dedicated Issue #29 regression should use Node built-ins and deterministic repository reads.

Minimum assertions:

- current core contains `getCurrent:getCurrent`;
- current core does not expose `getCurrentUser:getCurrentUser`;
- both approved pages contain `TasunAuthV4.getCurrent`;
- both approved pages do not contain `TasunAuthV4.getCurrentUser`;
- `tasun-api/index.html` still contains its storage/session bridge key lookup;
- `名詞解釋.html` still contains `AUTH_BRIDGE_KEYS`;
- `名詞解釋.html` still retains `TasunGlobalCore.getCurrentUser` fallback;
- no auth-core source file is changed by the implementation PR.

## 12. Diff-scope contract

Expected implementation PR changed files:

- `tasun-api/index.html`
- `名詞解釋.html`
- `tests/issue-29-auth-getcurrent-contract.test.cjs`

No other production file is expected.

Any additional production file requires explicit evidence and architecture review.

## 13. Release impact

Both approved runtime files are HTML.

Therefore merge is expected to trigger Exact Auto Release.

Expected post-merge behavior:

1. merge to `main`;
2. Exact Auto Release workflow triggers;
3. autoscan recognizes changed HTML as relevant;
4. next automatic build/releaseSequence is generated;
5. `tasun-version.json` is updated only by the publisher workflow;
6. formal four-page group is synchronized;
7. Pages deploys;
8. deployed four-page build/sequence/SHA verification passes.

The automatic release sequence is not the functional Issue #29 R-number.

## 14. Version authority contract

Formal version authority remains:

`.github/workflows/release-version.yml`
→ `publish-version_tasun_project_autoscan.mjs`
→ `tasun-version.json`
→ exact four-page deploy/verification.

Implementation commits must not manually touch `tasun-version.json`.

## 15. Review criteria

Independent review must verify:

- only the stale TasunAuthV4 method name/guard changed in the two runtime pages;
- storage/session fallback order remains intact;
- normalization logic remains intact;
- no auth-core alias was added;
- no unrelated auth cleanup was bundled;
- regression covers both pages;
- release-trigger impact is documented.

## 16. Verification matrix

Before merge, all must be GREEN:

- focused Issue #29 test;
- full Tasun regression suite;
- disposable exact-release verification;
- exact active-caller scan;
- diff-scope review;
- auth-core unchanged check.

Implementation PR must record:

- RED head SHA;
- RED run/result;
- GREEN head SHA;
- GREEN run/result;
- disposable exact-release result;
- changed-file list;
- auth-core unchanged evidence;
- no manual version edit confirmation.

## 17. Merge contract

Only merge after:

- RED→GREEN evidence complete;
- full regression GREEN;
- disposable exact-release verification GREEN;
- no unresolved major review issue;
- changed-file scope matches the approved written spec.

Follow current repository merge practice.

## 18. Post-merge verification

After merge:

1. capture implementation merge SHA;
2. inspect Exact Auto Release run associated with that merge;
3. capture generated release commit;
4. capture formal build;
5. capture automatic releaseSequence;
6. confirm four formal pages report the expected build;
7. confirm deployed manifest SHA values match;
8. confirm both approved pages on current `main` use `TasunAuthV4.getCurrent()`;
9. confirm neither approved page uses stale `TasunAuthV4.getCurrentUser()`;
10. record closure evidence in Issue #29;
11. close Issue #29 when all acceptance criteria are satisfied.

## 19. Failure handling

If `getCurrent()` causes a runtime/test incompatibility:

- do not add `getCurrentUser` alias;
- do not rewrite storage/session logic;
- capture the exact incompatible consumer/shape;
- stop and return to architecture review.

## 20. Acceptance criteria

Implementation is complete only when all are true:

- [ ] `tasun-api/index.html` uses `TasunAuthV4.getCurrent()`;
- [ ] `名詞解釋.html` uses `TasunAuthV4.getCurrent()`;
- [ ] neither approved page calls `TasunAuthV4.getCurrentUser()`;
- [ ] `tasun-auth-v4.js` remains unchanged;
- [ ] no `getCurrentUser` compatibility alias is added;
- [ ] storage/session fallback ordering remains unchanged;
- [ ] existing user/role normalization remains unchanged;
- [ ] regression locks API alignment;
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
