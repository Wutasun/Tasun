'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const register=fs.readFileSync(path.join(ROOT,'汐東收發文登錄表.html'),'utf8');

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
    if(c==="'"||c==='\"'){quote=c;continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated function '+name);
}

test('Issue #15 timeout producer owns an explicit Tasun abort cause',()=>{
  const src=extractFunction(register,'fetchBuffer');
  assert.match(src,/timedOut/,'fetchBuffer must retain explicit producer-owned timeout state');
  assert.match(src,/tasunArtifactAbortCause/,'fetchBuffer must normalize timeout to a Tasun-owned cause');
  assert.match(src,/[\"']timeout[\"']/,'timeout must have a stable cause code');
});

test('Issue #15 generic AbortError is not supersession authority',()=>{
  const src=extractFunction(register,'probe');
  assert.doesNotMatch(src,/e&&e\.name===[\"']AbortError[\"']/,'generic AbortError must not be the quiet-cancel discriminator');
  assert.match(src,/tasunArtifactAbortCause\s*===\s*[\"']superseded[\"']/,'only explicit supersession cause may quiet-cancel');
});

test('Issue #15 timeout remains on the existing failure and retry path',()=>{
  const src=extractFunction(register,'probe');
  assert.match(src,/scheduleRetry\s*\(state\.lastError\)/,'probe must retain the existing single retry authority');
  const superAt=src.indexOf('tasunArtifactAbortCause');
  const retryAt=src.indexOf('scheduleRetry(state.lastError)');
  assert.ok(superAt>=0&&retryAt>superAt,'explicit supersession branch must precede ordinary failure/retry handling');
  assert.doesNotMatch(src,/tasunArtifactAbortCause\s*===\s*[\"']timeout[\"'][\s\S]{0,300}attempt\s*=\s*Math\.max\(0,state\.attempt-1\)/,'timeout must not decrement failed-attempt accounting');
});

test('Issue #15 explicit supersession remains quiet and non-retrying',()=>{
  const src=extractFunction(register,'probe');
  const superAt=src.indexOf('tasunArtifactAbortCause');
  assert.ok(superAt>=0,'explicit supersession discriminator is required');
  const tail=src.slice(superAt,superAt+700);
  assert.match(tail,/cancelled-superseded/,'explicit supersession keeps quiet cancellation status');
  assert.match(tail,/attempt=Math\.max\(0,state\.attempt-1\)/,'explicit supersession must not count as failed attempt');
  const returnAt=tail.indexOf('return false');
  const retryAt=tail.indexOf('scheduleRetry');
  assert.ok(returnAt>=0&&(retryAt<0||returnAt<retryAt),'explicit supersession must return before retry');
});

test('Issue #15 parallel artifact probe and exact verification authorities remain unchanged',()=>{
  const src=extractFunction(register,'probe');
  assert.match(src,/Promise\.all\s*\(/,'manifest and HTML probes must stay parallel');
  assert.match(src,/fetchBuffer\(VERSION_URL/,'manifest must still use fetchBuffer');
  assert.match(src,/fetchBuffer\(PAGE_FILE/,'HTML must still use fetchBuffer');
  assert.match(src,/sha256Hex\s*\(/,'SHA verification must remain');
  assert.doesNotMatch(src,/setInterval\s*\(/,'probe must not poll');
  const retry=extractFunction(register,'scheduleRetry');
  assert.doesNotMatch(retry,/setInterval\s*\(/,'retry authority must remain bounded and non-polling');
});
