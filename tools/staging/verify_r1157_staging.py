#!/usr/bin/env python3
"""Read-only cross-file R1157 staging consistency gate. No internet/Cloudflare writes."""
import pathlib,sys,json,hashlib,re,html, tomllib
from urllib.parse import urlsplit
DOCS=('汐東收發文明細表.html','汐東收發文登錄表.html','汐東文件統計表.html','汐東文件管理表.html')
PROD_WORKER='tasun-worker.wutasun.workers.dev'
PROD_D1='ecb1ff1d-eb3d-4fe8-ba2c-8b7cc884bd84'
STAGING_WORKER_REVIEW_HEAD='f54b5f3629c19d2c47f0ca30521ff43fc9bee7f2'
STAGING_WORKER_SHA256='48f14b3a94bec082b900ea8003a1d5491629b8e03299617e4284e3e46f83400f'
DIGEST_FIELDS=('sha256','artifactSha256','pageArtifactSha256','htmlSha256','digest')
SIZE_FIELDS=('bytes','pageBytes','sizeBytes','artifactBytes')

def require(value, label):
    if not value:
        raise ValueError("BLOCKED: Staging isolation check failed: " + label)

def verify(root):
    root=pathlib.Path(root); site=root/'site'; worker=root/'worker'
    state=json.loads((root/'STAGING_STATUS.json').read_text('utf-8'))
    require(state['status'] in ('DEMO_NOT_DEPLOYABLE','AWAITING_CLOUDFLARE_RESOURCE_VERIFICATION'), "isolation-gate-01")
    cfg=tomllib.loads((worker/'wrangler.staging.toml').read_text('utf-8'))
    require(cfg['name']=='tasun-worker-staging' and cfg['main']=='tasun-worker-stable-v4.js', "isolation-gate-02")
    require(cfg['vars']['CORS_ALLOW_ORIGINS']==state['staging_site'], "isolation-gate-03")
    d1=cfg['d1_databases'][0]
    require(d1['database_id']==state['staging_d1_id'] and d1['database_id']!=PROD_D1, "isolation-gate-04")
    require(d1['binding']=='DB' and d1['database_name']=='tasun-db-staging', "isolation-gate-05")
    require((worker/cfg['main']).is_file() and (worker/'schema_v4.sql').is_file(), "isolation-gate-06")
    worker_bytes=(worker/cfg['main']).read_bytes()
    if state['status'] != 'DEMO_NOT_DEPLOYABLE':
        require(state.get('staging_worker_source_head')==STAGING_WORKER_REVIEW_HEAD,
                'approved PR worker source head')
        require(state.get('staging_worker_sha256')==STAGING_WORKER_SHA256,
                'approved PR worker SHA metadata')
        require(hashlib.sha256(worker_bytes).hexdigest()==STAGING_WORKER_SHA256,
                'actual staging Worker SHA')
    js=worker_bytes.decode('utf-8')
    require(('if (!["admin","write"].includes(me.r))' in js or 'if (me.r !== "admin" && me.r !== "write")' in js), "isolation-gate-07")
    require('function configuredAuthSecret(env)' in js and 'AUTH_SECRET_NOT_CONFIGURED' in js and 'dev-secret' not in js, "isolation-gate-08")
    require('const user = await getUser(env, me.u)' in js and 'if (!user || !user.enabled || !validSessionVersion(user.session_version)' in js, "isolation-gate-09")
    require('const roleOverride = await getAuth(env, me.u)' in js and 'me.r = String(roleOverride?.role || user.role || "read")' in js, "isolation-gate-10")
    require('!sameSessionVersion(me.sv, user.session_version)' in js, 'session version invalidation guard')
    require('Number(guard.installed) !== 5' in js, 'five-trigger fail-closed check')
    v=json.loads((site/'tasun-version.json').read_text('utf-8'))
    stage=state['staging_build']
    require(v['version']==v['cacheV']==v['buildStamp']==v['rebuildStamp']==stage, "isolation-gate-11")
    require(v['release']['stagingOnly'] and v['release']['notFormalRelease'], "isolation-gate-12")
    require((site/'TASUN_REBUILD_STAMP').read_text('utf-8').strip()==stage, "isolation-gate-13")
    require('version='+stage in (site/'TASUN_REBUILD').read_text('utf-8'), "isolation-gate-14")
    for name in DOCS:
        data=(site/name).read_bytes();s=data.decode('utf-8')
        require(stage in s and PROD_WORKER not in s, "isolation-gate-15")
        require('http-equiv="Content-Security-Policy"' in s and 'connect-src' in s, "isolation-gate-16")
        require(state['staging_worker'] in s, "isolation-gate-17")
        digest=hashlib.sha256(data).hexdigest()
        records=[v['pageArtifactManifest'][name]]+[e for e in v['pages'].values() if isinstance(e,dict) and e.get('file')==name]
        require(len(records)>=2, "isolation-gate-18")
        for e in records:
            for k in DIGEST_FIELDS:
                if k in e: require(e[k]==digest, "isolation-gate-19")
            for k in SIZE_FIELDS:
                if k in e: require(e[k]==len(data), "isolation-gate-20")
    for p in site.rglob('*'):
        if p.is_file() and p.suffix.lower() in ('.html','.json','.js'):
            require(PROD_WORKER not in p.read_text('utf-8'), "isolation-gate-21: " + str(p))
    api=json.loads((site/'tasun-resources.json').read_text('utf-8'))['api']
    require(api['base']==state['staging_worker'], "isolation-gate-22")
    require(cfg['vars']['CORS_ALLOW_ORIGINS']!='https://wutasun.github.io', "isolation-gate-23")
    require(state['cloud_deployed'] is False, "isolation-gate-24")
    require(state.get('github_pr')==102, "isolation-gate-25")
    require(state.get('github_pr_head')=='69c0327a1158a2dfb757c5a3808f5f55495c0c37', "isolation-gate-26")
    require(state.get('source_commit_pins_verified') or state.get('status')=='DEMO_NOT_DEPLOYABLE', "isolation-gate-27")
    return {'result':'PASS_OFFLINE_ONLY','four_page_artifact_hashes':'PASS','CSP_connect_src':'STAGING_ONLY',
            'backend_entry':'tasun-worker-stable-v4.js','d1_binding':'DB','AUTH_SECRET':'NOT_CONFIGURED',
            'cloud_d1_readback':'NOT_VERIFIED','cloud_e2e':'NOT_VERIFIED',
            'formal_release_modified':False}
if __name__=='__main__':
    try: print(json.dumps(verify(sys.argv[1]),ensure_ascii=False,indent=2))
    except Exception as e:print('BLOCKED:',repr(e),file=sys.stderr);sys.exit(3)
