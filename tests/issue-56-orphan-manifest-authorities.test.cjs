'use strict';

const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const {spawnSync}=require('node:child_process');

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

test('Issue #56 A2 preserves tasun-api source but retires its non-deployed page authority',()=>{
  const files=repositoryFiles();
  assert.equal(files.has('tasun-api/index.html'),true,'tasun-api/index.html repository source must remain');
  assert.equal(Object.hasOwn(MANIFEST.pages||{},'tasun-api/index.html'),false,'tasun-api/index.html must not remain a public Pages authority while tasun-api/ is excluded from deployment');
});

test('Issue #56 A2 deployment-surface guard matches the active Pages rsync command',()=>{
  const workflow=fs.readFileSync(path.join(ROOT,'.github/workflows/release-version.yml'),'utf8');
  const lines=workflow.split(/\\r?\\n/);
  const start=lines.findIndex(line=>/^\\s*rsync\\s+-a\\s+\\.\\/\\s+_site\\/\\s+\\\\\\s*$/.test(line));
  assert.notEqual(start,-1,'active Pages rsync command must remain discoverable; topology drift requires architecture review');
  const excludes=[];
  for(let i=start+1;i<lines.length;i++){
    const line=lines[i];
    if(!/^\\s+--exclude\\s+/.test(line)) break;
    excludes.push(line);
  }
  assert.ok(excludes.some(line=>/^\\s+--exclude\\s+["']tasun-api\\/["'](?:\\s+\\\\)?\\s*$/.test(line)),'active Pages rsync command must exclude tasun-api/; topology drift requires architecture review');
  const invalid=[];
  for(const [key,entry] of Object.entries(MANIFEST.pages||{})){
    const file=entry&&typeof entry==='object'&&typeof entry.file==='string'?entry.file.trim():'';
    if(file.startsWith('tasun-api/')) invalid.push({key,file});
  }
  assert.deepEqual(invalid,[],'manifest contains non-deployed Pages authorities: '+JSON.stringify(invalid));
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

test('Issue #56 metadata-only publisher preserves formal identity and does not restore orphan authorities',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tasun-issue56-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const mkdir=rel=>fs.mkdirSync(path.join(dir,rel),{recursive:true});
  const copy=rel=>{mkdir(path.dirname(rel));fs.copyFileSync(path.join(ROOT,rel),path.join(dir,rel));};

  for(const rel of [
    'publish-version_tasun_project_autoscan.mjs',
    'tasun-version.json',
    'TASUN_REBUILD',
    'TASUN_REBUILD_STAMP',
    '.github/workflows/release-version.yml',
    '汐東收發文明細表.html',
    '汐東收發文登錄表.html',
    '汐東文件統計表.html',
    '汐東文件管理表.html'
  ]) copy(rel);

  const before=JSON.parse(fs.readFileSync(path.join(dir,'tasun-version.json'),'utf8'));
  for(const [key] of ORPHANS) assert.equal(Object.hasOwn(before.pages||{},key),false,key+' must already be retired before publisher verification');
  assert.equal(Object.hasOwn(before.pages||{},'tasun-api/index.html'),false,'tasun-api/index.html authority must already be retired before publisher verification');
  const beforeBuild=before.version;
  const beforeSequence=before.releaseSequence;

  const r=spawnSync(process.execPath,['publish-version_tasun_project_autoscan.mjs'],{
    cwd:dir,
    encoding:'utf8',
    env:{...process.env,TASUN_CHANGED_FILES:'tasun-version.json',TASUN_BEFORE_SHA:'',TASUN_HEAD_SHA:''}
  });

  assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
  const after=JSON.parse(fs.readFileSync(path.join(dir,'tasun-version.json'),'utf8'));
  assert.equal(after.version,beforeBuild,'metadata-only cleanup must keep the formal build');
  assert.equal(after.releaseSequence,beforeSequence,'metadata-only cleanup must keep releaseSequence');
  for(const [key] of ORPHANS) assert.equal(Object.hasOwn(after.pages||{},key),false,key+' must not be restored by publisher');
  assert.equal(Object.hasOwn(after.pages||{},'tasun-api/index.html'),false,'publisher must not restore tasun-api/index.html authority');
  assert.match(r.stdout,/read-only four-page release verification passed:/);
});
