const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const perm=fs.readFileSync(path.join(ROOT,'權限表.html'),'utf8');
const resources=JSON.parse(fs.readFileSync(path.join(ROOT,'tasun-resources.json'),'utf8'));
const manager=fs.readFileSync(path.join(ROOT,'汐東文件管理表.html'),'utf8');

const exists=(p)=>fs.existsSync(path.join(ROOT,p));
function block(src,start,end){
  const a=src.indexOf(start); assert.notEqual(a,-1,'missing block start '+start);
  const b=src.indexOf(end,a); assert.notEqual(b,-1,'missing block end '+end);
  return src.slice(a,b);
}
const filesBlock=block(perm,'const DEFAULT_ENTRY_FILES = [','const DEFAULT_ENTRY_BUTTONS = {');
const buttonsBlock=block(perm,'const DEFAULT_ENTRY_BUTTONS = {','function stripInvisibles');

const canonical=[
  '汐東收發文明細表.html',
  '汐東收發文登錄表.html',
  '捷運汐東線事項記錄.html',
  '捷運汐止東湖線-施工查驗管控表.html',
  '捷運汐止東湖線-材料查驗管控表.html'
];
const stale=[
  '收發文明細表.html',
  '收發文登錄表.html',
  '回覆文登錄表.html',
  '汐東回覆文登錄表.html',
  '捷運汐止東湖線-查驗管控表.html',
  '捷運汐東線審查文件管制查詢表-水環組.html',
  '捷運汐東線審查文件管制登錄表-水環組.html',
  '捷運汐東線審查文件管制表-水環組.html',
  '捷運汐東線記事.html'
];

test('Issue #61 canonical replacement pages exist',()=>{
  for(const f of canonical) assert.equal(exists(f),true,f+' must exist');
});

test('Issue #61 production entry/button defaults contain no stale topology targets',()=>{
  const quoted=(block,name)=>block.includes("'"+name+"'")||block.includes('"'+name+'"');
  const href=(block,name)=>block.includes("href:'"+name+"'")||block.includes('href:"'+name+'"');
  const found=stale.filter(x=>quoted(filesBlock,x)||quoted(buttonsBlock,x)||href(buttonsBlock,x));
  assert.deepEqual(found,[],'stale live defaults: '+JSON.stringify(found));
});

test('Issue #61 auth-table resource entries contain no stale topology targets',()=>{
  const entries=resources?.resources?.['tasun-auth-table']?.entries;
  assert.ok(Array.isArray(entries),'tasun-auth-table entries must remain an array');
  const found=stale.filter(x=>entries.includes(x));
  assert.deepEqual(found,[],'stale resource entries: '+JSON.stringify(found));
});


test('Issue #61 canonical replacements remain registered in navigation authority',()=>{
  for(const name of ['汐東收發文明細表.html','汐東收發文登錄表.html','捷運汐東線事項記錄.html']){
    assert.ok(filesBlock.includes("'"+name+"'")||filesBlock.includes('"'+name+'"'),name+' must remain in DEFAULT_ENTRY_FILES');
  }
  const entries=resources?.resources?.['tasun-auth-table']?.entries;
  assert.ok(Array.isArray(entries),'tasun-auth-table entries must remain an array');
  assert.ok(entries.includes('捷運汐東線事項記錄.html'),'canonical record page must remain in auth-table resource entries');
});

test('Issue #61 examples/comments are not production targets',()=>{
  for(const example of ['xx.html','yy.html','新頁面.html']){
    assert.equal(filesBlock.includes(example),false,example+' must not be in DEFAULT_ENTRY_FILES');
    assert.equal(buttonsBlock.includes(example),false,example+' must not be in DEFAULT_ENTRY_BUTTONS');
  }
});

test('Issue #61 retired reply route cleanup remains owned by document manager',()=>{
  assert.match(manager,/retired=\[[^\]]*official_reply_register[^\]]*汐東回覆文登錄表\.html/s);
});



