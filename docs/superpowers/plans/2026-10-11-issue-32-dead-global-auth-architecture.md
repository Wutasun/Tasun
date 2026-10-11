# Issue #32 Architecture — Retire dead TasunGlobalAuth token fallback and dormant auth authority

Date: 2026-10-11  
Requirement: GitHub Issue #32 — `[REQ] Retire dead TasunGlobalAuth token fallback and dormant auth authority`  
Functional R-number: NOT ASSIGNED  
Status: DRAFT / NOT APPROVED / NO IMPLEMENTATION AUTHORITY

## 1. Baseline authority

Architecture tracing baseline:

- repository: `Wutasun/Tasun`
- baseline: `main @ bc3af2d1ea555237c9728b9500d947f6d81b0307`
- current auth/token authority: `tasun-auth-v4.js`
- current token API: `TasunAuthV4.getToken()`
- formal release publisher: `publish-version_tasun_project_autoscan.mjs`
- formal workflow: `.github/workflows/release-version.yml`

No implementation is authorized by this draft.

## 2. Confirmed dead fallback

`tasun-api/index.html` current `getAnyToken()` resolution order is:

1. token keys from session/local storage;
2. session/current-user bridge extraction;
3. `TasunAuthV4.getToken()`;
4. legacy/global auth alias probe;
5. cookie fallback.

The legacy/global probe is:

`window.TasunGlobalAuth || window.tasunGlobalAuth || window.TASUN_AUTH`

and attempts:

- `token`
- `accessToken`
- `authToken`
- `apiKey`
- `getToken()`

## 3. Actual legacy auth contract

Current `tasun-global-auth.js` exposes only:

- `sha256Hex`
- `getGlobalPassHashFromLocal`
- `verifyPassword`
- `requireAuth`
- `isAuthed`
- `getCurrentUser`
- `setAuthed`
- storage-key metadata

It does not expose any token property or `getToken()`.

Therefore the current `TasunGlobalAuth` object cannot satisfy the token fallback contract.

## 4. Runtime loading evidence

Exact current repository search shows no runtime page loading:

`tasun-global-auth.js`

by filename.

The filename is not referenced by:

- `tasun-resources.json`
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`

No current definition of `window.TASUN_AUTH` exists.

No current lower-case token provider `window.tasunGlobalAuth` exists.

Therefore there is no current repository call chain that makes the legacy/global token fallback executable.

## 5. Current supported authority

`tasun-auth-v4.js` already owns the supported token/session contract:

- Worker token login;
- token mirroring;
- `getToken()`;
- current-user/session/session-bridge persistence;
- child-page session bridge;
- login/logout state.

`tasun-api/index.html` already calls `TasunAuthV4.getToken()` before the dead legacy/global branch.

## 6. Architecture options

### Option A — Remove dead fallback and retire dormant legacy auth file

Changes:

- remove the `TasunGlobalAuth / tasunGlobalAuth / TASUN_AUTH` token fallback block from `tasun-api/index.html`;
- preserve the existing cookie fallback immediately after `TasunAuthV4.getToken()`;
- delete `tasun-global-auth.js`;
- add regression coverage locking both invariants.

Do not modify `tasun-auth-v4.js`.

**Advantages**

- removes a provably dead token branch;
- retires a dormant second auth authority;
- reduces ambiguity about token ownership;
- preserves the already-supported TasunAuthV4 token chain;
- no compatibility shim or alias.

**Risks**

- an undocumented external injector could theoretically create one of the legacy globals at runtime. Current repository/deployment evidence does not support such a dependency.

### Option B — Retain legacy file/fallback

Only justified if tracing proves:

- a current runtime loader for `tasun-global-auth.js`; or
- a current external/global token provider intentionally projected through one of the aliases.

No such evidence is currently present.

## 7. Recommended architecture

**Recommend Option A — remove the dead legacy/global token fallback and delete dormant `tasun-global-auth.js`.**

This preserves a single supported token authority:

storage/session bridge
→ `TasunAuthV4.getToken()`
→ cookie fallback.

No second auth/token authority is needed.

## 8. Explicitly unchanged

Do not modify:

- `tasun-auth-v4.js`;
- Worker login endpoint;
- token key list;
- token mirroring behavior;
- session/current-user bridge shape;
- login UI;
- password/role model;
- permissions;
- formal row data;
- statistics;
- cloud sync;
- release algorithm;
- `tasun-version.json` manually.

Functional R-number remains NOT ASSIGNED.

## 9. Release impact

Approved implementation would:

- modify `tasun-api/index.html`;
- delete `tasun-global-auth.js`.

Because an existing HTML file changes, Exact Auto Release is expected to trigger and generate the next automatic release sequence.

The JS deletion alone may not be formal release-relevant because the file is not an active autoscan core asset, but the HTML change makes the implementation release-triggering.

Post-merge verification therefore requires:

- formal Exact Auto Release GREEN;
- Pages deployment GREEN;
- deployed four-page build/sequence/SHA verification GREEN.

## 10. TDD direction

RED regression should assert:

- `tasun-api/index.html` no longer contains the legacy/global token alias block;
- `tasun-api/index.html` still contains `TasunAuthV4.getToken()`;
- cookie fallback remains present;
- `tasun-global-auth.js` does not exist;
- current auth core remains unchanged.

Expected RED:

- legacy token block still exists;
- `tasun-global-auth.js` still exists.

GREEN implementation:

- remove only the dead token block;
- delete only `tasun-global-auth.js`.

## 11. Reference-scan contract

Before GREEN, repeat exact search for:

- `tasun-global-auth.js`
- `window.TasunGlobalAuth`
- `window.tasunGlobalAuth`
- `window.TASUN_AUTH`

If a new active runtime loader/provider appears on latest implementation baseline, stop and return to architecture review.

Historical governance docs/tests may retain evidence mentions.

## 12. Diff-scope contract

Expected implementation PR changed files:

- `tasun-api/index.html`
- deleted `tasun-global-auth.js`
- one dedicated Issue #32 regression test

No other production file is expected.

## 13. Acceptance criteria

- [ ] dead legacy/global token fallback removed from `tasun-api/index.html`;
- [ ] cookie fallback remains intact;
- [ ] canonical `TasunAuthV4.getToken()` remains intact;
- [ ] `tasun-global-auth.js` retired;
- [ ] no replacement auth/token compatibility authority added;
- [ ] `tasun-auth-v4.js` unchanged;
- [ ] regression locks both absence invariants;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] formal Exact Auto Release GREEN;
- [ ] deployed four-page build/sequence/SHA verification GREEN;
- [ ] no manual version edit.

## 14. Architecture approval gate

Architecture:

- [ ] explicitly approved by user

Written spec:

- [ ] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after written spec approval

Until explicit user approval, this remains a draft with no implementation authority.
