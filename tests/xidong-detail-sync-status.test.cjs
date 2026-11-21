const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const page = fs.readFileSync(path.join(__dirname, '..', '汐東收發文明細表.html'), 'utf8');
const start = page.indexOf('function r1134StartupAwaitingCanExpire(');
const end = page.indexOf('\nfunction setStatus(', start);
assert.ok(start >= 0 && end > start, 'detail sync status authority must exist');
const source = page.slice(start, end);
const adoptionStart = page.indexOf('async function r1092AdoptPrefetchAsVisiblePreview(');
const adoptionEnd = page.indexOf('\nasync function r1088ConsumeInitialCloudPrefetch(', adoptionStart);
assert.ok(adoptionStart >= 0 && adoptionEnd > adoptionStart, 'background preview adoption authority must exist');
const adoptionSource = page.slice(adoptionStart, adoptionEnd);
const prefetchStart = page.indexOf('r1088InitialCloudPrefetchPromise.then(result=>');
const prefetchEnd = page.indexOf('.catch(()=>false)', prefetchStart);
assert.ok(prefetchStart >= 0 && prefetchEnd > prefetchStart, 'open prefetch continuation must exist');
const prefetchContinuation = page.slice(prefetchStart, prefetchEnd);


function evaluate(state, options = {}, internalText = '') {
  const context = vm.createContext({
    navigator: { onLine: options.online !== false },
    window: {},
    rows: [{}],
    session: { user: 'test' },
    r710AuthoritySyncPromise: null,
    r792ActiveSyncRunId: 0,
    r710InitStarted: false,
    r710InitStarting: options.initStarting === true,
    r1129OpenTransientRetryTimer: 0,
    r1063DetailDataAuthorityReady: () => true,
    r774ActiveCount: rows => rows.filter(row => !row.deleted).length,
    normalizeCloudStatusText: message => {
      const value = String(message || '').trim();
      if (/同步中|處理中|checking|檢查/i.test(value)) return '同步處理中';
      if (/待登入|未授權|權限不足|401|403|UNAUTH|FORBIDDEN|expired/i.test(value)) return '待登入授權';
      if (/連線失敗|Failed to fetch|NetworkError|Load failed|CORS|ERR_|timeout|timed out|AbortError/i.test(value)) return '連線失敗';
      if (/同步失敗|INTERNAL|BAD_INPUT|METHOD|NOT_FOUND|API/i.test(value)) return '同步失敗';
      return value || '等待同步';
    }
  });
  vm.runInContext(source, context);
  return context.r1063ExpectedDetailSyncText(state, internalText);
}

function r1134StartupAwaitingCanExpire(state, options = {}) {
  const context = vm.createContext({
    r710AuthoritySyncPromise: options.syncPromise ? {} : null,
    r792ActiveSyncRunId: options.activeSyncRunId || 0,
    r710InitStarted: options.initStarted === true,
    r710InitStarting: options.initStarting === true
  });
  vm.runInContext(source, context);
  return context.r1134StartupAwaitingCanExpire(state);
}

test('startup remains a connection check after the old 8.5 second grace expires', () => {
  assert.equal(evaluate({ r1134StartupAwaitingFormalSync: false, r1134StartupAt: Date.now() - 12000, pending: false }, { initStarting: true }, '沒同步'), '連線確認中');
});

test('startup grace period is shown as connection confirmation before formal sync begins', () => {
  assert.equal(evaluate({ r1134StartupAwaitingFormalSync: true, r1134StartupAt: Date.now(), pending: false }), '連線確認中');
});

test('startup grace is not expired while initialization is still in progress', () => {
  const state = { r1134StartupAwaitingFormalSync: true, pending: false, verified: false };
  assert.equal(r1134StartupAwaitingCanExpire(state, { initStarting: true }), false);
  assert.equal(r1134StartupAwaitingCanExpire(state, {}), true);
  assert.equal(r1134StartupAwaitingCanExpire(state, { activeSyncRunId: 1 }), false);
});

test('terminal connection and initialization errors are not collapsed into generic no-sync', () => {
  assert.equal(evaluate({ pending: false }, {}, '連線失敗'), '連線失敗');
  assert.equal(evaluate({ pending: false, message: '初始化失敗' }), '初始化失敗');
});

test('unverified idle state remains no-sync and verified readback remains synced', () => {
  assert.equal(evaluate({ pending: false }), '沒同步');
  assert.equal(evaluate({ verified: true, pending: false }), '已同步');
});
test('background cloud preview cannot render concurrently with startup init', async () => {
  const window = {};
  const context = vm.createContext({ window, r710InitStarting: true, Date });
  vm.runInContext(adoptionSource, context);
  assert.equal(await context.r1092AdoptPrefetchAsVisiblePreview(320, { background: true }), false);
  assert.equal(window.__TASUN_R1092_BACKGROUND_PREFETCH_ADOPTION_DEFERRED__?.reason, 'formal-init-owns-render');
});

test('only the background prefetch path opts into the init race guard', () => {
  assert.ok(prefetchContinuation.includes('r1092AdoptPrefetchAsVisiblePreview(320,{background:true})'));
  assert.ok(page.includes('await r1092AdoptPrefetchAsVisiblePreview(180)'));
});


const deleteStart = page.indexOf('async function r1186SyncDeleteWithReadback(');
const deleteEnd = page.indexOf('\nasync function confirmDeleteR618()', deleteStart);
assert.ok(deleteStart >= 0 && deleteEnd > deleteStart, 'delete readback authority must exist');
const deleteSource = page.slice(deleteStart, deleteEnd);

test('delete drains an older sync and reports success only after verified tombstone readback', () => {
  assert.match(deleteSource, /await flight/);
  assert.match(deleteSource, /saveLocal\(\);renderAll\(\)/);
  assert.match(deleteSource, /await authoritySync\(reason\)/);
  assert.match(deleteSource, /state\.verified===true&&state\.pending!==true&&state\.reason===reason/);
  assert.match(deleteSource, /finalReadback\.verified===true/);
  assert.match(deleteSource, /confirmedRow\.deleted===true/);
  const confirmStart = page.indexOf('async function confirmDeleteR618()');
  const confirmEnd = page.indexOf('\nfunction bindR618DetailDeleteModal()', confirmStart);
  const confirmSource = page.slice(confirmStart, confirmEnd);
  assert.match(confirmSource, /saveLocal\(\)/);
  assert.match(confirmSource, /const syncReason="detail-delete-r1186"/);
  assert.match(confirmSource, /if\(confirmed\)toast\("已刪除 1 筆資料，且雲端讀回確認完成。"/);
});
