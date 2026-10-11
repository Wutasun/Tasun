# R1144 Formal Closure and Delivery Record

Date: 2026-10-11  
Repository: `Wutasun/Tasun`  
Status: CLOSED / VERIFIED / RELEASED

## 1. Approved scope

R1144 Authority Convergence was implemented against the approved written specification and Tasun v5 fixed rules.

The implementation preserved the existing UI, page layout, primary operation logic, formal data identity contract, permissions, statistics formulas, and release authority.

No new secondary authority, compatibility patch authority, or manual version authority was introduced.

## 2. Implementation result

R1144 converged the current runtime/self-heal responsibilities around:

- public bridge based current SelfHeal behavior;
- one exact geometry scheduler authority;
- Search / Show All semantic-terminal coordination;
- atomic projection visibility;
- intentional artifact cancellation without retry;
- current convergence verifier ownership;
- retirement of obsolete compatibility auto-run behavior.

The four formal pages remain the release target:

- 汐東收發文明細表.html
- 汐東收發文登錄表.html
- 汐東文件統計表.html
- 汐東文件管理表.html

## 3. TDD and regression verification

R1144 targeted tests: **16/16 GREEN**.

During full regression, five canonical stage-jump failures were detected. Investigation confirmed that the R1144 integration had overwritten the previously verified canonical normalization in the original `r949JumpMeta()` authority.

The correction was made in the original authority only:

- visible source labels remain unchanged;
- receiver canonical stage labels are normalized at the producer;
- no extra patch layer or second authority was added;
- R1144 Authority Convergence behavior was preserved.

After correction:

- R1144 targeted tests: GREEN
- canonical stage-jump tests: GREEN
- full Tasun regression suite: GREEN

## 4. Merge record

Regression repair PR: **#7 — R1144: restore canonical stage-jump authority**

Merged by squash.

Merge commit:

`b58021c2c9f50f1ce5350e0c65514eb4af5a406a`

## 5. Formal release record

Exact Auto Release Chain completed successfully after the verified merge.

Formal auto-release commit:

`267245583b2e6d72be71f4f3f0ed6aa6efe5848b`

Formal build:

`20261011_tasun_v5_xidong_docs_r1145_0215fac8ef74_release`

The `R1145` token above is the automatic release-sequence increment produced by the formal publisher. It is **not** a new functional requirement or a separately approved R1145 feature scope.

Release verification completed successfully for:

1. exact four-page release artifact build;
2. Tasun release deployment;
3. deployed four-page build-sequence and SHA verification.

## 6. Version authority

`tasun-version.json` remains the sole formal version source.

No manual version hardcoding was introduced as part of the R1144 implementation, repair, or this closure record.

## 7. Delivery artifact

Verified GitHub Pages artifact from the successful exact release chain:

- workflow artifact id: `11698448227`
- artifact SHA-256: `935683128248c0e2e7c9b5ea8665d5ec008bba68bc7aa12b47a9ecfa1864492d`

A separate expanded delivery ZIP was also prepared from that verified artifact for direct use. The original GitHub artifact remains the traceable release baseline.

## 8. Closure boundary

R1144 is closed for:

- approved written specification;
- implementation / TDD;
- regression repair;
- merge;
- exact release;
- four-page SHA verification;
- delivery packaging.

This closure does not claim browser-manual user-operation testing, formal-account login testing, or live cloud end-to-end testing that was not executed in the verified CI/release chain.

Any future functional work must begin from the latest formal `main` baseline and must not infer a new functional requirement solely from the automatic release sequence number.
