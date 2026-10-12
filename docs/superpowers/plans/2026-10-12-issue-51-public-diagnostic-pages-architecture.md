# Issue #51 — Publicly Deployed Legacy Cloud Diagnostic Pages Architecture

Status: **APPROVED**
Functional R-number: **NOT ASSIGNED**
Approval: user explicitly approved **Option A** on 2026-10-12.
Implementation authority: **NO — written spec approval still required**

## 1. Baseline

Authoritative baseline:

- Repository: `Wutasun/Tasun`
- Branch: `main`
- Baseline commit: `88acc327503813219d93dc6314a6cde5e6a9aa36`
- Formal build: `20261012_tasun_v5_xidong_docs_r1152_70f1b5421b9c_release`
- Release sequence: `1152`
- Sole formal version authority: `tasun-version.json`

Current automated verification authority:

- `tests/*.test.*`
- Tasun regression checks
- disposable exact-release verification
- Exact Auto Release deployed four-page build / sequence / SHA verification.

## 2. Verified defect

Two legacy manual cloud-diagnostic HTML pages remain at repository root and are included in the current GitHub Pages static artifact:

1. `汐東收發文明細表_雲端逐步測試_正式版.html`
2. `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`

They are dormant relative to current application navigation and automated verification, but still publicly deployable because Pages copies root files through `rsync`.

Latest deployed-artifact evidence:

- workflow run: `38239730342`
- artifact: `11742506621`
- both filenames are present in `artifact.tar`.

## 3. Legacy page trace

### 3.1 Official-document cloud-step diagnostic

File:

`汐東收發文明細表_雲端逐步測試_正式版.html`

Embedded build:

`20260817_tasun_v5_xidong_docs_r880_option_plain_transport_isolation_release`

The page explicitly sets:

- `window.__TASUN_REQUIRE_LOGIN__ = false`;
- `window.__TASUN_TEST_PAGE_PUBLIC_DIRECT_OPEN__ = true`;
- `window.__TASUN_CLOUD_STEP_TEST_AUTH_OPTIONAL__ = true`;
- clears the auth-blocked state.

It exposes browser-driven diagnostic steps for:

- Health;
- Read;
- Merge;
- readback;
- formal-page iframe inspection;
- localStorage / IndexedDB inspection;
- console collection.

Its Merge probe builds a `deleted:true` tombstone and can call the normal merge endpoint when session/Worker authority permits.

Last source history is R880-era / 2026-08-17.

### 3.2 Package-detail R442 diagnostic

File:

`捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`

The page is a R442-era manual browser diagnostic last updated on 2026-06-01.

It likewise contains:

- Worker Health;
- Read;
- Merge;
- `deleted:true` probe;
- local state inspection;
- formal-page iframe checks;
- report-generation behavior.

It is far behind the current R1152 runtime.

## 4. Consumer and authority trace

Current repository search finds no active:

- page navigation;
- loader;
- workflow;
- runtime source;
- maintained test

that names either diagnostic filename.

Neither filename appears in current `tasun-version.json`.

Therefore the pages are not:

- formal release pages;
- current version authority;
- release-manifest aliases;
- required automated verification inputs.

Their historical content remains available in Git history if root copies are deleted.

## 5. Risk model

The Worker remains the server-side auth/data authority. Issue #51 does **not** assume an unauthenticated browser can bypass Worker authorization.

The defect is the unnecessary deployed browser surface:

- one page intentionally bypasses the normal page login gate;
- both expose internal cloud/resource/page/database identifiers and diagnostic controls;
- both may exercise write-authorized Merge probes when a valid browser session is present;
- both use stale historical diagnostic assumptions;
- “正式版” in the filenames can falsely imply current supported production tooling;
- bookmarks or direct URLs can access them despite no current supported navigation path.

This is an authority-convergence and deployed-surface problem, not a Worker-auth redesign.

## 6. Architecture options

### Option A — retire both dormant public diagnostic pages

Delete:

- `汐東收發文明細表_雲端逐步測試_正式版.html`
- `捷運汐止東湖線統包工程-資料明細表_雲端逐步測試_正式版_R442.html`

Add regression that locks:

- file absence;
- absence of the old public-direct diagnostic markers from active runtime/build sources;
- no active dependency on either retired filename.

Keep the existing automated test/release verification authority unchanged.

#### Advantages

