const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const page = fs.readFileSync(path.join(__dirname, '..', '汐東收發文明細表.html'), 'utf8');
const start = page.indexOf('function r1127SubjectCapacityFloorPx(');
const end = page.indexOf('\nfunction r993ExactTargetDataWidthPx(', start);
assert.ok(start >= 0 && end > start, 'subject capacity width authority must exist');
const source = page.slice(start, end);

function measureWidth(text) {
  return Array.from(String(text)).reduce((sum, char) => sum + (char.codePointAt(0) > 255 ? 10 : 5), 0);
}
function runFloor({ startSubject, text }) {
  const measured = [];
  const header = { startSubject, dataset: {} };
  const cell = { text };
  const context = vm.createContext({
    Math, Number, String, Array,
    r990WidthFieldLabel: () => '主旨',
    r990IsStartSubjectColumn: value => value.startSubject,
    r990SubjectLimit: value => value.startSubject ? 15 : 20,
    r763HeaderSourceText: () => '主旨',
    r763HeaderGraphemes: value => Array.from(String(value)),
    r990CellDisplayTextWithBreaks: value => value.text,
    r757TextLines: value => String(value).split('\n'),
    r990ChunkDisplayLine: (value, max) => {
      const chars = Array.from(String(value || ''));
      if (chars.length <= max) return [String(value || '')];
      const out = [];
      for (let i = 0; i < chars.length; i += max) out.push(chars.slice(i, i + max).join(''));
      return out;
    },
    r1012MeasureFinalProjectionTextPx: (_cell, value) => {
      measured.push(String(value));
      return measureWidth(value);
    }
  });
  vm.runInContext(source, context);
  return { px: context.r1127SubjectCapacityFloorPx(header, [cell], 12), header, measured };
}

test('subject width floor measures the actual rendered line and only 0.05cm per side', () => {
  const result = runFloor({ startSubject: false, text: 'A1234567890123456789B' });
  assert.equal(result.header.dataset.r1127SubjectCapacityLimit, '20');
  assert.equal(result.header.dataset.r1127SubjectCapacityChars, '20');
  assert.equal(result.header.dataset.r1127SubjectCapacityMode, 'stage-actual-line-px-capped-20');
  assert.equal(result.px, Math.ceil(Math.max(measureWidth('主旨'), measureWidth('A1234567890123456789')) + (96 / 2.54) * .1 + 3));
  assert.ok(!result.measured.includes('國'.repeat(20)), 'full-width surrogate must not inflate mixed-script cells');
});

test('start subject keeps the 15-grapheme cap when measuring natural content width', () => {
  const value = 'A12345678901234';
  const result = runFloor({ startSubject: true, text: value });
  assert.equal(result.header.dataset.r1127SubjectCapacityLimit, '15');
  assert.equal(result.header.dataset.r1127SubjectCapacityChars, '15');
  assert.equal(result.header.dataset.r1127SubjectCapacityMode, 'start-actual-line-px-capped-15');
  assert.equal(result.px, Math.ceil(Math.max(measureWidth('主旨'), measureWidth(value)) + (96 / 2.54) * .1 + 3));
});
