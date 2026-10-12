# Issue #61 — Navigation / Permission Target Topology Architecture

Status: **OPTION A ARCHITECTURE APPROVED / WRITTEN SPEC IN PROGRESS**

Issue: #61  
Baseline main: `adc510e80ca52b6affa4302b6e726e12c188ec56`  
Formal build: `20261012_tasun_v5_xidong_docs_r1152_70f1b5421b9c_release`  
releaseSequence: `1152`

## 1. Problem boundary

Issue #56 fixed manifest authority so every deployed `pages[*].file` resolves to a deployed artifact file. It explicitly deferred a separate user-facing navigation problem.

Latest-main tracing confirms that `權限表.html` still holds active entry/button defaults that point to nonexistent or retired pages. Some stale names also originate in `tasun-resources.json`, so a local one-file string cleanup would not establish durable convergence.

This issue is about **navigation / permission topology authority**, not manifest page authority.

## 2. Current authority chain

Current permission/navigation path is:

`tasun-resources.json::resources.tasun-auth-table`
→ `權限表.html::loadResourcesForAuthTable()`
→ dynamic entry/button merge
→ `tasunEntryRegistry_v1` / `tasunNavButtons_v1` / `tasunRoutes_v1`
→ permission-entry UI / user navigation.

`權限表.html` also contains built-in fallback authority:
- `DEFAULT_ENTRY_FILES`
- `DEFAULT_ENTRY_BUTTONS`
- migration logic for managed permission definitions.

`汐東文件管理表.html` is a consumer/repair authority for current document-manager buttons and explicitly removes the retired reply-register route.

Therefore topology must converge across the existing sources; no new route registry should be added.

## 3. Verified stale production targets

The following are real active-source mismatches, not example comments:

### Legacy official-document names
- `收發文明細表.html` — missing; canonical current page is `汐東收發文明細表.html`.
- `收發文登錄表.html` — missing; canonical current page is `汐東收發文登錄表.html`.
- `回覆文登錄表.html` — missing; no current supported reply-register page.
- `汐東回覆文登錄表.html` — missing; `汐東文件管理表.html` explicitly retires its route.

### Inspection topology
- `捷運汐止東湖線-查驗管控表.html` — missing legacy combined target.
- Current supported split pages exist:
  - `捷運汐止東湖線-施工查驗管控表.html`
  - `捷運汐止東湖線-材料查驗管控表.html`

### Record-page alias
- `捷運汐東線記事.html` — missing legacy alias.
- Current supported page exists: `捷運汐東線事項記錄.html`.
- `tasun-resources.json` already treats `捷運汐東線記事.html` as an alias under the `sxdh-notes` resource, but the auth-table entry list still exposes the missing filename.

### Water/environment document-control pages
These names are present in active auth-table entry sources but the files do not exist:
- `捷運汐東線審查文件管制查詢表-水環組.html`
- `捷運汐東線審查文件管制登錄表-水環組.html`
- `捷運汐東線審查文件管制表-水環組.html`

No current repository file with those exact page identities exists.

## 4. Non-production strings excluded from scope

Do not classify examples/comments as broken navigation:
- `xx.html`
- `yy.html`
- `新頁面.html`
- placeholder help text such as “其他／請輸入檔名”.

Tests must distinguish executable/default data structures from documentation examples.

## 5. Architectural invariants

1. One existing navigation/permission authority chain remains authoritative.
2. No compatibility HTML is recreated solely to preserve obsolete names.
3. Current canonical page files remain unchanged unless tracing proves a consumer-side correction is required.
4. Existing role semantics and explicit permission settings are preserved for surviving page/button identities.
5. Runtime storage migration must remove or normalize stale defaults rather than rehydrate them.
6. `tasun-resources.json` and `權限表.html` must not disagree on supported entry topology.
7. `汐東文件管理表.html` must not be forced to restore the already-retired reply-register route.
8. No manual `tasun-version.json` edit.
9. No second router, polling loop, or SelfHeal authority.
10. Any HTML mutation follows normal Exact Auto Release.

## 6. Option A — converge existing authorities to current topology

Recommended.

