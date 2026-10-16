/**
 * R1157 GitHub committed-source checksum gate.
 * Run BEFORE the disposable release generator intentionally rewrites release artifacts.
 * SHA-256_校驗表.csv is excluded because it cannot hash itself without recursion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checksumFile = 'SHA-256_校驗表.csv';

test('R1157 committed GitHub checksum table matches every tracked project file', () => {
  const csv = fs.readFileSync(path.join(root, checksumFile), 'utf8');
  const lines = csv.trimEnd().split(/\r?\n/);
  assert.equal(lines.shift(), '檔案,SHA-256,大小(bytes)', 'checksum header mismatch');
  const listed = new Set();
  for (const [index, line] of lines.entries()) {
    assert.ok(line, 'blank checksum entry at row ' + (index + 2));
    const cells = line.split(',');
    assert.equal(cells.length, 3, 'bad checksum row ' + (index + 2));
    const [name, expectedDigest, byteCount] = cells;
    assert.ok(name && !path.isAbsolute(name) && !name.split('/').includes('..'), 'invalid checksum path: ' + name);
    assert.notEqual(name, checksumFile, 'checksum table cannot checksum itself');
    assert.ok(!listed.has(name), 'duplicated checksum entry: ' + name);
    listed.add(name);
    assert.match(expectedDigest, /^[a-f0-9]{64}$/, 'invalid SHA-256: ' + name);
    assert.match(byteCount, /^(0|[1-9]\d*)$/, 'invalid byte count: ' + name);
    const artifact = fs.readFileSync(path.join(root, name));
    assert.equal(artifact.length, Number(byteCount), 'byte mismatch: ' + name);
    assert.equal(crypto.createHash('sha256').update(artifact).digest('hex'), expectedDigest, 'SHA-256 mismatch: ' + name);
  }
  const tracked = execFileSync('git', ['ls-files', '--cached', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean).filter(name => name !== checksumFile);
  assert.deepEqual([...listed].sort(), tracked.sort(), 'checksum entries must equal Git tracked files');
});
