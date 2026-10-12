# Issue #67 — Retire Orphan Legacy Dropbox Store Authority

Status: **OPTION A ARCHITECTURE APPROVED / WRITTEN SPEC IN PROGRESS**

Issue: #67  
Baseline main: `702c1ba5eae351e3646ebf7bdefa0238ecb78a3d`  
Formal build: `20261012_tasun_v5_xidong_docs_r1153_1a82f9970b1a_release`  
releaseSequence: `1153`

## 1. Problem boundary

Latest-main tracing confirms one dormant executable Dropbox authority remains:

- `tasun-store-dropbox.js`

This requirement is limited to retiring that verified-unreferenced authority. It is not a redesign of current cloud synchronization.

## 2. Verified current evidence

`tasun-store-dropbox.js`:
- exports/reuses `window.TasunDropboxStore`;
- can read a Dropbox token from localStorage or injected getter;
- directly calls Dropbox API v2 download/upload/get_metadata;
- loads a resource registry;
- maintains payload caches;
- implements cooperative lock files;
- maintains lock TTL / heartbeat state;
- watches remote revisions;
- writes JSON directly to Dropbox paths.

Repository-wide searches show:
- `tasun-store-dropbox.js` filename only in this file;
- `TasunDropboxStore` only in this file.

Neither `tasun-resources.json` nor `tasun-version.json` references this module.

No current HTML/runtime loader has been found that loads it.

## 3. Current supported authority

Current Tasun v5 cloud/data ownership remains with supported current paths, including:
- `tasun-cloud-kit.js`;
- `tasun-cloudwrap-v4.js` where applicable;
- current page-owned D1/Dropbox synchronization;
- current Worker/auth/session contracts;
- current page lifecycle and migration sequencing.

Issue #64 retired the orphan Cloud Page v1 sidecars and left these current authorities unchanged.

## 4. Risk

If accidentally reintroduced, this dormant file can create a second Dropbox ownership path:
- direct Dropbox read/write independent of current page lifecycle;
- independent lock and heartbeat behavior;
- independent resource-registry/cache semantics;
- remote revision watching outside current sequencing;
- potential split-brain synchronization and stale-data overwrite.

The architectural concern is dormant executable authority, not current production usage.

## 5. Option A — retire the orphan Dropbox store authority

Recommended.

Delete:
- `tasun-store-dropbox.js`

Add focused regression that proves:
- file absent;
- no live runtime source defines or consumes `TasunDropboxStore`;
- no active HTML/resource/workflow references the retired filename;
- current supported cloud authority files remain present and unchanged.

Do not add a compatibility shim.

## 6. Option B — retain dormant compatibility authority

Not recommended.

Retention preserves:
- direct Dropbox token handling;
- direct Dropbox write capability;
- second lock/heartbeat implementation;
- second revision-watch path;
- future reintroduction risk without a proven consumer.

No current compatibility need is demonstrated.

## 7. Architectural invariants

1. No change to `tasun-cloud-kit.js`.
2. No change to `tasun-cloudwrap-v4.js`.
3. No change to Worker/auth/session behavior.
4. No change to current page-owned D1/Dropbox synchronization.
5. No change to `權限表.html`.
6. No change to `捷運汐東線事項記錄.html`.
7. No change to `tasun-resources.json`.
8. No manual `tasun-version.json` mutation.
9. No compatibility global or loader for `TasunDropboxStore`.
10. No relocated direct-Dropbox lock/watch logic.

## 8. Expected implementation scope after approval

Expected manual changes:
- delete `tasun-store-dropbox.js`;
- add `tests/issue-67-retire-dropbox-store.test.cjs`.

No other production file should require modification.

If a real current consumer is found during re-sync, stop and return for architecture amendment.

## 9. TDD direction

### RED
Before deletion:
- assert `tasun-store-dropbox.js` must be absent;
- assert no live runtime source supplies `TasunDropboxStore`;
- assert no current HTML/resource/workflow references the filename;
- assert current supported cloud authority files remain present.

Expected RED: failure caused by the existing orphan file/global.

### GREEN
Delete only `tasun-store-dropbox.js`.

Then require:
- focused GREEN;
- full regression GREEN;
- disposable exact-release GREEN;
- semantic diff exact;
- locked current cloud authority blobs unchanged;
- independent Codex review clear.

## 10. Release expectation

Deleting this JS file may trigger the Exact Auto Release workflow by path filter.

Expected autoscan behavior:
- no formal four-page/core/manifest change attributable to Issue #67;
- no generated production release identity;
- formal build remains R1153;
- releaseSequence remains 1153;
- read-only exact release verification passes.

Post-merge workflow behavior must be verified from actual logs.

## 11. Failure boundaries

Return to architecture if:
- any current HTML/runtime/workflow actually loads `tasun-store-dropbox.js`;
- another live source depends on `TasunDropboxStore`;
- deletion requires changing current cloud-kit/page/Worker/auth behavior;
- another dormant module must be changed to avoid breakage;
- release behavior contradicts the expected publisher contract in a way that requires production changes.

## 12. Recommendation

**Approve Option A — delete the verified-unreferenced `tasun-store-dropbox.js` authority and add regression protection, while leaving the current Tasun v5 cloud chain unchanged.**

Option A architecture was explicitly approved by the user on 2026-10-12. Implementation remains blocked until the written-spec gate is explicitly approved.
