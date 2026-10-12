# Issue #56 Architecture — Retire orphan manifest page authorities

Date: 2026-10-12  
Requirement: GitHub Issue #56 — `[REQ] Retire orphan manifest page authorities`  
Status: **APPROVED — OPTION A**  
Functional R-number: **NOT ASSIGNED**  
Architecture approval: **user explicitly approved Option A on 2026-10-12**  
Implementation authority: **YES — implementation/TDD authorized after governance PR merge**

## 1. Problem statement

Current R1152 `tasun-version.json.pages` contains three page authorities whose declared `file` paths do not exist in the repository or deployed GitHub Pages artifact:

1. `收發文明細表.html` → missing `收發文明細表.html`
2. `收發文登錄表.html` → missing `收發文登錄表.html`
3. `xidong-official-doc-detail-cloud-step-test-r497` → missing `汐東收發文明細表_雲端逐步測試_正式版_R497.html`

The manifest therefore claims version authority for pages that cannot be loaded.

A recursive path check distinguishes these from valid nested authorities such as `tasun-api/index.html`, whose physical file exists.

## 2. Architecture goal

Make `tasun-version.json.pages` describe deployable page files only, without recreating retired compatibility/test surfaces and without altering supported application behavior.

## 3. Option A — retire exactly the three orphan authorities

### Manifest change

Remove exactly these keys from `tasun-version.json.pages`:

- `收發文明細表.html`
- `收發文登錄表.html`
- `xidong-official-doc-detail-cloud-step-test-r497`

No other manifest page entry is removed or manually changed.

### Regression invariant

Add a dedicated Issue #56 regression that recursively validates every remaining `pages[*].file` path against the repository tree.

The invariant must:

- accept root files;
- accept nested files such as `tasun-api/index.html`;
- reject any manifest page authority whose non-empty `file` path does not exist;
- separately assert the three known orphan keys are absent;
- preserve canonical four-page authorities.

### Release behavior

The only approved production file mutation is `tasun-version.json`.

Current publisher semantics classify `tasun-version.json` as generated metadata. Expected behavior:

- changed file is relevant;
- `metadataOnly === true`;
- current formal build remains R1152;
- releaseSequence remains 1152;
- four formal pages are verified at the same build;
- publisher may normalize metadata timestamps / formal aliases and create a same-build generated metadata commit;
- no functional R-number is assigned solely for Issue #56.

### Runtime scope

No supported HTML page changes.

In particular, do not modify `權限表.html` under Issue #56 even though a separate scan found dead navigation definitions there. That deserves a separate requirement because it is user-facing routing/UI behavior rather than manifest-authority hygiene.

## 4. Option B — recreate compatibility files

Recreate missing HTML files corresponding to the stale authorities.

For the two unprefixed official-document aliases this would mean adding compatibility redirects; for the R497 alias it would mean reviving an obsolete diagnostic/test surface.

This is not recommended because it:

- expands the public Pages surface;
- revives legacy topology already superseded by canonical pages;
- adds maintenance and test burden;
- conflicts with the recent diagnostic-surface retirement direction.

## 5. Recommendation

**Option A.**

It is the smallest authority-convergence change:

- three stale authorities removed;
- zero supported runtime pages modified;
- zero legacy public surface recreated;
- general regression prevents recurrence;
- R1152 remains the functional release identity.

## 6. TDD architecture

After explicit architecture approval and written-spec approval:

### RED

Add `tests/issue-56-orphan-manifest-authorities.test.cjs` first.

Expected RED:

- exactly three missing-file authorities are reported.

The test must resolve nested paths correctly so `tasun-api/index.html` is not a false positive.

### GREEN

Remove exactly the three approved `pages` keys from `tasun-version.json`.

Then require:

- focused Issue #56 test GREEN;
- full Tasun regression GREEN;
- disposable exact-release GREEN;
- manifest semantic diff proves exactly three key removals;
- four formal page blobs unchanged;
- publisher/workflow blobs unchanged;
- root build/releaseSequence unchanged;
- independent review clear.

## 7. Post-merge release contract

Exact Auto Release is expected to trigger because `tasun-version.json` changed.

Required result:

- metadata-only same-build normalization;
- formal build remains `20261012_tasun_v5_xidong_docs_r1152_70f1b5421b9c_release` unless unrelated concurrent work legitimately advances main;
- no Issue #56-only sequence increment;
- four-page deployed SHA verification succeeds;
- fresh deployed verification succeeds;
- deployed manifest has no remaining page entry whose `file` path is absent from the Pages artifact/repository topology.

## 8. Explicit no-change boundary

Do not manually modify:

- `權限表.html`
- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- `TASUN_REBUILD`
- `TASUN_REBUILD_STAMP`
- Worker/auth/cloud/data code

No redirect/shim/replacement HTML may be added.

## 9. Failure boundary

Return to architecture if implementation proves any of the three files is intentionally generated or required at runtime, or if a current supported loader/navigation path requires one of the three manifest authorities.

Do not recreate a missing file or edit a supported page as an implementation workaround.

## 10. Approval gate

- [x] Architecture Option A explicitly approved by user on 2026-10-12
- [ ] Written spec completed after architecture approval
- [x] Written spec explicitly approved by user on 2026-10-12
- [ ] Implementation/TDD authorized

No production change is authorized before the gates above are satisfied.
