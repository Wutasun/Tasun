const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {source,declaration}=require('./helpers/embedded.cjs');
const manager=source('汐東文件管理表.html'),detail=source('汐東收發文明細表.html');
function fixture(){
 const c=vm.createContext({URL,location:{href:'https://example.invalid/Tasun/manager.html'},sessionStorage:new Map(),localStorage:new Map()});
 c.sessionStorage.setItem=c.sessionStorage.set;c.localStorage.setItem=c.localStorage.set;
 vm.runInContext('const R706_STAGE_HISTORY_KEY="文件處理歷程",R706_STAGE_START="起始文件",R706_STAGE_SUPERVISOR="監造回覆",R706_STAGE_CONTRACTOR="統包回覆來文";'+manager.slice(manager.indexOf('const SUMMARY_FIELDS='),manager.indexOf('const SUMMARY_DETAIL_FILTERS=')),c);
 for(const name of ['norm','safeJson','summaryNormalize','summaryNormalizeKey','summaryField','summaryLogicalKey','summaryStageType','summaryStageList','summaryStageDocNo','summaryStageDate','summaryNormalizeDirection','r949StageContext','r949JumpMeta','r949PrepareDetailJump'])vm.runInContext(declaration(manager,name),c);
 // The detail receiver uses the same whitespace normalization contract.
 vm.runInContext('const normalizeText=summaryNormalize; const withVersion=x=>x;',c);
 for(const name of ['r853NormalizeJumpMeta','r853StageMatchScore'])vm.runInContext(declaration(detail,name),c);
 return c;
}
const stages=[{'階段類型':'起始文件','階段UID':'start','文號':'DUP','階段序號':1},{'階段類型':'監造回覆','階段UID':'s1','文號':'DUP','同類次數':1,'階段序號':2},{'階段類型':'統包回覆來文','階段UID':'c1','文號':'DUP','同類次數':1,'階段序號':3},{'階段類型':'監造回覆','階段UID':'s2','文號':'DUP','同類次數':2,'階段序號':4}];
for(const [index,label] of [[0,'起始文件'],[1,'監造回覆(1)'],[2,'統包回覆來文(1)'],[3,'監造回覆(2)']])test('duplicate number selects '+label+' instead of first occurrence',()=>{
 const c=fixture(),row={uid:'parent','文號':'DUP','文件處理歷程':stages,__tasunDocumentEvent:true,__tasunStageRecord:index?stages[index]:null,__tasunDocumentEventSource:label+'文號',__tasunDocumentEventSequence:stages[index]['同類次數']||0,__tasunDocumentEventDocNo:'DUP'};
 const ctx=c.r949StageContext(row,'total'),meta=c.r949JumpMeta(row,ctx);
 assert.equal(meta.stageLabel,label);assert.equal(ctx.source,label+'文號','display label remains unchanged');
 const labels=['起始文件','監造回覆(1)','統包回覆來文(1)','監造回覆(2)'];
 const ranked=labels.map((s,i)=>({i,score:c.r853StageMatchScore({dataset:{r796DataStage:s}},meta)})).sort((a,b)=>b.score-a.score||a.i-b.i);
 assert.equal(ranked[0].i,index);assert.equal(meta.rowUid,'parent');assert.equal(meta.docNo,'DUP');
 assert.equal(meta.locator.stageUid,ctx.stageUid);
 const url=new URL(c.r949PrepareDetailJump(meta));assert.equal(url.searchParams.get('_r853stage'),label);
 const intent=JSON.parse(c.sessionStorage.get('tasun_r855_duplicate_jump_intent_v1'));assert.equal(intent.stageLabel,label);
});
test('legacy reply label uses receiver canonical label without a stage record',()=>{
 const c=fixture(),row={uid:'parent','文號':'LEGACY',__tasunDocumentEvent:true,__tasunDocumentEventSource:'回覆文號 (監造)',__tasunDocumentEventDocNo:'LEGACY'};
 const meta=c.r949JumpMeta(row,c.r949StageContext(row,'sent'));
 const labels=['起始文件(1)','監造回覆(1)','統包回覆來文(1)'];
 const ranked=labels.map((label,i)=>({i,score:c.r853StageMatchScore({dataset:{r796DataStage:label}},meta)})).sort((a,b)=>b.score-a.score||a.i-b.i);
 assert.equal(ranked[0].i,1,'legacy reply must not select the start stage with the same document number');
 assert.equal(meta.stageLabel,'監造回覆(1)');
});
test('ordinary latest-stage drilldown preserves canonical label and stage locator',()=>{
 const c=fixture(),row={uid:'parent','文號':'DUP','文件處理歷程':stages};const meta=c.r949JumpMeta(row,c.r949StageContext(row,'pendingReply'));
 assert.equal(meta.stageLabel,'監造回覆(2)');assert.equal(meta.locator.stageUid,'s2');assert.equal(meta.locator.kind,'stage');
});
