const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '..', '汐東收發文明細表.html'), 'utf8');

test('document-number links are block-contained inside their own table cell', () => {
  const start = page.indexOf('function r930RenderDocNoHost(');
  const end = page.indexOf('\nfunction r930HostLines(', start);
  assert.ok(start >= 0 && end > start, 'document-number wrap authority must exist');
  const apply = page.slice(start, end);
  assert.match(apply, /host\.tagName!=="TD"/);
  assert.match(apply, /setProperty\("display","block","important"\)/);
  assert.match(apply, /setProperty\("width","100%","important"\)/);
  assert.match(apply, /setProperty\("overflow","hidden","important"\)/);
  assert.match(apply, /currentStyle\.whiteSpace==="nowrap"&&contained/);
  const verifyStart = page.indexOf('function r930VerifyDocNoMax15AfterDi(');
  const verifyEnd = page.indexOf('\nconst r930DocNoApi=', verifyStart);
  assert.ok(verifyStart >= 0 && verifyEnd > verifyStart, 'document-number containment verifier must exist');
  const verify = page.slice(verifyStart, verifyEnd);
  assert.match(verify, /const hostOk=hosts\.every[\s\S]*contained/);
  assert.match(verify, /cs\.display==="block"&&cs\.boxSizing==="border-box"&&cs\.overflow==="hidden"/);
});

test('verified cloud data is rendered and viewport rails rebound before the synced status is published', () => {
  const helperStart = page.indexOf('async function r1070CommitVerifiedProjection(');
  const helperEnd = page.indexOf('\nfunction r836ScheduleSyncTerminalRender(', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, 'verified projection commit helper must exist');
  const helper = page.slice(helperStart, helperEnd);
  assert.match(helper, /renderAll\(\{r999BackgroundTerminalProjection:true/);
  assert.match(helper, /await r1103WaitForCurrentRender\(\)/);
  assert.ok(helper.indexOf('await r1103WaitForCurrentRender()') < helper.indexOf('rebindInteraction'));
  assert.match(helper, /writeHorizontal\?\.\(beforeH\)/);
  assert.match(helper, /writeVertical\?\.\(beforeV\)/);

  const successStart = page.indexOf('const r1070WaitForVerifiedProjection=');
  const successEnd = page.indexOf('return true;', successStart);
  assert.ok(successStart >= 0 && successEnd > successStart, 'verified readback completion block must exist');
  const success = page.slice(successStart, successEnd);
  assert.match(success, /pending:r1070WaitForVerifiedProjection/);
  assert.ok(success.indexOf('await r1070CommitVerifiedProjection') < success.indexOf('r792SetStatusForRun(runId,"已同步"'));
  assert.match(success, /r836ScheduleSyncTerminalRender\("r963-verified-retry"\)/);
});

test('subject data retains exact 0.05cm inline insets and its 15/20 grapheme caps', () => {
  const apply = page.slice(page.indexOf('function r848ApplyBodyMax15Cell('), page.indexOf('\n  function r1126ApplyDetachedSubjectRules('));
  assert.match(apply, /const isNumber=r910IsDocNoLabel\(label\)/);
  assert.match(apply, /\["padding-left","padding-inline-start"\]\.forEach\(name=>cell\.style\.setProperty\(name,subjectLeft/);
  assert.match(apply, /cell\.style\.setProperty\("padding-right",subjectRight,"important"\)/);
  assert.match(apply, /r936BodyLimit\(label,cell\)/);
  assert.ok(page.includes('"START_SUBJECT_MAX_CHARS":15,"STAGE_SUBJECT_MAX_CHARS":20'));
});
