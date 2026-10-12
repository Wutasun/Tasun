# Issue #64 — Retire Orphan Cloud Page v1 Sidecar Authority

Status: **OPTION A ARCHITECTURE APPROVED / WRITTEN SPEC IN PROGRESS**

Issue: #64  
Baseline main: `bff489872d7bf7ffb223b31c824ec65ef2c2318d`  
Formal build: `20261012_tasun_v5_xidong_docs_r1153_1a82f9970b1a_release`  
releaseSequence: `1153`

## 1. Problem boundary

Latest-main tracing confirms two Cloud Page v1 sidecar files remain in the repository:

- `tasun-cloud-page-v1.js`
- `tasun-cloud-pages.v1.json`

Neither has a current consumer.

This requirement is limited to dormant Cloud Page v1 authority retirement. It is not a redesign of current cloud synchronization.

## 2. Verified current evidence

### 2.1 Executable sidecar

`tasun-cloud-page-v1.js`:
- exports `window.TasunCloudPageV1`;
- reads `window.TASUN_CLOUD_V1`;
- dynamically loads `tasun-cloud-kit.js`;
- mounts a cloud controller;
- defaults to `watch.intervalSec = 10`;
- automatically performs a pull;
- can reload after apply;
- creates `window.__tasunCloudCtrl__`.

Repository-wide searches find:
- `TASUN_CLOUD_V1` only in this file;
- `TasunCloudPageV1` only in this file;
- `__tasunCloudCtrl__` only in this file;
- the filename itself only in this file.

Therefore the executable sidecar is dormant.

### 2.2 Mapping sidecar

`tasun-cloud-pages.v1.json` declares mappings for:
- `捷運汐東線事項記錄.html`
- `權限表.html`

Repository-wide search finds no loader or consumer for this JSON file.

Neither candidate is referenced by:
- `tasun-resources.json`;
- `tasun-version.json`;
- current HTML runtime loaders;
- current release workflow.

## 3. Current supported authority

Current cloud behavior is owned by existing Tasun v5/current paths, including:
- `tasun-cloud-kit.js`;
- current page-owned D1/Dropbox/cloud load/apply logic;
- current page lifecycle and migration sequencing;
- `tasun-cloudwrap-v4.js` where applicable.

Issue #61 specifically stabilized current permission/cloud migration behavior without any dependency on Cloud Page v1.

## 4. Risk

Even dormant executable sidecars are authority surfaces.

If `tasun-cloud-page-v1.js` is accidentally reintroduced into a page, it can:
- mount another cloud controller;
- start a periodic 10-second watch;
- pull/apply independently from current page lifecycle;
- trigger reload after cloud apply;
- create a second synchronization owner.

The JSON mapping can also falsely imply that the two named pages still use this old Cloud Page v1 contract.

## 5. Option A — retire both orphan sidecars

Recommended.

Delete:
- `tasun-cloud-page-v1.js`
- `tasun-cloud-pages.v1.json`

Add a focused regression that proves:
- both files are absent;
- no live source defines `TASUN_CLOUD_V1`, `TasunCloudPageV1`, or `__tasunCloudCtrl__`;
- current supported cloud files remain present;
- no production HTML or resource file begins referencing a retired sidecar.

Do not add compatibility shims.

## 6. Option B — retain dormant sidecars

Not recommended.

Retention preserves:
- a second executable cloud-page authority surface;
- an obsolete page-to-cloud mapping contract;
- reintroduction risk without a proven consumer.

There is no current compatibility need demonstrated by latest-main tracing.

## 7. Architectural invariants

1. No change to current TasunCloudKit behavior.
2. No change to page-owned D1/Dropbox synchronization.
3. No change to current auth/session behavior.
4. No change to `權限表.html`.
5. No change to `捷運汐東線事項記錄.html`.
6. No change to `tasun-resources.json`.
7. No manual `tasun-version.json` mutation.
8. No compatibility loader or redirect for retired sidecars.
9. No new polling/synchronization authority.
10. Regression must prevent sidecar reintroduction.

## 8. Expected implementation scope after approval

Expected manual changes:
- delete `tasun-cloud-page-v1.js`;
- delete `tasun-cloud-pages.v1.json`;
- add `tests/issue-64-retire-cloud-page-v1-sidecars.test.cjs`.

No other production file should need modification.

If tracing finds a real current consumer, stop and return to architecture amendment.

## 9. TDD direction

### RED
Before deletion:
- assert both sidecar files must be absent;
- assert Cloud Page v1 globals/config symbols must not be supplied by live runtime sources;
- assert current supported cloud authority files exist.

Expected RED: failure caused by the two existing sidecar files.

### GREEN
Delete only the two verified-orphan sidecars.

Then require:
- focused GREEN;
- full regression GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked current cloud authority blobs unchanged;
- independent Codex review.

## 10. Release expectation

The JS deletion may trigger the Exact Auto Release workflow by path filter.

Expected autoscan behavior:
- no formal four-page/core/manifest content change attributable to Issue #64;
- no forced manual R-number;
- formal build should remain R1153 if the publisher correctly finds nothing release-relevant.

Post-merge workflow behavior must be explicitly verified rather than assumed.

## 11. Failure boundaries

Return to architecture if:
- any current HTML actually loads `tasun-cloud-page-v1.js`;
- any runtime reads `tasun-cloud-pages.v1.json`;
- current cloud behavior depends on `TASUN_CLOUD_V1`;
- deletion requires changes to current cloud-kit/page/Worker/auth behavior;
- deletion causes a functional release increment that is not explained by existing publisher rules.

## 12. Recommendation

**Approve Option A — delete both verified-unreferenced Cloud Page v1 sidecars and add regression protection, while leaving the current Tasun v5 cloud authority chain unchanged.**

Option A architecture was explicitly approved by the user on 2026-10-12. Implementation remains blocked until the written-spec gate is explicitly approved.