### A1. Normalize unambiguous renamed targets

Where there is exactly one current supported replacement:
- `收發文明細表.html` → `汐東收發文明細表.html`
- `收發文登錄表.html` → `汐東收發文登錄表.html`
- `捷運汐東線記事.html` → `捷運汐東線事項記錄.html`

Normalization should happen at the current default/resource authority rather than by adding redirect pages.

### A2. Retire unsupported routes

Remove from live entry/button defaults:
- `回覆文登錄表.html`
- `汐東回覆文登錄表.html`

Do not add a replacement unless a current supported reply-register workflow is independently proven.

### A3. Converge inspection topology

Retire the missing combined `捷運汐止東湖線-查驗管控表.html` authority.

Preserve the current explicit split:
- construction inspection;
- material inspection.

Permission keys already associated with current split pages should remain the authoritative controls.

### A4. Retire unsupported water/environment page entries

Remove the three nonexistent water/environment document-control page names from auth-table entry sources unless implementation tracing finds an existing current canonical page identity that is semantically and operationally equivalent.

Do not guess replacements from labels alone.

### A5. Update both source layers where required

Because `tasun-resources.json` feeds `權限表.html`, update both where the same stale entry is represented.

The implementation should avoid changing `汐東文件管理表.html` unless RED tracing proves its current cleanup logic cannot prevent a stale value from surviving/returning after the source changes.

### A6. Migration behavior

Existing local/cloud-stored navigation values may already contain retired names.

Use the existing migration/normalization path in `權限表.html`:
- preserve explicit permissions for canonical surviving identities;
- remap clear aliases;
- delete unsupported retired route identities;
- do not overwrite unrelated administrator settings.

No second migration subsystem.

## 7. Option B — recreate compatibility HTML/shims

Rejected recommendation.

This would:
- restore public files intentionally retired by earlier cleanup;
- expand Pages surface;
- create parallel page identities;
- weaken Issues #51/#56 topology convergence;
- require ongoing version/auth/redirect maintenance.

## 8. TDD strategy after approval

### RED
Add an Issue #61 regression that reads the actual source files and proves:
1. production auth-table sources currently contain missing targets;
2. comment/example-only filenames are ignored;
3. resources and built-in defaults can currently disagree with repository topology;
4. the retired reply-register route can still be represented by `權限表.html` defaults.

RED must be captured before production mutation.

### GREEN
Modify only the source files proven necessary by RED/trace:
- expected: `權限表.html`;
- expected where duplicated: `tasun-resources.json`;
- `汐東文件管理表.html` only if tracing proves required.

Then require:
- every production auth-table entry target resolves to an existing supported deployed page or an explicitly non-file control;
- no stale legacy reply-register target;
- no legacy combined inspection target;
- current construction/material pages remain;
- clear alias normalization is exact;
- role and permission keys for surviving current pages remain stable.

## 9. Release expectations

Changing `權限表.html` is a changed HTML input and is therefore release-relevant to the autoscan.

Expected post-merge behavior:
- next formal release identity generated by existing publisher;
- no manual R-number;
- current four-page exact group remains coherent;
- `權限表.html` gets a current page entry/version through existing autoscan behavior;
- deployed artifact contains only supported navigation targets.

## 10. Failure boundaries

Stop and amend architecture if implementation tracing finds any of the following:
- a missing filename is still intentionally served by a non-repository deployment path;
- water/environment entries have a current canonical replacement not identified during intake;
- changing auth-table defaults would overwrite administrator-defined explicit permissions;
- `tasun-resources.json` is not actually authoritative at runtime;
- a second page/router authority is required;
- current inspection split depends on the legacy combined name for persisted migration.

## 11. Acceptance gate

Architecture approval authorizes only written-spec drafting.

Implementation remains blocked until:
- [x] Option A architecture explicitly approved by user on 2026-10-12;
- [ ] written spec completed;
- [ ] written spec explicitly approved;
- [ ] governance PR merged.

## 12. Recommendation

**Approve Option A — converge existing live navigation/permission authorities to the actual deployed topology, normalize only unambiguous aliases, and retire unsupported legacy targets without recreating public compatibility pages.**
