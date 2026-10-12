# Issue #61 — Written Spec: Navigation / Permission Target Topology Convergence

Date: 2026-10-12  
Issue: #61 — `[REQ] Converge stale navigation and permission targets to deployed page topology`  
Approved architecture: **Option A**  
Functional R-number: **NOT ASSIGNED**  
Status: **WRITTEN SPEC COMPLETE / APPROVAL REQUIRED**  
Implementation authority: **BLOCKED pending explicit written-spec approval and governance PR #62 merge**

## 1. Objective

Converge Tasun's live navigation / permission target sources to the pages actually supported by the repository and GitHub Pages deployment.

This requirement is not a general string-cleanup task. It targets only stale filenames that are present in live navigation / permission authority paths and can reach entry selectors, button definitions, route storage, or persisted permission/navigation state.

The implementation must preserve:
- current supported pages;
- existing permission role semantics;
- explicit administrator choices for surviving page/button identities;
- the existing single navigation/permission authority chain;
- current Worker/auth/cloud/data contracts;
- TasunSelfHealV5 / R268 ownership;
- the Exact Auto Release publisher/workflow authority.

## 2. Authoritative baseline

Implementation must re-synchronize to latest `main` immediately before RED work.

Known drafting baseline:
- main: `adc510e80ca52b6affa4302b6e726e12c188ec56`
- formal build: `20261012_tasun_v5_xidong_docs_r1152_70f1b5421b9c_release`
- releaseSequence: `1152`
- `權限表.html` blob: `e2e9d9cf930a708f307399a632dedc0ccceac504`
- `tasun-version.json` page authority for `權限表.html`: present
- Issue #56 deployed page-authority mismatch count: 0

If unrelated legitimate work advances `main`, use the then-current baseline and preserve all unrelated changes.

## 3. Existing authority chain

Current navigation / permission flow:

`tasun-resources.json::resources.tasun-auth-table`
→ `權限表.html::loadResourcesForAuthTable()`
→ fallback/default merge
→ `DEFAULT_ENTRY_FILES` / `DEFAULT_ENTRY_BUTTONS`
→ dynamic entry/button structures
→ `tasunEntryRegistry_v1` / `tasunNavButtons_v1` / `tasunRoutes_v1`
→ permission-entry UI and navigation.

`汐東文件管理表.html` is a current consumer/repair source for document-manager navigation and already removes the retired reply-register route.

No second registry, router, migration subsystem, polling loop, or SelfHeal owner may be introduced.

## 4. Production stale-target classification

The implementation must use the following exact classification unless pre-implementation tracing proves the repository has legitimately changed.

### 4.1 Normalize to canonical supported pages

These are unambiguous one-to-one current replacements:

| Retired / missing target | Canonical current target |
|---|---|
| `收發文明細表.html` | `汐東收發文明細表.html` |
| `收發文登錄表.html` | `汐東收發文登錄表.html` |
| `捷運汐東線記事.html` | `捷運汐東線事項記錄.html` |

Normalization means live default/resource authority must use the canonical target. Do not recreate redirect HTML.

### 4.2 Retire with no replacement

These targets must not remain in live navigation/permission authority:
- `回覆文登錄表.html`
- `汐東回覆文登錄表.html`

No replacement page is authorized under Issue #61.

### 4.3 Retire legacy combined inspection target

Retire:
- `捷運汐止東湖線-查驗管控表.html`

Preserve the current supported split pages:
- `捷運汐止東湖線-施工查驗管控表.html`
- `捷運汐止東湖線-材料查驗管控表.html`

Do not merge them back into a combined page.

### 4.4 Retire unsupported water/environment document-control entries

Unless latest-main tracing proves a real canonical replacement exists, retire these auth-table entries:
- `捷運汐東線審查文件管制查詢表-水環組.html`
- `捷運汐東線審查文件管制登錄表-水環組.html`
- `捷運汐東線審查文件管制表-水環組.html`

Do not infer replacements from names alone.

## 5. Explicit non-production exclusions

The following are examples/comments/help text and must not be treated as broken live navigation:
- `xx.html`
- `yy.html`
- `新頁面.html`
- placeholder text such as `（其他）請輸入檔名，例如：汐東工程管理表.html`

Regression must distinguish active structures from examples/comments.

## 6. Authorized manual implementation files

After written-spec approval, manual production changes are authorized only in:

1. `權限表.html`
2. `tasun-resources.json`
3. new focused test file:
   `tests/issue-61-navigation-permission-topology.test.cjs`

`汐東文件管理表.html` is **not authorized by default**.

It may be added to scope only if RED/pre-GREEN tracing proves the existing current cleanup logic cannot keep stale routes retired after the source-layer corrections. If that happens, stop and return to architecture amendment rather than silently expanding scope.

## 7. Explicit no-change files / behaviors

Do not manually modify under Issue #61:
- `tasun-version.json`
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- four formal document pages:
  - `汐東收發文明細表.html`
  - `汐東收發文登錄表.html`
  - `汐東文件統計表.html`
  - `汐東文件管理表.html` unless failure boundary is triggered
