-- R1157 P1 / STAGING ONLY / Gate 3 approval REQUIRED before remote execution.
-- Target is pinned by the operator's validated Wrangler configuration:
-- name tasun-db-staging; D1 e0d35b53-fa41-4ad3-814c-bea390f2a5be.
-- NEVER apply to Production; NEVER blindly rerun after partial failure.
-- Preconditions checked separately: exact D1 UUID, schema_v4, 3 test users/3 auth/0 rows,
-- no session_version column, no tr_*_sv triggers, no existing migration journal.
ALTER TABLE tasun_users ADD COLUMN session_version TEXT NOT NULL DEFAULT '';
UPDATE tasun_users SET session_version = lower(hex(randomblob(16)));

-- A new account must always get a fresh generation, even after delete/recreate.
CREATE TRIGGER tr_r1157_sv_users_insert AFTER INSERT ON tasun_users
BEGIN
  UPDATE tasun_users SET session_version = lower(hex(randomblob(16)))
   WHERE username = NEW.username;
END;

-- Changing a user's password, role, or enabled flag revokes all previously issued tokens.
CREATE TRIGGER tr_r1157_sv_users_update AFTER UPDATE OF pass_hash, role, enabled ON tasun_users
WHEN OLD.pass_hash IS NOT NEW.pass_hash OR OLD.role IS NOT NEW.role OR OLD.enabled IS NOT NEW.enabled
BEGIN
  UPDATE tasun_users SET session_version = lower(hex(randomblob(16)))
   WHERE username = NEW.username;
END;

-- Auth creation/modification/removal also invalidates all tokens for that account.
CREATE TRIGGER tr_r1157_sv_auth_insert AFTER INSERT ON tasun_auth
BEGIN
  UPDATE tasun_users SET session_version = lower(hex(randomblob(16)))
   WHERE username = NEW.username;
END;
CREATE TRIGGER tr_r1157_sv_auth_update AFTER UPDATE ON tasun_auth
WHEN OLD.role IS NOT NEW.role OR OLD.btn1 IS NOT NEW.btn1 OR
     OLD.btn2 IS NOT NEW.btn2 OR OLD.btn3 IS NOT NEW.btn3 OR
     OLD.btn4 IS NOT NEW.btn4 OR OLD.btn5 IS NOT NEW.btn5
BEGIN
  UPDATE tasun_users SET session_version = lower(hex(randomblob(16)))
   WHERE username = NEW.username;
END;
CREATE TRIGGER tr_r1157_sv_auth_delete AFTER DELETE ON tasun_auth
BEGIN
  UPDATE tasun_users SET session_version = lower(hex(randomblob(16)))
   WHERE username = OLD.username;
END;