- removes stale public diagnostic surface completely;
- preserves one current verification path;
- no auth/Worker behavior changes;
- no new diagnostic authority;
- smallest implementation and maintenance surface;
- Git history retains historical diagnostic code when needed.

#### Costs / risks

- old bookmarked diagnostic URLs stop working;
- any undocumented external/manual operator workflow using these exact pages is retired.

Current repository evidence shows no maintained consumer.

### Option B — retain a supported diagnostic surface

Keep or replace browser diagnostics, but define a new supported contract:

- authenticated access policy;
- deployment location/gating;
- current-version source;
- safe cloud-operation rules;
- test coverage;
- ownership and release lifecycle.

#### Advantages

- preserves an interactive browser diagnostic capability.

#### Costs / risks

- materially expands scope;
- creates a maintained diagnostic product surface;
- requires explicit auth and deployment contracts;
- risks becoming another runtime/release authority;
- no current requirement proves this capability is needed.

## 7. Recommended architecture — Option A

**Recommend Option A.**

Reason:

The current project already has maintained automated regression, disposable exact-release verification, and deployed exact four-page verification. The two legacy manual HTML diagnostics are neither current authority nor referenced consumer.

The correct convergence is to retire dormant public root pages rather than modernize an unrequested diagnostic subsystem.

## 8. Authority map after Option A

| Concern | Sole authority |
|---|---|
| Formal build / sequence | `tasun-version.json` + canonical release chain |
| Runtime regression | current `tests/*.test.*` |
| Disposable release verification | current PR regression workflow |
| Production deployment verification | current Exact Auto Release verifier |
| Worker auth/data authority | existing Worker/auth contract |
| Legacy manual cloud diagnostics | **absent from deployed root** |

No replacement public diagnostic authority is introduced.

## 9. TDD / regression boundary

Written spec should require RED→GREEN coverage for at least:

1. both legacy diagnostic root files must be absent;
2. current formal pages remain present;
3. current automated test/release authority files remain present;
4. active runtime/build sources do not depend on either retired filename;
5. the public-direct diagnostic markers are not reintroduced into an active root diagnostic page;
6. publisher/workflow/version files remain unchanged;
7. deletion-only changed-file list does not generate a new formal release;
8. full regression GREEN;
9. disposable exact-release verification GREEN;
10. deployed artifact no longer contains either diagnostic page.

Tests should lock **retirement / non-authority**, not replace the pages.

## 10. Release workflow behavior

Both files are `.html`, so deletion triggers the Exact Auto Release workflow.

Current autoscan only treats a changed HTML path as relevant when that path still exists after the change.

Expected Option A merge behavior:

1. workflow triggers from deleted HTML paths;
2. changed-file list contains the two retired diagnostic pages;
3. autoscan sees neither path exists;
4. no surviving formal/core/generated change remains from Issue #51;
5. publisher reports `no formal page/core/manifest change; nothing to sync.`;
6. no new formal build/releaseSequence is generated solely for retirement;
7. Pages redeploys the current formal release without the retired diagnostic files;
8. four-page build/sequence/SHA verification remains GREEN.

Any Issue #51-only sequence increment is a failure.

## 11. Explicitly unchanged

Do not change:

- `汐東收發文明細表.html`;
- `汐東收發文登錄表.html`;
- `汐東文件統計表.html`;
- `汐東文件管理表.html`;
- other supported application pages;
- `tasun-version.json`;
- `TASUN_REBUILD`;
- `TASUN_REBUILD_STAMP`;
- publisher;
- release workflow;
- Worker endpoints;
- auth/session policy;
- cloud sync business contract;
- row schemas;
- permissions;
- supported UI.

## 12. Failure boundary

If latest-main tracing finds a real active consumer of either diagnostic page:

- stop deletion of that page;
- identify the exact consumer/workflow;
- return to architecture review;
- do not silently add redirects or compatibility copies.

If post-merge autoscan generates a formal release:

- treat it as unexpected;
- inspect current relevance logic;
- do not manually roll version files backward.

If there is a real business requirement for interactive diagnostics:

- return to Option B architecture;
- define auth/deployment/ownership explicitly before implementation.

## 13. Approval gate

- [x] Architecture Option A approved by user on 2026-10-12
- [x] Written spec completed after architecture approval
- [ ] Written spec explicitly approved by user

Implementation/TDD is not authorized until required approval gates are satisfied.
