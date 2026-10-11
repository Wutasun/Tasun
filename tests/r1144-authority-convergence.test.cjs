'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

function extractFunction(source, name) {
  const marker = 'function ' + name;
  const start = source.indexOf(marker);
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
  const src = extractFunction(register, 'converge');
  assert.match(src, /AbortError[\s\S]{0,260}(cancel|supersed)/i, 'AbortError must terminate as cancellation/supersession');
  assert.doesNotMatch(src, /AbortError[\s\S]{0,180}html_probe_timeout/i, 'AbortError must not be classified as html probe timeout failure');
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
    extractFunction(register, 'converge'),
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
