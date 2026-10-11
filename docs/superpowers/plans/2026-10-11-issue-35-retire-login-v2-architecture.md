# Issue #35 Architecture — Retire dormant tasun-login-v2 authentication authority

Date: 2026-10-11  
Requirement: GitHub Issue #35 — `[REQ] Retire dormant tasun-login-v2 authentication authority`  
Functional R-number: NOT ASSIGNED  
Status: DRAFT / NOT APPROVED / NO IMPLEMENTATION AUTHORITY

## 1. Baseline

Architecture tracing baseline:

- repository: `Wutasun/Tasun`
- baseline: `main @ c511917bfa8d1d797fb05ac71eb5a63a6cf0b2d7`
- supported auth authority: `tasun-auth-v4.js`
- legacy candidate: `tasun-login-v2.js`

No implementation is authorized by this draft.

## 2. Legacy module behavior

`tasun-login-v2.js` is a complete executable auth/session module.

It defines:

- hard-coded Worker base `https://tasun-worker.wutasun.workers.dev`;
- private session key `tasunAuthSession_v2`;
- its own `get/set/clear` session lifecycle;
- `login(username,password)`;
- `logout()`;
- `isLoggedIn()`;
- `requireLogin()`;
- global `fetch` monkey-patch that injects Bearer authorization for Worker endpoints;
- global export `window.tasunAuth`;
- global fetch guard `window.__TASUN_AUTH_FETCH__`.

If loaded, it would establish a parallel auth/session/token authority outside the current TasunAuthV4 contract.

## 3. Current dependency tracing

Exact repository tracing confirms:

- no current HTML page loads `tasun-login-v2.js`;
- `index.html` does not load it;
- `inject-index-login-v3.js` does not load/use it;
- `inline.js` does not load/use it;
- `tasun-resources.json` does not list it;
- `publish-version_tasun_project_autoscan.mjs` does not list it as a core authority;
- `.github/workflows/release-version.yml` does not name it;
- no active current consumer uses `tasunAuthSession_v2`;
- no active current consumer uses `tasunAuth.login()`;
- no active current consumer uses `__TASUN_AUTH_FETCH__`.

Repository code-search may show stale/indexed hits for `window.tasunAuth`, but direct reads of the reported current runtime files do not contain that string on current `main`.

Direct current-file reads take precedence over stale search indexing.

## 4. Current supported authority

`tasun-auth-v4.js` already provides the supported auth/session/token model:

- Worker login;
- current-user/session/session-bridge persistence;
- token mirroring;
- `getCurrent()`;
- `getToken()`;
- `isLoggedIn()`;
- `login()`;
- `logout()`;
- child-page session bridge.

Issue #29 and Issue #32 already converged stale callers/fallbacks onto this current authority.

## 5. Architecture options

### Option A — Delete dormant tasun-login-v2.js

Delete only:

`tasun-login-v2.js`

Add a regression test that proves:

- the legacy file is absent;
- current `tasun-auth-v4.js` remains present;
- current auth core still exports canonical login/getToken/getCurrent/session behavior;
- no active runtime reference to `tasun-login-v2.js`, `tasunAuthSession_v2`, `tasunAuth.login`, or `__TASUN_AUTH_FETCH__` exists.

Do not create a compatibility shim.

**Advantages**

- removes an executable duplicate auth authority;
- prevents accidental reintroduction of a second session key and global fetch wrapper;
- minimal production diff;
- preserves current auth behavior untouched.

### Option B — Retain/archive

Retain only if tracing proves a current runtime dependency or a deployment requirement outside the repository.

Current evidence does not support this option.

## 6. Recommended architecture

**Recommend Option A — delete the verified-unreferenced `tasun-login-v2.js` executable artifact.**

No runtime caller migration is needed because no current runtime caller exists.

## 7. Explicitly unchanged

Do not modify:

- `tasun-auth-v4.js`;
- `tasun-global-core.js`;
- Worker login endpoint;
- token keys;
- session/current-user bridge keys;
- active fetch behavior;
- login UI;
- permission model;
- formal row data;
- statistics;
- cloud sync;
- release algorithm;
- `tasun-version.json` manually.

Functional R-number remains NOT ASSIGNED.

## 8. Release impact

The workflow push filter includes:

`**/*.js`

Therefore deleting `tasun-login-v2.js` will trigger the Exact Auto Release workflow.

However autoscan relevance is stricter:

- formal pages: only `.html/.htm`;
- core files: only names in `CORE_FILES`;
- generated authority files: generated set;
- changed files are considered relevant only when they still exist after the change.

`tasun-login-v2.js` is not in `CORE_FILES`, and after deletion it will not exist.

Therefore expected production behavior is:

1. workflow triggers because a JS path changed;
2. autoscan resolves the deleted path;
3. no relevant formal/core/generated file remains;
4. autoscan logs `no formal page/core/manifest change; nothing to sync.`;
5. no new formal build/releaseSequence is expected;
6. no forced release should be created merely to increment sequence.

This is analogous to a governance cleanup with workflow verification but no formal release mutation.

## 9. TDD direction

### RED

Add a dedicated test first.

Expected path:

`tests/issue-35-retire-login-v2.test.cjs`

Assertions should include:

- `tasun-login-v2.js` must not exist;
- `tasun-auth-v4.js` must exist;
- `tasun-auth-v4.js` must export canonical login/getCurrent/getToken;
- no approved active runtime authority file references the legacy filename/session key/fetch guard.

Expected RED:

- the legacy file still exists.

### GREEN

Delete only:

`tasun-login-v2.js`

Re-run:

- focused Issue #35 test;
- full regression suite;
- disposable exact-release verification.

## 10. Reference scan contract

Before GREEN, repeat searches for:

- `tasun-login-v2.js`
- `tasunAuthSession_v2`
- `tasunAuth.login`
- `__TASUN_AUTH_FETCH__`

If a real active runtime consumer appears on latest implementation baseline, stop and return to architecture review.

Historical docs/tests do not count as active runtime consumers.

## 11. Diff-scope contract

Expected implementation PR changed files:

- deleted `tasun-login-v2.js`;
- one dedicated regression test.

No HTML/auth-core/version-manifest change is expected.

## 12. Acceptance criteria

- [ ] `tasun-login-v2.js` deleted;
- [ ] no compatibility shim added;
- [ ] `tasun-auth-v4.js` unchanged;
- [ ] no active runtime consumer of `tasunAuthSession_v2`, `tasunAuth.login`, or `__TASUN_AUTH_FETCH__`;
- [ ] regression locks the retirement invariant;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] post-merge workflow behavior verified;
- [ ] if autoscan reports no relevant change, formal build/releaseSequence remains unchanged;
- [ ] no manual `tasun-version.json` edit.

## 13. Architecture approval gate

Architecture:

- [ ] explicitly approved by user

Written spec:

- [ ] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after written spec approval

Until explicit user approval, this remains a draft with no implementation authority.
