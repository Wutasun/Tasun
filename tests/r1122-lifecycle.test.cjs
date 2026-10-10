const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {source,declaration}=require('./helpers/embedded.cjs');
const html=source('汐東收發文明細表.html');
function fixture(){
 const pending=new Map();let next=0;
 const window={__TASUN_MANAGER_SESSION__:{user:'tester',role:'write'}};
 const c=vm.createContext({window,document:{visibilityState:'visible'},performance,console,requestAnimationFrame:fn=>{pending.set(++next,fn);return next;},cancelAnimationFrame:id=>pending.delete(id),requestIdleCallback:fn=>{pending.set(++next,fn);return next;},cancelIdleCallback:id=>pending.delete(id)});
 // Execute the actual isolated lifecycle/HeavyLane/revision core, with browser scheduling as the only boundary fake.
 vm.runInContext('const rows=[];'+html.slice(html.indexOf('const R1113_RENDER_BUDGET_MS='),html.indexOf('const R1113_SAME_DIGEST_NO_RENDER=')),c);
 return {c,pending,window};
}
test('fresh ticket commits; older generation cannot overwrite it',()=>{
 const {c}=fixture(),old=c.r1113BeginRenderTicket('old'),fresh=c.r1113BeginRenderTicket('fresh');assert.equal(c.r1113CommitRenderTicket(old),false);assert.equal(c.r1113CommitRenderTicket(fresh),true);
});
for(const state of ['HIDDEN','BF_CACHE_SUSPENDED'])test(state+' invalidates queued work and old tickets after resume',()=>{
 const {c,pending}=fixture(),ticket=c.r1113BeginRenderTicket('before');let ran=0;
 c.r1113HeavyLaneSchedule('geometry',5,'test',4,()=>{ran++;return true;});const queued=[...pending.values()][0];assert.ok(queued);
 c.r1122LifecycleTransition(state,'test');assert.equal(pending.size,0);assert.equal(c.r1113CommitRenderTicket(ticket),false);
 c.r1122LifecycleTransition('ACTIVE','resume');queued();assert.equal(ran,0);assert.equal(c.r1113CommitRenderTicket(ticket),false);
 assert.equal(c.r1113CommitRenderTicket(c.r1113BeginRenderTicket('new')),true);
});
for(const change of ['user','role'])test('auth '+change+' change rejects pending work and previous render',()=>{
 const {c,window,pending}=fixture(),ticket=c.r1113BeginRenderTicket('before');let ran=0;
 c.r1113HeavyLaneSchedule('formatter',5,'test',4,()=>{ran++;});const queued=[...pending.values()][0];
 window.__TASUN_MANAGER_SESSION__[change]='changed';queued();assert.equal(ran,0);assert.equal(c.r1113CommitRenderTicket(ticket),false);
});
test('hidden DOM prevents scheduling even before lifecycle listener fires',()=>{
 const {c,pending}=fixture();c.document.visibilityState='hidden';assert.equal(c.r1113HeavyLaneSchedule('geometry',5,'test',4,()=>assert.fail('hidden work')),0);assert.equal(pending.size,0);
});
test('new projection and data revisions reject previous render tickets',()=>{
 const {c}=fixture();let ticket=c.r1113BeginRenderTicket('before');c.r1113BumpProjectionRevision('search');assert.equal(c.r1113CommitRenderTicket(ticket),false);
 ticket=c.r1113BeginRenderTicket('before data');vm.runInContext('rows.push({uid:"new"})',c);c.r1113RefreshFormalRevision('readback');assert.equal(c.r1113CommitRenderTicket(ticket),false);
});
test('same data digest does not request a new render generation',()=>{
 const {c}=fixture();c.r1113BeginRenderTicket('initial');const before=vm.runInContext('r1113RevisionState.renderGeneration',c);assert.equal(c.r1113RefreshFormalRevision('same-readback').changed,false);assert.equal(vm.runInContext('r1113RevisionState.renderGeneration',c),before);
});
test('current SelfHeal registration retains bounded abortable controls',()=>{
 const {c,window}=fixture(),registrations=[];
 c.AbortController=AbortController;window.TasunSelfHealV5={register:(name,options)=>registrations.push({name,options})};
 vm.runInContext(declaration(html,'r1113RegisterCurrentSelfHeal'),c);c.r1113RegisterCurrentSelfHeal();
 assert.ok(registrations.some(x=>x.name.endsWith('officialDocsR1122LifecycleCommitAuthority')));
 for(const {options:o} of registrations){assert.ok(o.coolDownMs>0);assert.ok(o.maxRetry>0&&o.maxRetry<=4);assert.ok(o.abortController);assert.equal(o.noInfinitePolling,true);}
});
test('actual R990 BFCache pageshow handler only rebinds committed UI',()=>{
 const {c,window}=fixture();let handler,rebound=0,rendered=0,synced=0;
 window.addEventListener=(type,fn)=>{assert.equal(type,'pageshow');handler=fn;};
 Object.assign(c,{scrollers:()=>({stage:{},rail:{}}),bindStage:()=>rebound++,projectGlobalPosition:()=>{},r1080EffectiveHorizontalPosition:()=>0,updateRailAria:()=>{},updateVerticalGeometry:()=>{},renderTable:()=>rendered++,authoritySync:()=>synced++});
 const start=html.indexOf('window.addEventListener("pageshow",event=>{if(event?.persisted!==true)return;try{r1122LifecycleTransition("ACTIVE","r990-pageshow-bfcache")');assert.ok(start>=0);
 const end=html.indexOf('},{passive:true});',start)+'},{passive:true});'.length;
 vm.runInContext(html.slice(start,end),c);
 const old=c.r1113BeginRenderTicket('before');c.r1122LifecycleTransition('BF_CACHE_SUSPENDED','test');handler({persisted:true});
 assert.equal(rebound,1);assert.equal(rendered,0);assert.equal(synced,0);assert.equal(c.r1113CommitRenderTicket(old),false);
 assert.equal(window.__TASUN_R1113_BFCACHE_REBIND_ONLY__.renderRequested,false);
 assert.equal(window.__TASUN_R1113_BFCACHE_REBIND_ONLY__.syncRequested,false);
});
