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

test('Issue #14 retry state is coalesced to one bounded timer',()=>{
  assert.match(detail,/r1144GeometryRetryTimer/,'one bounded retry timer must exist');
  const src=extractFunction(detail,'r1144DeferGeometry');
  assert.match(src,/if\s*\(r1144GeometryRetryTimer\)return true/,'duplicate deferrals must coalesce behind the active timer');
});
