# Issue #23 Architecture — Retire Dormant Legacy Release and Version-Loader Authorities

Date: 2026-10-11  
Requirement: GitHub Issue #23 — `[REQ] Retire dormant legacy release and version-loader authorities`  
Functional R-number: NOT ASSIGNED  
Status: ARCHITECTURE APPROVED / WRITTEN SPEC IN PROGRESS / NO IMPLEMENTATION AUTHORITY

## 1. Baseline authority

Architecture tracing baseline:

- repository: `Wutasun/Tasun`
- baseline: `main @ 7574497a1589a3a2ae961b9d2a81d187a061507d`
- formal version source: `tasun-version.json`
- formal release workflow: `.github/workflows/release-version.yml`
- formal release publisher: `publish-version_tasun_project_autoscan.mjs`
- formal version loader: `tasun-version-loader.js`

No implementation branch or runtime mutation is authorized by this document.

## 2. Confirmed problem

Two dormant legacy artifacts remain in the repository:

1. `publish-version_tasun_project.mjs`
2. `tasun-version-loade.js`

Exact repository code search finds zero current references to either legacy filename.

The first artifact is nevertheless a complete independent publisher. It can directly rewrite `tasun-version.json`, `tasun-resources.json`, fallback HTML version tokens and related state when run with `ADMIN_RELEASE=1`.

The second artifact is an older executable loader that reads `tasun-version.json`, sets global version values, persists a different cache key and performs root-version redirect semantics that differ from the current page-entry-only loader.

Therefore both files are dormant but still executable duplicate authority.

## 3. Existing original authorities

### 3.1 Release authority

The current exact chain is:

`main push / workflow_dispatch`
→ `.github/workflows/release-version.yml`
→ admin permission gate
→ historical highest-R floor guard
→ changed-file resolution
→ `publish-version_tasun_project_autoscan.mjs`
→ four-page exact manifest/build/SHA synchronization
→ `tasun-version.json`
→ read-only verify
→ Pages deployment
→ deployed four-page build/sequence/SHA verification.

The workflow directly invokes only `publish-version_tasun_project_autoscan.mjs`.

Current code/docs/tests/runtime metadata reference the autoscan publisher. Exact search finds zero references to `publish-version_tasun_project.mjs`.

### 3.2 Version-loader authority

Current page-entry version authority is `tasun-version-loader.js`.

It reads `tasun-version.json`, selects the current page entry, establishes page-specific globals/build stamps and only redirects when the current page has a valid page entry.

Exact search finds zero references to `tasun-version-loade.js`.

## 4. Legacy authority analysis

### 4.1 `publish-version_tasun_project.mjs`

The legacy publisher is not merely historical text. It remains executable and contains an independent mutation path:

- admin environment gate via `ADMIN_RELEASE=1`;
- independent controlled-file set;
- independent hash/version algorithm;
- direct rewrite of root version aliases in `tasun-version.json`;
- optional fallback-page rewriting;
- old forbidden-pattern scanning.

It does not implement the current four-page release sequence/SHA/page-entry contract.

Therefore retaining the executable file leaves a second potential release authority even though current workflow does not call it.

### 4.2 `tasun-version-loade.js`

The typo-named loader uses an older authority model:

- root `cfg.version` parsing;
- cache key `tasun_single_version_cache_v5`;
- root-version redirect behavior;
- global version assignment independent of the current page-entry-only selection contract.

If accidentally referenced later, it can reintroduce a second loader behavior without changing `tasun-version.json` itself.

## 5. Release-trigger tracing

The current release workflow path filter includes:

- `**/*.js`
- `**/*.mjs`

Therefore deleting either legacy artifact from `main` will trigger the Exact Auto Release workflow.

However, the autoscan publisher only adds an entry to its formal `relevant` set when:

- the changed path still exists; and
- it is formal HTML, active `CORE_FILES`, or generated release metadata.

The two legacy files are not active `CORE_FILES`. After deletion they no longer exist, so they will not be included in `relevant`.

Expected result of an implementation containing only those deletions plus `.cjs` regression tests:

1. workflow triggers because a tracked `.js/.mjs` path changed;
2. autoscan reports no formal page/core/manifest change;
3. no new release build or releaseSequence is generated;
4. current `tasun-version.json` remains unchanged;
5. read-only exact release verification runs;
6. current exact Pages artifact may be redeployed under the same existing build;
7. deployed four-page build/sequence/SHA must remain identical.

This is a release-workflow event, but not a new formal R-sequence release.

## 6. Architecture options

### Option A — Delete both dormant executable artifacts

Delete:

