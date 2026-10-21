"""Gate 4-A2: deliberate RED/GREEN tests; local-only and no Cloudflare operations."""
import ast
import hashlib
import os
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import prepare_r1157_staging as prepare
import verify_r1157_staging as verify
import cloudflare_staging_operator as op

HERE=Path(__file__).resolve().parent

class Gate4A2Safety(unittest.TestCase):
    def test_01_verifier_uses_uncancellable_guards(self):
        source=(HERE/'verify_r1157_staging.py').read_text('utf-8')
        tree=ast.parse(source)
        checks=[n for n in ast.walk(tree) if isinstance(n,ast.Assert)]
        self.assertEqual(checks,[], 'P1: assert is removed under python -O')
        self.assertIn('raise ValueError(',source)

    def test_01b_python_O_does_not_disable_isolation_checks(self):
        code=("import verify_r1157_staging as v; v.require(False, 'wrong D1 UUID')")
        result=subprocess.run([sys.executable,'-O','-c',code],cwd=HERE,capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('wrong D1 UUID',result.stderr)

    def test_02_latest_worker_pin_separate_from_immutable_source(self):
        self.assertEqual(prepare.PR_HEAD,'69c0327a1158a2dfb757c5a3808f5f55495c0c37')
        self.assertEqual(prepare.PR_WORKER_SHA256,'a7998eaeaa5aa648fb198e3f0b8da526f1dc1eb000b556a1ef47b49941e8b8e2')
        self.assertEqual(prepare.STAGING_WORKER_REVIEW_HEAD,'f54b5f3629c19d2c47f0ca30521ff43fc9bee7f2')
        self.assertEqual(prepare.STAGING_WORKER_SHA256,'48f14b3a94bec082b900ea8003a1d5491629b8e03299617e4284e3e46f83400f')
        self.assertNotEqual(prepare.PR_WORKER_SHA256,prepare.STAGING_WORKER_SHA256)

    def test_02b_checkout_worker_sha_matches_approved_pin(self):
        repo_worker=HERE.parents[1] / 'tasun-api' / 'tasun-worker-stable-v4.js'
        if not repo_worker.is_file():
            self.skipTest('Partial local tooling fixture; GitHub CI checks full checkout')
        self.assertEqual(hashlib.sha256(repo_worker.read_bytes()).hexdigest(),prepare.STAGING_WORKER_SHA256)

    def test_03_missing_and_altered_candidate_fail_before_cloud(self):
        with self.assertRaises(ValueError):prepare.read_pinned_worker_candidate(None)
        with tempfile.TemporaryDirectory() as d:
            file=Path(d)/'worker.js';file.write_text('// old or tampered worker')
            with self.assertRaises(ValueError):prepare.read_pinned_worker_candidate(str(file))

    def test_04_local_pinned_wrangler_cannot_download_unversioned_package(self):
        self.assertEqual(op.WRANGLER_PACKAGE,'wrangler@4.151.0')
        self.assertEqual(op.WRANGLER_CLI_ARGS[1:],['--offline','--no-install','wrangler@4.151.0'])
        self.assertNotIn('--yes',op.WRANGLER_CLI_ARGS)
        self.assertNotIn('wrangler',op.WRANGLER_CLI_ARGS[1:])

    def test_05_operator_prevents_provision_without_current_worker_candidate(self):
        import argparse
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'source.zip').write_bytes(b'fixture')
            called=[]
            def fake(args,cwd=None):called.append(args);raise AssertionError('No cloud interaction allowed')
            args=argparse.Namespace(mode='provision',workers_subdomain='test-account',source=str(root/'source.zip'),output=str(root/'bundle'),confirm_create='CREATE_NEW_EMPTY_STAGING_ONLY',worker_candidate=None)
            with self.assertRaises((op.Stop,ValueError)):
                op.execute(args,fake)
            self.assertEqual(called,[])

if __name__=='__main__':unittest.main(verbosity=2)
