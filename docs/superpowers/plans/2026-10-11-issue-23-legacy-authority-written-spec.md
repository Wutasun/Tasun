# Issue #23 Written Spec — Retire Dormant Legacy Release and Version-Loader Authorities

Date: 2026-10-11  
Requirement: GitHub Issue #23 — `[REQ] Retire dormant legacy release and version-loader authorities`  
Architecture: Option A APPROVED  
Functional R-number: NOT ASSIGNED  
Status: WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED

## 1. Implementation objective

Retire the two verified-unreferenced dormant executable legacy authorities:

- `publish-version_tasun_project.mjs`
- `tasun-version-loade.js`

The implementation must reduce authority surface only. It must not change the active Exact Auto Release chain, formal version loader behavior, formal pages, data, permissions, cloud synchronization, geometry, release sequence algorithm, or `tasun-version.json`.

## 2. Baseline

Implementation must begin only after this written spec is explicitly approved and merged to `main`.

Implementation branch baseline must be the latest current `main` at that time.

Architecture tracing baseline was:

`main @ 7574497a1589a3a2ae961b9d2a81d187a061507d`

If `main` advances before implementation begins, rebase by creating the implementation branch from the latest `main`; do not reuse the architecture branch as the implementation branch.

## 3. Approved change set

### 3.1 Required deletions

Delete exactly:

1. `publish-version_tasun_project.mjs`
2. `tasun-version-loade.js`

Do not replace them with executable compatibility shims.

Historical code remains available in Git history.

### 3.2 Required regression coverage

Add a dedicated Issue #23 regression test file under `tests/`, expected name:

`tests/issue-23-legacy-authority-retirement.test.cjs`

The test must verify, at minimum:

1. `publish-version_tasun_project.mjs` does not exist.
2. `tasun-version-loade.js` does not exist.
3. `.github/workflows/release-version.yml` still invokes `publish-version_tasun_project_autoscan.mjs`.
4. `publish-version_tasun_project_autoscan.mjs` still identifies `tasun-version.json` as the version file.
5. `tasun-version-loader.js` still exists and reads `tasun-version.json`.
6. The current loader retains page-entry-only authority behavior.
7. No tracked source/config/document intended as active authority references either retired filename.

The test should inspect repository text deterministically and must not depend on network access.

## 4. TDD sequence

### RED

Create the regression test first with assertions that the two legacy files must be absent.

Run the focused Issue #23 test and full Tasun regression suite before deleting the files.

Expected RED cause:

- the two legacy files still exist on the tests-only head.

Record:

- tests-only commit SHA;
- focused test result;
- full regression run result if CI is triggered;
- failure output proving the intended invariant is the failure source.

Do not weaken the test to make RED pass.

### GREEN

Delete only the two approved legacy files.

Re-run:

- focused Issue #23 regression;
- full Tasun regression;
- disposable exact-release verification.

Expected result: GREEN without modifying active runtime/release logic.

## 5. Active authority invariants

### 5.1 Release chain

Must remain:

`.github/workflows/release-version.yml`
→ `publish-version_tasun_project_autoscan.mjs`
→ `tasun-version.json`
→ four-page exact verification
→ Pages deployment
→ deployed four-page build/sequence/SHA verification.

Implementation must not edit:

- `.github/workflows/release-version.yml`
- `publish-version_tasun_project_autoscan.mjs`
- `tasun-version.json`

unless RED evidence proves an unexpected required dependency. If such evidence appears, stop the implementation scope and return to architecture review rather than expanding silently.

### 5.2 Loader chain

Must remain:

formal page
→ `tasun-version-loader.js`
→ `tasun-version.json` page entry
→ page version/build globals.

Implementation must not edit `tasun-version-loader.js`.

## 6. Repository reference scan contract

Before GREEN deletion, perform exact repository search for:

- `publish-version_tasun_project.mjs`
- `tasun-version-loade.js`

Known architecture result: zero active references on the traced baseline.

During implementation, repeat the exact scan on the latest implementation baseline.

If any new reference exists:

- classify whether it is historical documentation, test fixture, or active authority;
- active references must not be removed or rewritten without explicit architecture review;
- historical references may remain only if they clearly identify the artifact as retired/non-authoritative and do not form an executable path.

The implementation PR must report the scan result.

## 7. Release workflow behavior

Deleting the legacy `.mjs/.js` paths will match the broad workflow path filters and may trigger the Exact Auto Release workflow on merge.

Expected contract:

1. workflow starts because a tracked `.js/.mjs` path changed;
2. autoscan evaluates changed files;
3. deleted legacy paths no longer exist and are not active `CORE_FILES`;
4. no formal `relevant` release input is produced solely by those deletions;
5. no new formal build/releaseSequence is generated;
6. existing `tasun-version.json` content remains unchanged;
7. read-only four-page exact verification remains GREEN;
8. Pages may redeploy the current existing build;
9. deployed four-page build/sequence/SHA remain identical to the pre-merge formal build.

