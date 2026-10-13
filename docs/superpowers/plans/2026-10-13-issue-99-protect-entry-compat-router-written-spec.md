# Issue #99 — Written Spec: Protect Externally Addressable entry.html Compatibility Router

Date: 2026-10-13  
Issue: #99 — `[REQ] Protect externally addressable entry.html compatibility router`  
Approved architecture: **Option A**  
Pre-spec main baseline: `51420ee74131d904ec84768e30ef8e582fef814d`  
Implementation comparison baseline: **the `main` SHA immediately after this written-spec PR is merged**  
Formal build at specification time: `20261013_tasun_v5_xidong_docs_r1155_6496a23cb51e_release`  
Release sequence at specification time: `1155`  
Status: **WRITTEN SPEC DRAFTED / IMPLEMENTATION-TDD NOT YET AUTHORIZED**

## 1. Goal

Protect root `entry.html` as an externally addressable compatibility router.

The file has zero internal filename references, but that does not make it an orphan because it is directly addressable and contains active runtime behavior:
- target selection from query/hash/storage;
- session bridge propagation;
- version query propagation;
- redirect using `location.replace(...)`.

The goal is to prevent a future cleanup from incorrectly deleting or behaviorally rewriting this compatibility entry surface solely because repository-reference count is zero.

## 2. Non-goal

This Issue does **not** authorize:
- UI redesign;
- navigation redesign;
- target-page changes;
- login/auth semantic changes;
- session-key renaming;
- new routing authority;
- removal of `entry.html`;
- modification of `index.html`;
- release/publisher/workflow changes;
- cloud/data/storage changes.

## 3. Authorized implementation scope

Only this implementation change is authorized:

- add:
  - `tests/issue-99-protect-entry-compat-router.test.cjs`

No production file change is authorized unless the written spec is formally amended.

## 4. Explicit locked production scope

The following must remain blob-identical from post-spec implementation baseline to final head:

- `entry.html`
- `index.html`
- `inline.js`
- `tasun-api/index.html`
- `tasun-auth-v4.js`
- `tasun-cloudwrap-v4.js`
- `tasun-core.js`
- `tasun-boot.js`
- `tasun-global-core.js`
- `tasun-guard-v5.js`
- `tasun-version.json`
- `tasun-resources.json`
- `publish-version_tasun_project_autoscan.mjs`
- `.github/workflows/release-version.yml`
- `.github/workflows/tasun-pr-checks.yml`
- `.github/workflows/r1144-tests.yml`
- `汐東工程管理表.html`
- `捷運汐東線權責分工精簡版.html`
- `捷運汐東線事項記錄.html`
- `捷運汐止東湖線統包工程-資料庫.html`
- `汐東收發文明細表.html`
- `汐東收發文登錄表.html`
- `汐東文件統計表.html`
- `汐東文件管理表.html`

Current storage/data schemas and persisted behavior are also locked.

## 5. TDD strategy

Because this Issue protects existing behavior rather than changing production behavior, TDD uses a **characterization RED** pattern.

### 5.1 RED — deliberately incomplete protection contract

Create only:

`tests/issue-99-protect-entry-compat-router.test.cjs`

The first RED commit must intentionally include one protection assertion expected to fail against the current source **without modifying production**.

The failure must be caused by the test demanding an explicit protection marker/contract artifact that does not yet exist in the test suite, not by changing `entry.html`.

Required RED pattern:
- Contracts A/B/C/D characterize current `entry.html` behavior and must pass in RED;
- separate Contract E — protection-completion marker — intentionally fails in the RED commit because the focused test is not yet finalized;
- GREEN is achieved by completing only the focused test file itself so Contract E passes;
- Contract E must not duplicate or replace any runtime characterization contract.

The RED design must not require or incentivize a production edit merely to make the test fail.

## 6. Required compatibility contracts

The final focused regression must protect at least the following.

### Contract A — entry surface remains present and auto-executes

