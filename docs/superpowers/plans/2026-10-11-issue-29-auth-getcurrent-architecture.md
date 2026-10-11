# Issue #29 Architecture — Align stale TasunAuthV4 getCurrentUser callers with current API

Date: 2026-10-11  
Requirement: GitHub Issue #29 — `[REQ] Align stale TasunAuthV4 getCurrentUser callers with current API`  
Functional R-number: NOT ASSIGNED  
Status: ARCHITECTURE APPROVED / WRITTEN SPEC IN PROGRESS / NO IMPLEMENTATION AUTHORITY

## 1. Baseline authority

Architecture tracing baseline:

- repository: `Wutasun/Tasun`
- baseline: `main @ 696b69332a3c749b73c269e480b46259c2e114e0`
- current auth core: `tasun-auth-v4.js`
- current-user canonical API: `TasunAuthV4.getCurrent()`
- session-state canonical API: `TasunAuthV4.getSessionState()`

No implementation is authorized by this draft.

## 2. Confirmed contract mismatch

Current `tasun-auth-v4.js` exports:

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
- token/direct-open helpers

It does not export `getCurrentUser`.

Current active callers still checking/invoking the stale API are:

1. `tasun-api/index.html`
2. `名詞解釋.html`

Both callers already have storage/session bridge resolution first, then attempt a TasunAuthV4 fallback.

The fallback condition can never become true with the current auth core because `getCurrentUser` is absent.

## 3. Current call-chain behavior

### 3.1 tasun-api/index.html

Current resolution order:

storage/session bridge keys
→ intended `TasunAuthV4` fallback
→ additional legacy/global fallback paths.

The intended auth-core branch currently checks:

`typeof window.TasunAuthV4.getCurrentUser === "function"`

and therefore skips the current core.

The same file already uses the valid `TasunAuthV4.getToken()` API elsewhere, confirming that `TasunAuthV4` is intended as an active authority.

### 3.2 名詞解釋.html

Current resolution order:

storage/session bridge keys
→ intended `TasunAuthV4` fallback
→ `TasunGlobalCore.getCurrentUser()` fallback
→ null/read-only state.

Its TasunAuthV4 branch also checks the nonexistent `getCurrentUser` method.

## 4. Canonical auth-core contract

`tasun-auth-v4.js` defines:

`function getCurrent(){ return getSessionState(); }`

and exports:

`getCurrent:getCurrent`

The returned object is the same normalized current session state intended by these callers:

- username/user identity;
- role;
- token;
- updatedAt.

Therefore `getCurrent()` is the correct current-user API for TasunAuthV4 callers.

## 5. Architecture options

### Option A — Update stale callers to `getCurrent()`

Modify only:

- `tasun-api/index.html`
- `名詞解釋.html`

Replace their TasunAuthV4 fallback contract from:

`getCurrentUser()`

to:

`getCurrent()`

Preserve all storage/session fallback order and normalization logic.

Add regression coverage that locks:

- current auth core exports `getCurrent`;
- current auth core does not require `getCurrentUser`;
- both affected pages use `getCurrent`;
- neither affected page invokes `TasunAuthV4.getCurrentUser`;
- storage/session fallback ordering remains intact.

**Advantages**

- fixes the callers to match the existing authority;
- no auth-core surface expansion;
- smallest possible runtime change;
- avoids compatibility aliases that could become permanent duplicate API;
- preserves current storage/session behavior.

### Option B — Add `getCurrentUser` compatibility alias to tasun-auth-v4.js

Add an alias mapping to `getCurrent`.

**Advantages**

- old callers continue working without page edits.

**Costs / risks**

- expands auth-core API solely for stale internal callers;
- hides outdated caller contracts instead of converging them;
- creates another long-lived compatibility surface;
- modifies core authority and broadens regression impact.

Current evidence does not justify this option.

## 6. Recommended architecture

**Recommend Option A — update the two stale callers to canonical `TasunAuthV4.getCurrent()`.**

Reason:

All identified current consumers are inside the repository and can be migrated directly. No external/current consumer requiring `getCurrentUser` has been identified.

The Tasun v5 authority-convergence rule favors correcting projections/callers over adding a compatibility alias to the core authority.

## 7. Data-flow invariants

After implementation:

page current-user resolver
→ existing storage/session bridge lookup
→ `TasunAuthV4.getCurrent()`
→ existing normalization
→ existing downstream role/token/header behavior.

No ordering change is authorized.

## 8. Explicitly unchanged

Implementation must not modify:

- `tasun-auth-v4.js`;
- `tasun-global-auth.js`;
- `tasun-global-core.js`;
- storage/session key names;
- token mirroring;
- Worker login endpoint;
- login UI;
- role model;
- permission matrix;
- formal row data;
- statistics;
- cloud synchronization;
- release algorithm;
- `tasun-version.json` manually.

Functional R-number remains NOT ASSIGNED.

## 9. Release impact

Both approved targets are HTML files.

The Exact Auto Release workflow tracks `**/*.html`.

Therefore implementation is expected to:

1. trigger Exact Auto Release after merge;
2. generate the next automatic release sequence;
3. update formal build metadata through the existing publisher only;
4. deploy Pages;
5. require deployed four-page build/sequence/SHA verification.

The automatic release sequence is not the Issue #29 functional R-number.

## 10. TDD direction

RED regression must assert that:

- both affected pages use `TasunAuthV4.getCurrent()`;
- neither uses `TasunAuthV4.getCurrentUser()`.

Expected current RED: both pages still contain stale getCurrentUser calls.

GREEN implementation should change only the TasunAuthV4 method name/guard in the two affected HTML files.

No storage/session fallback refactor is authorized.

## 11. Failure handling

If RED/implementation tracing finds additional active stale callers on the latest implementation baseline:

- enumerate them;
- if they follow the identical current-user fallback contract, return to architecture review before expanding file scope;
- do not silently modify additional runtime pages.

If `getCurrent()` return shape proves incompatible with an affected caller's existing normalization, stop and return to architecture review.

## 12. Acceptance criteria

- [ ] `tasun-api/index.html` uses `TasunAuthV4.getCurrent()`;
- [ ] `名詞解釋.html` uses `TasunAuthV4.getCurrent()`;
- [ ] neither page calls `TasunAuthV4.getCurrentUser()`;
- [ ] `tasun-auth-v4.js` is unchanged;
- [ ] storage/session fallback order is unchanged;
- [ ] current user/role normalization is unchanged;
- [ ] regression locks canonical API alignment;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] formal Exact Auto Release GREEN;
- [ ] deployed four-page build/sequence/SHA verification GREEN;
- [ ] no manual version edit.

## 13. Architecture approval gate

Architecture:

- [x] explicitly approved by user on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after written spec approval

Architecture Option A is approved. The written spec is now being established in the same governance PR; implementation/TDD remains unauthorized until explicit written-spec approval.
