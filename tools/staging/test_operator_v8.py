import argparse
from pathlib import Path
import json
import tempfile
import unittest
from unittest import mock
import cloudflare_staging_operator as op
import prepare_r1157_staging as core
import verify_r1157_staging as verify

PR=op.PR_COMMIT

class FakeWrangler:
    def __init__(self, existing_d1=None, existing_pages=None, uuid='22222222-2222-4222-8222-222222222222', fail_on=None):
        self.d1=list(existing_d1 or [])
        self.pages=list(existing_pages or [])
        self.uuid=uuid
        self.fail_on=fail_on
        self.calls=[]
    def __call__(self, args, cwd=None):
        self.calls.append(args[:])
        text=' '.join(args)
        if self.fail_on and self.fail_on in text:raise op.Stop('simulated command failure')
        if args[-1]=='whoami':return 'Logged in'
        if args[4:7]==['d1','list','--json']:return json.dumps(self.d1)
        if args[4:7]==['pages','project','list']:return json.dumps(self.pages)
        if args[4:6]==['d1','create']:
            self.d1.append({'name':op.DB_NAME,'uuid':self.uuid});return 'Created'
        if args[4:7]==['pages','project','create']:
            self.pages.append({'name':op.PAGES_NAME});return 'Created'
        raise AssertionError(args)

