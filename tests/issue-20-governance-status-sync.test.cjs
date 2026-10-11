'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

const issue14Arch=read('docs/superpowers/plans/2026-10-11-issue-14-geometry-architecture.md');
const issue14Spec=read('docs/superpowers/plans/2026-10-11-issue-14-geometry-written-spec.md');
const issue15Arch=read('docs/superpowers/plans/2026-10-11-issue-15-artifact-abort-architecture.md');
const issue15Spec=read('docs/superpowers/plans/2026-10-11-issue-15-artifact-abort-written-spec.md');
const template=read('docs/superpowers/plans/TEMPLATE-tasun-architecture-written-spec.md');

const APPROVED_STATUS='Status: ARCHITECTURE APPROVED / WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED';

test('Issue #20 keeps Issue #14 architecture approval projection synchronized',()=>{
  assert.ok(issue14Spec.includes('Status: WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED'));
  assert.ok(issue14Arch.includes(APPROVED_STATUS));
  assert.ok(issue14Arch.includes('- [x] completed after architecture approval'));
  assert.ok(issue14Arch.includes('- [x] explicitly approved by user on 2026-10-11'));
  assert.ok(issue14Arch.includes('IMPLEMENTATION-TDD AUTHORIZED'));
  assert.ok(!issue14Arch.includes('Implementation/TDD remains unauthorized until the written spec is completed'));
});

test('Issue #20 keeps Issue #15 architecture approval projection synchronized',()=>{
  assert.ok(issue15Spec.includes('Status: WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED'));
  assert.ok(issue15Arch.includes(APPROVED_STATUS));
  assert.ok(issue15Arch.includes('- [x] completed after architecture approval'));
  assert.ok(issue15Arch.includes('- [x] explicitly approved by user on 2026-10-11'));
  assert.ok(issue15Arch.includes('IMPLEMENTATION-TDD AUTHORIZED'));
  assert.ok(!issue15Arch.includes('Implementation/TDD remains unauthorized until the written spec is completed'));
});

test('Issue #20 template requires atomic same-change approval synchronization',()=>{
  assert.ok(template.includes('same governance PR/commit'));
  assert.ok(template.includes('paired architecture document'));
  assert.ok(template.includes('Do not merge a written-spec approval record if its paired architecture document still carries an earlier gate state.'));
  assert.ok(template.includes('explicit user approval'));
  assert.ok(template.includes('latest current `main`'));
});

test('Issue #20 remains governance-only',()=>{
  assert.ok(!template.includes('self-approve'));
  assert.ok(template.includes('`tasun-version.json` remains the sole formal release-version authority'));
});
