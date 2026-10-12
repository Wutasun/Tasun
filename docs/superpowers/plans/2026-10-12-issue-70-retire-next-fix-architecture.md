# Issue #70 — Architecture: Retire No-op tasun-next-fix Bootstrap Marker

Date: 2026-10-12  
Issue: #70 — `[REQ] Retire no-op tasun-next-fix bootstrap marker`  
Baseline main: `cd00217307e33f5509d1835d3fc57dd7b0f9badd`  
Formal build: `20261012_tasun_v5_xidong_docs_r1153_1a82f9970b1a_release`  
Status: ARCHITECTURE OPTION A APPROVED / WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED

## 1. Problem

`tasun-next-fix.js` remains in the active bootstrap chain although the file only assigns:

```js
window.__TASUN_NEXT_FIX__ = { version: '20260420_tasun_v5_corepack_r1' };
```

Latest-main tracing confirms active loader references in:
- `index.html`
- `inline.js`
- `tasun-api/index.html`

No current consumer of `__TASUN_NEXT_FIX__` has been found.

## 2. Current authority model

Supported current bootstrap/runtime authority remains with:
- version loader/current version metadata;
- `tasun-cloudwrap-v4.js`;
- `tasun-auth-v4.js`;
- `tasun-guard-v5.js`;
- `tasun-core.js`;
- current page-owned runtime initialization.

The legacy marker has no demonstrated current responsibility in that chain.

## 3. Option A — retire marker and loader calls

Delete:
- `tasun-next-fix.js`

Remove only the `loadOnce('tasun-next-fix', ...)` call from:
- `index.html`
- `inline.js`
- `tasun-api/index.html`

Add focused regression asserting:
- file absent;
- no live source references `tasun-next-fix.js`;
- no live source defines/consumes `__TASUN_NEXT_FIX__`;
- cloudwrap/auth/guard/core loader order otherwise remains present and unchanged.

### Benefits
- removes an obsolete blocking bootstrap fetch;
- removes a misleading compatibility/global authority surface;
- reduces three-way loader maintenance;
- prevents future code from attaching behavior to a stale marker.

### Risk
- hidden consumer not found by tracing.

Mitigation:
- full repository search before TDD RED;
- focused regression;
- full Tasun regression;
- disposable exact-release;
- semantic and locked-file audits;
- independent review.

## 4. Option B — retain dormant compatibility marker

Keep the file and three loader calls.

This avoids any change to loader surfaces but preserves a no-op global and unnecessary fetch with no verified consumer.

## 5. Recommendation

**Option A — approved by user on 2026-10-12.**

The marker is active only as a loaded no-op artifact. Retirement is narrower and more deterministic than continuing to preserve an unused compatibility surface.

## 6. Scope boundary

Approved architecture scope:
- delete `tasun-next-fix.js`;
- remove exactly its three loader calls;
- add one focused regression test.

Do not redesign:
- auth;
- cloud;
- guard;
- core;
- current version authority;
- Worker/data schemas;
- formal document page behavior;
- release publisher/workflow.

If any real consumer is discovered, stop and amend architecture.

## 7. Release expectation

Because `index.html` is in scope, the normal exact-release pipeline may legitimately classify the change as release-relevant. No manual version mutation is authorized; actual publisher behavior must be accepted from the normal workflow and verified post-merge.

## 8. Approval record

- [x] Option A architecture explicitly approved by user on 2026-10-12
- [x] written spec explicitly approved by user on 2026-10-12
- [x] implementation / TDD authorized after governance PR merge

Written spec is explicitly approved. Implementation / TDD is authorized after this synchronized governance record is merged to `main`.

This Issue follows the project-wide rule in `docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md`.