test('Issue #61 persisted permission aliases migrate without overwriting canonical permissions',()=>{
  const runtimeBlock=block(perm,'function migrateIssue61PersistedTopology(){','function applyIssue61TopologyConvergence(){');
  assert.match(runtimeBlock,/Object\.keys\(ISSUE61_ENTRY_ALIASES\)/);
  assert.match(runtimeBlock,/hasOwnProperty\.call\(target,k\)/);
  assert.match(runtimeBlock,/delete u\[oldEntry\]/);
  assert.match(runtimeBlock,/ISSUE61_RETIRED_ENTRIES\.forEach/);
  assert.match(runtimeBlock,/savePermMatrix\(\)/);
});

test('Issue #61 persisted selected entry is normalized before rendering',()=>{
  const loadBlock=block(perm,'function loadSelectedEntry(){','function saveSelectedEntry');
  assert.match(loadBlock,/normalizeIssue61Target\(s,false\)/);
  assert.match(loadBlock,/ENTRY_SELECTED_KEY/);
  const migrationBlock=block(perm,'function migrateIssue61PersistedTopology(){','function applyIssue61TopologyConvergence(){');
  assert.match(migrationBlock,/localStorage\.getItem\(ENTRY_SELECTED_KEY\)/);
  assert.match(migrationBlock,/nextSelected=normalized\|\|'index\.html'/);
});

test('Issue #61 persisted routes normalize pathname while preserving query or hash suffixes',()=>{
  const splitBlock=block(perm,'function issue61SplitTarget(raw){','function migrateIssue61PersistedTopology(){');
  assert.match(splitBlock,/\(\[\?#\]\.\*\)\?/);
  assert.match(splitBlock,/path\+\(preserveSuffix===false\?'':parts\.suffix\)/);
  const migrationBlock=block(perm,'function migrateIssue61PersistedTopology(){','function applyIssue61TopologyConvergence(){');
  assert.match(migrationBlock,/normalizeIssue61Target\(href,true\)/);
  assert.match(migrationBlock,/delete routes\[k\]/);
  assert.match(migrationBlock,/setRouteStorageObject\(routes\)/);
});

test('Issue #61 active topology materializer cannot restore retired targets',()=>{
  const runtimeBlock=block(perm,'function applyIssue61TopologyConvergence(){','function applyR709ManagedPermissionDefinitions()');
  for(const name of ['回覆文登錄表.html','汐東回覆文登錄表.html','捷運汐止東湖線-查驗管控表.html','捷運汐東線審查文件管制查詢表-水環組.html','捷運汐東線審查文件管制登錄表-水環組.html','捷運汐東線審查文件管制表-水環組.html']){
    const appearsAsOutput=runtimeBlock.includes("href:'"+name+"'")||runtimeBlock.includes('href:"'+name+'"')||runtimeBlock.includes("push('"+name+"')")||runtimeBlock.includes('push("'+name+'")');
    assert.equal(appearsAsOutput,false,name+' must not be materialized by active topology convergence');
  }
  assert.match(runtimeBlock,/捷運汐止東湖線-施工查驗管控表\.html/);
  assert.match(runtimeBlock,/捷運汐止東湖線-材料查驗管控表\.html/);
  assert.match(runtimeBlock,/normalizeIssue61Target\(raw,false\)/);
  const helperBlock=block(perm,'const ISSUE61_ENTRY_ALIASES={','function migrateIssue61PersistedTopology(){');
  assert.match(helperBlock,/收發文明細表\.html':'汐東收發文明細表\.html/);
  assert.match(helperBlock,/收發文登錄表\.html':'汐東收發文登錄表\.html/);
  assert.match(helperBlock,/捷運汐東線記事\.html':'捷運汐東線事項記錄\.html/);
});

test('Issue #61 current split inspection pages remain represented',()=>{
  assert.equal(exists('捷運汐止東湖線-施工查驗管控表.html'),true);
  assert.equal(exists('捷運汐止東湖線-材料查驗管控表.html'),true);
  assert.match(perm,/捷運汐止東湖線-施工查驗管控表\.html/);
  assert.match(perm,/捷運汐止東湖線-材料查驗管控表\.html/);
});
