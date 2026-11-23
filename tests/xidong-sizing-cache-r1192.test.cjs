const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const page = fs.readFileSync(path.join(__dirname, '..', '汐東收發文明細表.html'), 'utf8');
const start = page.indexOf('function r993MeasureTextPx(');
const end = page.indexOf('\nfunction r1012MeasureFinalProjectionTextPx(', start);
assert.ok(start >= 0 && end > start, 'canvas text measurement function must exist');

test('column sizing memoizes duplicate text metrics and caps per-pass memory', () => {
  const measureStart = page.indexOf('function r993MeasureTextPx(');
  const measureEnd = page.indexOf('\nfunction r1012MeasureFinalProjectionTextPx(', measureStart);
  const source = page.slice(measureStart, measureEnd);
  let canvasMeasures = 0;
  const context = vm.createContext({
    String, Number, Math,
    r993TargetWidthMeasureCache: new Map(),
    r993TargetFont: () => '16px sans-serif',
    r993TargetWidthContext: {
      set font(_value) {},
      measureText: value => { canvasMeasures++; return { width: String(value).length * 8 }; }
    },
    r993TargetWidthCanvas: null,
    document: {},
    r757UnicodeLength: value => Array.from(String(value)).length
  });
  vm.runInContext(source, context);
  assert.equal(context.r993MeasureTextPx({}, '重複主旨', 16), 32);
  assert.equal(context.r993MeasureTextPx({}, '重複主旨', 16), 32);
  assert.equal(canvasMeasures, 1, 'identical font/text pair should be measured once');
  for (let index = 0; index < 4100; index++) context.r993MeasureTextPx({}, `文字${index}`, 16);
  assert.equal(context.r993TargetWidthMeasureCache.size, 4096, 'cache must stay within the fixed memory cap');
});

test('cache is confined to the exact column sizing pass', () => {
  const sizingStart = page.indexOf('function r757ApplyAdaptiveColumnSizing(');
  const sizingEnd = page.indexOf('\nfunction r757CancelColumnSizing(', sizingStart);
  assert.ok(sizingStart >= 0 && sizingEnd > sizingStart);
  const sizing = page.slice(sizingStart, sizingEnd);
  const begin = sizing.indexOf('r993TargetWidthMeasureCache=new Map()');
  const close = sizing.indexOf('r993TargetWidthMeasureCache=null', begin);
  assert.ok(begin >= 0 && close > begin, 'cache must be released after exact width measurement');
  assert.match(sizing.slice(begin, close), /headers\.map/);
  assert.match(sizing.slice(close), /table\.dataset\.r1192WidthMeasureCacheLimit="4096"/);
});
