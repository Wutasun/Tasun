'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

function extractFunction(source, name) {
  const plain = 'function ' + name;
  const asyncMarker = 'async function ' + name;
  const asyncStart = source.indexOf(asyncMarker);
  const plainStart = source.indexOf(plain);
  const start = asyncStart >= 0 ? asyncStart : plainStart;
  assert.notEqual(start, -1, 'missing function ' + name);
  const open = source.indexOf('{', start);
  let depth = 0, quote = '', esc = false, line = false, block = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unterminated function ' + name);
}

function count(source, needle) {
  let n = 0, i = 0;
  while ((i = source.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

const detail = read('汐東收發文明細表.html');
const register = read('汐東收發文登錄表.html');
const stats = read('汐東文件統計表.html');
const manager = read('汐東文件管理表.html');

test('R1144 detail current SelfHeal uses public bridge only', () => {
  const src = extractFunction(detail, 'r1113RegisterCurrentSelfHeal');
  assert.doesNotMatch(src, /r990WidthFieldLabel\s*\(/, 'current SelfHeal must not call R990 private width helpers');
  assert.doesNotMatch(src, /r1012RefreshPostCommitGeometry\?\.\([^)]*forceExactSizing:true/s, 'current SelfHeal must not force exact geometry synchronously');
  assert.match(src, /__TASUN_ACTIVE_SCROLL_API__/, 'current SelfHeal should validate/repair through public scroll API');
});

test('R1144 manager current SelfHeal has no cross-IIFE lifecycle private references', () => {
  const src = extractFunction(manager, 'registerSelfHeal');
  assert.doesNotMatch(src, /String\(bindLifecycle\)/, 'manager SelfHeal must not stringify private bindLifecycle');
  assert.doesNotMatch(src, /String\(clearLocks\)/, 'manager SelfHeal must not stringify private clearLocks');
  assert.doesNotMatch(src, /=>clearLocks\(\)/, 'manager SelfHeal must not directly repair through private clearLocks');
});

test('R1144 intentional artifact AbortError is quiet cancellation, not failure retry', () => {
  const src = extractFunction(register, 'probe');
  assert.match(src, /e&&e\.name===\"AbortError\"[\s\S]{0,420}(cancel|supersed)/i, 'AbortError must terminate as cancellation/supersession');
  const abortAt = src.indexOf('e&&e.name===\"AbortError\"');
  const warnAt = src.indexOf('console.warn', abortAt);
  const retryAt = src.indexOf('scheduleRetry', abortAt);
  const returnAt = src.indexOf('return false', abortAt);
  assert.ok(abortAt >= 0 && returnAt > abortAt, 'AbortError branch must return terminally');
  assert.ok(warnAt === -1 || returnAt < warnAt, 'AbortError cancellation must return before warning');
  assert.ok(retryAt === -1 || returnAt < retryAt, 'AbortError cancellation must return before retry scheduling');
});

test('R1144 only scheduler owns exact sizing', () => {
  assert.equal(count(detail, 'forceExactSizing:true'), 0, 'direct forceExactSizing callers must be retired; scheduler owns exact sizing');
  const scheduler = extractFunction(detail, 'r1113RequestGeometry');
  assert.match(scheduler, /r1065CommitExactGeometryIfIdle/, 'scheduler must delegate exact commit through the one exact geometry authority');
});

test('R1144 Show All waits for semantic terminal parity before success', () => {
  const src = extractFunction(detail, 'r1102ScheduleInteractionRender');
  assert.match(src, /semanticRowsOk/, 'interaction terminal must calculate semantic row parity');
  const successAt = src.indexOf('toast("已全部顯示。")');
  const parityAt = src.indexOf('semanticRowsOk');
  assert.ok(successAt > parityAt && parityAt >= 0, 'Show All success must occur after semantic parity logic');
});

test('R1144 Search and Show All preempt pending heavy geometry before semantic commit', () => {
  const search = extractFunction(detail, 'applyR603DetailSearch');
  const all = extractFunction(detail, 'clearR603DetailSearch');
  for (const [name, src] of [['search', search], ['show-all', all]]) {
    const cancelAt = src.indexOf('cancelPendingGeometry');
    const dispatchAt = src.indexOf('r1102ScheduleInteractionRender');
    assert.ok(cancelAt >= 0 && dispatchAt > cancelAt, name + ' must cancel pending geometry before render transaction dispatch');
  }
});

test('R1144 projection visibility remains atomic', () => {
  const src = extractFunction(detail, 'r1142SetFrozenProjectionReady');
  assert.match(src, /visibility/, 'projection readiness must gate visibility');
  assert.match(src, /hidden/, 'unsealed projection must be hidden');
  assert.match(src, /visible/, 'sealed projection may be revealed');
});

test('R1144 no polling in formal current critical paths', () => {
  const blocks = [
    extractFunction(detail, 'r1113RegisterCurrentSelfHeal'),
    extractFunction(detail, 'r1113RequestGeometry'),
    extractFunction(register, 'probe'),
    extractFunction(manager, 'registerSelfHeal')
  ];
  for (const src of blocks) assert.doesNotMatch(src, /setInterval\s*\(/, 'critical path must not poll');
});

test('R1144 four pages preserve one formal data contract identity fields', () => {
  for (const [name, src] of [['detail', detail], ['register', register], ['stats', stats], ['manager', manager]]) {
    if (name === 'manager') continue;
    for (const field of ['uid', 'rev', 'updatedAt', 'deleted']) {
      assert.ok(src.includes(field), name + ' must retain ' + field);
    }
  }
});


test('R1144 statistics automatic current baseline retires R1138 historical leaf', () => {
  const src = extractFunction(stats, 'currentBaseline');
  assert.match(src, /R1144\|r1144/, 'statistics current baseline must recognize R1144');
  assert.doesNotMatch(src, /R1138\|r1138/, 'R1138 must not remain an automatic current baseline');
});


test('R1144 public scroll bridge exposes control operations, not exact-commit internals', () => {
  assert.match(detail, /markGeometryDirty:r1144MarkGeometryDirty,requestGeometry:r1113RequestGeometry/);
  assert.doesNotMatch(detail, /requestExactGeometry:r1065RequestExactGeometry/);
  assert.doesNotMatch(detail, /commitExactGeometryIfIdle:r1065CommitExactGeometryIfIdle/);
  assert.doesNotMatch(detail, /cancelPendingGeometry:r1103CancelPendingGeometry,r1113MeasureGeometry/);
});

test('R1144 current SelfHeal leaf is public-bridge-only and historical compatibility auto-run is retired', () => {
  const src = extractFunction(detail, 'r1113RegisterCurrentSelfHeal');
  for (const forbidden of ['r990WidthFieldLabel(', 'r1065RequestExactGeometry(', 'r1065CommitExactGeometryIfIdle(', 'r1012RefreshPostCommitGeometry(', 'r1113RequestGeometry(']) {
    assert.equal(src.includes(forbidden), false, 'current SelfHeal must not invoke private geometry symbol ' + forbidden);
  }
  assert.match(src, /officialDocsR1144AuthorityConvergence/);
  assert.match(src, /__TASUN_ACTIVE_SCROLL_API__/);
  assert.match(detail, /R1113_COMPATIBILITY_SELFHEAL_NAMES=new Set\(\)/);
});

test('R1144 native vertical scroll is isolated from exact geometry scheduling', () => {
  const src = extractFunction(detail, 'bindStage');
  const scrollAt = src.indexOf('addEventListener("scroll"');
  const wheelAt = src.indexOf('addEventListener("wheel"', scrollAt);
  assert.ok(scrollAt >= 0 && wheelAt > scrollAt);
  const verticalScroll = src.slice(scrollAt, wheelAt);
  assert.doesNotMatch(verticalScroll, /requestGeometry|requestExactGeometry|r1113RequestGeometry|r1065RequestExactGeometry|commitExactGeometry/i);
});

test('R1144 warm handoff is exact same-resource/build, mutation-free and bounded to 120 seconds', () => {
  assert.match(detail, /R1139_WARM_HANDOFF_TTL_MS=120000/);
  const intent = extractFunction(detail, 'r1139WarmIntentForCurrentPage');
  assert.match(intent, /x\.resourceKey!==RESOURCE_KEY/);
  assert.match(intent, /x\.build!==BUILD/);
  assert.match(intent, /R1139_WARM_HANDOFF_TTL_MS/);
  const validated = extractFunction(detail, 'r1139WarmHandoffValidated');
  assert.match(validated, /r1092ReadLocalMutation\(\)/);
  assert.match(validated, /r1139RowMetadataStamp\(rows\)/);
  assert.match(validated, /verifiedReceiptAt/);
});

test('R1144 manager historical checks are diagnostic-only; one current convergence leaf auto-registers', () => {
  const src = extractFunction(manager, 'registerSelfHeal');
  assert.match(src, /__TASUN_R1144_MANAGER_HISTORICAL_SELFHEAL_AUTO_RETIRED__=true/);
  assert.match(src, /docManagerR1144AuthorityConvergence/);
  const registrations = [...src.matchAll(/core\.register\(/g)].length;
  assert.equal(registrations, 1, 'manager function must auto-register only the R1144 current leaf');
});

test('R1144 register and statistics current baseline no longer auto-run R1138', () => {
  const reg = extractFunction(register, 'currentBaseline');
  const stat = extractFunction(stats, 'currentBaseline');
  for (const src of [reg, stat]) {
    assert.match(src, /R1144\|r1144/);
    assert.doesNotMatch(src, /R1138\|r1138/);
  }
});