- `publish-version_tasun_project.mjs`
- `tasun-version-loade.js`

Add regression coverage that locks:

- absence of both retired filenames;
- workflow authority remains `publish-version_tasun_project_autoscan.mjs`;
- active loader remains `tasun-version-loader.js`;
- `tasun-version.json` remains sole formal version source;
- no active workflow/runtime reference is allowed to the retired names.

**Advantages**

- removes executable duplicate authority completely;
- smallest durable authority graph;
- satisfies old-residue cleanup rule;
- prevents accidental future reuse by filename;
- no compatibility shim or archive code can execute.

**Costs / risks**

- merge will trigger Exact Auto Release workflow because deleted files match broad path filters;
- existing build may be redeployed even though no new releaseSequence is expected;
- any undocumented external process calling the legacy publisher/loader would fail after deletion.

### Option B — Retain archival non-authoritative stubs

Replace legacy files with inert stubs or move historical content to documentation, while making the executable filenames fail closed.

**Advantages**

- leaves an explicit migration message for a maintainer who invokes an old filename;
- historical intent remains easily visible.

**Costs / risks**

- legacy executable filenames remain discoverable;
- requires defining and testing stub behavior;
- keeps extra authority-adjacent surface;
- creates more maintenance than a verified-unreferenced deletion;
- still triggers workflow when changed.

## 7. Recommended architecture

**Recommend Option A — delete both dormant executable artifacts.**

Reason:

The repository already has complete current authorities and zero code references to the legacy filenames. Keeping executable or executable-shaped legacy artifacts provides no current functionality but preserves a path to authority divergence.

Historical implementation remains available through Git history, so retaining executable stubs is unnecessary.

## 8. Authority convergence contract

After implementation:

### Formal release authority

`.github/workflows/release-version.yml`
→ `publish-version_tasun_project_autoscan.mjs`
→ `tasun-version.json`
→ exact four-page verify/deploy.

No other publisher in the repository may be treated as a supported formal publisher.

### Version-loader authority

formal page
→ `tasun-version-loader.js`
→ `tasun-version.json` page entry
→ page globals/build stamp.

No typo/legacy version loader remains available.

## 9. Call-chain / data-flow invariants

Implementation must not modify:

- formal four HTML pages;
- active autoscan publisher logic;
- release workflow logic;
- active version loader logic;
- `tasun-version.json`;
- formal page data;
- auth/permission/cloud sync behavior;
- releaseSequence calculation.

The implementation is authority-surface reduction only.

## 10. Failure / abort / retry behavior

No runtime retry/abort behavior changes are authorized.

Release workflow behavior after deletion must be explicitly verified:

- workflow may run due path matching;
- autoscan must not generate a new build;
- current exact build verification must stay GREEN;
- any unexpected version increment is a failure.

## 11. SelfHeal boundary

TasunSelfHealV5 / R268 must not recreate either retired artifact.

SelfHeal remains a verifier/repairer of existing supported authorities, not a source of new release or loader authority.

## 12. TDD direction

RED tests should first demonstrate the repository currently violates the intended single-authority invariant because the two retired executable files still exist.

Minimum assertions:

1. `publish-version_tasun_project.mjs` must not exist after convergence.
2. `tasun-version-loade.js` must not exist after convergence.
3. workflow contains/uses `publish-version_tasun_project_autoscan.mjs`.
4. current loader remains `tasun-version-loader.js`.
5. formal version-source contract remains `tasun-version.json`.
6. no repository authority reference points to either retired filename.

GREEN implementation should then be limited to deleting the two legacy files unless RED tracing proves an additional reference must be removed.

## 13. Release verification contract

Before merge:

- full Tasun regression GREEN;
- disposable exact-release verification GREEN;
- verify current release build and releaseSequence are unchanged by the proposed deletion logic.

After merge:

- observe the workflow triggered by deleted `.js/.mjs` paths;
- confirm no new releaseSequence is generated solely from the deletion;
- confirm four-page deployed build/sequence/SHA remain identical to the current formal build;
- no functional R-number is assigned from an automatic workflow run.

## 14. Explicitly unchanged

- Tasun v5 UI and layout;
- formal data and statistics;
- login and permissions;
- cloud synchronization;
- mobile geometry behavior;
- Exact Auto Release algorithm;
- `tasun-version.json` authority;
- functional R-number remains NOT ASSIGNED.

## 15. Architecture approval gate

Architecture:

- [x] explicitly approved by user on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] authorized only after written spec approval

Architecture Option A is approved. The written spec is now complete but remains awaiting explicit user approval; implementation/TDD is not authorized until that approval is recorded.
