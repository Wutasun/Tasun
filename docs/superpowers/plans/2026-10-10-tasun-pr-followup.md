# Tasun PR follow-up implementation plan

> Execute inline with superpowers:executing-plans; use TDD and a fresh final reviewer.

**Goal:** Repair the existing release authority and the manager's cross-stage document jump, then retire superseded PRs.
**Architecture:** Keep the current main (326065efd4d0958761d7826362b4db71942779ee, R1139) as source. Change the existing publisher and existing jump metadata producer; never introduce a second runtime authority.
**Tech Stack:** Embedded browser JavaScript, Node built-in test runner, GitHub Actions.
**Spec:** User-approved handling sequence in this conversation. The full original R1122 written spec is not available; preserve and test its existing lifecycle/commit contract, without claiming full acceptance.

## Global constraints
- tasun-version.json is the only release-version authority.
- Preserve Tasun v5, TasunSelfHealV5/R268, UI, permission checks, formal rows, and sync behavior.
- SelfHeal remains bounded, cooled down, abortable.
- Keep two separate review branches; no merge or production deployment in this task.

## Review focus
- Chinese paths in Git diff must not skip a release.
- Verification must be read-only, must reject stale sequences/digests, and must not depend on changed-file selection.
- One formal document page change must produce an internally consistent four-page artifact.
- Duplicate document numbers must select the canonical stage, including legacy events without stage records.
- Hidden/BFCache/auth changes must invalidate old render tickets and queued heavy work.

## Task 1: release consistency
- [ ] RED: tests/release-contract.test.mjs exercises publisher via temporary repositories: quoted paths, verify-only rejection/no writes, four-page closure, aliases/hash/rebuild parity, repeat verification.
- [ ] GREEN: fix existing publish-version_tasun_project_autoscan.mjs and .github/workflows/release-version.yml. Remove forbidden Pages configuration PUT; validate existing configuration and explain required admin setup. Do not expand credentials.
- [ ] Verify all release tests plus actual repository artifact in a disposable copy. Add PR-only read-only CI. Document Pages prerequisites.
- [ ] Commit and create independent PR targeting main.

## Task 2: stage jump + lifecycle regression
- [ ] RED: tests/stage-jump.test.cjs executes existing manager metadata and detail scoring with duplicate stage numbers; tests legacy and stage-backed events.
- [ ] GREEN: normalize canonical stage type/sequence in the existing r949 context/metadata flow, preserving display labels and locator fields.
- [ ] Add tests/r1122-lifecycle.test.cjs executing existing lifecycle/ticket/HeavyLane functions. Run all tests and embedded-script syntax checks.
- [ ] Commit and create independent PR targeting main (merge after release PR; publisher regenerates artifacts at release).

## Retirement
- Close #1 as empty/misplaced/superseded.
- Close #3 after confirming core fixes already in R1139.
- Close #2 only after replacement PR explicitly tracks unresolved review and passes its regression tests.

## Evidence / ledger
- main is unchanged at start; clean isolated clone and feature branch, no AGENTS.md or pre-existing test suite found.
- Job 113288731048 logs: quoted Chinese paths caused publisher no-op; --verify-only also no-op; Pages PUT returned 403 Resource not accessible by integration.
- Ruling: execute the already-authorized plan without an additional approval round. Full R1122 spec unavailable, so report targeted regression scope honestly.
- Task 1 implementation: initial 8 behavioral tests RED (0/8) -> GREEN; workflow checks additionally passed.
- Independent review found missing fixed aliases, manual one-page version preservation, and artifact-size verification gaps. All reproduced RED and fixed in existing publisher; conflicting manual versions now fail closed before writes. Final release suite: 14/14.
- Metadata normalized at existing R1139; no functional HTML modifications. Actual four-page --verify-only passes. Pages source still requires administrator configuration; no deployment attempted.
