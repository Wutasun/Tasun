"""Offline SQLite regression only. Does not connect to Cloudflare or Production."""
from __future__ import annotations
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCHEMA = (ROOT / 'tasun-api' / 'schema_v4.sql').read_text(encoding='utf-8')
MIGRATION = (ROOT / 'tools/staging/migrations/001_session_version_staging.sql').read_text(encoding='utf-8')
VALID = re.compile(r'^[a-f0-9]{32}$')
TRIGGERS = ('tr_r1157_sv_users_insert','tr_r1157_sv_users_update',
            'tr_r1157_sv_auth_insert','tr_r1157_sv_auth_update','tr_r1157_sv_auth_delete')

class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.executescript(SCHEMA)
        for user,role in [('r1157_test_admin','admin'),('r1157_test_write','write'),('r1157_test_read','read')]:
            self.db.execute('INSERT INTO tasun_users(username,pass_hash,role,enabled,createdAt,updatedAt) VALUES(?,?,?,?,?,?)',(user,'a'*64,role,1,1,1))
            self.db.execute('INSERT INTO tasun_auth(username,role,btn1,btn2,btn3,btn4,btn5,updatedAt) VALUES(?,?,?,?,?,?,?,?)',(user,role,0,0,0,0,0,1))
        self.db.commit()
        self.db.executescript(MIGRATION)
        self.name = 'r1157_test_write'
    def tearDown(self): self.db.close()
    def version(self,name=None):
        return self.db.execute('SELECT session_version FROM tasun_users WHERE username=?',(name or self.name,)).fetchone()[0]
    def test_01_backfill_exact_accounts_distinct(self):
        versions=[self.version(name) for name in ['r1157_test_admin','r1157_test_write','r1157_test_read']]
        self.assertEqual(len(set(versions)),3)
        self.assertTrue(all(VALID.fullmatch(v) for v in versions))
        self.assertEqual(self.db.execute('SELECT count(*) FROM tasun_rows').fetchone()[0],0)
    def test_02_five_triggers_installed(self):
        rows=self.db.execute('SELECT name FROM sqlite_master WHERE type="trigger" AND name LIKE "tr_r1157_sv_%"').fetchall()
        self.assertEqual({x[0] for x in rows},set(TRIGGERS))
    def test_03_disable_reenable_permanently_rotates(self):
        old=self.version();self.db.execute('UPDATE tasun_users SET enabled=0 WHERE username=?',(self.name,));middle=self.version()
        self.db.execute('UPDATE tasun_users SET enabled=1 WHERE username=?',(self.name,));new=self.version()
        self.assertEqual(len({old,middle,new}),3)
    def test_04_user_password_and_role_rotate(self):
        old=self.version();self.db.execute('UPDATE tasun_users SET pass_hash=? WHERE username=?',('b'*64,self.name));middle=self.version()
        self.db.execute('UPDATE tasun_users SET role="read" WHERE username=?',(self.name,));new=self.version()
        self.assertEqual(len({old,middle,new}),3)
    def test_05_auth_role_and_button_rotate(self):
        old=self.version();self.db.execute('UPDATE tasun_auth SET role="read" WHERE username=?',(self.name,));middle=self.version()
        self.db.execute('UPDATE tasun_auth SET btn1=1 WHERE username=?',(self.name,));new=self.version()
        self.assertEqual(len({old,middle,new}),3)
    def test_06_auth_insert_delete_rotate(self):
        self.db.execute('DELETE FROM tasun_auth WHERE username=?',(self.name,));after_delete=self.version()
        self.db.execute('INSERT INTO tasun_auth(username,role,btn1,btn2,btn3,btn4,btn5,updatedAt) VALUES(?,?,?,?,?,?,?,?)',(self.name,'write',0,0,0,0,0,2));after_insert=self.version()
        self.assertNotEqual(after_delete,after_insert)
    def test_07_new_user_and_recreate_fresh_version(self):
        old=self.version()
        self.db.execute('DELETE FROM tasun_auth WHERE username=?',(self.name,))
        self.db.execute('DELETE FROM tasun_users WHERE username=?',(self.name,))
        self.db.execute('INSERT INTO tasun_users(username,pass_hash,role,enabled,createdAt,updatedAt) VALUES(?,?,?,?,?,?)',(self.name,'a'*64,'read',1,2,2))
        self.assertRegex(self.version(),VALID)
        self.assertNotEqual(self.version(),old)
    def test_08_same_values_do_not_rotate(self):
        old=self.version()
        self.db.execute('UPDATE tasun_auth SET updatedAt=100 WHERE username=?',(self.name,))
        self.db.execute('UPDATE tasun_users SET updatedAt=100 WHERE username=?',(self.name,))
        self.assertEqual(self.version(),old)
    def test_09_second_migration_rejected_without_data_change(self):
        before=[self.version(x) for x in ['r1157_test_admin','r1157_test_write','r1157_test_read']]
        with self.assertRaises(sqlite3.OperationalError): self.db.executescript(MIGRATION)
        self.assertEqual(before,[self.version(x) for x in ['r1157_test_admin','r1157_test_write','r1157_test_read']])

if __name__ == '__main__': unittest.main(verbosity=2)
