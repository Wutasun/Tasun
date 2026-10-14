#!/usr/bin/env python3
"""Read-only cross-file R1157 staging consistency gate. No internet/Cloudflare writes."""
import pathlib,sys,json,hashlib,re,html, tomllib
from urllib.parse import urlsplit
DOCS=('汐東收發文明細表.html','汐東收發文登錄表.html','汐東文件統計表.html','汐東文件管理表.html')
PROD_WORKER='tasun-worker.wutasun.workers.dev'
PROD_D1='ecb1ff1d-eb3d-4fe8-ba2c-8b7cc884bd84'
DIGEST_FIELDS=('sha256','artifactSha256','pageArtifactSha256','htmlSha256','digest')
SIZE_FIELDS=('bytes','pageBytes','sizeBytes','artifactBytes')

def verify(root):
    root=pathlib.Path(root); site=root/'site'; worker=root/'worker'
    state=json.loads((root/'STAGING_STATUS.json').read_text('utf-8'))
    assert state['status'] in ('DEMO_NOT_DEPLOYABLE','AWAITING_CLOUDFLARE_RESOURCE_VERIFICATION')
    cfg=tomllib.loads((worker/'wrangler.staging.toml').read_text('utf-8'))
    assert cfg['name']=='tasun-worker-staging' and cfg['main']=='tasun-worker-stable-v4.js'
    assert cfg['vars']['CORS_ALLOW_ORIGINS']==state['staging_site']
    d1=cfg['d1_databases'][0]
    assert d1['database_id']==state['staging_d1_id'] and d1['database_id']!=PROD_D1
    assert d1['binding']=='DB' and d1['database_name']=='tasun-db-staging'
    assert (worker/cfg['main']).is_file() and (worker/'schema_v4.sql').is_file()
    js=(worker/cfg['main']).read_text('utf-8')
    assert ('if (!["admin","write"].includes(me.r))' in js or 'if (me.r !== "admin" && me.r !== "write")' in js)
    assert 'function configuredAuthSecret(env)' in js and 'AUTH_SECRET_NOT_CONFIGURED' in js and 'dev-secret' not in js
    assert 'const user = await getUser(env, me.u)' in js and 'if (!user || !user.enabled)' in js
    assert 'const roleOverride = await getAuth(env, me.u)' in js and 'me.r = String(roleOverride?.role || user.role || "read")' in js
    v=json.loads((site/'tasun-version.json').read_text('utf-8'))
    stage=state['staging_build']
    assert v['version']==v['cacheV']==v['buildStamp']==v['rebuildStamp']==stage
    assert v['release']['stagingOnly'] and v['release']['notFormalRelease']
    assert (site/'TASUN_REBUILD_STAMP').read_text('utf-8').strip()==stage
    assert 'version='+stage in (site/'TASUN_REBUILD').read_text('utf-8')
    for name in DOCS:
        data=(site/name).read_bytes();s=data.decode('utf-8')
        assert stage in s and PROD_WORKER not in s
        assert 'http-equiv="Content-Security-Policy"' in s and 'connect-src' in s
        assert state['staging_worker'] in s
        digest=hashlib.sha256(data).hexdigest()
        records=[v['pageArtifactManifest'][name]]+[e for e in v['pages'].values() if isinstance(e,dict) and e.get('file')==name]
        assert len(records)>=2
        for e in records:
            for k in DIGEST_FIELDS:
                if k in e: assert e[k]==digest,(name,k)
            for k in SIZE_FIELDS:
                if k in e: assert e[k]==len(data),(name,k)
    for p in site.rglob('*'):
        if p.is_file() and p.suffix.lower() in ('.html','.json','.js'):
            assert PROD_WORKER not in p.read_text('utf-8'),str(p)
    api=json.loads((site/'tasun-resources.json').read_text('utf-8'))['api']
    assert api['base']==state['staging_worker']
    assert cfg['vars']['CORS_ALLOW_ORIGINS']!='https://wutasun.github.io'
    assert state['cloud_deployed'] is False
    assert state.get('github_pr')==102
    assert state.get('github_pr_head')=='69c0327a1158a2dfb757c5a3808f5f55495c0c37'
    assert state.get('source_commit_pins_verified') or state.get('status')=='DEMO_NOT_DEPLOYABLE'
    return {'result':'PASS_OFFLINE_ONLY','four_page_artifact_hashes':'PASS','CSP_connect_src':'STAGING_ONLY',
            'backend_entry':'tasun-worker-stable-v4.js','d1_binding':'DB','AUTH_SECRET':'NOT_CONFIGURED',
            'cloud_d1_readback':'NOT_VERIFIED','cloud_e2e':'NOT_VERIFIED',
            'formal_release_modified':False}
if __name__=='__main__':
    try: print(json.dumps(verify(sys.argv[1]),ensure_ascii=False,indent=2))
    except Exception as e:print('BLOCKED:',repr(e),file=sys.stderr);sys.exit(3)
