# Issue #96 — Written Spec: Retire Stale Root schema_v3.sql

Date: 2026-10-13  
Issue: #96 — `[REQ] Retire stale root schema_v3.sql`  
Approved architecture: **Option A**  
Pre-spec main baseline: `c9e0d6200a6d99708b08c1f764e656df54f13d60`  
Implementation comparison baseline: **the `main` SHA immediately after this written-spec PR is merged**  
Formal build at specification time: `20261013_tasun_v5_xidong_docs_r1155_6496a23cb51e_release`  
Release sequence at specification time: `1155`  
Status: **WRITTEN SPEC DRAFTED / IMPLEMENTATION-TDD NOT YET AUTHORIZED**

## 1. Goal

Retire stale root `schema_v3.sql`, which identifies itself as a historical `Tasun Security v3 schema (D1 / SQLite)`, so it cannot be mistaken for the current D1/API schema authority.

Current schema authority is under the `tasun-api/` area, including:
- `tasun-api/schema_v4.sql`
- `tasun-api/schema.sql`
- `tasun-api/migrations/0001_init.sql`

This is a stale-root-artifact retirement only. It must not alter actual D1 schema, migration order, Worker/runtime behavior, authentication behavior, cloud synchronization, release flow, formal pages, UI, or persisted data semantics.

## 2. Verified precondition

Before RED implementation begins, re-verify on the latest implementation baseline:

1. root `schema_v3.sql` exists;
2. its header identifies it as historical v3 schema content;
3. exact live-source/config search finds no consumer of root `schema_v3.sql`;
4. current schema/migration authority remains under `tasun-api/`;
5. current Worker/runtime code does not load, import, embed, shell-reference, or otherwise depend on root `schema_v3.sql`.

If any current migration/deployment/Worker consumer is discovered, stop and amend architecture before implementation.

## 3. Authorized implementation scope

Only these implementation changes are authorized:

1. delete:
   - `schema_v3.sql`

2. add:
   - `tests/issue-96-retire-root-schema-v3.test.cjs`

No replacement schema, alias, redirect, copied SQL, migration rewrite, schema_v4 edit, Worker edit, compatibility shim, generated surrogate, release metadata mutation, or data migration is authorized.

## 4. Explicit no-change boundary

The following are locked:

