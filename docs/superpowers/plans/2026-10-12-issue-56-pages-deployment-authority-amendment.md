# Issue #56 — Post-merge Architecture Amendment: Pages-deployment authority

Date: 2026-10-12  
Requirement: GitHub Issue #56 — `[REQ] Retire orphan manifest page authorities`  
Status: **APPROVED — OPTION A2**  
Functional R-number: **NOT ASSIGNED**  
Implementation authority: **BLOCKED pending amended written-spec approval**

## 1. Why the approved written spec cannot close yet

Issue #56 Option A successfully retired the three approved repository-missing manifest authorities.

Implementation PR #58 was merged and Exact Auto Release succeeded at the same formal R1152 identity.

However, the final GitHub Pages artifact audit exposed a second authority mismatch that the original architecture treated as a valid control case:

`pages["tasun-api/index.html"]`

The repository file exists, but the formal Pages release workflow explicitly excludes the entire directory:

`--exclude "tasun-api/"`

Therefore the deployed `tasun-version.json` still declares a page authority whose file is intentionally absent from the deployed Pages artifact.

## 2. Verified post-merge evidence

Current formal main after metadata-only normalization:

- main: `f878249cdaf72ada51ba86b559a44b4226206097`
- formal build: `20261012_tasun_v5_xidong_docs_r1152_70f1b5421b9c_release`
- releaseSequence: `1152`
- manifest page count: `42`
- previously approved three orphan keys: absent
- repository-missing page authorities: zero

Issue #56 release:

- implementation merge: `2b65d4fa400cf889664a8a2c7284a02118379e6b`
- Exact Auto Release run: `38248451114`
- attempt 1: SUCCESS
- fresh deployed verification attempt 2: SUCCESS
- fresh verify job: `114808841751`
- Pages artifact ID: `11746905417`
- artifact digest: `sha256:6798bad6fec2f5a415b167385cf4a42dbbe547806de4018342fefe9f5da9f329`

Artifact inspection:

- `tasun-api/index.html`: absent
- deployed manifest entry `pages["tasun-api/index.html"]`: present
- all other remaining non-empty `pages[*].file`: resolved inside the artifact
- four formal pages: present
- `TASUN_REBUILD` and `TASUN_REBUILD_STAMP`: present

Thus exactly one deployed missing-file authority remains.

## 3. Current tasun-api authority facts

Current manifest entry:

- key: `tasun-api/index.html`
- file: `tasun-api/index.html`
- pageKey: `tasun-api/index.html`
- version: R1149-era identity
- officialVersionSource: `tasun-version.json`

Repository tracing shows active exact-name references only in:

- historical/current governance docs;
- tests for the repository-local `tasun-api/index.html` source;
- `tasun-version.json`.

No current public navigation, formal page button, loader route, fetch, iframe, or Pages entry point was found that requires `tasun-api/index.html` to be a public Pages page.

The file itself may remain in the repository and remain testable as source code. The issue is specifically its classification as a public page authority in the deployed manifest.

## 4. Amendment options

### Option A2 — retire the non-deployed Pages authority

Remove only:

`manifest.pages["tasun-api/index.html"]`

Keep:

- repository file `tasun-api/index.html`;
- `tasun-api/worker.js`;
- existing Issue #29 / Issue #32 source-level tests;
- workflow exclusion `--exclude "tasun-api/"`;
- all supported HTML pages;
- all Worker/auth/cloud behavior.

Update the Issue #56 regression so page-authority validity means:

1. the declared source file exists in the repository; and
2. the file is part of the GitHub Pages deployment surface.

At the current workflow, any path under `tasun-api/` is not Pages-deployable and therefore must not appear in `tasun-version.json.pages`.

Expected final manifest page count: `41`.

### Option B2 — deploy tasun-api/index.html publicly

Modify the release workflow/package logic to include `tasun-api/index.html` while still excluding backend source such as `tasun-api/worker.js`.

This changes the public deployment surface and requires security review, selective packaging logic, release-workflow changes, new public-route verification, and ongoing support ownership.

### Option C2 — allow manifest page authorities for non-deployed files

Relax the Issue #56 artifact invariant and document `tasun-api/index.html` as a repository-only manifest authority.

This leaves deployed `tasun-version.json.pages` describing a page the deployed site cannot serve, weakening manifest/page authority semantics.

## 5. Approved architecture

**Option A2 is explicitly approved by the user on 2026-10-12.**

Rationale:

- the directory is intentionally excluded from Pages;
- no active public runtime consumer requires this page authority;
- the repository source and its tests remain unchanged;
- no workflow/security surface expansion is needed;
- deployed manifest becomes exact: every remaining page authority resolves to an artifact file;
- only one additional manifest key is retired;
- the formal build/releaseSequence remain unchanged through metadata-only release behavior.

## 6. Revised TDD contract

After amended written-spec approval:

1. branch from then-current latest `main`;
2. preserve all Issue #56 existing GREEN behavior except the obsolete nested-authority expectation;
3. repository source `tasun-api/index.html` must still exist;
4. `manifest.pages["tasun-api/index.html"]` must be absent;
5. deployment-surface regression must reject manifest page files under currently excluded Pages directories;
6. RED must prove the current manifest still contains the non-deployed authority;
7. GREEN removes exactly `pages["tasun-api/index.html"]`;
8. semantic manifest diff must prove exactly one key removal relative to the post-Issue-56 baseline;
9. repository `tasun-api/index.html` blob remains unchanged;
10. workflow remains unchanged;
11. full regression + disposable exact-release + independent review must pass.

## 7. Release contract

Manual implementation changes only:

- `tasun-version.json`;
- `tests/issue-56-orphan-manifest-authorities.test.cjs`.

Do not change:

- `.github/workflows/release-version.yml`;
- `tasun-api/index.html`;
- `tasun-api/worker.js`;
- formal four HTML pages;
- `權限表.html`;
- publisher;
- canonical rebuild files;
- Worker/auth/cloud behavior.

Expected post-merge behavior:

- metadata-only Exact Auto Release;
- same functional build;
- same releaseSequence;
- publisher must not restore `tasun-api/index.html` authority;
- fresh Pages artifact must have zero `pages[*].file` targets missing from the artifact.

## 8. Failure boundary

Return to architecture if tracing proves a supported public route depends on the manifest authority, or if removing the entry breaks source/runtime tests for reasons beyond version lookup.

Do not expose `tasun-api/` publicly as a workaround.

## 9. Approval gate

- [x] Option A2 architecture amendment explicitly approved by user on 2026-10-12
- [x] amended written spec completed
- [ ] amended written spec explicitly approved
- [ ] implementation/TDD resumed

Amended written spec:
`docs/superpowers/plans/2026-10-12-issue-56-pages-deployment-authority-amended-written-spec.md`

Issue #56 remains open until the post-merge artifact invariant is satisfied.
