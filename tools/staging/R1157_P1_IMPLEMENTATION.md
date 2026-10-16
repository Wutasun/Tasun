# R1157 P1 Session Version / Implementation TDD

- Written spec: R1157_P1_SESSION_VERSION_WRITTEN_SPEC_DRAFT_V1.md, **approved for local implementation/TDD only** on 2026-10-15.
- Source of truth for candidate code: PR #102 `release/r1157-review`, review HEAD `e1ffd1a415a461bcdb1ef96e0a177b86bc0f7ad9` at intake. Immutable release ZIP source snapshot `69c0327a1158a2dfb757c5a3808f5f55495c0c37` MUST NOT be repinned.
- This patch changes Worker signing, validation, CORS, and adds *standalone staging-only* migration (not applied). Existing `tasun-api/schema_v4.sql`, `tasun-version.json`, frontend, and Production config remain unchanged.
- Staging D1 only `tasun-db-staging` UUID `e0d35b53-fa41-4ad3-814c-bea390f2a5be`; Production D1 UUID `ecb1ff1d-eb3d-4fe8-ba2c-8b7cc884bd84` is **NEVER a write target**.
- Existing online Staging Worker has separately deployed credentialed CORS fix: do **not** deploy this PR Worker without comparing the live deployed CORS patch, deployment source, bindings, and SHA. Tested candidate allows only exact `CORS_ALLOW_ORIGINS` and supports credentials.
- Migration preconditions: separate approved gate; exact D1 UUID and Cloudflare account; SQLite schema `tasun_users` lacks `session_version`; none of five `tr_r1157_sv_*` triggers exist; exact pre-migration row counts 3 users/3 auth/0 rows; account names/roles match only three test accounts; retained journal contains no previous attempt. Do not rerun upon partial success.
- Migration creates 128-bit random session generation and five database triggers. Login requires both the column and all five triggers; fail closed for missing migration/trigger. New Token `tv:2,sv:32 lowercase hex,exp` and HMAC; old Tokens are invalid and users will re-login.
- Offline check: `node --test tools/staging/tests/test_session_version.mjs`, then `python -m unittest discover -s tools/staging/tests -p 'test_session_version_migration.py' -v` (Python 3.11+). No network calls.
- RED baseline results: 12 Node tests → 3 pass, 9 fail. GREEN: 13 Node tests → all pass; 9 Python SQLite migration tests → all pass. These are **offline mock tests**, not Staging E2E nor a deployment confirmation.
- Subsequent approvals: Gate 3 Staging-only D1 migration; Gate 4 separate Staging Worker deployment approval. No Worker, Pages, Production, AUTH_SECRET, or `main` modifications at this stage; PR #102 remains Draft.
- In-flight requests may have passed authorization before revocation; request-start-after-change guarantee only. Avoid automatic rollback to a Worker that accepts legacy tokens.
