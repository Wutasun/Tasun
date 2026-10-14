#!/usr/bin/env python3
"""R1157 independent Cloudflare staging D1/Pages provisioner.

Safe two-stage design:
  plan       only prints locally, no cloud calls
  provision  requires explicit confirmation, creates only a *new* D1 and Pages project;
             never deploys Worker, secrets, schema, real data or main.

Cloudflare interaction requires the operator's *local* authenticated Wrangler CLI.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Callable
from urllib.parse import urlsplit

PR_COMMIT = '69c0327a1158a2dfb757c5a3808f5f55495c0c37'
PROD_DB = 'ecb1ff1d-eb3d-4fe8-ba2c-8b7cc884bd84'
# This is the real Git blob ID of SHA-256_校驗表.csv at the immutable PR commit.
SOURCE_CHECKSUM_GIT_BLOB = '0097c1cb69ba27d952e20f576f968f89591d1c72'
PROD_WORKER = 'tasun-worker.wutasun.workers.dev'
PROD_PAGES = 'wutasun.github.io'
DB_NAME = 'tasun-db-staging'
WORKER_NAME = 'tasun-worker-staging'
PAGES_NAME = 'tasun-r1157-staging'
# Windows uses npx.cmd; Unix-based CI/operators use the npx executable.
NPX = 'npx.cmd' if os.name == 'nt' else 'npx'
UUID = re.compile(r'^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$')
SUBDOMAIN = re.compile(r'^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$')


class Stop(RuntimeError):
    pass


def check_worker_subdomain(subdomain: str) -> str:
    value = str(subdomain or '').strip().lower()
    if not SUBDOMAIN.fullmatch(value):
        raise Stop('invalid Workers.dev account subdomain; use its subdomain only')
    worker = f'https://{WORKER_NAME}.{value}.workers.dev'
    if urlsplit(worker).hostname == PROD_WORKER or value in {'example', 'sample', 'placeholder'}:
        raise Stop('placeholder/production Worker not allowed')
    return worker


def resources_from_json(output: str, kind: str) -> list[dict]:
    try:
        data = json.loads(output)
    except Exception as exc:
        raise Stop(f'could not parse Wrangler {kind} JSON; no resource may be created: {exc}') from exc
    if isinstance(data, list):
        records = data
    elif isinstance(data, dict):
        records = next((data[key] for key in ('result', 'databases', 'projects', 'items') if isinstance(data.get(key), list)), None)
    else:
        records = None
    if not isinstance(records, list) or not all(isinstance(x, dict) for x in records):
        raise Stop(f'unexpected {kind} list structure; stop rather than guess')
    return records


def pages_project_name(record: dict) -> str | None:
    """Wrangler emits `Project Name` in table JSON and `name` in API JSON.

    Disagreeing keys are not safe to guess: fail closed before any write.
    """
    name = record.get('name')
    display = record.get('Project Name')
    if name and display and name != display:
        raise Stop('conflicting Pages project names in Wrangler JSON')
    return name or display


def find_new_d1(records: list[dict]) -> str:
    matches = [x for x in records if x.get('name') == DB_NAME]
    if len(matches) != 1:
        raise Stop('new staging D1 not uniquely discoverable; do not proceed')
    d1 = str(matches[0].get('uuid') or matches[0].get('id') or '').lower()
    if not UUID.fullmatch(d1) or d1 == PROD_DB:
        raise Stop('staging D1 ID invalid or equal to production D1')
    return d1


def verify_source_checksum(files: dict[str, bytes]) -> dict:
    """Pin the complete GitHub source tree, not just the three V7 critical files."""
    path = 'SHA-256_校驗表.csv'
    table = files.get(path)
    if table is None:
        raise Stop('source missing the committed GitHub checksum table')
    git_id = hashlib.sha1(b'blob ' + str(len(table)).encode() + b'\x00' + table).hexdigest()
    if git_id != SOURCE_CHECKSUM_GIT_BLOB:
        raise Stop('GitHub checksum file blob differs from locked PR commit')
    rows = list(csv.reader(io.StringIO(table.decode('utf-8'))))
    if not rows or rows[0] != ['檔案','SHA-256','大小(bytes)']:
        raise Stop('unexpected source SHA-256 table header')
    seen=set()
    for row in rows[1:]:
        if len(row) != 3:raise Stop('malformed checksum row')
        name,digest,length=row
        if name in seen or name == path or name not in files:
            raise Stop('duplicate, self-referential or missing source checksum file: ' + name)
        seen.add(name)
        raw=files[name]
        if hashlib.sha256(raw).hexdigest() != digest or str(len(raw)) != length:
            raise Stop('source content differs from committed SHA-256: ' + name)
    extra=set(files) - seen - {path}
    if extra:
        raise Stop('unexpected files not covered by GitHub checksum: ' + ','.join(sorted(extra)[:3]))
    return {'tracked_files':len(seen)+1,'hashes_verified':len(seen),'source_checksum_git_blob':git_id}


def call(argv: list[str], cwd: Path | None = None) -> str:
    print('RUN:', ' '.join(argv))
    r = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
    if r.returncode != 0:
        raise Stop(f'command failed (exit={r.returncode}): {argv[0]} {" ".join(argv[1:])}\n{r.stderr[-2500:]}')
    return r.stdout


def execute(args: argparse.Namespace, runner: Callable = call) -> dict:
    worker = check_worker_subdomain(args.workers_subdomain)
    site = f'https://{PAGES_NAME}.pages.dev'
    if args.mode == 'plan':
        return {
            'mode': 'PLAN_ONLY_NO_CLOUD_ACTIONS', 'pr_commit': PR_COMMIT,
            'staging_d1_name': DB_NAME, 'staging_worker_name': WORKER_NAME,
            'staging_worker_origin': worker, 'staging_pages': site,
            'what_provision_creates': ['new empty staging D1', 'new separate Pages project'],
            'does_not_deploy': ['Worker', 'D1 schema', 'Pages content', 'AUTH_SECRET', 'production'],
            'next': 'Download exact PR source ZIP, authenticate with Wrangler locally, then use --mode provision and explicit confirmation.'
        }
    if args.mode != 'provision':
        raise Stop('unknown mode')
    if args.confirm_create != 'CREATE_NEW_EMPTY_STAGING_ONLY':
        raise Stop('explicit --confirm-create CREATE_NEW_EMPTY_STAGING_ONLY required')
    source = Path(args.source or '').resolve()
    if not source.is_file() or source.suffix.lower() != '.zip':
        raise Stop('source ZIP must exist and have .zip extension')
    out = Path(args.output or '').resolve()
    if out.exists() and any(out.iterdir()):
        raise Stop('output must not contain existing files; use a new directory')
    if not (out.parent.is_dir()):
        raise Stop('output parent directory must exist')
    journal = out.parent / (out.name + '_provision_journal.json')
    if journal.exists():
        raise Stop('existing provision journal; refusing to create additional resources')
    # The V7 generator is the source pin authority. Pre-flight the entire candidate
    # BEFORE touching any Cloudflare resources with demo names, but *real* source pins.
    import prepare_r1157_staging as core
    build, version, files = core.source_files(source, enforce_pr_pins=True)
    integrity = verify_source_checksum(files)
    if core.PR_HEAD != PR_COMMIT:
        raise Stop('V7 source PR head is stale or does not match this operator')
    if build != version['version']:
        raise Stop('version file inconsistent')
    # Authentication check and the two no-collision checks precede any write.
    runner([NPX, '--yes', 'wrangler', 'whoami'])
    d1_before = resources_from_json(runner([NPX,'--yes','wrangler','d1','list','--json']), 'D1')
    pages_before = resources_from_json(runner([NPX,'--yes','wrangler','pages','project','list','--json']), 'Pages')
    if any(x.get('name') == DB_NAME for x in d1_before):
        raise Stop('staging D1 name already exists; NOT reusing/deleting it; contact operator for reconciliation')
    if any(pages_project_name(x) == PAGES_NAME for x in pages_before):
        raise Stop('staging Pages name already exists; NOT overwriting it')
    # A new resource is intentionally created only after a fully verified source ZIP.
    runner([NPX,'--yes','wrangler','d1','create',DB_NAME,'--location','apac'])
    after = resources_from_json(runner([NPX,'--yes','wrangler','d1','list','--json']), 'D1')
    fresh_uuid = find_new_d1(after)
    if any(str(x.get('uuid') or x.get('id') or '').lower() == fresh_uuid for x in d1_before):
        raise Stop('staging D1 ID existed before create; refusing to reuse')
    # A write journal preserves UUID if a subsequent create or build fails.
    journal.write_text(json.dumps({'state':'D1_CREATED_PAGES_PENDING','d1_name':DB_NAME,
                                   'd1_uuid':fresh_uuid,'source_commit':PR_COMMIT,
                                   'no_secret_stored':True},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    runner([NPX,'--yes','wrangler','pages','project','create',PAGES_NAME,'--production-branch','staging'])
    pages_after = resources_from_json(runner([NPX,'--yes','wrangler','pages','project','list','--json']), 'Pages')
    if sum(pages_project_name(x) == PAGES_NAME for x in pages_after) != 1:
        raise Stop('Pages project not uniquely discoverable; do not attempt deployment')
    # Generate only the offline candidate staging config and verify it.
    argv = argparse.Namespace(source=str(source),output=str(out),site=site,worker=worker,
                              d1=fresh_uuid,confirm_independent=True,demo=False,fixture_only=False)
    state = core.build(argv)
    import verify_r1157_staging as verify
    verified = verify.verify(out)
    if verified.get('result') != 'PASS_OFFLINE_ONLY':
        raise Stop('offline isolation verification did not pass')
    details = {'state':'RESOURCES_CREATED_CANDIDATE_VERIFIED_NO_DEPLOYMENT',
               'pr_commit':PR_COMMIT,'staging_pages':site,'staging_worker':worker,
               'staging_d1_uuid':fresh_uuid,'staging_d1_name':DB_NAME,
               'generated_bundle':str(out),'cloud_worker_deployed':False,
               'cloud_pages_deployed':False,'schema_initialized':False,
               'live_readback_verified':False,'secrets_configured':False,
               'no_production_mutation_requested':True,'source_integrity':integrity}
    journal.write_text(json.dumps(details,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return details


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--mode',choices=['plan','provision'],default='plan')
    ap.add_argument('--workers-subdomain',required=True,help='Real account workers.dev subdomain, not an entire URL')
    ap.add_argument('--source',help='GitHub ZIP for PR #102 exact commit')
    ap.add_argument('--output',help='New empty output directory')
    ap.add_argument('--confirm-create',default='',help='Exact string CREATE_NEW_EMPTY_STAGING_ONLY required for writes')
    args=ap.parse_args()
    try:
        outcome=execute(args)
        print(json.dumps(outcome,ensure_ascii=False,indent=2))
    except (Stop,ValueError,FileNotFoundError) as ex:
        print('BLOCKED:',ex,file=sys.stderr)
        sys.exit(3)

if __name__=='__main__':
    main()
