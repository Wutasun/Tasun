# R1157 P1 Gate 4-A2 — Staging Deployment Safety Written Spec v1

**Authorization:** User approved Gate 4-A2 safety fixes, offline RED/GREEN, and local validation; **not** Cloudflare Worker/Pages deployment, Production mutation, D1 re-migration, or PR merge.

## 1. Immutable authorities and isolation

- Source of working code: PR #102 `release/r1157-review` at Gate 4-A2 intake HEAD `f54b5f3629c19d2c47f0ca30521ff43fc9bee7f2`. Commits after intake must be reviewed; exact approved Worker bytes stay SHA-256 pinned.
- Immutable historical R1157 release-source ZIP commit `69c0327a1158a2dfb757c5a3808f5f55495c0c37` and original Worker hash `a7998eaeaa5aa648fb198e3f0b8da526f1dc1eb000b556a1ef47b49941e8b8e2` remain unchanged. **Do not repin or rewrite that historical source.**
- Gate 4 staging Worker candidate: same file `tasun-api/tasun-worker-stable-v4.js` from approved review HEAD above; SHA-256 `48f14b3a94bec082b900ea8003a1d5491629b8e03299617e4284e3e46f83400f`. The original ZIP Worker must not be staged after Session Version D1 migration.
- Staging D1 name `tasun-db-staging`, UUID `e0d35b53-fa41-4ad3-814c-bea390f2a5be`. Production UUID `ecb1ff1d-eb3d-4fe8-ba2c-8b7cc884bd84` never a write target. PR #102 remains Draft; no changes to main.

## 2. Gate 4-A2 requirements

**P1-A: non-bypassable offline isolation checks.** Replace all `assert` safety conditions in `tools/staging/verify_r1157_staging.py` with explicit exception-raising checks; expected to reject wrong D1 UUID, Production Worker/origin, CORS mismatch, wrong version/page SHA, and tampering even under Python `-O` and `PYTHONOPTIMIZE=1`. Retain `PASS_OFFLINE_ONLY` status semantics; never use it to authorize a cloud deployment.

**P1-B: separate immutable source ZIP and approved current Worker.** `prepare_r1157_staging.py` must keep old immutable ZIP hashes and provide a distinct, mandatory `--worker-candidate PATH` in non-demo mode. Candidate is accepted only if its bytes equal the approved latest Worker SHA. The candidate is used exclusively for isolated Staging Worker output. Generated `STAGING_STATUS.json` must record worker source/head and digest; verifier must check actual bytes, metadata and pinned digest. Missing/altered candidate stops before output or cloud operations. Never silently fall back to the immutable ZIP Worker.

**P2: deterministic offline Wrangler.** `cloudflare_staging_operator.py` must replace unversioned `npx --yes wrangler` with `npx --offline --no-install wrangler@4.151.0` (using `npx.cmd` on Windows). No remote npm downloads while Cloudflare credentials are accessible. A missing or mismatched local installation must fail closed. This operator's `provision` mode must be **disabled in practice for existing R1157 resources**; do not reprovision Staging D1 or Pages. The operator must pre-check candidate Worker before any provision request.

## 3. TDD scenarios and evidence

- RED tests must fail on old code for assert usage, missing current Worker pin and candidate validation, unversioned Wrangler, and pre-provision candidate gate.
- GREEN tests must pass on patched code, including an actual `python -O` subprocess negative guard test, candidate missing/tampered negative tests, and no cloud calls when candidate absent.
- Run existing `test_operator_v8`, `test_pages_json_regression`, and new `test_gate4a2_safety`, plus existing Session Version Node/Python offline tests and release/version checks in CI.
- Update `SHA-256_校驗表.csv` to match committed source artifacts, preserving the self-exclusion rule for the checksum table.
- Preserve existing worker source and CORS/Token logic, all Tasun v5 HTML/UI, `tasun-version.json`, existing SQLite migration and 5 triggers. No rerun of Gate 3-B.

## 4. Deployment boundary and gates

Gate 4-A2 only authorizes written spec, local tool changes, offline tests and review-branch PR commit, not cloud operations. Gate 4-B revalidates all offline/CI tests. Gate 4-C checks live Staging Worker source/SHA, `DB` UUID, secret **existence without reading it**, CORS configuration, no Production route, concurrency and rollback without reviving legacy tokens. Gate 4-D Staging Worker deployment requires **a separate explicit approval**. Do not deploy Pages, write Production, merge PR #102, or use the original default `tasun-api/wrangler.toml` (Production configuration).

## 5. Stop and recovery policy

If any checksum, UUID, CORS/origin, Worker identity, test, or CI status differs, **BLOCKED**. Do not auto-bypass, auto-deploy, force-push, or run any database migration. Preserve Gate 3-B backups, one-shot journal and previous Cloudflare configuration. Report the failing test and make no further cloud changes until reviewed.