- `捷運汐止東湖線-施工查驗管控表.html`
- `捷運汐止東湖線-材料查驗管控表.html`
- Worker source / auth/session/cloud code
- row/data schema
- permission role meanings
- rebuild files by hand

## 8. Pre-implementation synchronization and trace

Before creating RED:

1. fetch latest `main`;
2. confirm Issue #61 governance branch can be reconciled with latest main;
3. re-scan `權限表.html` active structures;
4. re-scan `tasun-resources.json::resources.tasun-auth-table.entries`;
5. verify canonical replacement files exist;
6. verify retired reply-register page remains absent;
7. verify split inspection files remain present;
8. verify `汐東文件管理表.html` still removes the reply-register route;
9. capture baseline SHAs for all locked files;
10. capture current `權限表.html` manifest page entry and root release identity.

If any target classification in Section 4 is no longer true, stop and amend architecture.

## 9. TDD RED contract

RED must be committed before any production-file mutation.

Create `tests/issue-61-navigation-permission-topology.test.cjs`.

The test must inspect actual source files and prove the current defect.

Required RED assertions:

1. active `權限表.html` entry sources contain one or more classified stale production targets;
2. `tasun-resources.json::resources.tasun-auth-table.entries` contains its classified stale targets;
3. current canonical replacement pages exist;
4. examples/comments (`xx.html`, `yy.html`, `新頁面.html`) are ignored by the production-target extractor;
5. retired reply-register target is still representable by current `權限表.html` defaults;
6. legacy combined inspection target is still representable;
7. current split inspection pages exist;
8. `汐東文件管理表.html` contains its current retired-route cleanup behavior;
9. no test writes production data or local/cloud state.

Expected RED:
- failures must identify stale live authority targets;
- missing example/comment files must not fail the test;
- canonical files must not be reported missing.

Record:
- RED tests-only commit SHA;
- CI run ID;
- total/pass/fail counts;
- exact Issue #61 failing assertions.

## 10. Production-target extraction contract

The regression must not grep all `.html` strings indiscriminately.

It must focus on executable/default navigation data, at minimum:
- `DEFAULT_ENTRY_FILES`;
- `DEFAULT_ENTRY_BUTTONS`;
- auth-table resource entries;
- active migration/merge definitions that materialize those values.

A comment-only or documentation example must not cause failure.

The test may use stable source-block extraction or structured parsing appropriate to the current file shape, but it must fail clearly if the relevant authority block becomes unrecognizable.

## 11. GREEN — `tasun-resources.json`

Update only the auth-table entry topology required by Section 4.

For `resources.tasun-auth-table.entries`:
- replace `捷運汐東線記事.html` with `捷運汐東線事項記錄.html`;
- remove the three unsupported water/environment entries;
- retain all other existing supported entries and ordering unless a duplicate canonical target would result.

Do not change unrelated resource definitions, API endpoints, aliases, resource keys, cloud settings, or other resource entry arrays.

Note: the `sxdh-notes` resource may continue to list old names as compatibility **aliases** if those aliases are not exposed as page-navigation file targets. Issue #61 does not require deleting non-navigation semantic aliases.

## 12. GREEN — `權限表.html`

Modify existing authority structures in place.

### 12.1 DEFAULT_ENTRY_FILES

- remove nonexistent unsupported entries;
- replace clear aliases with canonical current targets;
- prevent duplicate canonical entries;
- preserve supported-entry order as much as possible.

### 12.2 DEFAULT_ENTRY_BUTTONS

For legacy official-document groups:
- any live button href for detail must use `汐東收發文明細表.html`;
- any live button href for register must use `汐東收發文登錄表.html`;
- remove reply-register button definitions when their target is retired;
- remove definitions keyed only by retired page identities when no current entry should exist.

For `汐東文件管理表.html`:
- do not re-add `official_reply_register`;
- construction/material inspection controls must point to their current split pages;
- do not retain the combined missing inspection href.

### 12.3 Migration / normalization

Use the existing normalization/migration path.

Required behavior:
- clear legacy alias route keys when mapped to canonical current targets;
- remove unsupported retired route keys;
- keep existing explicit permission values for surviving current page/button keys;
- do not reset unrelated admin-configured nav order/names/roles;
- do not create a new localStorage namespace.

## 13. Explicit permission-preservation contract

The cleanup is topology-only.

For surviving keys such as:
- `official_doc_detail`
- `official_doc_register`
- current construction inspection key
- current material inspection key
- managed page permission keys

preserve existing role semantics.

If a retired page identity has no surviving page, its route/entry can be removed, but unrelated stored permission rows must not be globally reset.

Regression should prove the code path uses selective migration/removal rather than wholesale storage replacement.

## 14. GREEN acceptance assertions

After production edits:

