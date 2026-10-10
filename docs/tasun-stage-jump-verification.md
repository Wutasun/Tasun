# Canonical stage jump verification

Baseline: main 326065efd4d (R1139). Replaces unresolved P2 feedback in PR #2, without reapplying the R949 package.

`r949JumpMeta` previously sent display-field labels such as `監造回覆(1)文號` while the existing detail receiver compares `監造回覆(1)`. Only normalize the metadata stage label at its producer. Keep visible labels, row UID/key, stage UID/index, document number, URL/storage protocol, renderer and lifecycle unchanged. Use the existing detail receiver's label-normalization semantics, including legacy `回覆文號 (監造)`.

Validation: `node --test tests/*.test.*`.
- Stage-jump RED: 5 failing / 1 passing before the fix; GREEN: 6/6 afterwards. Uses real manager context/metadata and real detail scoring, with repeated document numbers across stages. Also checks URL and storage intent.
- R1122 regressions execute the actual lifecycle/HeavyLane/revision core, with scheduling isolated at the browser API boundary. Tests stale generation, data/projection revision, hidden/BFCache, changed user/role, same-digest readback, bounded/abortable SelfHeal registration and actual R990 pageshow rebind handler.
- All embedded scripts in the four active HTML pages are syntax-checked.

Limits: This is targeted runtime regression, not a full production-login/cloud integration or complete R1122 written-spec acceptance. No live user data is read or modified.

Merge ordering: merge the release-consistency PR first. This independent PR targets the same baseline and deliberately does not hand-edit version strings/hashes: the repaired existing publisher regenerates the exact four-page release on merge. Do not deploy this HTML alone with an old manifest.

Independent review found that an unnumbered legacy 監造回覆 still scores -2 against the actual 監造回覆(1) header. The receiver-selection regression was strengthened, observed RED, and the existing metadata producer now uses the first supervisor stage (or the supplied positive sequence) for that legacy field. All 20 tests pass after the fix.
