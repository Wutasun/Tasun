'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const DETAIL=fs.readFileSync(path.join(ROOT,'汐東收發文明細表.html'),'utf8');
const REGISTER=fs.readFileSync(path.join(ROOT,'汐東收發文登錄表.html'),'utf8');

function functionBody(source,name){
  const marker='function '+name+'(';
  const start=source.indexOf(marker);
  assert.notEqual(start,-1,`missing function ${name}`);
  const brace=source.indexOf('{',start);
  assert.notEqual(brace,-1,`missing body for ${name}`);
  let depth=0,quote='',escape=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escape){escape=false;continue;}
      if(ch==='\\'){escape=true;continue;}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='\`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'){
      depth--;
      if(depth===0)return source.slice(brace+1,i);
    }
  }
  throw new Error('unterminated function '+name);
}

test('Issue #44 detail dropdown click never falls back to synchronous full option scan',()=>{
  const build=functionBody(DETAIL,'buildR603DetailSearchForm');
  assert.ok(!build.includes('r950RefreshSearchOptionList(idx,false)'),
    'detail dropdown click must not synchronously refresh/scan on cache miss');
  assert.ok(build.includes('r950OpenPreparedSearchOptions'),
    'detail dropdown click must use the prepared-projection open path');
});

test('Issue #44 detail prepared projection owns cache-miss scheduling',()=>{
  const refresh=functionBody(DETAIL,'r950RefreshSearchOptionList');
  assert.ok(!refresh.includes('cached||r950ComputeSearchOptions'),
    'refresh/open path must not synchronously compute expensive options');
  assert.ok(DETAIL.includes('function r950OpenPreparedSearchOptions'),
    'prepared open helper must exist inside the R950 authority');
  assert.ok(DETAIL.includes('function r950EnsureSearchOptionProjection'),
    'cooperative ensure helper must exist inside the R950 authority');
});

test('Issue #44 register projection invalidation separates rows and field scopes',()=>{
  assert.ok(REGISTER.includes('function r953InvalidateRegisterRowsProjection'),
    'rows-business invalidation helper must exist');
  assert.ok(REGISTER.includes('function r953InvalidateRegisterFieldProjection'),
    'field-only invalidation helper must exist');
  const legacy=functionBody(REGISTER,'r953InvalidateRegisterProjection');
  assert.ok(!/r953RegisterFieldOptionCache\.clear\(\).*r953RegisterParentOptionCache\.clear\(\)/s.test(legacy),
    'generic invalidation must not always clear field and parent projections together');
});

test('Issue #44 register warm-up discovers actual visible combo fields',()=>{
  const warm=functionBody(REGISTER,'r1048WarmRegisterDropdownCaches');
  assert.ok(warm.includes('querySelectorAll'),
    'register warm-up must discover rendered combo controls');
  assert.ok(warm.includes('r715Combo'),
    'register warm-up must derive actual combo fields');
  assert.ok(!warm.includes('r953CachedRegisterFieldOptions("文號");r953CachedRegisterFieldOptions("主旨")'),
    'register warm-up must not be hard-coded to only docNo and subject');
});

test('Issue #44 register direction changes invalidate only dependent prepared projections',()=>{
  const build=functionBody(REGISTER,'buildRegisterForm');
  assert.ok(build.includes('r953InvalidateRegisterFieldProjection("上階文號"'),
    'source-direction change must invalidate the parent-document prepared projection');
  assert.ok(build.includes('r953InvalidateRegisterFieldProjection("文號"'),
    'own-direction change must invalidate document-number prepared projections');
});

test('Issue #44 register combo open never runs semantic full-row source synchronously',()=>{
  const combo=functionBody(REGISTER,'r715CreateCombo');
  assert.ok(!combo.includes('if(opening){') || !combo.includes('render("");'),
    'combo opening path must not call the source-render path synchronously');
  assert.ok(combo.includes('r953OpenPreparedRegisterCombo'),
    'combo opening must use prepared projection path');
});

test('Issue #44 saved-detail Yes path arms one-shot trusted same-tab departure',()=>{
  const leave=functionBody(REGISTER,'r950LeaveRegisterForSavedDetail');
  assert.ok(leave.includes('r950ArmTrustedSavedDetailDeparture'),
    'trusted saved-detail departure must be armed only in the explicit Yes path');
  assert.ok(REGISTER.includes('function r950ConsumeTrustedSavedDetailDeparture'),
    'trusted departure state must be one-shot consumable');
});

test('Issue #44 unload guard preserves normal protection but exempts exact trusted departure',()=>{
  assert.ok(REGISTER.includes('r950ConsumeTrustedSavedDetailDeparture'),
    'beforeunload path must consult the trusted departure state');
  assert.ok(REGISTER.includes('r1089ReadLocalMutation()'),
    'normal local-mutation protection must remain');
  assert.ok(REGISTER.includes('syncState.pending===true')&&REGISTER.includes('syncState.verified!==true'),
    'normal pending/unverified protection must remain');
  const arm=functionBody(REGISTER,'r950ArmTrustedSavedDetailDeparture');
  assert.ok(!arm.includes('r1089ClearLocalMutation')&&!arm.includes('verified:true'),
    'trusted navigation must not clear mutation or fabricate cloud verification');
});

test('Issue #44 detail visible gate canonicalizes docNo while preserving exact UIDs',()=>{
  const visible=functionBody(DETAIL,'r1058TargetVisible');
  assert.ok(visible.includes('r715ValueKey')||visible.includes('r1058CanonicalDocNoKey'),
    'detail visible gate must compare canonical document-number keys');
  assert.ok(visible.includes('===rowUid'),'row UID match must remain exact');
  assert.ok(visible.includes('===stageUid'),'stage UID match must remain exact');
  assert.ok(visible.includes('===replyUid'),'reply UID match must remain exact');
});

test('Issue #44 retains existing transport/sync authority and no polling',()=>{
  assert.ok(REGISTER.includes('r1061WriteSaveTransport'));
  assert.ok(REGISTER.includes('r1061ScheduleBackgroundSaveSync'));
  assert.ok(DETAIL.includes('r1083FinalizeTransportAfterVisibleRender'));
  assert.ok(!functionBody(REGISTER,'r950LeaveRegisterForSavedDetail').includes('setInterval'));
  assert.ok(!functionBody(DETAIL,'r1058TargetVisible').includes('setInterval'));
});


test('Issue #44 released register projections invalidate combo stamps and warm again on resume',()=>{
  const stamp=functionBody(REGISTER,'r953RegisterProjectionStamp');
  const release=functionBody(REGISTER,'r953ReleaseRegisterProjectionCaches');
  assert.ok(stamp.includes('r953RegisterReleaseEpoch'),
    'prepared combo stamp must include a release epoch');
  assert.ok(release.includes('r953RegisterReleaseEpoch++'),
    'releasing shared caches must invalidate every retained combo prepared stamp');
  assert.ok(REGISTER.includes('function r953ResumeRegisterProjectionCaches'),
    'resume helper must exist inside the R953 projection authority');
  const resume=functionBody(REGISTER,'r953ResumeRegisterProjectionCaches');
  assert.ok(resume.includes('querySelectorAll')&&resume.includes('r715Combo'),
    'resume helper must discover currently rendered combos');
  assert.ok(resume.includes('r953ScheduleRegisterComboPreparation'),
    'visible resume must cooperatively prepare stale combos instead of scanning on click');
  assert.ok(REGISTER.includes('document.visibilityState==="visible"')&&REGISTER.includes('r953ResumeRegisterProjectionCaches("visibility-visible")'),
    'visibility resume must schedule prepared projections after hidden-cache release');
});
