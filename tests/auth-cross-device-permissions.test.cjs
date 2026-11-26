'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const permissionSource = fs.readFileSync(path.join(root, '權限表.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'tasun-api', 'worker_tasun.js'), 'utf8');
const detailSource = fs.readFileSync(path.join(root, '汐東收發文明細表.html'), 'utf8');

function functionBody(source, name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'missing function ' + name);
  const end = nextName ? source.indexOf('function ' + nextName + '(', start + 1) : -1;
  return source.slice(start, end === -1 ? Math.min(source.length, start + 7000) : end);
}

test('homepage hydrates entry config and permission matrix from the D1 authority snapshot', () => {
  const applySnapshot = functionBody(indexSource, 'applyAuthoritySnapshotToLocal', 'mergeAuthorityAuthToLocal');
  for (const key of ['NAV_KEY', 'ROUTE_KEY', 'PERM_MATRIX_KEY', 'entrySelected', 'entryRegistry']) {
    assert.ok(applySnapshot.includes(key), 'missing D1 snapshot field: ' + key);
  }
  assert.doesNotMatch(applySnapshot, /LEGACY_ROUTE_KEY/);
  const sync = functionBody(indexSource, 'syncAuthTableFromAuthority', 'loadScriptOnce');
  assert.match(sync, /applyAuthoritySnapshotToLocal\(snapshot\)/);
  assert.match(sync, /onIndexConfigApplied()/);
  const buttons = functionBody(indexSource, 'refreshButtonsForCurrentUser', 'onIndexConfigApplied');
  assert.match(buttons, /Array\.isArray\(CURRENT_USER\.buttons\)/);
  assert.match(buttons, /matrixPermission === null\s*\?\s*accountPermission\s*:\s*matrixPermission === true/);
  assert.match(buttons, /level === 'admin' \|\| permissionGranted/);
  assert.match(indexSource, /AUTH_TABLE_SYNC_TIMEOUT_MS = 8000/);
  assert.match(sync, /權責表清單讀取逾時\|AbortError\|timeout/);
});

test('permission table routes Staging to its isolated Worker without a cached bearer token', () => {
  const apiBase = functionBody(permissionSource, 'isStagingPagesHost', 'getSharedWorkerToken');
  assert.match(apiBase, /tasun-worker-staging\.wutasun\.workers\.dev/);
  const headers = functionBody(permissionSource, 'buildWorkerAuthHeaders', 'withNoCache');
  assert.match(headers, /isStagingPagesHost\(location\.hostname\)\) return headers/);
  const ready = functionBody(permissionSource, 'workerLooksReady', 'd1PullAuthTable');
  assert.doesNotMatch(ready, /getSharedWorkerToken/);
  const normalize = functionBody(permissionSource, 'normalizeAuth', 'getEffectiveRole');
  assert.match(normalize, /new Map\(\)/);
  assert.match(normalize, /source\.length > auth\.length/);
});

test('Staging D1 account aliases resolve to one identity and are revocable by exact stored name', () => {
  const getUser = functionBody(workerSource, 'getUser', 'getAuth');
  const getAuth = functionBody(workerSource, 'getAuth', 'requireSession');
  assert.match(getUser, /TRIM\(username\)=\?/);
  assert.match(getUser, /rowsByNormalizedUsername\(result\.results\)/);
  assert.match(getAuth, /TRIM\(username\)=\?/);
  const save = functionBody(workerSource, 'saveAuthTableData', 'normalizeBtnFlags');
  assert.match(save, /submittedUsernames\.has\(storedUsername\)/);
  assert.match(save, /WHERE username=\?/);
});

test('Staging pages do not fall back to external cloud sync or release actions', () => {
  const cloudMount = functionBody(indexSource, 'ensureCloudMounted', 'isAdminUser');
  assert.match(cloudMount, /isStagingPagesHost\(location\.hostname\)\) return null/);
  const release = functionBody(indexSource, 'triggerAdminRelease', 'scheduleAll');
  assert.match(release, /Staging 預覽不提供發布新版/);
  const cloudPull = functionBody(permissionSource, 'scheduleCloudPull', 'scheduleD1Push');
  const cloudPush = functionBody(permissionSource, 'scheduleCloudPush', 'loadResourcesForAuthTable');
  assert.match(cloudPull, /if\(isStagingPagesHost\(location\.hostname\)\) return/);
  assert.match(cloudPush, /scheduleD1Push\(reason\);\s*if\(isStagingPagesHost\(location\.hostname\)\) return/);
});

test('official-document deletion is Admin-only in the Staging page and Worker merge', () => {
  const labels = functionBody(detailSource, 'refreshR635FunctionMenuLabels', 'triggerR635FunctionButton');
  assert.match(labels, /const adminDelete=typeof canAdmin==="function"&&canAdmin\(\)/);
  assert.match(labels, /deleteOption\.hidden=!adminDelete/);
  assert.match(labels, /deleteOption\.style\.setProperty\("display","none","important"\)/);

  const toolbar = functionBody(detailSource, 'repairAndBindR614DetailToolbar', 'verifyR614DetailToolbarButtons');
  assert.match(toolbar, /replaceR614ButtonHandler\(deleteBtn,function\(\)\{\s*if\(!canAdmin\(\)\)/);
  const openDelete = functionBody(detailSource, 'openDeleteConfirmR618', 'r1186SyncDeleteWithReadback');
  assert.match(openDelete, /if\(!canAdmin\(\)\)/);
  const confirmDelete = functionBody(detailSource, 'confirmDeleteR618', 'r1186SyncDeleteWithReadback');
  assert.match(confirmDelete, /if\(!canAdmin\(\)\)/);

  const mergeStart = workerSource.indexOf("if (path === '/api/tasun/merge')");
  const mergeEnd = workerSource.indexOf("return json({ ok: false, error: 'NOT_FOUND', path }, 404, cors);", mergeStart);
  assert.ok(mergeStart >= 0 && mergeEnd > mergeStart, 'merge route must be found');
  const merge = workerSource.slice(mergeStart, mergeEnd);
  assert.match(merge, /resourceKey === 'official-documents' && me\.r !== 'admin'/);
  assert.match(merge, /DELETE_ADMIN_REQUIRED/);
  assert.ok(merge.indexOf('DELETE_ADMIN_REQUIRED') < merge.indexOf('INSERT INTO tasun_rows'), 'authorization must be checked before D1 writes');
});
