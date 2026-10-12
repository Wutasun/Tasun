# Issue #51 Amended Written Spec — Retire public diagnostics and their live manifest authority

Date: 2026-10-12  
Requirement: GitHub Issue #51 — `[REQ] Retire publicly deployed legacy cloud diagnostic pages`  
Architecture amendment: **Option A2 APPROVED**  
Functional R-number: **NOT ASSIGNED**  
Status: **AMENDED WRITTEN SPEC COMPLETE / AWAITING USER APPROVAL / IMPLEMENTATION PAUSED**

## 1. Purpose of this amended spec

The original Issue #51 written spec approved deletion of two dormant public diagnostic HTML pages.

Implementation evidence then proved that the R880 diagnostic page is still represented by live entries in `tasun-version.json.pages`, and that `tasun-version-loader.js` actively resolves version authority through `pages[pageFile] || pages[pageKey]`.

Therefore Issue #51 cannot be completed by deleting the HTML files alone.

This amended written spec supersedes only the conflicting portions of the original written spec and adds the approved **Option A2 manifest-authority retirement**.

All original constraints that do not conflict with this amendment remain in force.

## 2. Authoritative baseline

Governance baseline before amendment merge:

- repository: `Wutasun/Tasun`
- current main: `d099f537a9eeb61df38916304220f798982b7048`
- formal build: `20261012_tasun_v5_xidong_docs_r1152_70f1b5421b9c_release`
- releaseSequence: `1152`
- formal version authority: `tasun-version.json`

Governance history:

- original Issue #51 governance PR #52: merged
- original governance merge SHA: `d099f537a9eeb61df38916304220f798982b7048`
- architecture amendment PR: #54
- approved architecture amendment: **Option A2**

Implementation history already preserved on draft PR #53:

- RED head: `7756cbae423943479bfc8df7d270c5a6e44ce980`
- RED workflow run: `38241814242`
- RED result: 117 total / 115 pass / 2 expected fail
- R880 diagnostic deletion commit: `1fc931ce957f30bdfb502ab7ffea46af98cd124b`
- R442 diagnostic deletion commit: `25cdde55b3b8778082c1ecf4c2710532e10cf0ac`

PR #53 remains **draft** and must not merge until this amended written spec is explicitly approved and governance PR #54 is merged.

## 3. Verified manifest authority defect

Current R1152 `tasun-version.json.pages` contains two live R880 diagnostic authority entries:

1. `汐東收發文明細表_雲端逐步測試_正式版.html`
2. `xidong-official-doc-detail-cloud-step-test`

It also contains nine diagnostic redirect-lineage entries:

3. `汐東收發文明細表_雲端逐步測試_正式版_R492.html`
4. `汐東收發文明細表_雲端逐步測試_正式版_R493.html`
5. `汐東收發文明細表_雲端逐步測試_正式版_R494.html`
6. `汐東收發文明細表_雲端逐步測試_正式版_R495.html`
7. `汐東收發文明細表_雲端逐步測試_正式版_R496.html`
8. `汐東收發文明細表_雲端逐步測試_正式版_R497.html`
9. `汐東收發文明細表_雲端逐步測試_正式版_R498.html`
10. `汐東收發文明細表_雲端逐步測試_正式版_R499.html`
11. `汐東收發文明細表_雲端逐步測試_正式版_R501.html`

The nine redirect entries contain `redirectTo` and/or `canonicalTestPage` values pointing to:

`汐東收發文明細表_雲端逐步測試_正式版.html`

The R442 package-detail diagnostic has no matching live manifest authority and requires file retirement only.

## 4. Approved production scope

After amended written-spec approval and governance merge, implementation is authorized to change only:

1. delete `汐東收發文明細表_雲端逐步測試_正式版.html`;
2. delete `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`;
3. edit `tasun-version.json` only to retire the 11 exact diagnostic-lineage `pages` keys listed in section 3;
4. update `tests/issue-51-retire-public-diagnostic-pages.test.cjs` to enforce the amended contract.

No other manual production/runtime/release modification is authorized.

## 5. Exact manifest mutation contract

Implementation must parse `tasun-version.json` as JSON and delete exactly these keys from `manifest.pages`:

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

