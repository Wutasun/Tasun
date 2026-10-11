'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const detail=fs.readFileSync(path.join(ROOT,'汐東收發文明細表.html'),'utf8');

function extractFunction(source,name){
  const markers=['async function '+name+'(','function '+name+'('];
  let start=-1;
  for(const marker of markers){const i=source.indexOf(marker);if(i>=0&&(start<0||i<start))start=i;}
  assert.notEqual(start,-1,'missing function '+name);
  const open=source.indexOf('{',start);
  let depth=0,quote='',esc=false,line=false,block=false;
  for(let i=open;i<source.length;i++){
    const c=source[i],n=source[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(quote){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===quote)quote='';continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==="'"||c==='"'){quote=c;continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated function '+name);
}

test('Issue #14 public geometry dirty operation guarantees scheduling through requestGeometry',()=>{
  const src=extractFunction(detail,'r1144MarkGeometryDirty');
  assert.match(src,/r1113RequestGeometry\s*\(/,'markGeometryDirty must delegate to the existing requestGeometry scheduler');
});

test('Issue #14 requestGeometry uses a private mark-only primitive, not the public scheduling marker',()=>{
  const src=extractFunction(detail,'r1113RequestGeometry');
  assert.doesNotMatch(src,/r1144MarkGeometryDirty\s*\(/,'requestGeometry must not call the public scheduling marker and recurse');
  assert.match(src,/r1144MarkGeometryDirtyState\s*\(/,'requestGeometry should use the private mark-only primitive');
});

test('Issue #14 recent activity defers geometry instead of silently dropping the obligation',()=>{
  const src=extractFunction(detail,'r1113RequestGeometry');
  assert.doesNotMatch(src,/visibilityState==="hidden"\|\|r1113UserRecentlyActive\(\)\)return false/,'recent activity must not share the terminal hidden return');
  assert.match(src,/r1113UserRecentlyActive\(\)[\s\S]{0,220}r1144DeferGeometry\s*\(/,'recent activity must route through bounded geometry deferral');
});

test('Issue #14 bounded deferral re-enters the single scheduler and remains lifecycle-bound',()=>{
  const src=extractFunction(detail,'r1144DeferGeometry');
  assert.match(src,/setTimeout\s*\(/,'deferral should be bounded rather than polling');
  assert.match(src,/r1113RequestGeometry\s*\(/,'deferred work must re-enter the existing single scheduler');
  assert.match(src,/__TASUN_R1122_LIFECYCLE_API__/,'deferred work must use the public lifecycle bridge');
  assert.match(src,/snapshot\s*\?\.\s*\(/,'deferred work must snapshot lifecycle state through the bridge');
  assert.match(src,/refreshAuthContext\s*\?\.\s*\(/,'deferred work may refresh auth only through the bridge');
  assert.match(src,/lifecycleEpoch|epoch/,'deferred work must capture/check lifecycle epoch');
  assert.match(src,/authRevision/,'deferred work must capture/check auth revision');
  assert.doesNotMatch(src,/\br1122LifecycleState\b|\br1122RefreshAuthContext\b/,'deferred work must not cross IIFE boundaries into private lifecycle symbols');
  assert.doesNotMatch(src,/setInterval\s*\(/,'deferral must never poll');
  assert.doesNotMatch(src,/r1065CommitExactGeometryIfIdle\s*\(/,'deferral must never become an exact-commit authority');
});

test('Issue #14 retry state is event-driven, coalesced, and bounded per activity stamp',()=>{
  assert.match(detail,/r1144GeometryRetryTimer/,'one bounded retry timer must exist');
  const src=extractFunction(detail,'r1144DeferGeometry');
  assert.match(src,/activityAt===r1144GeometryRetryActivityAt/,'duplicate deferrals for the same activity stamp must coalesce');
  assert.match(src,/activityAt===r1144GeometryRetryFiredActivityAt\)return false/,'a fired activity stamp must not self-rearm indefinitely');
  assert.match(src,/latestActivityAt!==firedActivityAt/,'new user activity may move the quiet deadline without polling');
  assert.doesNotMatch(src,/setInterval\s*\(/,'quiet handoff must remain non-polling');
});

test('Issue #14 interaction preemption preserves dirty geometry through the public bridge',()=>{
  const src=extractFunction(detail,'markUserActivity');
  assert.match(src,/cancelPendingGeometry\?\.\(/,'interaction still cancels stale pending geometry first');
  assert.match(src,/snapshotGeometryStatus\?\.\(/,'interaction checks the public dirty state');
  assert.match(src,/deferGeometryAfterInteraction\?\.\(/,'dirty geometry must receive a quiet handoff after preemption');
  assert.match(detail,/deferGeometryAfterInteraction:r1144DeferGeometry/,'the public bridge must expose only the control-level quiet handoff');
});


test('Issue #14 HeavyLane rejection preserves dirty geometry until lane completion',()=>{
  const req=extractFunction(detail,'r1113RequestGeometry');
  assert.match(req,/const scheduled=r1113HeavyLaneSchedule\s*\(/,'requestGeometry must inspect HeavyLane admission');
  assert.match(req,/lane-reject-await-completion/,'rejected geometry must remain an explicit pending obligation');
  assert.doesNotMatch(detail,/r1144DeferRejectedGeometry/,'fixed retry chains must be retired in favor of lane completion');
  const lane=extractFunction(detail,'r1113HeavyLaneSchedule');
  assert.match(lane,/owner!==["']geometry["']/,'geometry must not recursively hand off itself');
  assert.match(lane,/__TASUN_R1113_GEOMETRY_DIRTY__\?\.pending===true/,'lane completion must inspect the canonical dirty obligation');
  assert.match(lane,/Promise\.resolve\(\)\.then/,'lane completion handoff must be event-driven, not polling');
  assert.match(lane,/r1113RequestGeometry\s*\(/,'lane completion must re-enter the existing scheduler');
  assert.doesNotMatch(lane,/setInterval\s*\(/,'lane completion handoff must not poll');
});
