# Issue #26 Architecture — Remove Broken tasun-global-auth-v65 Page References

Date: 2026-10-11  
Requirement: GitHub Issue #26 — `[REQ] Remove broken tasun-global-auth-v65 page references`  
Functional R-number: NOT ASSIGNED  
Status: ARCHITECTURE APPROVED / WRITTEN SPEC IN PROGRESS / NO IMPLEMENTATION AUTHORITY

## 1. Baseline authority

Architecture tracing baseline:

- repository: `Wutasun/Tasun`
- baseline: `main @ 97e77d7e456ac81b8c086f2fb313c981f12498e6`
- current auth core: `tasun-auth-v4.js`
- formal version source: `tasun-version.json`
- formal release publisher: `publish-version_tasun_project_autoscan.mjs`
- formal release workflow: `.github/workflows/release-version.yml`

No implementation is authorized by this draft.

## 2. Confirmed broken asset references

The repository root contains:

- `tasun-auth-v4.js`
- `tasun-global-auth.js`

The repository root does not contain:

- `tasun-global-auth-v65.js`

Current active HTML nevertheless references the missing file in six pages:

1. `權限表.html`
2. `工程資料查詢.html`
3. `工程資料登錄.html`
4. `工程資料明細表.html`
5. `捷運汐止東湖線統包工程-資料明細表查詢.html`
6. `捷運汐止東湖線統包工程-資料明細表登錄.html`

Five pages use a plain script tag. `權限表.html` uses a safe loader with empty success/error callbacks.

Every affected page also loads `tasun-auth-v4.js`.

## 3. Auth behavior tracing

### 3.1 Current supported auth core

`tasun-auth-v4.js` provides the current auth/session bridge:

- Worker token login;
- current-user/session/session-bridge persistence;
- token mirroring;
- role normalization;
- child-page session bridge;
- current-login helpers;
- direct-open target bridge.

It exposes `window.TasunAuthV4` and the current login/token helper globals.

### 3.2 Missing v65 asset

Repository search finds:

- no `TasunGlobalAuthV65` API consumer;
- no symbol-level dependency on a v65-specific global;
- only the stale filename references in the six pages.

Therefore there is no evidence that current page behavior consumes an API produced by the missing file.

### 3.3 Separate `tasun-global-auth.js`

`tasun-global-auth.js` is a distinct older global-password/localStorage implementation exposing `window.TasunGlobalAuth`.

It is not the missing v65 file and is not referenced by the six affected pages under the exact filename.

Its broader retirement status is outside Issue #26 unless implementation evidence proves it participates in the same call chain. Issue #26 must not silently delete or rewrite it.

## 4. Page-level evidence

The six affected pages load `tasun-auth-v4.js` before the stale v65 reference.

Observed auth state usage across the pages includes:

- `tasunCurrentUser_v1`
- `tasunSessionBridge_v1`
- `tasunSession_v1`
- `tasunAuthTable_v1`
- index-login verification bridge keys.

No consumer call to `TasunGlobalAuthV65` was found.

This means the stale script request currently adds a missing-network-resource failure without a proven functional consumer.

## 5. Architecture options

### Option A — Remove stale v65 references only

Remove the `tasun-global-auth-v65.js` load from all six affected pages.

Do not restore the missing file.

Do not modify `tasun-auth-v4.js`.

Do not modify `tasun-global-auth.js`.

Add regression coverage that verifies:

- the missing v65 filename does not exist;
- no active HTML references it;
- each affected page still loads the current `tasun-auth-v4.js`;
- auth/session contract markers remain present;
- no second auth authority is introduced.

**Advantages**

- directly repairs the broken asset chain;
- preserves the already-working auth authority;
- smallest change surface;
- no compatibility code;
- prevents accidental reintroduction of a nonexistent asset.

**Risks**

- if an undocumented external deployment once injected `tasun-global-auth-v65.js`, removing the reference makes that injection impossible on these pages. Current repository evidence does not support such a dependency.

### Option B — Recreate or merge v65 behavior into current auth

Only justified if tracing proves required behavior exists outside `tasun-auth-v4.js`.

Current evidence does not show such a missing behavior.

**Costs**

- larger auth surface;
- higher regression risk;
- risk of recreating duplicate authority;
- conflicts with the Tasun v5 authority-convergence principle unless a concrete missing contract is proven.

## 6. Recommended architecture

**Recommend Option A — remove all six stale v65 references and preserve `tasun-auth-v4.js` as the current auth authority.**

No missing v65 API consumer exists in current repository evidence.

Restoring an absent file merely to satisfy stale references would recreate an unnecessary authority surface.

## 7. Authority convergence contract

After implementation:

affected page
→ existing page auth/session code
→ `tasun-auth-v4.js`
→ Worker/session/token bridge.

There must be no:

- `tasun-global-auth-v65.js` request;
- compatibility shim with that filename;
- new auth core;
- silent migration to `tasun-global-auth.js`.

## 8. Release impact

All six changes are HTML changes.

The Exact Auto Release workflow path filter includes `**/*.html`, so merge is release-triggering.

The autoscan publisher treats existing changed HTML as relevant. Therefore an approved implementation that edits these pages is expected to:

1. trigger Exact Auto Release;
2. generate a new formal build/releaseSequence;
3. synchronize the formal four-page release group;
4. include changed auxiliary HTML in the release processing set;
5. update `tasun-version.json` only through the publisher;
6. require deployed build/sequence/SHA verification.

This differs from Issue #23: here changed HTML still exists and is relevant, so a new automatic release sequence is expected.

The automatic release sequence is not the functional Issue #26 R-number.

## 9. TDD direction

RED tests should prove current `main` violates the intended asset-load invariant:

- six affected pages still contain `tasun-global-auth-v65.js`.

GREEN implementation should remove only those references.

Regression must separately assert that:

- `tasun-auth-v4.js` remains loaded by every affected page;
- current auth/session bridge markers are not deleted;
- no missing-v65 compatibility file is added.

## 10. Explicitly unchanged

- login UI;
- user/password/role model;
- Worker login endpoint;
- token/session key model;
- permission inheritance;
- formal row data;
- statistics;
- cloud data sync;
- mobile/table behavior;
- `tasun-auth-v4.js`;
- `tasun-global-auth.js`;
- release algorithm;
- functional R-number remains NOT ASSIGNED.

## 11. Failure / fallback behavior

Removing the stale load should eliminate one failed asset request.

No new fallback, retry, or dynamic script loader is authorized.

If RED/implementation tracing reveals a page actually checks a global only produced by the missing v65 file, implementation must stop and return to architecture review rather than recreating behavior ad hoc.

## 12. Acceptance criteria

- [ ] all six stale references are removed;
- [ ] missing `tasun-global-auth-v65.js` is not recreated;
- [ ] all six pages retain `tasun-auth-v4.js`;
- [ ] existing login/permission behavior remains unchanged;
- [ ] regression locks the asset-reference invariant;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] formal Exact Auto Release GREEN;
- [ ] deployed build/releaseSequence/SHA verification GREEN;
- [ ] no manual `tasun-version.json` edit.

## 13. Architecture approval gate

Architecture:

- [x] explicitly approved by user on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after written spec approval

Architecture Option A is approved. The written spec is now being established in the same governance PR; implementation/TDD remains unauthorized until explicit written-spec approval.