Any unexpected releaseSequence increment is a failure requiring investigation before closure.

## 8. Version authority contract

`tasun-version.json` remains the sole formal version source.

Forbidden implementation actions:

- manual version edits;
- manual releaseSequence edits;
- replacing the active publisher;
- adding a second publisher;
- adding a second loader;
- hard-coding a formal version in pages or core scripts.

Functional R-number remains NOT ASSIGNED.

An automatic release workflow sequence, if any occurs unexpectedly, must not be reinterpreted as the functional Issue #23 number.

## 9. File-scope constraints

Expected implementation diff:

- delete `publish-version_tasun_project.mjs`;
- delete `tasun-version-loade.js`;
- add `tests/issue-23-legacy-authority-retirement.test.cjs`.

No other production/runtime file changes are expected.

Any additional production file change requires explicit evidence and review.

## 10. UI / data / permissions / cloud invariants

No changes to:

- UI visual design;
- page layout;
- formal row data;
- uid/rev/updatedAt/deleted semantics;
- statistics formulas;
- login flow;
- permission inheritance;
- cloud synchronization;
- mobile table/stage behavior;
- SelfHeal runtime authority.

## 11. TasunSelfHealV5 / R268 contract

TasunSelfHealV5 and R268 must not recreate the retired artifacts.

No SelfHeal code change is expected.

Regression should ensure the current supported authority chain remains discoverable without either legacy file.

## 12. Test design details

The Issue #23 test should use Node built-ins only unless existing test conventions already require otherwise.

Recommended structure:

- resolve repository root from `tests/`;
- use `fs.existsSync` for retired-file absence;
- read workflow/autoscan/current-loader text;
- assert exact current-authority markers;
- optionally enumerate tracked text files or a bounded authority-source set to assert no active reference to retired filenames.

Avoid false positives from this written spec or architecture docs themselves. If scanning repository text, exclude governance records that intentionally mention retired filenames as historical evidence, or classify paths so governance references do not fail the test.

The regression must lock authority, not prohibit historical documentation.

## 13. Verification matrix

Before merge, all of the following must be GREEN:

- focused Issue #23 test;
- full Tasun regression suite;
- current release contract tests;
- disposable exact-release verification;
- exact repository reference scan;
- diff-scope check.

The implementation PR must explicitly state:

- RED head SHA;
- GREEN head SHA;
- focused test result;
- full regression result;
- disposable exact-release result;
- changed files;
- current build before/after disposable verification;
- confirmation that no manual `tasun-version.json` edit occurred.

## 14. Review criteria

Independent review should specifically check:

- no hidden reference to either legacy filename remains in an active authority path;
- current publisher was not altered;
- current loader was not altered;
- version manifest was not altered manually;
- regression test does not produce false confidence by scanning only one file;
- docs that mention the retired filenames are treated as historical governance evidence, not executable references;
- deletion-only runtime scope is preserved.

## 15. Merge contract

Only merge after:

- RED→GREEN evidence is complete;
- full regression GREEN;
- disposable exact-release verification GREEN;
- review has no unresolved major issue;
- changed-file scope matches the approved implementation.

Preferred merge style: follow current repository practice for the implementation PR.

## 16. Post-merge verification

After merge to `main`:

1. capture merge SHA;
2. inspect Exact Auto Release workflow run caused by deleted `.js/.mjs` paths;
3. confirm autoscan did not create a new formal build solely from these deletions;
4. confirm `tasun-version.json` formal build and releaseSequence remain unchanged;
5. confirm four deployed pages report the same expected build;
6. confirm manifest SHA values match deployed bytes;
7. confirm Issue #23 acceptance criteria;
8. record closure evidence in Issue #23;
9. close Issue #23 as completed.

If the workflow does not run because GitHub path-event semantics differ from expectation, record that actual behavior; do not trigger a production release solely to force a run. Read-only/disposable verification remains required.

## 17. Acceptance criteria

Implementation is complete only when all are true:

- [ ] `publish-version_tasun_project.mjs` is absent from current `main`.
- [ ] `tasun-version-loade.js` is absent from current `main`.
- [ ] no active authority path references either retired filename.
- [ ] `publish-version_tasun_project_autoscan.mjs` remains the formal publisher.
- [ ] `tasun-version-loader.js` remains the formal loader.
- [ ] `tasun-version.json` remains sole formal version source.
- [ ] regression locks these invariants.
- [ ] full Tasun regression GREEN.
- [ ] disposable exact-release verification GREEN.
- [ ] no manual version change.
- [ ] no unintended formal releaseSequence increment.
- [ ] no formal UI/data/auth/cloud behavior change.
- [ ] closure evidence is recorded.

## 18. Approval gate

Architecture:

- [x] Option A explicitly approved by user on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [x] explicitly approved by user on 2026-10-11

Implementation / TDD:

- [x] authorized by user on 2026-10-11

Implementation/TDD is authorized after this synchronized governance PR is merged to `main`; the implementation branch must then be created from the latest current `main`.
