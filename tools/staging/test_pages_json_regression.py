import json
import unittest
import argparse
import tempfile
from pathlib import Path
from unittest import mock
import cloudflare_staging_operator as op
import prepare_r1157_staging as core
import verify_r1157_staging as verify
from test_operator_v8 import FakeWrangler

class PagesJSONRegression(unittest.TestCase):
    def check_name(self, payload):
        records = op.resources_from_json(
            json.dumps(payload), 'Pages'
        )
        matches = [
            x for x in records
            if op.pages_project_name(x)
            == 'tasun-r1157-staging'
        ]
        self.assertEqual(len(matches), 1)

    def test_wrangler_display_format(self):
        self.check_name([
            {'Project Name': 'tasun-r1157-staging'}
        ])

    def test_standard_name_format(self):
        self.check_name([
            {'name': 'tasun-r1157-staging'}
        ])

    def test_missing_project(self):
        records = op.resources_from_json(
            '[{"Project Name":"other-project"}]',
            'Pages'
        )
        self.assertEqual(
            sum(
                op.pages_project_name(x)
                == 'tasun-r1157-staging'
                for x in records
            ), 0
        )

    def test_invalid_json_rejected(self):
        with self.assertRaises(Exception):
            op.resources_from_json('not-json', 'Pages')

    def test_conflicting_name_fields_fail_closed(self):
        with self.assertRaises(op.Stop):
            op.pages_project_name({'name':'other-project',
                                   'Project Name':op.PAGES_NAME})

    def test_wrangler_executable_is_platform_appropriate(self):
        import os
        self.assertEqual(op.NPX, 'npx.cmd' if os.name == 'nt' else 'npx')

    def test_real_operator_blocks_existing_display_name(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root/'source.zip').write_bytes(b'mocked')
            args = argparse.Namespace(mode='provision',
                workers_subdomain='test-account', source=str(root/'source.zip'),
                output=str(root/'candidate'),
                confirm_create='CREATE_NEW_EMPTY_STAGING_ONLY')
            fake = FakeWrangler(existing_pages=[{'Project Name':op.PAGES_NAME}])
            with mock.patch.object(core,'source_files',return_value=('release',{'version':'release'},{})), \
                 mock.patch.object(op,'verify_source_checksum',return_value={}):
                with self.assertRaises(op.Stop):
                    op.execute(args, fake)
            self.assertFalse(any('create' in item for call in fake.calls for item in call))

    def test_real_operator_verifies_created_display_name(self):
        class DisplayNameWrangler(FakeWrangler):
            def __call__(self, args, cwd=None):
                answer = super().__call__(args,cwd)
                if args[3:6] == ['pages','project','create']:
                    self.pages[-1] = {'Project Name':op.PAGES_NAME}
                return answer
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root/'source.zip').write_bytes(b'mocked')
            args = argparse.Namespace(mode='provision',
                workers_subdomain='test-account', source=str(root/'source.zip'),
                output=str(root/'candidate'),
                confirm_create='CREATE_NEW_EMPTY_STAGING_ONLY')
            fake = DisplayNameWrangler()
            with mock.patch.object(core,'source_files',return_value=('release',{'version':'release'},{})), \
                 mock.patch.object(op,'verify_source_checksum',return_value={}), \
                 mock.patch.object(core,'build',return_value={'status':'AWAITING_CLOUDFLARE_RESOURCE_VERIFICATION'}), \
                 mock.patch.object(verify,'verify',return_value={'result':'PASS_OFFLINE_ONLY'}):
                result = op.execute(args, fake)
            self.assertEqual(result['state'],'RESOURCES_CREATED_CANDIDATE_VERIFIED_NO_DEPLOYMENT')

if __name__ == '__main__':
    unittest.main(verbosity=2)
