const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '..', '汐東收發文明細表.html'), 'utf8');

test('horizontal rail drag previews compositor transforms without per-pointer native scroll reads', () => {
  const projectStart = page.indexOf('function projectGlobalPosition(');
  const projectEnd = page.indexOf('\n function setGlobalHorizontalTarget(', projectStart);
  assert.ok(projectStart >= 0 && projectEnd > projectStart, 'single horizontal projection function must exist');
  const project = page.slice(projectStart, projectEnd);
  assert.match(project, /if\(!g\.dragActive\)r1131NormalizeNativeHorizontalOrigin\(x,"project-global-position"\)/);
  assert.match(project, /setTransform\(x\.dataTrack,-p\)/);
  assert.match(project, /setTransform\(x\.headerTrack,-p\)/);
  assert.match(project, /setThumbs\(p,x\)/);

  const previewStart = page.indexOf('function previewHorizontalTarget(');
  const previewEnd = page.indexOf('\n function commitHorizontalTarget(', previewStart);
  assert.ok(previewStart >= 0 && previewEnd > previewStart, 'rail preview/commit handlers must exist');
  assert.match(page.slice(previewStart, previewEnd), /projectGlobalPosition\(pos,null,false\)/);

  const commitStart = page.indexOf('function commitHorizontalTarget(');
  const commitEnd = page.indexOf('\n function bindRail(', commitStart);
  assert.ok(commitStart >= 0 && commitEnd > commitStart, 'rail commit handler must exist');
  const commit = page.slice(commitStart, commitEnd);
  assert.ok(commit.indexOf('horizontalState.dragActive=false') < commit.indexOf('projectGlobalPosition(p,x,false)'),
    'native horizontal origin is still normalized once at drag end');
  assert.match(commit, /r1131NormalizeNativeHorizontalOrigin\(x,"pointer-commit"\)/);
});