Assert:
- root `entry.html` exists;
- it is an HTML file;
- it contains the Tasun entry router script;
- the router exposes `window.__TASUN_ENTRY_GO__ = go` as currently implemented;
- evaluating/loading the entry script automatically invokes the router through the unconditional terminal `go();` call;
- deleting the automatic invocation while leaving `go()` defined must fail this contract, because direct navigation to `entry.html` must continue to bridge and redirect without an external caller.

### Contract B — target routing contract remains intact

Assert the current routing surface includes:
- default target `汐東工程管理表.html`;
- allowlisted targets:
  - `汐東工程管理表.html`
  - `捷運汐東線權責分工精簡版.html`
  - `捷運汐東線事項記錄.html`
  - `捷運汐止東湖線統包工程-資料庫.html`
  - `捷運汐止東湖線統包工程-資料明細表.html`
  - `index.html`;
- query aliases `next`, `to`, `page`;
- stored-routing read logic remains present in `pickTarget()` for both `sessionStorage` and `localStorage`, including `tasun_entry_next_v1` and `tasun_next_path_v1`;
- hash routing input matching `next`, `to`, or `page` remains present;
- runtime execution order remains current-compatible: `go()` calls `bridge()` before `pickTarget()`;
- `bridge()` removes `tasun_entry_next_v1` and `tasun_next_path_v1` from both stores before `pickTarget()` executes;
- therefore, in the current externally executed flow, a storage-only routing hint is cleared before target selection and falls through to the default target, while a hash fallback can still be used after storage cleanup;
- query routing remains highest externally effective priority because query values are read directly by `pickTarget()` after `bridge()`;
- fallback to default target remains when no effective request resolves to an allowed/remapped target.

The focused test must characterize both the presence of the stored-routing branch and the actual end-to-end ordering that currently makes those stored hints ineffective after `bridge()` cleanup. It must not falsely assert that storage-only hints currently route externally.

Also protect the current legacy remapping branch before allowlist fallback:
- any decoded request containing `汐東工程管理表` is forced to `汐東工程管理表.html`;
- any decoded request containing `捷運汐止東湖線` is forced to `汐東工程管理表.html`;
- any decoded request containing `捷運汐東線管理` is forced to `汐東工程管理表.html`;
- this remapping occurs before the `ALLOW[b]` fallback check;
- therefore even allowlisted filenames whose decoded request contains `捷運汐止東湖線` are currently remapped to the default page rather than resolving to themselves.

This Issue protects the existing allowlist, actual execution order, stored-branch presence, hash/query behavior, and legacy remapping. It does not authorize adding/removing destinations, changing the ordering, or fixing the stored-routing quirk.

### Contract C — session bridge compatibility remains intact

Protect current session bridge source-key order:
- `tasunCurrentUser_v1`
- `tasunSessionBridge_v1`
- `tasunSession_v1`
- `tasunSso_v2`
- `tasunSso_v1`

The test must characterize the current bridge algorithm, not merely key-name presence:
- the router searches the above keys in the current precedence order;
- it reads from `sessionStorage` first and then `localStorage` for each key;
- the first non-empty value becomes the bridge source;
- when a bridge value is found, that same value is written to **every** bridge key in both `sessionStorage` and `localStorage`;
- removal of either storage-scope fan-out must fail the contract;
- reordering the source-key precedence must fail unless the written spec is amended.

Protect current cleanup keys and behavior:
- `tasun_next_path_v1`
- `tasun_entry_next_v1`
- `tasun_child_jump_lock_v1`
- each is removed from both `sessionStorage` and `localStorage`.

Protect current session markers and values:
- `tasunIndexSession_v1` is set to `1` in `sessionStorage`;
- `tasunIndexSessionAuthed_v2` is set to `1` in `sessionStorage`.

### Contract D — redirect/version behavior remains intact

Assert:
- routing uses `location.replace(...)`;
- version source selection preserves the exact current first-nonempty precedence:
  1. URL query parameter `v`;
  2. `window.__CACHE_V`;
  3. `window.TASUN_APP_VER`;
  4. `window.APP_VER`;
