# Issue #51 — Architecture Amendment: retire live manifest authority for deleted diagnostics

Status: **APPROVED — OPTION A2**  
Functional R-number: **NOT ASSIGNED**  
Approval: user explicitly approved **Option A2** on 2026-10-12.  
Implementation authority: **YES — implementation/TDD resumes after governance PR merge**

## 1. Why the approved architecture must be amended

Issue #51 Option A was approved on the premise that the two legacy diagnostic filenames were not present in the current `tasun-version.json`.

A full Git blob inspection of the current R1152 manifest disproves that premise for:

`汐東收發文明細表_雲端逐步測試_正式版.html`

The manifest contains 21 exact references and, critically, two live `pages` authority entries:

- `pages["汐東收發文明細表_雲端逐步測試_正式版.html"]`
- `pages["xidong-official-doc-detail-cloud-step-test"]`

Both identify the R880-era diagnostic page as a versioned `mode:"test"` page with `directOpenLoginRequired:false`.

The manifest also contains nine legacy redirect page entries (R492–R499 and R501) whose `redirectTo` / `canonicalTestPage` fields point to the same diagnostic page.

`tasun-version-loader.js` actively resolves page authority from:

`pages[pageFile] || pages[pageKey]`

Therefore the R880 diagnostic page is not merely a deployed orphan: its page/file authority remains live in the current version manifest.

The R442 package-detail diagnostic has no corresponding manifest entry.

## 2. Current implementation/TDD state

Governance PR #52 is already merged.

Implementation PR #53 is still draft.

RED evidence:

- RED head: `7756cbae423943479bfc8df7d270c5a6e44ce980`
- run: `38241814242`
- 117 total / 115 pass / 2 expected fail.

Approved file deletions have been made only on the unmerged implementation branch:

- R880 diagnostic deletion commit: `1fc931ce957f30bdfb502ab7ffea46af98cd124b`
- R442 diagnostic deletion commit: `25cdde55b3b8778082c1ecf4c2710532e10cf0ac`

No production change has reached `main`.

Subsequent CI correctly exposed the previously hidden manifest authority conflict. PR #53 must not merge under the old written spec.

## 3. Additional runtime trace

The formal page `汐東收發文明細表.html` contains the legacy diagnostic filename inside its `TRUSTED_FILES` compatibility list.

This is **not** a navigation, loader, fetch, iframe, or manifest consumer of the deleted file. Once the public diagnostic HTML is absent, this string does not make the page reachable.

Changing that formal page would convert this cleanup into a formal HTML release and unnecessarily advance the functional release sequence. This amendment therefore leaves that compatibility literal unchanged.

A future requirement may retire legacy trust-list strings if independently justified.

## 4. Amendment options

### Option A2 — retire files and their live manifest authority

Keep the approved deletion of:

1. `汐東收發文明細表_雲端逐步測試_正式版.html`
2. `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`

Additionally remove only the obsolete diagnostic-lineage entries from `tasun-version.json.pages`:

- `汐東收發文明細表_雲端逐步測試_正式版.html`
- `xidong-official-doc-detail-cloud-step-test`
- `汐東收發文明細表_雲端逐步測試_正式版_R492.html`
- `汐東收發文明細表_雲端逐步測試_正式版_R493.html`
- `汐東收發文明細表_雲端逐步測試_正式版_R494.html`
- `汐東收發文明細表_雲端逐步測試_正式版_R495.html`
- `汐東收發文明細表_雲端逐步測試_正式版_R496.html`
- `汐東收發文明細表_雲端逐步測試_正式版_R497.html`
- `汐東收發文明細表_雲端逐步測試_正式版_R498.html`
- `汐東收發文明細表_雲端逐步測試_正式版_R499.html`
- `汐東收發文明細表_雲端逐步測試_正式版_R501.html`

Do not remove or alter any formal four-page authority entry.

Allow the existing publisher to perform its normal **metadata-only** normalization after the manifest change. Under current publisher logic, when relevant changes are generated files only, the build remains `current.version`; the releaseSequence must therefore remain 1152 unless unrelated concurrent work legitimately advances main.

Expected publisher behavior:

- `tasun-version.json` is relevant;
- `metadataOnly === true`;
- build remains current R1152;
- four formal pages are re-verified at the same build;
- no Issue #51-only releaseSequence increment;
- retired diagnostic page entries remain absent because the publisher begins from the cleaned current `pages` object and only refreshes formal-page aliases.

### Option B2 — revert diagnostic retirement

Restore both deleted diagnostic HTML files and keep the manifest as-is.

This preserves the old R880/R442 browser diagnostic surface and does not solve the original public-deployment defect.

## 5. Recommendation

**Recommend Option A2.**

It converges repository deployment and version authority together:

- retired HTML is absent;
- retired diagnostic page authority is absent;
- stale redirect metadata no longer points at a missing canonical diagnostic;
- formal four-page runtime remains unchanged;
- Worker/auth/data contracts remain unchanged;
- the release sequence is not advanced solely for cleanup.

## 6. Revised TDD contract

After amendment approval, update the Issue #51 regression to assert:

1. both diagnostic HTML files are absent;
2. the exact R880 diagnostic filename key is absent from `manifest.pages`;
3. `xidong-official-doc-detail-cloud-step-test` is absent from `manifest.pages`;
4. no `manifest.pages` entry has `file`, `redirectTo`, or `canonicalTestPage` equal to the retired R880 diagnostic filename;
5. no R442 diagnostic page authority exists;
6. four formal pages remain present;
7. all formal four-page page entries remain present and valid;
8. publisher/workflow remain unchanged;
9. cleanup/metadata-only publisher flow keeps the same formal build and releaseSequence;
10. active executable sources do not navigate/load/fetch/iframe either retired page.

The test must distinguish a dormant compatibility string such as the formal page's `TRUSTED_FILES` entry from a real file consumer.

## 7. Revised implementation scope

Approved only if Option A2 is explicitly approved:

- delete the two diagnostic HTML files;
- update `tasun-version.json` by removing only the 11 diagnostic-lineage `pages` entries listed above;
- update the dedicated Issue #51 regression.

No manual change to:

- root build string;
- releaseSequence;
- `TASUN_REBUILD`;
- `TASUN_REBUILD_STAMP`;
- publisher;
- workflow;
- four formal HTML pages;
- Worker/auth/cloud behavior.

Publisher-generated metadata normalization after merge is allowed, but any new functional R-number caused solely by Issue #51 is a failure.

## 8. Post-merge acceptance

Require:

- full regression GREEN;
- disposable exact-release GREEN;
- independent review clear;
- implementation diff contains only the approved two deletions, manifest authority cleanup, and Issue #51 test;
- post-merge Exact Auto Release keeps the current formal build/releaseSequence for metadata-only cleanup;
- four formal page blobs remain unchanged;
- fresh Pages artifact excludes both diagnostic HTML files;
- final `tasun-version.json.pages` contains no retired R880 diagnostic authority/redirect lineage.

## 9. Approval gate

- [x] **Issue #51 Option A2 architecture amendment explicitly approved on 2026-10-12**
- [x] amended written spec synchronized
- [x] amended written spec explicitly approved on 2026-10-12
- [x] implementation/TDD authorized to resume after governance PR merge

Until approval, PR #53 stays draft and must not merge.