- `tasun-api/schema_v4.sql`
- `tasun-api/schema.sql`
- `tasun-api/migrations/0001_init.sql`
- all other `tasun-api/migrations/*`
- `tasun-api/worker.js`
- `tasun-api/index.html`
- `tasun-cloud-kit.js`
- `tasun-cloudwrap-v4.js`
- `tasun-auth-v4.js`
- `tasun-version.json`
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- `.github/workflows/tasun-pr-checks.yml`
- `.github/workflows/r1144-tests.yml`
- `docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md`
- `tasun-resources.json`
- `tasun-version-loader.js`
- `tasun-core.js`
- `tasun-boot.js`
- `tasun-guard-v5.js`
- `tasun-global-core.js`
- `index.html`
- `inline.js`
- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`
- current storage/data schemas and persisted data behavior

No manual D1 migration, schema mutation, R-number, build string, releaseSequence, manifest, or formal-page metadata edit is authorized.

## 5. TDD sequence

### 5.1 RED — tests-only commit first

Create only:

`tests/issue-96-retire-root-schema-v3.test.cjs`

The RED test must contain three independent contracts.

### Contract A — stale root v3 schema must be absent

Assert:

`fs.existsSync(path.join(ROOT,'schema_v3.sql')) === false`

On the pre-change baseline this must fail because the stale root schema still exists.

### Contract B — current schema/migration authorities remain present

Assert all of the following exist as regular files:

- `tasun-api/schema_v4.sql`
- `tasun-api/schema.sql`
- `tasun-api/migrations/0001_init.sql`
- `tasun-api/worker.js`

Also verify:
- `tasun-api/schema_v4.sql` still identifies the current v4 D1 schema;
- current Worker/runtime authority remains in `tasun-api/`;
- the PR-check workflow still runs regression tests and disposable exact-release verification.

This contract is expected to pass already in RED.

### Contract C — no live consumer of root schema_v3.sql exists

Recursively scan live source/config files while excluding:
- `.git/`
- `node_modules/`
- `docs/`
- `tests/`
- historical Markdown/text artifacts

Include active source/config extensions at minimum:
- html / htm
- js / mjs / cjs
- json
- yaml / yml
- toml
- sql

The scan must return zero live references to:
- exact filename `schema_v3.sql`;
- root-relative path references to `schema_v3.sql`;
- path joins/resolves that target root `schema_v3.sql`.

The test must not classify the filename's own source file as a consumer.

Also prove:
- no workflow points to root `schema_v3.sql`;
- no Worker/runtime file points to root `schema_v3.sql`;
- current schema authorities under `tasun-api/` remain intact.

### Expected RED evidence

Required RED state:
- exactly Contract A fails;
- Contract B passes;
- Contract C passes;
- all pre-existing regressions remain green;
- disposable exact-release is skipped because RED blocks the regression job before that step.

Any additional RED failure requires diagnosis before GREEN.

## 6. GREEN implementation

After valid RED evidence:

1. delete exactly root `schema_v3.sql`;
2. do not edit `tasun-api` schemas/migrations;
3. do not edit Worker/runtime code;
4. do not edit workflow or publisher files;
5. do not edit formal HTML pages;
6. do not create replacement or compatibility SQL;
7. do not alter persisted data or migration order.

The intended semantic production diff is exactly one deletion.

## 7. GREEN acceptance

After deletion, the focused regression must prove:

- root `schema_v3.sql` absent;
- current `tasun-api` schema/migration authorities present;
- no live consumer/reference to root `schema_v3.sql`;
- Worker/runtime/release authorities unchanged.

## 8. Full regression gate

Run the repository's complete regression suite, including all prior Issue protections and release/runtime tests.

Required:
- all tests PASS;
- Issue #96 focused tests PASS;
- no existing test weakened, skipped, renamed away, or removed.

Record:
- workflow run ID;
- total tests;
- pass count;
- fail count.

## 9. Disposable exact-release gate

Run existing disposable exact-release verification on final implementation head.

Required:
- disposable exact-release PASS;
- post-disposable regression PASS if performed;
- no formal Pages deployment from the PR branch.

Issue #96 focused tests must tolerate legitimate disposable release progression and must not pin runtime execution to exactly R1155.

## 10. Semantic diff gate

Compare final implementation branch against the post-spec implementation comparison baseline.

Allowed changed paths only:
- deleted `schema_v3.sql`;
- added `tests/issue-96-retire-root-schema-v3.test.cjs`.

The written-spec file is already part of baseline and must not appear as implementation scope.

Any other path is scope drift and blocks merge unless the written spec is formally amended.

## 11. Locked-file audit

Compare baseline vs final-head blob SHAs for every explicit no-change file in Section 4.

Required:
- every locked file blob-identical.

For `tasun-api/migrations/*`, verify both:
- no migration file changed;
- no migration file added or removed.

## 12. Independent review gate

Request Codex review on the exact final head.

Review focus:
- whether root `schema_v3.sql` has any current runtime/deployment/migration consumer;
- whether current D1 schema authority truly remains in `tasun-api/`;
- whether deleting root v3 SQL can alter data initialization, auth, or Worker behavior;
- whether implementation scope is exactly deletion + focused regression;
- whether RED/GREEN evidence is valid and complete.

All valid findings must be addressed and re-reviewed before merge.

## 13. Merge policy

Merge only after:
- final CI GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- migration directory audit exact;
- independent review clear;
- no unresolved valid review thread.

Use allowed repository merge method. If merge commits are disallowed, prefer rebase merge when it preserves RED→GREEN auditability.

## 14. Post-merge release behavior

Because root `schema_v3.sql` is not a current publisher CORE_FILE and is not part of formal page/runtime authority, expected post-merge behavior:

- Exact Auto Release may or may not trigger depending on current workflow path filters;
- if triggered, autoscan should report no formal page/core/manifest change to sync;
- no generated release metadata commit should be required;
- formal build/releaseSequence should remain unchanged unless the actual workflow legitimately determines otherwise.

Expected unchanged identity at specification time:
- build: `20261013_tasun_v5_xidong_docs_r1155_6496a23cb51e_release`
- releaseSequence: `1155`

This is an expectation only; do not force metadata.

## 15. Post-merge verification

After merge:

1. verify implementation merge SHA on `main`;
2. verify root `schema_v3.sql` absent;
3. verify `tasun-api/schema_v4.sql`, `tasun-api/schema.sql`, and migration files remain unchanged;
4. verify Worker/runtime files unchanged;
5. inspect triggered Exact Auto Release workflow to terminal state;
6. record autoscan result;
7. record whether generated metadata commit exists;
8. verify final `tasun-version.json` blob/build/releaseSequence;
9. verify deployed four-page build/sequence/SHA if deployment is triggered;
10. verify no data-schema/runtime side effect occurred.

## 16. Closure evidence required on Issue #96

Before closing, record:

- architecture approval date;
- written-spec approval date;
- pre-spec main baseline SHA;
- post-spec implementation comparison baseline SHA;
- RED tests-only commit SHA;
- RED workflow run ID and test counts;
- expected RED-only failure evidence;
- GREEN/final head SHA;
- full regression run/counts;
- disposable exact-release result;
- semantic diff result;
- locked-file audit result;
- migration directory audit result;
- independent review result;
- implementation PR merge SHA;
- post-merge workflow run/result or explicit not triggered;
- autoscan result if applicable;
- generated metadata commit SHA or explicit none;
- final formal build;
- final releaseSequence;
- proof root `schema_v3.sql` absent;
- proof current `tasun-api` schema/migration/Worker authorities remain intact.

Close Issue #96 only when every acceptance item is satisfied.

## 17. Governance gate

Current gate:

- [x] Architecture Option A explicitly approved by user on 2026-10-13
- [x] Written spec drafted
- [ ] Written spec explicitly approved by user
- [ ] Implementation / TDD authorized

**Stop at the written-spec approval gate. Implementation begins only after explicit written-spec approval.**