- each fallback source is independently covered so removal or reordering fails the contract;
- version is propagated via `out.searchParams.set('v', v)` when the resolved version is non-empty;
- cache-busting query `_` is always added before redirect;
- no new window-opening/navigation mechanism replaces the current `location.replace(...)` redirect contract.

## 7. RED acceptance

The RED run must show:
- Contracts A/B/C/D — all characterization assertions that describe current production behavior — pass;
- exactly Contract E, the deliberately incomplete Issue #99 protection-completion assertion, fails;
- all pre-existing tests remain green;
- no production file differs from baseline.

If any characterization assertion fails against current `entry.html`, stop and amend the spec because the intake assumptions are wrong.

## 8. GREEN implementation

GREEN is achieved by editing **only**:

`tests/issue-99-protect-entry-compat-router.test.cjs`

Complete the focused protection contract so all Issue #99 assertions pass.

No production file edit is allowed.

## 9. Full regression gate

Run full repository regression suite.

Required:
- all tests PASS;
- Issue #99 focused contracts PASS;
- no existing regression weakened or removed.

Record run ID and counts.

## 10. Disposable exact-release gate

Run existing disposable exact-release verification.

Required:
- PASS;
- post-disposable regression PASS if performed;
- no formal PR-branch deployment.

Because no production/release file changes are authorized, Issue #99 tests must tolerate legitimate temporary disposable release metadata progression.

## 11. Semantic diff gate

Compare final implementation branch against post-spec implementation baseline.

Allowed changed path only:
- `tests/issue-99-protect-entry-compat-router.test.cjs`

No production file may differ.

Any additional path is scope drift and blocks merge unless the written spec is amended.

## 12. Locked-file audit

Compare blob SHA baseline vs final head for every file in Section 4.

Required:
- all production/authority files blob-identical.

This includes `entry.html` itself.

## 13. Independent review gate

Request Codex review on exact final head.

Review focus:
- whether the test actually protects externally addressable entry compatibility rather than merely filename presence;
- whether routing/default/allowlist/session bridge/redirect/version behavior are characterized accurately;
- whether any production file changed;
- whether the test is brittle in a way that would block legitimate non-behavioral formatting changes without reason;
- whether scope is exactly one focused regression file.

All valid findings must be addressed and re-reviewed before merge.

## 14. Merge policy

Merge only after:
- final CI GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked-file audit exact;
- independent review clear;
- no unresolved valid review thread.

Prefer rebase merge if repository disallows merge commits.

## 15. Post-merge behavior

Because this Issue changes tests only:
- Exact Auto Release is expected not to trigger;
- no generated release metadata commit is expected;
- formal build/releaseSequence should remain R1155 / 1155 unless an unrelated legitimate workflow changes it.

No manual version edit is authorized.

## 16. Post-merge verification

After merge:

1. verify merge SHA on `main`;
2. verify `entry.html` blob SHA is unchanged from implementation baseline;
3. verify focused Issue #99 test exists on main;
4. verify all locked production files remain unchanged;
5. check whether Exact Auto Release triggered;
6. if not triggered, record explicit not-triggered result;
7. verify `tasun-version.json` remains unchanged;
8. verify formal build/releaseSequence remain current authority.

## 17. Closure evidence required on Issue #99

Record:
- architecture approval date;
- written-spec approval date;
- pre-spec baseline SHA;
- post-spec implementation comparison baseline SHA;
- RED commit/run/counts;
- proof characterization contracts passed and only deliberate protection-completion assertion failed;
- GREEN/final head;
- full regression run/counts;
- disposable exact-release result;
- semantic diff result;
- locked-file audit result;
- Codex final review result;
- merge SHA;
- post-merge release trigger result;
- final `entry.html` blob SHA;
- final `tasun-version.json` blob/build/releaseSequence.

Close only after all acceptance items pass.

## 18. Governance gate

Current gate:

- [x] Architecture Option A explicitly approved by user on 2026-10-13
- [x] Written spec drafted
- [ ] Written spec explicitly approved by user
- [ ] Implementation / TDD authorized

**Stop at the written-spec approval gate. Implementation begins only after explicit written-spec approval.**
