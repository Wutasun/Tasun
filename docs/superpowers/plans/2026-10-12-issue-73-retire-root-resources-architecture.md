# Issue #73 — Architecture: Retire Orphan Legacy Root resources.json Manifest

Date: 2026-10-12  
Issue: #73 — `[REQ] Retire orphan legacy root resources.json manifest`  
Baseline main: `d426bf83b20759a4c9e408501a465eb19a91f1fd`  
Formal build: `20261012_tasun_v5_xidong_docs_r1154_425da05a1ae8_release`  
Release sequence: `1154`  
Status: ARCHITECTURE OPTION A APPROVED / WRITTEN SPEC IN PROGRESS / NO IMPLEMENTATION AUTHORITY

## 1. Problem

The repository still contains a root `resources.json` file with older cloud resource configuration concepts.

Latest-main evidence shows:
- the file still exists;
- exact repository search for standalone `resources.json`, excluding `tasun-resources.json`, finds zero references;
- supported current resource consumers reference `tasun-resources.json`;
- the current release publisher recognizes `tasun-resources.json` as the core resource manifest and does not recognize root `resources.json`.

The root file therefore appears to be dormant legacy configuration rather than current authority.

## 2. Current supported authority

Retained authority is:
- `tasun-resources.json`;
- current cloud-kit/cloudwrap consumers;
- current page-owned resource configuration;
- current Worker behavior;
- `tasun-version.json` and the Exact Auto Release chain.

## 3. Option A — retire root resources.json

Delete:
- `resources.json`

Add focused regression proving:
- root `resources.json` is absent;
- no live source references standalone root `resources.json`;
- `tasun-resources.json` remains present;
- current supported consumers still reference `tasun-resources.json`.

Advantages:
- removes a second-looking resource manifest;
- prevents accidental future revival of legacy configuration ownership;
- establishes one obvious supported resource-manifest authority.

Risk:
- an external or hidden consumer could depend on the public file despite no repository reference.

Mitigation:
- repeat latest-main search before RED;
- full regression;
- disposable exact-release;
- semantic diff and locked-file audit;
- independent review;
- post-merge release verification.

## 4. Option B — retain dormant legacy manifest

Keep root `resources.json`.

Advantage:
- zero file deletion risk.

Disadvantages:
- leaves ambiguous duplicate resource-manifest naming;
- preserves stale configuration surface;
- increases chance of future accidental reuse.

## 5. Recommendation

**Recommend Option A.**

Repository-owned current runtime and release authority converge on `tasun-resources.json`; no current repository consumer of root `resources.json` is proven.

## 6. Scope boundary

Approved Option A scope is limited to:
- delete `resources.json`;
- add one focused regression test.

Explicit no-change:
- `tasun-resources.json`;
- `tasun-cloud-kit.js`;
- `tasun-cloudwrap-v4.js`;
- `tasun-auth-v4.js`;
- `tasun-api/worker.js`;
- `index.html`;
- `inline.js`;
- `tasun-api/index.html`;
- formal four document pages;
- `tasun-version.json`;
- publisher/workflow;
- storage/data schemas.

If a real consumer is discovered, stop and amend architecture.

## 7. Release expectation

No manual version mutation is authorized.

The normal Exact Auto Release pipeline decides whether the deletion is release-relevant. Actual post-merge build/sequence behavior must be verified rather than predicted or forced.

## 8. Governance

This Issue inherits:
`docs/superpowers/TASUN-AUTO-PROGRESSION-GOVERNANCE.md`

Architecture Option A was explicitly approved by the user on 2026-10-12.

Current gate:
- [x] architecture Option A approved
- [ ] written spec explicitly approved
- [ ] implementation / TDD authorized

Written spec drafting may proceed automatically. Implementation remains blocked until the written spec is explicitly approved and the synchronized governance record is merged to `main`.
