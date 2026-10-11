# Issue #38 Architecture — Retire dormant Tasun Security v3 repository mutators

Date: 2026-10-11  
Requirement: GitHub Issue #38 — `[REQ] Retire dormant Tasun Security v3 repository mutators`  
Functional R-number: NOT ASSIGNED  
Status: ARCHITECTURE APPROVED / WRITTEN SPEC IN PROGRESS / NO IMPLEMENTATION AUTHORITY

## 1. Baseline

Architecture tracing baseline:

- repository: `Wutasun/Tasun`
- baseline: `main @ f52f5ec19abe694c72deb0788c50c0a78bd352a5`
- current auth authority: `tasun-auth-v4.js`
- current boot/guard chain: `tasun-boot.js` + `tasun-guard-v5.js`
- legacy mutators:
  - `inject-index-login-v3.js`
  - `guard-all-html-security-v3.js`

No implementation is authorized by this draft.

## 2. Legacy mutator behavior

### 2.1 inject-index-login-v3.js

A Node repository-mutator script that rewrites `index.html`.

It can inject:

- `tasun-auth-v3.js`
- `tasun-cloudwrap-v3.js`
- inline TasunAuthV3 login glue

The glue binds common username/password/login controls and calls:

- `window.TasunAuthV3.login()`
- `window.TasunAuthV3.applyRoleButtons()`

It can therefore rewrite the current formal entry page back toward the obsolete v3 auth chain.

### 2.2 guard-all-html-security-v3.js

A Node repository-mutator script that recursively scans HTML and rewrites every HTML page except `index.html`.

It injects:

- inline guard for `tasunAuthSession_v3`;
- `tasun-auth-v3.js`;
- `tasun-cloudwrap-v3.js`;
- `tasun-guard-v3.js`.

It therefore has repo-wide mutation authority over active HTML pages.

## 3. Broken-target evidence

Current `main` does not contain:

- `tasun-auth-v3.js`
- `tasun-cloudwrap-v3.js`
- `tasun-guard-v3.js`

Therefore either mutator, if run now, would create references to missing runtime files.

This is not only dormant legacy code; it is an executable downgrade/broken-reference generator.

## 4. Current dependency tracing

Repository tracing confirms:

- no current HTML page loads either mutator;
- no GitHub workflow invokes either mutator;
- no current package/script runner invokes either mutator;
- current release/autoscan chain does not depend on either mutator;
- current v4/v5 runtime authority does not require either mutator.

The mutators are therefore verified-unreferenced current repository tools.

## 5. Authority conflict

Current supported chain is:

current HTML
→ current boot/security loaders
→ `tasun-auth-v4.js`
→ v5 guard/self-heal/session/token behavior.

The legacy mutators can reintroduce:

HTML
→ missing v3 runtime references
→ `tasunAuthSession_v3`
→ `TasunAuthV3`.

That would recreate a parallel authority surface and potentially break page loading/auth inheritance.

## 6. Architecture options

### Option A — Delete both legacy mutators

Delete:

- `inject-index-login-v3.js`
- `guard-all-html-security-v3.js`

Add regression coverage asserting:

- both files are absent;
- obsolete v3 runtime files remain absent;
- active current authority files remain present;
- no active runtime/workflow/package reference depends on either mutator.

Do not add replacement scripts.

**Advantages**

- removes destructive downgrade tooling;
- prevents accidental mass reinjection of dead v3 references;
- preserves current v4/v5 authority unchanged;
- minimal production diff.

### Option B — Retain/archive

Retain only if a current build/deployment/recovery workflow is proven to require these scripts.

Current evidence does not support this option.

## 7. Recommended architecture

**Recommend Option A — delete both verified-unreferenced v3 repository-mutator scripts.**

No caller migration is required because no current dependency exists.

## 8. Explicitly unchanged

Do not modify:

- any HTML file;
- `tasun-auth-v4.js`;
- `tasun-boot.js`;
- `tasun-guard-v5.js`;
- `tasun-global-core.js`;
- release workflow;
- autoscan publisher;
- session/token keys;
- Worker endpoints;
- UI;
- permissions;
- formal data/statistics;
- cloud synchronization;
- `tasun-version.json` manually.

Functional R-number remains NOT ASSIGNED.

## 9. Release impact

Both deleted targets are `.js` files.

The workflow push filter includes `**/*.js`, so merge is expected to trigger the Exact Auto Release workflow.

Autoscan relevance requires a changed file to still exist and be:

- a formal HTML/HTM page;
- a listed `CORE_FILES` authority;
- a generated authority file.

Neither mutator is in `CORE_FILES`, and both will be absent after deletion.

Expected post-merge behavior:

1. workflow triggers;
2. changed-file resolution sees deleted JS paths;
3. autoscan finds no surviving relevant formal/core/generated file;
4. logs `no formal page/core/manifest change; nothing to sync.`;
5. formal build remains unchanged;
6. releaseSequence remains unchanged;
7. `tasun-version.json` remains unchanged;
8. existing four-page deployment verification still succeeds.

Do not force a release solely to create a new sequence.

## 10. TDD direction

### RED

Add one dedicated regression test first.

Expected test path:

`tests/issue-38-retire-v3-mutators.test.cjs`

RED assertions:

- `inject-index-login-v3.js` must not exist;
- `guard-all-html-security-v3.js` must not exist;
- obsolete v3 runtime files remain absent;
- current `tasun-auth-v4.js`, `tasun-boot.js`, and `tasun-guard-v5.js` remain present;
- active workflow/runtime files do not depend on either mutator.

Expected RED:

- both legacy mutators still exist.

### GREEN

Delete only:

- `inject-index-login-v3.js`
- `guard-all-html-security-v3.js`

Then rerun:

- focused Issue #38 regression;
- full regression suite;
- disposable exact-release verification.

## 11. Reference-scan contract

Before GREEN, repeat exact searches for:

- `inject-index-login-v3.js`
- `guard-all-html-security-v3.js`
- `tasun-auth-v3.js`
- `tasun-cloudwrap-v3.js`
- `tasun-guard-v3.js`
- `tasunAuthSession_v3`
- `TasunAuthV3`

If a real active current dependency appears outside the mutator files, stop and return to architecture review.

Historical docs/tests do not count as active runtime dependencies.

## 12. Diff-scope contract

Expected implementation PR changed files:

- deleted `inject-index-login-v3.js`;
- deleted `guard-all-html-security-v3.js`;
- one dedicated Issue #38 regression test.

No active runtime file edits are expected.

## 13. Acceptance criteria

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
- [ ] no manual `tasun-version.json` edit.

## 14. Architecture approval gate

Architecture:

- [x] explicitly approved by user on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after written spec approval

Architecture Option A is approved. The written spec is now being established in the same governance PR; implementation/TDD remains unauthorized until explicit written-spec approval.
