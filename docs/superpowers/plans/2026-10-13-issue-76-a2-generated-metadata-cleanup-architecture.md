# Issue #76 — A2 Architecture Amendment: Publisher-generated Metadata Cleanup Before Merge

Date: 2026-10-13  
Issue: #76  
Base architecture: Option A  
Baseline main: `614a5f57282e38aa3661e9ad94e7d8b1beef74f0`  
Current formal build: `20261012_tasun_v5_xidong_docs_r1154_425da05a1ae8_release`  
Release sequence: `1154`  
Status: A2 ARCHITECTURE AMENDMENT PROPOSAL / GATE C / IMPLEMENTATION PAUSED

## 1. Why amendment is required

The approved written spec correctly prohibits manual edits to `tasun-version.json`.

However, the current repository manifest itself contains the forbidden public authority:

`pages["tasun-api/index.html"]`

Existing Issue #56 regression tests read the repository manifest directly.

Therefore, changing only:
- `publish-version_tasun_project_autoscan.mjs`
- the Issue #76 focused test

cannot make the implementation branch fully GREEN before merge.

The branch would still carry the old generated metadata and Issue #56 would remain red.

Running the formal Exact Auto Release workflow on the PR branch is not an acceptable substitute because that workflow can deploy Pages.

## 2. A2 amendment

Keep all Option A behavior and add one narrowly-scoped authorization:

After the publisher fix is GREEN in isolated simulation, the repaired publisher may be run locally/in CI-style metadata-only mode on the implementation branch to generate the metadata cleanup required to remove forbidden deployment-excluded page authority.

This is not a hand edit.

## 3. Allowed generated metadata

The repaired publisher may update only generated release metadata files that are actually required by metadata-only normalization:

- `tasun-version.json`
- `TASUN_REBUILD`
- `TASUN_REBUILD_STAMP`

Expected normal result:
- `tasun-version.json` changes to remove deployment-excluded authority;
- rebuild files remain byte-equivalent if formal identity is preserved.

No four-page HTML mutation is authorized for this cleanup.

## 4. Formal identity invariant

For the pre-merge metadata-only cleanup:

- formal build must remain `20261012_tasun_v5_xidong_docs_r1154_425da05a1ae8_release`;
- releaseSequence must remain `1154`;
- no new R-number may be generated;
- formal four page SHA/build identity must remain unchanged;
- `tasun-api/index.html` source remains unchanged.

If the repaired publisher attempts to advance the formal build during this metadata-only cleanup, stop as a failure boundary.

## 5. Implementation ordering

1. RED evidence already captured.
2. Modify only publisher source.
3. Make focused Issue #76 simulation GREEN.
4. Run repaired publisher with metadata-only changed-file input that forces normalization without a formal/core release.
5. Commit only publisher-generated metadata cleanup.
6. Run full regression.
7. Run disposable exact-release.
8. Verify semantic diff separates:
   - manual source/test changes;
   - publisher-generated metadata cleanup.
9. Locked-file audit.
10. Independent review.
11. Merge only when all gates are GREEN.

## 6. Semantic diff contract

Manual implementation changes:
- modified `publish-version_tasun_project_autoscan.mjs`;
- added `tests/issue-76-publisher-deployment-surface.test.cjs`.

Generated metadata changes allowed:
- `tasun-version.json`;
- `TASUN_REBUILD`;
- `TASUN_REBUILD_STAMP`.

No other changed path is authorized.

## 7. Why this is preferred

This preserves the single-authority rule:
- humans do not hand-edit the manifest;
- the fixed publisher is the only writer;
- regression can become GREEN before merge;
- PR branch does not run formal Pages deployment;
- formal identity remains R1154 until the actual post-merge release decides otherwise.

## 8. Governance

This is a Gate C architecture amendment.

Implementation remains paused until explicit approval.

Recommended decision:

`核准 Issue #76 方案 A2 架構修正，開始 amended written spec`
