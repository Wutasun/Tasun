const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('document manager paints only a fresh, compatible, cloud-confirmed summary cache before sync', () => {
  const html = read('汐東文件管理表.html');
  assert.match(html, /function summaryHydrateCachedStats\(\)/);
  assert.match(html, /cached\.cloudConfirmed!==true/);
  assert.ok(html.includes('cached.totalRule!=="total = received + sent"'));
  assert.ok(html.includes('cached.totalDetailMode!=="one-row-per-statistical-event"'));
  assert.match(html, /cached\.supervisorDaysFilter!==SUMMARY_DAYS_ALL/);
  assert.match(html, /now-at>SUMMARY_CACHE_MAX_AGE_MS/);
  assert.match(html, /SUMMARY_CACHE_MAX_AGE_MS=7\*24\*60\*60\*1000/);

  const initAt = html.indexOf('function init(){if(window.__TASUN_AUTH_BLOCKED__)');
  const hydrateAt = html.indexOf('summaryHydrateCachedStats();', initAt);
  const localReadAt = html.indexOf('summaryRows=summaryReadLocal();', initAt);
  const scheduledReadAt = html.indexOf('requestAnimationFrame(()=>setTimeout(()=>{summaryRows=summaryReadLocal();', initAt);
  assert.ok(initAt >= 0 && hydrateAt > initAt, 'cache hydration should run during page initialization');
  assert.ok(scheduledReadAt > hydrateAt && localReadAt > scheduledReadAt, 'local rows should load only in the scheduled post-paint callback');
});

test('aggregate-only cached figures cannot open detail before source rows load', () => {
  const html = read('汐東文件管理表.html');
  assert.match(html, /summaryCacheHydrated&&!summaryRowsResolved/);
  assert.match(html, /summaryCacheHydrated\)summarySetState\("雲端未確認，顯示上次統計",false\)/);
  assert.match(html, /docManagerR717AllKpiDetailCountParity",\(\)=>\{if\(summaryCacheHydrated&&!summaryRowsResolved\)return true/);
  assert.match(html, /docManagerR717TotalEqualsReceivedPlusSent",\(\)=>\{if\(summaryCacheHydrated&&!summaryRowsResolved\)return true/);
  assert.match(html, /docManagerR680SupervisorDaysCountMatches",\(\)=>summaryCacheHydrated&&!summaryRowsResolved\?true/);
  assert.match(html, /if\(synced\)summaryCacheHydrated=false/);
  assert.match(html, /if\(synced\|\|!summaryCacheHydrated\)/);
});

test('versioned manager links avoid unnecessary per-navigation cache-busting', () => {
  const html = read('汐東文件管理表.html');
  assert.match(html, /if\(v\)u\.searchParams\.delete\("__tasun_network"\);else u\.searchParams\.set\("__tasun_network",String\(Date\.now\(\)\)\)/);
});

test('the three formal document pages keep their shared warm-navigation and dual-scroll safeguards', () => {
  for (const name of ['汐東收發文明細表.html', '汐東收發文登錄表.html', '汐東文件統計表.html']) {
    const html = read(name);
    assert.match(html, /__TASUN_R1139_PREPARE_WARM_HANDOFF__/);
    assert.match(html, /r926-formal-link/);
  }
  const detail = read('汐東收發文明細表.html');
  assert.match(detail, /singleHorizontalRail:true/);
  assert.match(detail, /singleNativeVerticalStage:true/);
  assert.match(detail, /r1103ScheduleCooperativeRows/);
  assert.match(detail, /r1113CanCommitRender/);
});