class V8Tests(unittest.TestCase):
    def setUp(self):
        self.worker_check=mock.patch.object(core,'read_pinned_worker_candidate',return_value=b'approved-worker-mock')
        self.worker_check.start()
    def tearDown(self):
        self.worker_check.stop()
    def args(self, root, mode='provision', **overrides):
        vals=dict(mode=mode,workers_subdomain='example-account',source=str(root/'source.zip'),
                  output=str(root/'candidate'),confirm_create='CREATE_NEW_EMPTY_STAGING_ONLY')
        vals.update(overrides)
        return argparse.Namespace(**vals)
    def make(self):
        d=tempfile.TemporaryDirectory();root=Path(d.name);(root/'source.zip').write_bytes(b'not-real-source-for-mocks');return d,root
    def test_01_plan_has_no_network(self):
        d,root=self.make();fake=FakeWrangler()
        try:
            r=op.execute(self.args(root,mode='plan'),fake)
            self.assertIn('NO_CLOUD_ACTIONS',r['mode']);self.assertEqual(fake.calls,[])
        finally:d.cleanup()
    def test_02_reject_invalid_account_domain(self):
        d,root=self.make()
        try:
            with self.assertRaises(op.Stop):op.execute(self.args(root,workers_subdomain='https://x.workers.dev'),FakeWrangler())
        finally:d.cleanup()
    def test_03_reject_placeholder_subdomain(self):
        d,root=self.make()
        try:
            with self.assertRaises(op.Stop):op.execute(self.args(root,workers_subdomain='example'),FakeWrangler())
        finally:d.cleanup()
    def test_04_needs_explicit_write_confirmation(self):
        d,root=self.make();fake=FakeWrangler()
        try:
            with self.assertRaises(op.Stop):op.execute(self.args(root,confirm_create=''),fake)
            self.assertEqual(fake.calls,[])
        finally:d.cleanup()
    def test_05_reject_missing_source_before_writes(self):
        d,root=self.make();fake=FakeWrangler()
        try:
            with self.assertRaises(op.Stop):op.execute(self.args(root,source=str(root/'missing.zip')),fake)
            self.assertEqual(fake.calls,[])
        finally:d.cleanup()
    def test_06_existing_d1_blocked(self):
        d,root=self.make();fake=FakeWrangler(existing_d1=[{'name':op.DB_NAME,'uuid':'22222222-2222-4222-8222-222222222222'}])
        try:
            with mock.patch.object(core,'source_files',return_value=('release',{'version':'release'},{})),\
                 mock.patch.object(op,'verify_source_checksum',return_value={'tracked_files':157,'hashes_verified':156}):
                with self.assertRaises(op.Stop):op.execute(self.args(root),fake)
            self.assertFalse(any('create' in x for x in sum(fake.calls,[])))
        finally:d.cleanup()
    def test_07_existing_pages_blocked(self):
        d,root=self.make();fake=FakeWrangler(existing_pages=[{'name':op.PAGES_NAME}])
        try:
            with mock.patch.object(core,'source_files',return_value=('release',{'version':'release'},{})),\
                 mock.patch.object(op,'verify_source_checksum',return_value={'tracked_files':157,'hashes_verified':156}):
                with self.assertRaises(op.Stop):op.execute(self.args(root),fake)
            self.assertFalse(any('create' in x for x in sum(fake.calls,[])))
        finally:d.cleanup()
    def test_08_production_uuid_blocked_after_d1_created(self):
        d,root=self.make();fake=FakeWrangler(uuid=op.PROD_DB)
        try:
            with mock.patch.object(core,'source_files',return_value=('release',{'version':'release'},{})),\
                 mock.patch.object(op,'verify_source_checksum',return_value={'tracked_files':157,'hashes_verified':156}):
                with self.assertRaises(op.Stop):op.execute(self.args(root),fake)
            self.assertFalse(any(x[4:7]==['pages','project','create'] for x in fake.calls))
        finally:d.cleanup()
    def test_09_valid_staging_creates_only_empty_d1_and_pages(self):
        d,root=self.make();fake=FakeWrangler()
        try:
            with mock.patch.object(core,'source_files',return_value=('release',{'version':'release'},{})),\
                 mock.patch.object(op,'verify_source_checksum',return_value={'tracked_files':157,'hashes_verified':156}),\
                 mock.patch.object(core,'build',return_value={'status':'AWAITING_CLOUDFLARE_RESOURCE_VERIFICATION'}) as build,\
                 mock.patch.object(verify,'verify',return_value={'result':'PASS_OFFLINE_ONLY'}):
                r=op.execute(self.args(root),fake)
            self.assertEqual(r['staging_d1_uuid'],fake.uuid)
            self.assertFalse(r['cloud_worker_deployed'])
            self.assertFalse(r['secrets_configured'])
            self.assertTrue(build.called)
            self.assertEqual(len([x for x in fake.calls if x[4:6]==['d1','create']]),1)
            self.assertEqual(len([x for x in fake.calls if x[4:7]==['pages','project','create']]),1)
            self.assertFalse(any(any(term in y for term in ('deploy','secret','execute','delete')) for x in fake.calls for y in x))
            self.assertTrue((root/'candidate_provision_journal.json').is_file())
        finally:d.cleanup()
    def test_10_no_cloud_writes_when_source_pin_invalid(self):
        d,root=self.make();fake=FakeWrangler()
        try:
            with mock.patch.object(core,'source_files',side_effect=ValueError('wrong source sha')):
                with self.assertRaises(ValueError):op.execute(self.args(root),fake)
            self.assertEqual(fake.calls,[])
        finally:d.cleanup()
    def test_11_json_parsing_fails_closed(self):
        with self.assertRaises(op.Stop):op.resources_from_json('not json','D1')
        with self.assertRaises(op.Stop):op.resources_from_json('{}','Pages')
    def test_13_existing_journal_blocks_before_cloud_calls(self):
        d,root=self.make();fake=FakeWrangler();(root/'candidate_provision_journal.json').write_text('{}')
        try:
            with self.assertRaises(op.Stop):op.execute(self.args(root),fake)
            self.assertEqual(fake.calls,[])
        finally:d.cleanup()
    def test_14_integrity_check_rejects_unpinned_checksum(self):
        with self.assertRaises(op.Stop):op.verify_source_checksum({'SHA-256_校驗表.csv':b'fake\n'})
    def test_15_integrity_detects_mutated_source_and_extra_file(self):
        import csv,hashlib,io
        real={'safe.txt':b'OK'}
        table=('檔案,SHA-256,大小(bytes)\nsafe.txt,'+hashlib.sha256(b'OK').hexdigest()+',2\n').encode()
        blob=hashlib.sha1(b'blob '+str(len(table)).encode()+b'\x00'+table).hexdigest()
        with mock.patch.object(op,'SOURCE_CHECKSUM_GIT_BLOB',blob):
            self.assertEqual(op.verify_source_checksum({**real,'SHA-256_校驗表.csv':table})['hashes_verified'],1)
            with self.assertRaises(op.Stop):op.verify_source_checksum({'safe.txt':b'BAD','SHA-256_校驗表.csv':table})
            with self.assertRaises(op.Stop):op.verify_source_checksum({**real,'other.txt':b'hi','SHA-256_校驗表.csv':table})
    def test_12_guard_explicit_no_prod_binding(self):
        with self.assertRaises(op.Stop):op.find_new_d1([{'name':op.DB_NAME,'uuid':op.PROD_DB}])
        with self.assertRaises(op.Stop):op.find_new_d1([])

if __name__=='__main__':unittest.main(verbosity=2)
