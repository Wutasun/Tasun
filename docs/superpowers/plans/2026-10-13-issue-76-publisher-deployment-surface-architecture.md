# Issue #76 — Architecture: Prevent Exact Publisher from Restoring Non-deployed tasun-api Page Authority

Date: 2026-10-13  
Issue: #76 — `[REQ] Prevent exact publisher from restoring non-deployed tasun-api page authority`  
Baseline main: `15355f24f0673ec958095bf9e0e8abb27f4be08c`  
Current formal build: `20261012_tasun_v5_xidong_docs_r1154_425da05a1ae8_release`  
Status: BLOCKER ARCHITECTURE OPTION A APPROVED / WRITTEN SPEC IN PROGRESS / NO IMPLEMENTATION AUTHORITY

## 1. Confirmed regression

Current R1154 `tasun-version.json` contains:

`pages["tasun-api/index.html"]`

This conflicts with the existing Issue #56 A2 invariant:
- `tasun-api/index.html` source stays in the repository;
- `tasun-api/` is excluded from deployed Pages;
- no `tasun-api/*` entry may remain a public page authority in `tasun-version.json`.

Issue #73 RED CI reproduced the failure twice.

## 2. Root cause

The current publisher builds its formal set as the canonical four pages plus every changed HTML file considered relevant.

When Issue #70 changed `tasun-api/index.html`, the R1154 release path treated that non-deployed source HTML as a formal page and rebuilt a manifest entry for it.

The deployment workflow still excludes `tasun-api/`, so publication authority and deployment surface diverged.

## 3. Option A — deployment-surface-aware publisher normalization

Approved by user on 2026-10-13.

Change the exact publisher so that:
1. HTML under deployment-excluded paths such as `tasun-api/` is not promoted into formal page-manifest authority;
2. existing `pages` aliases whose `file` points into excluded deployment paths are retired during normalization;
3. source files remain untouched;
4. the formal four-page release contract remains unchanged;
5. metadata-only cleanup preserves the existing formal build/releaseSequence when no real formal/core change requires a new release;
6. focused regression proves a future change to `tasun-api/index.html` cannot restore its manifest authority.

Expected implementation scope:
- `publish-version_tasun_project_autoscan.mjs`
- focused new Issue #76 regression test
- workflow-generated metadata only as a consequence of the normal release path

No manual edit to `tasun-version.json` is authorized.

## 4. Option B — one-time manifest cleanup only

Remove the current `tasun-api/index.html` entry from metadata without changing publisher selection logic.

Rejected recommendation because a later change to `tasun-api/index.html` can recreate the same regression.

## 5. Locked areas

Do not redesign:
- `tasun-api/index.html` source behavior;
- auth;
- cloud sync;
- Worker APIs;
- formal four document pages except normal generated release metadata;
- Pages topology;
- data schemas;
- UI.

## 6. TDD direction

RED must reproduce:
- current manifest incorrectly contains `tasun-api/index.html`;
- simulated publisher input where `tasun-api/index.html` is changed restores/retains the forbidden authority.

GREEN must prove:
- non-deployed `tasun-api/` HTML cannot enter page authority;
- existing forbidden aliases are cleaned;
- source file remains;
- formal four-page release identity is preserved for metadata-only cleanup;
- Issue #56 A2 regression returns GREEN.

## 7. Release expectation

The publisher change itself is a core release-relevant change, so normal Exact Auto Release behavior may generate the next formal release. No R-number is to be manually invented or forced.

## 8. Governance

This blocker exists because Issue #73 crossed a verified failure boundary.

Per `docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md`, Architecture Option A was explicitly approved by the user on 2026-10-13.

Current gate:
- [x] Architecture Option A approved
- [ ] Written spec explicitly approved
- [ ] Implementation / TDD authorized

Written spec drafting may proceed automatically. Implementation remains blocked until Gate B is explicitly approved and the synchronized governance record is merged to `main`.
