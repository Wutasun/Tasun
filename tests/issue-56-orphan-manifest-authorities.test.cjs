'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const ROOT=path.resolve(__dirname,'..');
const MANIFEST=JSON.parse(fs.readFileSync(path.join(ROOT,'tasun-version.json'),'utf8'));
const ORPHANS=[
  ['收發文明細表.html','收發文明細表.html'],
  ['收發文登錄表.html','收發文登錄表.html'],
  ['xidong-official-doc-detail-cloud-step-test-r497','汐東收發文明細表_雲端逐步測試_正式版_R497.html']
];

function repositoryFiles(){
  const out=new Set();
  const stack=[ROOT];
  while(stack.length){
    const dir=stack.pop();
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      if(ent.name==='.git'||ent.name==='node_modules') continue;
      const abs=path.join(dir,ent.name);
      const rel=path.relative(ROOT,abs).split(path.sep).join('/');
      if(ent.isDirectory()) stack.push(abs);
      else if(ent.isFile()) out.add(rel);
    }
  }
  return out;
}

test('Issue #56 every manifest page file resolves to a repository file',()=>{
  const files=repositoryFiles();
  const missing=[];
  for(const [key,entry] of Object.entries(MANIFEST.pages||{})){
    const file=entry&&typeof entry==='object'&&typeof entry.file==='string'?entry.file.trim():'';
    if(file&&!files.has(file)) missing.push({key,file});
  }
  assert.deepEqual(missing,[],'manifest contains missing-file authorities: '+JSON.stringify(missing));
});

for(const [key,file] of ORPHANS){
  test('Issue #56 retires orphan manifest authority '+key,()=>{
    assert.equal(Object.hasOwn(MANIFEST.pages||{},key),false,key+' must be absent because '+file+' does not exist');
  });
}

test('Issue #56 accepts valid nested tasun-api/index.html authority',()=>{
  const files=repositoryFiles();
  assert.equal(files.has('tasun-api/index.html'),true,'nested control file must exist');
  const entry=MANIFEST.pages?.['tasun-api/index.html'];
  assert.ok(entry,'nested manifest authority must remain');
  assert.equal(entry.file,'tasun-api/index.html');
});

test('Issue #56 preserves canonical formal four-page authorities',()=>{
  const formal=[
    '汐東收發文明細表.html',
    '汐東收發文登錄表.html',
    '汐東文件統計表.html',
    '汐東文件管理表.html'
  ];
  for(const file of formal){
    assert.equal(fs.existsSync(path.join(ROOT,file)),true,file+' must remain present');
    const entry=MANIFEST.pages?.[file];
    assert.ok(entry,file+' manifest authority must remain');
    assert.equal(entry.file,file);
    assert.equal(entry.version,MANIFEST.version);
    assert.equal(entry.releaseSequence,MANIFEST.releaseSequence);
  }
});
