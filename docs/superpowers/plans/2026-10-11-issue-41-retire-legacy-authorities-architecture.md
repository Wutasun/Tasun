# Issue #41 Architecture — Retire dormant legacy guard security and cloudwrap authorities

Date: 2026-10-11  
Requirement: GitHub Issue #41 — `[REQ] Retire dormant legacy guard security and cloudwrap authorities`  
Functional R-number: NOT ASSIGNED  
Status: ARCHITECTURE APPROVED / WRITTEN SPEC IN PROGRESS / NO IMPLEMENTATION AUTHORITY

## 1. Baseline

Architecture tracing baseline:

- repository: `Wutasun/Tasun`
- baseline: `main @ 0134e692d7cc9a7436a1d2d027de868aec318563`
- current auth authority: `tasun-auth-v4.js`
- current cloud wrapper: `tasun-cloudwrap-v4.js`
- current guard: `tasun-guard-v5.js`
- current boot/self-heal: `tasun-boot.js`

Legacy candidates:

- `tasun-guard.js`
- `tasun-security.js`
- `tasun-cloudwrap.js`

No implementation is authorized by this draft.

## 2. Legacy authority tracing

### 2.1 tasun-guard.js

Legacy page guard marked stable v1.

Behavior:

- checks `window.tasunLogin`;
- calls `window.tasunLogin.requireLogin({ index:'index.html' })`.

Current repository evidence:

- no current filename loader for `tasun-guard.js`;
- no current `window.tasunLogin` provider outside the legacy file itself.

Therefore the guard is currently dormant and targets a retired login authority surface.

### 2.2 tasun-security.js

Legacy all-site Security v1.2 loader.

Defines/uses:

- `tasunGlobalPassHash_v1`;
- `tasunSessionAuth_v1`;
- `window.TasunSecurity`;
- redirect-to-index auth gating.

Current repository evidence:

- no current filename loader for `tasun-security.js`;
- `TasunSecurity` occurs only in the legacy file;
- `tasunSessionAuth_v1` occurs only in the legacy file.

Therefore the file is a dormant parallel auth/session authority.

### 2.3 tasun-cloudwrap.js

Legacy/older cloud wrapper.

It exports:

`window.TasunCloudWrapV4`

The supported current file `tasun-cloudwrap-v4.js` exports the same global name.

The files are not byte-identical.

The supported wrapper additionally provides current behavior including:

- `loadResources()`;
- `getApiBaseAsync()`;
- `getPageResource()`;
- version-aware `withV()` integration;
- current cache-busting resource loading;
- alias `TasunCloudwrapV4`.

The legacy `tasun-cloudwrap.js` exposes a narrower implementation.

If the legacy file is accidentally loaded after the supported wrapper, it can overwrite `window.TasunCloudWrapV4` with the older contract.

## 3. Current dependency tracing

Exact repository filename search shows:

- `tasun-guard.js`: no current filename references;
- `tasun-security.js`: only self-reference;
- `tasun-cloudwrap.js`: no current filename references.

Current runtime/release chain references the supported authorities:

- `tasun-cloudwrap-v4.js`;
- `tasun-auth-v4.js`;
- `tasun-guard-v5.js`;
- `tasun-boot.js`.

No active current loader or workflow dependency has been found for the three legacy files.

## 4. Architecture options

### Option A — Delete all three dormant legacy authorities

Delete:

- `tasun-guard.js`;
- `tasun-security.js`;
- `tasun-cloudwrap.js`.

Add regression coverage that verifies:

- all three legacy files are absent;
- supported current authority files remain present;
- `tasun-cloudwrap-v4.js` remains the only runtime file providing the supported cloudwrap file contract;
- no active runtime/workflow references any deleted legacy filename;
- no compatibility shim is introduced.

Do not modify current runtime files.

**Advantages**

- removes three dormant executable authority surfaces;
- prevents obsolete guard/session contracts from returning;
- prevents legacy cloud wrapper from overwriting current `TasunCloudWrapV4`;
- minimal production diff;
- preserves current v4/v5 behavior unchanged.

### Option B — Retain any legacy file

Retain only if a real current consumer or deployment dependency is proven.

Current evidence does not support this option.

## 5. Recommended architecture

**Recommend Option A — delete all three verified-unreferenced legacy authority files.**

No runtime caller migration is required.

## 6. Explicitly unchanged

Do not modify:

- any HTML file;
- `tasun-auth-v4.js`;
- `tasun-cloudwrap-v4.js`;
- `tasun-guard-v5.js`;
- `tasun-boot.js`;
- `tasun-global-core.js`;
- release workflow;
- autoscan publisher;
- session/token keys;
- Worker endpoints;
- UI;
- permission model;
- formal data/statistics;
- cloud synchronization;
- `tasun-version.json` manually.

Functional R-number remains NOT ASSIGNED.

## 7. Release impact

All three deleted targets are JavaScript files.

The workflow push filter includes `**/*.js`, so merge is expected to trigger the Exact Auto Release workflow.

Autoscan relevance requires a changed file to still exist and be one of:

- formal HTML/HTM;
- `CORE_FILES`;
- generated authority files.

None of the three legacy candidates is in `CORE_FILES`, and all will be absent after deletion.

Expected behavior:

1. merge triggers workflow;
2. autoscan sees deleted paths;
3. no surviving relevant formal/core/generated file remains;
4. autoscan logs `no formal page/core/manifest change; nothing to sync.`;
5. formal build remains unchanged;
6. releaseSequence remains unchanged;
7. `tasun-version.json` remains unchanged;
8. deployed four-page verification still succeeds.

No forced release is required.

## 8. TDD direction

### RED

Add:

`tests/issue-41-retire-legacy-authorities.test.cjs`

before deleting production files.

Assertions:

- `tasun-guard.js` must not exist;
- `tasun-security.js` must not exist;
- `tasun-cloudwrap.js` must not exist;
- `tasun-auth-v4.js` must remain present;
- `tasun-cloudwrap-v4.js` must remain present;
- `tasun-guard-v5.js` must remain present;
- `tasun-boot.js` must remain present;
- active runtime/workflow files must not depend on the three retired filenames.

Expected RED:

- at least the first legacy file still exists.

### GREEN

Delete only the three approved legacy files.

Then run:

- focused Issue #41 regression;
- full Tasun regression;
- disposable exact-release verification.

## 9. Diff-scope contract

Expected implementation PR changed files:

- deleted `tasun-guard.js`;
- deleted `tasun-security.js`;
- deleted `tasun-cloudwrap.js`;
- added `tests/issue-41-retire-legacy-authorities.test.cjs`.

No other production file is expected.

## 10. Acceptance criteria

- [ ] `tasun-guard.js` deleted;
- [ ] `tasun-security.js` deleted;
- [ ] `tasun-cloudwrap.js` deleted;
- [ ] no compatibility shim added;
- [ ] current v4/v5 authority files unchanged;
- [ ] regression locks retirement;
- [ ] full regression GREEN;
- [ ] disposable exact-release verification GREEN;
- [ ] post-merge workflow behavior verified;
- [ ] formal build/releaseSequence unchanged if autoscan finds no relevant file;
- [ ] no manual `tasun-version.json` edit.

## 11. Architecture approval gate

Architecture:

- [x] explicitly approved by user on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after written spec approval

Architecture Option A is approved. The written spec is now being established in the same governance PR; implementation/TDD remains unauthorized until explicit written-spec approval.
