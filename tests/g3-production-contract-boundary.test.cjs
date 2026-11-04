'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { review } = require('../tasun-api/g3-production-contract-gate.cjs');
const src = fs.readFileSync(path.resolve(__dirname, '../tasun-api/tasun-worker-stable-v4.js'), 'utf8');
const workerPromise = import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const activeRoutes = [
  '/api/tasun/health', '/api/tasun/login', '/api/tasun/me',
  '/api/tasun/auth/read', '/api/tasun/auth/upsert',
  '/api/tasun/users/upsert','/api/tasun/read','/api/tasun/merge'
];
const evidence = {
  worker_name:'tasun-worker',source_matches_active_version:'ETAG_EQUAL_ACTIVE_100_PERCENT',
  downloaded_latest_source:{sha256:'TEST-ONLY-CONTAINER-HASH'},
  active_versions:[{version_id:'TEST-VERSION',percentage:100,binding_names_and_types:[
    {name:'DB',type:'d1'},{name:'SESSION_SECRET',type:'plain_text'}
  ]}]
};
const routes = {
  worker_name:'tasun-worker',version_id:'TEST-VERSION',percentage:100,
  source_association:'ETAG_EQUAL_ACTIVE_100_PERCENT',
  verified_raw_container_sha256:'TEST-ONLY-CONTAINER-HASH',
  route_marker_found:Object.fromEntries(activeRoutes.map(s=>[s,true])),
  identifier_marker_found:{AUTH_SECRET:true,SESSION_SECRET:false,GH_TOKEN:true,GITHUB_TOKEN:true}
};
function codes(result) { return result.issues.map(x=>x.code); }
test('missing AUTH_SECRET is rejected before any D1 login lookup; never falls back to SESSION_SECRET', async()=>{
  const worker = (await workerPromise).default;
  let calls=0;
  const env={SESSION_SECRET:'LEGACY-MOCK-NEVER-USE',DB:{prepare(){calls++;throw Error('DB must not be accessed');}}};
  const response=await worker.fetch(new Request('https://unit.invalid/api/tasun/login',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({username:'synthetic',password:'not-real'})
  }),env,{});
  assert.equal(response.status,503);
  const body=await response.json();
  assert.deepEqual(body,{ok:false,error:'AUTH_CONFIGURATION'});
  assert.equal(calls,0);
  assert.ok(!JSON.stringify(body).includes('LEGACY-MOCK'));
});
test('short AUTH_SECRET is rejected without querying D1', async()=>{
  const worker=(await workerPromise).default;let calls=0;
  const response=await worker.fetch(new Request('https://unit.invalid/api/tasun/login',{
    method:'POST',body:'{}',headers:{'content-type':'application/json'}
  }),{AUTH_SECRET:'weak',DB:{prepare(){calls++;throw Error('unexpected query')}}},{});
  assert.equal(response.status,503);assert.equal(calls,0);
});
test('production evidence triggers NO_GO on missing HMAC secret, GitHub integration, and entrypoint',()=>{
  const r=review(evidence,routes);
  assert.equal(r.decision,'NO_GO');assert.equal(r.route_marker_contract,'STATIC_MATCH_ONLY');
  for(const code of ['AUTH_SECRET_BINDING_MISSING','LEGACY_SESSION_SECRET_EXPOSURE_REVIEW',
    'GITHUB_INTEGRATION_NOT_PRESERVED','FORMAL_DEPLOY_ENTRY_UNRESOLVED',
    'FUNCTIONAL_EQUIVALENCE_UNPROVEN','D1_SCHEMA_READBACK_PENDING'])assert.ok(codes(r).includes(code),code);
  assert.equal(r.production_changes,false);
  assert.ok(!JSON.stringify(r).includes('LEGACY-MOCK-NEVER-USE'));
});
test('binding metadata alone cannot certify release even if AUTH_SECRET is a secret',()=>{
  const e=structuredClone(evidence);
  e.active_versions[0].binding_names_and_types.push({name:'AUTH_SECRET',type:'secret_text'});
  const r=review(e,routes);
  assert.equal(r.decision,'NO_GO');
  assert.ok(!codes(r).includes('AUTH_SECRET_BINDING_MISSING'));
  assert.ok(codes(r).includes('GITHUB_INTEGRATION_NOT_PRESERVED'));
});
test('mismatched active version cannot be silently treated as matched',()=>{
  const bad=structuredClone(routes);bad.version_id='STALE';
  const r=review(evidence,bad);
  assert.ok(codes(r).includes('ACTIVE_SOURCE_EVIDENCE_UNCONFIRMED'));
});
test('marker match is not runtime or D1 schema proof',()=>{
  const r=review(evidence,routes);
  assert.ok(codes(r).includes('FUNCTIONAL_EQUIVALENCE_UNPROVEN'));
  assert.ok(codes(r).includes('D1_SCHEMA_READBACK_PENDING'));
});
test('formal config and local dual-API harness remain unmodified/non-deployable',()=>{
  const root=path.resolve(__dirname,'../tasun-api');
  const wrangler=fs.readFileSync(path.join(root,'wrangler.toml'),'utf8');
  const dual=fs.readFileSync(path.join(root,'g3-dual-api-local.js'),'utf8');
  assert.match(wrangler,/main\s*=\s*"worker_tasun\.js"/);
  assert.match(dual,/LOCAL_ONLY/);
  assert.match(dual,/env\.G3_DB === env\.LEGACY_DB/);
  assert.doesNotMatch(src,/env\.SESSION_SECRET/);
});