Do not manually alter:

- root `version`;
- root `cacheV`;
- root `buildStamp`;
- root `rebuildStamp`;
- root `releaseSequence`;
- `release.releaseSequence`;
- formal four-page `pages` aliases;
- `pageArtifactManifest` formal entries;
- `pageBuildStamp` formal entries;
- unrelated metadata.

After the manual cleanup, the manifest must have no `pages` entry whose:

- key equals the retired R880 filename;
- `file` equals the retired R880 filename;
- `redirectTo` equals the retired R880 filename;
- `canonicalTestPage` equals the retired R880 filename;
- pageKey equals `xidong-official-doc-detail-cloud-step-test`.

## 6. Formal four-page invariants

The following formal HTML files must remain byte-identical to the implementation baseline through the manual implementation:

- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`

Their current formal blob SHAs at the R1152 baseline are:

- detail: `a1e95b763da00c14778942a2dd297febe231d3c8`
- register: `4d08d144db757218787520918ae596b0fdd52282`
- statistics: `08eaa07fb1578a2bde52335c377de4c016a882eb`
- manager: `0539de1b595b7a93bdcc24199732ef49eb539ff6`

If unrelated concurrent work legitimately advances `main` before implementation resumes, capture the new valid baseline blobs and compare against that current authority instead of hard-coding the values above.

## 7. Dormant formal-page compatibility literal

`汐東收發文明細表.html` currently contains the retired diagnostic filename inside a `TRUSTED_FILES` compatibility array.

Under Option A2 this literal is explicitly **out of implementation scope** because:

- it is not a navigation target;
- it is not a loader/fetch/iframe consumer;
- it does not recreate the deleted file;
- changing the formal HTML would unnecessarily convert the cleanup into a functional HTML release.

The Issue #51 regression must therefore distinguish:

- **forbidden active authority/dependency**: manifest page entries, redirects, navigation, loader, fetch, iframe, executable route;
- **allowed dormant compatibility literal**: non-navigating `TRUSTED_FILES` membership in the formal detail page.

A separate requirement may later retire that compatibility literal.

## 8. Governance synchronization before implementation resumes

Before further production mutation:

1. this amended written spec must receive explicit user approval;
2. amendment PR #54 must be synchronized to approved status;
3. PR #54 must be merged to `main`;
4. implementation PR #53 must be synchronized with the then-current `main` before final GREEN review.

If PR #53 cannot be safely synchronized while preserving exact diff scope, create a replacement implementation branch from latest `main` and reproduce only:

- the already-proven RED test logic;
- the two approved HTML deletions;
- the amended manifest cleanup;
- the amended Issue #51 regression.

The historical RED evidence from run `38241814242` remains valid and does not need to be recreated solely because governance docs advanced.

## 9. Amended regression contract

Update `tests/issue-51-retire-public-diagnostic-pages.test.cjs` so it verifies:

### 9.1 File retirement

- R880 diagnostic HTML is absent;
- R442 diagnostic HTML is absent.

### 9.2 Manifest authority retirement

Parse the committed/current `tasun-version.json` structurally.

Assert:

- `manifest.pages["汐東收發文明細表_雲端逐步測試_正式版.html"]` is absent;
- `manifest.pages["xidong-official-doc-detail-cloud-step-test"]` is absent;
- all nine R492–R499/R501 diagnostic-lineage keys are absent;
- no remaining `manifest.pages` entry has `file`, `redirectTo`, or `canonicalTestPage` equal to the retired R880 filename;
- no remaining `manifest.pages` entry has `pageKey === "xidong-official-doc-detail-cloud-step-test"`;
- no R442 diagnostic authority exists.

Do not use a raw `manifest.includes(filename)` assertion as the authority test.

### 9.3 Formal authority preservation

Assert:

- four formal pages exist;
- their required manifest page aliases exist;
- their build/sequence values remain coherent with the root formal build;
- publisher exists;
- workflow exists;
- canonical rebuild files exist.

### 9.4 Active consumer scan

The active-source scan must reject true executable dependencies on either retired page, including:

- anchors/navigation;
- `location` redirects;
- loader lists used for page selection;
- `fetch`;
- iframe source assignment;
- script/module import;
- manifest page authority.

It must not fail solely because the formal detail page contains the retired filename in its dormant `TRUSTED_FILES` compatibility array.

Historical governance docs and test code remain excluded from active-consumer classification.

## 10. Metadata-only publisher regression

The original deletion-only `nothing to sync` expectation is superseded by Option A2 because `tasun-version.json` itself is now an approved changed file.

Add an isolated publisher regression that:

1. creates a temporary workspace containing:
   - current publisher;
   - current workflow;
   - four formal HTML pages;
   - canonical rebuild files;
   - a copy of the cleaned manifest after the 11 page-entry removals;
2. records the pre-run root formal build and releaseSequence;
3. runs the publisher with:
   `TASUN_CHANGED_FILES=tasun-version.json`
4. requires publisher success;
5. requires the root formal build to remain exactly unchanged;
6. requires releaseSequence to remain exactly unchanged;
7. requires all four formal pages to verify at that same build;
8. requires the retired diagnostic page entries not to reappear;
9. permits publisher-normalized metadata such as `updatedAt`, `lastAutoSyncAt`, refreshed formal alias metadata, and generated canonical rebuild-file rewrites at the same build.

Any new functional R-number caused solely by this metadata cleanup is a failure.

## 11. Publisher/workflow invariants

Manual implementation must not edit:

- `publish-version_tasun_project_autoscan.mjs`;
- `.github/workflows/release-version.yml`.

Current expected publisher semantics:

- changed `tasun-version.json` is relevant;
- relevant set consists only of generated metadata for the Issue #51 authority cleanup;
- `metadataOnly === true`;
- publisher retains `current.version`;
- releaseSequence remains `rank(current.version)`;
- formal pages are normalized/verified at the same build;
- cleaned diagnostic entries do not reappear because only formal page aliases are refreshed.

If actual publisher behavior differs, stop and return to architecture review rather than modifying publisher under Issue #51.

## 12. TDD continuation sequence

The historical RED evidence remains:

- head `7756cbae423943479bfc8df7d270c5a6e44ce980`;
- run `38241814242`;
- two expected file-presence failures.

After governance amendment approval:

1. synchronize implementation branch with latest `main`;
2. revise the dedicated Issue #51 test to the structural manifest contract;
3. apply the exact 11-key manifest cleanup;
4. keep the two already-approved HTML deletions;
5. run focused Issue #51 tests;
6. run full Tasun regression;
7. run disposable exact-release verification;
8. perform diff-scope and blob audits;
9. request independent review;
10. resolve any valid finding;
11. rerun final GREEN;
12. only then mark PR ready and merge.

## 13. Exact implementation diff contract

Before publisher-generated post-merge normalization, the implementation PR should contain only:

- removed `汐東收發文明細表_雲端逐步測試_正式版.html`;
- removed `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`;
- modified `tasun-version.json` with only the 11 approved `pages` key removals;
- modified/added `tests/issue-51-retire-public-diagnostic-pages.test.cjs`.

No formal HTML modification is permitted.

No publisher/workflow modification is permitted.

No Worker/auth/runtime JS modification is permitted.

## 14. Independent review criteria

Independent review must verify:

- two target HTML files are deleted;
- exactly the 11 approved manifest `pages` entries are removed;
- no unrelated manifest entry is removed or modified manually;
- root build and releaseSequence are not manually changed;
- formal four-page HTML blobs are unchanged;
- test structurally checks manifest authority rather than raw filename absence;
- test allows the explicitly approved dormant `TRUSTED_FILES` compatibility literal;
- metadata-only publisher test proves no functional release increment;
- no replacement diagnostic surface is added;
- no unresolved major finding remains.

## 15. Pre-merge verification matrix

All must be GREEN:

- focused Issue #51 regression;
- full Tasun regression suite;
- disposable exact-release verification;
- manifest structural authority audit;
- implementation diff scope audit;
- formal four-page blob comparison;
- publisher/workflow blob comparison;
- root build/releaseSequence comparison;
- independent review.

Record final implementation head SHA and final CI run ID.

## 16. Merge contract

Merge only after:

- amended governance PR #54 is merged;
- implementation branch is synchronized to latest main;
- final implementation diff matches section 13;
- all verification in section 15 is GREEN;
- independent review has no unresolved major finding.

Use repository-supported squash merge.

Do not manually assign a new R-number.

## 17. Expected post-merge Exact Auto Release behavior

The merge changes include deleted HTML paths and `tasun-version.json`.

Therefore Exact Auto Release is expected to run.

Required behavior:

1. `tasun-version.json` is classified as relevant generated metadata;
2. publisher enters metadata-only behavior for the surviving relevant change;
3. current formal build is retained;
4. releaseSequence is retained;
5. four formal pages remain at the same build;
6. publisher may normalize manifest timestamps / formal aliases and canonical rebuild files;
7. release machinery may create a generated metadata commit if normalized bytes change;
8. no new functional R-number is created solely for Issue #51;
9. final manifest remains free of all 11 retired diagnostic-lineage page entries.

If a new R-number is generated solely because of Issue #51, treat that as a release failure and inspect the publisher path; do not manually roll version files backward.

## 18. Post-merge formal verification

After merge and any generated metadata commit:

- capture final `main` SHA;
- capture Exact Auto Release run ID and conclusion;
- capture formal build and releaseSequence;
- verify all four formal page SHA/digest checks pass;
- confirm formal page blobs are unchanged from the valid baseline unless unrelated concurrent work legitimately advanced them;
- run fresh deployed verification;
- confirm no Issue #51-only sequence increment.

## 19. Deployed artifact verification

Inspect the actual GitHub Pages artifact generated by the post-merge release run.

Require:

- `汐東收發文明細表_雲端逐步測試_正式版.html`: absent;
- `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`: absent;
- `tasun-version.json`: present;
- `TASUN_REBUILD`: present;
- `TASUN_REBUILD_STAMP`: present;
- all four formal document pages: present.

Also inspect deployed `tasun-version.json` and require:

- both live diagnostic authority entries absent;
- all nine redirect-lineage entries absent;
- no remaining `pages` entry points to the retired R880 diagnostic as `file`, `redirectTo`, or `canonicalTestPage`.

## 20. Explicitly forbidden changes

Do not manually modify:

- four formal document HTML files;
- other supported application HTML;
- publisher;
- release workflow;
- Worker endpoints;
- Worker authorization;
- auth/session logic;
- cloud synchronization business logic;
- row schema;
- permissions;
- root formal build string;
- releaseSequence;
- canonical rebuild values to force a result.

Do not add:

- replacement diagnostic page;
- redirect shim;
- compatibility HTML placeholder;
- alternate public diagnostic;
- second manifest authority;
- second release verifier.

Any such need requires a new architecture decision.

## 21. Closure criteria

Issue #51 may close only when all are true:

- [ ] Option A2 amended written spec explicitly approved;
- [ ] governance amendment PR #54 merged;
- [ ] implementation synchronized to latest main;
- [ ] both legacy diagnostic HTML files deleted;
- [ ] 11 approved diagnostic-lineage manifest page entries removed;
- [ ] no diagnostic manifest authority/redirect lineage remains;
- [ ] no replacement diagnostic surface added;
- [ ] formal four-page HTML unchanged by manual implementation;
- [ ] publisher/workflow unchanged;
- [ ] focused regression GREEN;
- [ ] full regression GREEN;
- [ ] disposable exact-release GREEN;
- [ ] independent review clear;
- [ ] implementation diff scope exact;
- [ ] post-merge metadata-only release keeps the same functional build/sequence;
- [ ] deployed four-page verification GREEN;
- [ ] fresh deployed verification GREEN;
- [ ] Pages artifact excludes both diagnostic HTML files;
- [ ] deployed manifest excludes all retired diagnostic-lineage authority;
- [ ] closure evidence recorded in Issue #51.

## 22. Approval gate

Architecture amendment:

- [x] Option A2 explicitly approved by user on 2026-10-12

Amended written spec:

- [x] completed after Option A2 approval
- [ ] explicitly approved by user

Implementation / TDD:

- [ ] resumes only after amended written-spec approval and governance PR #54 merge

PR #53 remains draft until the gate above is satisfied.
