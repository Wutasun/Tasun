const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '..', '汐東收發文明細表.html'), 'utf8');

test('subject headers stay centered while subject values keep the 15/20 grapheme sizing contract', () => {
  const subjectWidthStart = page.indexOf('function r1127SubjectCapacityFloorPx(');
  const subjectWidthEnd = page.indexOf('\nfunction r993ExactTargetDataWidthPx(', subjectWidthStart);
  assert.ok(subjectWidthStart >= 0 && subjectWidthEnd > subjectWidthStart);
  const subjectWidth = page.slice(subjectWidthStart, subjectWidthEnd);
  assert.match(subjectWidth, /const start=r990IsStartSubjectColumn\(header\),limit=.*start\?15:20/);
  assert.match(subjectWidth, /paddingPx=\(96\/2\.54\)\*\.1/);
  assert.match(subjectWidth, /widestRenderedLinePx/);
  assert.match(page, /function r1127RenderedLineMaxPx\(cell\)/);
  assert.match(subjectWidth, /r1127RenderedLineMaxPx\(cell\)/);
  assert.match(page, /header\.style\.setProperty\("text-align","center","important"\)/);
  assert.match(page, /r1104ApplyBodyAlignmentCell\(cell,label/);
  assert.match(page, /r933SubjectRightPaddingCm="0\.05"/);
});

test('subject width includes the browser rendered width when font metrics exceed canvas estimates', () => {
  const start = page.indexOf('function r1127RenderedLineMaxPx(cell)');
  const end = page.indexOf('\nfunction r1127HardWrapSubjectHost(', start);
  assert.ok(start >= 0 && end > start);
  const context = require('node:vm').createContext({
    Array, Number, document: { createRange: () => ({ selectNodeContents() {}, getClientRects: () => [{ width: 219.5 }], detach() {} }) }
  });
  require('node:vm').runInContext(page.slice(start, end), context);
  assert.equal(context.r1127RenderedLineMaxPx({}), 219.5);
});

test('document-number heading is centered and single-line; body-only formatter never rewrites TH text layout', () => {
  const ruleStart = page.indexOf('function r998ApplyHeaderTextRules(');
  const ruleEnd = page.indexOf('\nfunction r951IsProcessingUnitHeader(', ruleStart);
  assert.ok(ruleStart >= 0 && ruleEnd > ruleStart);
  const headerRules = page.slice(ruleStart, ruleEnd);
  assert.match(headerRules, /r998HeaderSource\(source\)==="文號"/);
  assert.match(headerRules, /text-align","center"/);
  assert.match(headerRules, /direction","ltr"/);
  const formatterStart = page.indexOf('function r1104FinalizeCooperativeMetadata(');
  const formatterEnd = page.indexOf('\n  function applyTableCooperative(', formatterStart);
  assert.ok(formatterStart >= 0 && formatterEnd > formatterStart);
  const formatter = page.slice(formatterStart, formatterEnd);
  assert.match(formatter, /isDocNo\(label\).*text-align","center".*white-space","nowrap"/);
  assert.doesNotMatch(formatter, /api\.apply\(header\)/);
  assert.match(page, /R930_DOCNO_MAX_GRAPHEMES=15/);
  assert.match(page, /after-di-plus-max15/);
});