1. all live auth-table entry file targets resolve to repository files;
2. all live button hrefs introduced/owned by the corrected authority resolve to supported repository files;
3. canonical detail/register targets are the `汐東...` pages;
4. `捷運汐東線記事.html` is not exposed as a page entry;
5. `捷運汐東線事項記錄.html` is exposed instead where the record page is intended;
6. reply-register retired targets are absent from live defaults;
7. combined inspection target is absent;
8. construction/material inspection targets remain present;
9. the three unsupported water/environment entry names are absent from auth-table entry sources;
10. example/comment filenames do not affect pass/fail;
11. no new compatibility HTML file exists.

## 15. Full regression

After focused GREEN:
- run complete Tasun regression suite;
- all existing Issue #14–#56 tests must remain GREEN;
- HTML syntax tests must pass;
- release contract/workflow tests must pass.

Any failure in current permission/navigation behavior must be diagnosed before proceeding.

## 16. Disposable exact-release

Run the repository's normal disposable exact-release verification on the final implementation head.

Expected:
- succeeds;
- uses disposable fixture identity only;
- verifies formal four-page exact chain;
- does not establish a second release authority.

The disposable R-number is not the production release result.

## 17. Semantic diff audit

Relative to synchronized implementation baseline, verify:

Expected manual production files:
- `權限表.html`
- `tasun-resources.json`

Expected test file:
- `tests/issue-61-navigation-permission-topology.test.cjs`

No other manual file changes.

Audit the production diff to prove:
- only approved stale targets are normalized/retired;
- no unrelated buttons/pages are removed;
- no role list is broadened or narrowed without explicit authorization;
- no cloud/API setting changes;
- no publisher/workflow changes.

## 18. Locked-file audit

Before merge, compare baseline/final blobs for:
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- `tasun-version.json` before release automation
- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`
- `捷運汐止東湖線-施工查驗管控表.html`
- `捷運汐止東湖線-材料查驗管控表.html`
- Worker/auth/cloud source files

All must remain identical through manual implementation.

## 19. Independent review

Request Codex review on final GREEN head.

Review focus:
- production vs comment/example target extraction is sound;
- normalization is only for unambiguous aliases;
- unsupported entries are retired rather than guessed/recreated;
- no reply-register route is reintroduced;
- split inspection topology is preserved;
- explicit permission semantics/settings are preserved;
- resource/default sources converge;
- no new navigation authority is added;
- no manual version/release change.

Resolve valid findings and rerun final GREEN.

## 20. Merge contract

Merge only after:
- Option A architecture approved;
- written spec explicitly approved;
- governance PR #62 merged;
- RED evidence captured;
- focused GREEN;
- full regression GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- independent review clear.

Use repository-supported merge behavior.

## 21. Expected production release behavior

Because `權限表.html` changes, the Exact Auto Release workflow is expected to treat this as release-relevant HTML.

Post-merge release must:
- use existing publisher;
- generate the next formal release identity automatically;
- never manually edit the R-number;
- preserve the four-page exact group contract;
- update `權限表.html` manifest page metadata through normal publisher behavior;
- deploy corrected `權限表.html` and `tasun-resources.json`;
- pass deployed build/sequence/SHA verification.

A releaseSequence increment produced by the existing publisher is expected for this functional HTML change.

## 22. Post-merge deployed verification

After Exact Auto Release is terminal:

1. require release attempt 1 SUCCESS;
2. trigger/require a fresh verification attempt;
3. inspect fresh Pages artifact;
4. confirm corrected `權限表.html` and `tasun-resources.json` are present;
5. verify no active navigation target from Issue #61 points to an absent artifact page;
6. verify canonical pages exist;
7. verify retired reply/combined-inspection/water-environment targets are not exposed by active auth-table entry sources;
8. verify four formal document pages still pass exact release checks.

## 23. Failure boundaries / architecture amendment triggers

Stop implementation and return to architecture if:
- a missing target is actually delivered through another supported deployment mechanism;
- a water/environment stale name has a legitimate current canonical page not identified here;
- selective migration cannot preserve explicit administrator settings;
- fixing resources/default convergence requires changing `汐東文件管理表.html`;
- fixing topology requires a second router or persistent compatibility page;
- the existing publisher cannot safely version `權限表.html` under the normal release model;
- unrelated stale navigation classes are discovered that materially expand scope.

Do not silently broaden Issue #61.

## 24. Closure evidence

Before closing Issue #61, record:
- architecture approval;
- written-spec approval;
- governance PR merge SHA;
- RED commit/run and failure counts;
- final implementation head;
- final full regression counts;
- disposable exact-release result;
- semantic diff result;
- locked-file audit result;
- Codex review outcome;
- implementation merge SHA;
- generated release metadata commit SHA if any;
- Exact Auto Release run ID/result;
- final formal build;
- final releaseSequence;
- fresh verification result;
- Pages artifact ID/digest;
- proof of zero Issue #61 active navigation targets resolving to absent deployed pages.

## 25. Approval gate

- [x] Option A architecture explicitly approved by user on 2026-10-12
- [x] written spec completed
- [ ] written spec explicitly approved by user
- [ ] implementation / TDD authorized

**No production mutation is authorized until the written spec is explicitly approved and governance PR #62 is merged.**
