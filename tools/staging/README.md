# R1157 isolated Staging tooling (review only)

- Pinned, immutable **release source snapshot**: `69c0327a1158a2dfb757c5a3808f5f55495c0c37`.
- `R1157_source.zip` must come from this exact snapshot, not from a later branch-head tooling commit.
- The tools commit is a **review update** to PR #102, not a replacement of the release source snapshot or a production deployment.
- `plan` never accesses Cloudflare. `provision` creates D1 and Pages and must **never be run again** after successful resource creation.
- The current account already has `tasun-db-staging` and `tasun-r1157-staging`; **do not run provision** against it.
- No Worker deployment, no Pages contents deployment, no D1 schema/data import, no AUTH_SECRET writes, and no main merge.
- Run `python -m unittest -v test_operator_v8 test_pages_json_regression` from this directory (Python 3.11+).
- Offline candidate, without Cloudflare calls: `python prepare_r1157_staging.py --source PATH_TO_PINNED_ZIP --output EMPTY_DIR --site https://tasun-r1157-staging.pages.dev --worker https://tasun-worker-staging.wutasun.workers.dev --d1 STAGING_D1_UUID --confirm-independent`, followed by `python verify_r1157_staging.py EMPTY_DIR`.
- The offline `PASS_OFFLINE_ONLY` gate does not prove remote Readback, login, browser E2E, or staging Worker/Pages deployment.
- GitHub SHA-256 manifest must be updated whenever tracked files are added or edited; do not change the immutable release-source checksum blob constant to point at the tooling PR head.
