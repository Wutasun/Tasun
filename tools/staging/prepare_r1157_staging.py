#!/usr/bin/env python3
"""Fail-closed R1157 PR#102 STAGING V7 preview generator (offline only).

Produces staging-only FRONTEND and WORKER bundles for operator verification.
It never calls Cloudflare, writes GitHub or deploys anything.
"""
import argparse, hashlib, json, pathlib, re, sys, tomllib, shutil, tempfile
from zipfile import ZipFile
from urllib.parse import urlsplit

PROD_HOST = 'tasun-worker.wutasun.workers.dev'
PROD_URL='https://' + PROD_HOST
PROD_DB='ecb1ff1d-eb3d-4fe8-ba2c-8b7cc884bd84'
PR_HEAD='69c0327a1158a2dfb757c5a3808f5f55495c0c37'
PR_WORKER_SHA256='a7998eaeaa5aa648fb198e3f0b8da526f1dc1eb000b556a1ef47b49941e8b8e2'
PR_REGISTER_SHA256='d32ecc76ea59d38c69ec2d7cd68d665a893d9721c44b06110671154181041e84'
PR_VERSION_SHA256='a38370a28088b4e4f6dd15e1d37ba10cf55b2b25d5f5031840b9c483d86990d7'
REGISTER='汐東收發文登錄表.html'
DOCS=('汐東收發文明細表.html','汐東收發文登錄表.html','汐東文件統計表.html','汐東文件管理表.html')
EXTRA=('index.html','entry.html')
WORKER='tasun-api/tasun-worker-stable-v4.js'
SCHEMA='tasun-api/schema_v4.sql'
DIGEST_FIELDS=('sha256','artifactSha256','pageArtifactSha256','htmlSha256','digest')
SIZE_FIELDS=('bytes','pageBytes','sizeBytes','artifactBytes')
BUILD_FIELDS=('version','cacheV','buildStamp','pageBuildStamp','rebuildStamp')


def fail(message): raise ValueError(message)

def origin(value,kind,demo=False):
    u=urlsplit(value or '')
    if (u.scheme!='https' or not u.hostname or u.port or u.username or u.password or
            u.path not in ('','/') or u.query or u.fragment):
        fail(kind + ' origin must be HTTPS hostname only, without port/path/credentials')
    host=u.hostname.lower().rstrip('.')
    if host in (PROD_HOST,'wutasun.github.io') or host.endswith('.wutasun.github.io'):
        fail(kind + ' origin points to formal production')
    if not demo and (host.endswith('.example.com') or '.example.' in host or host.startswith('demo-')):
        fail(kind + ' origin is a placeholder; provide an actual independent domain')
    if kind=='worker' and not host.endswith('.workers.dev'): fail('worker origin must be a *.workers.dev domain')
    if kind=='site' and host.endswith('.workers.dev'): fail('site and worker must be distinct origins')
    return 'https://' + host

def source_files(path, enforce_pr_pins=True):
    if not path.is_file(): fail('source ZIP missing')
    with ZipFile(path) as z:
        if z.testzip(): fail('source ZIP CRC error')
        names=z.namelist()
        if not names:fail('source ZIP is empty')
        for n in names:
            p=pathlib.PurePosixPath(n)
            if p.is_absolute() or '..' in p.parts: fail('unsafe ZIP member')
        # Both GitHub branch-download archives (one root folder) and the already
        # unpacked/repacked full-root ZIP are accepted, without modifying source.
        if 'tasun-version.json' in names and WORKER in names: root=''
        else:
            candidate_roots={n.split('/')[0] for n in names if '/' in n}
            matches=[r+'/' for r in candidate_roots
                     if r+'/tasun-version.json' in names and r+'/'+WORKER in names]
            if len(matches)!=1:fail('source ZIP must have exact project root or one GitHub folder')
            root=matches[0]
        def read(p):
            if root+p not in names: fail('required source member missing: '+p)
            return z.read(root+p)
        if enforce_pr_pins:
            for p,expected in ((WORKER,PR_WORKER_SHA256),(REGISTER,PR_REGISTER_SHA256),
                               ('tasun-version.json',PR_VERSION_SHA256)):
                digest=hashlib.sha256(read(p)).hexdigest()
                if digest!=expected:fail('source differs from validated PR #102 head '+PR_HEAD[:12]+' for '+p)
        version=json.loads(read('tasun-version.json'))
        build=version['version']
        if not re.search(r'_r1157_[0-9a-f]{12}_release$',build):fail('only R1157 candidate is accepted')
        code=read(WORKER).decode('utf-8')
        if not (('if (!["admin","write"].includes(me.r))' in code) or
                ('if (me.r !== "admin" && me.r !== "write")' in code)):
            fail('Worker lacks server-side admin/write-only /merge guard')
        for marker in ['function configuredAuthSecret(env)','AUTH_SECRET_NOT_CONFIGURED',
                       '/api/tasun/read','/api/tasun/merge']:
            if marker not in code:fail('R1157 Worker missing required contract: '+marker)
        if 'dev-secret' in code:fail('Worker contains unsafe dev-secret fallback')
        for marker in ['const user = await getUser(env, me.u)',
                       'if (!user || !user.enabled)',
                       'const roleOverride = await getAuth(env, me.u)',
                       'me.r = String(roleOverride?.role || user.role || "read")']:
            if marker not in code:fail('Worker lacks live D1 permission revocation guard: '+marker)
        schema=read(SCHEMA).decode('utf-8')
        for table in ('tasun_users','tasun_auth','tasun_rows'):
            if not re.search('CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+'+table, schema,re.I):
                fail('schema missing table: '+table)
        wrangler=tomllib.loads(read('tasun-api/wrangler.toml').decode('utf-8'))
        if wrangler.get('main')=='tasun-worker-stable-v4.js':
            pass
        # Source config is NEVER reused by generated staging wrangler.
        source_root={n[len(root):]:z.read(n) for n in names if n.startswith(root) and not n.endswith('/')}
        return build,version,source_root

def injection(text,worker):
    # connect-src is intentionally narrowly scoped to block ANY production API / third-party writes
    # while permitting locally served static resources and standalone authentication with staging.
    csp=("<meta http-equiv=\"Content-Security-Policy\" "
         "content=\"connect-src 'self' " + worker + "; form-action 'self'; base-uri 'self'\" />")
    robots='<meta name="robots" content="noindex,nofollow,noarchive" />'
    if '<head' not in text.lower():fail('page missing head element')
    return re.sub(r'(<head[^>]*>)',lambda m:m.group(1)+'\n'+robots+'\n'+csp, text,count=1,flags=re.I)

def build(args):
    source=pathlib.Path(args.source).resolve()
    old_build,version,files=source_files(source, enforce_pr_pins=not (args.demo and args.fixture_only))
    if args.demo:
        site='https://tasun-stage-demo.pages.dev'
        worker='https://tasun-stage-demo.workers.dev'
        d1='11111111-2222-4333-8444-555555555555'
    else:
        site=origin(args.site,'site')
        worker=origin(args.worker,'worker')
        d1=str(args.d1 or '').lower().strip()
        if not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',d1):fail('independent D1 UUID required')
        if d1==PROD_DB:fail('production D1 ID prohibited')
        if not args.confirm_independent:fail('require --confirm-independent for independently created staging resources')
    if site==worker:fail('same site and worker origin')
    dest=pathlib.Path(args.output).resolve()
    if dest.exists() and any(dest.iterdir()):fail('output must be empty; refusing to overwrite')
    if not dest.exists():dest.mkdir(parents=True)
    st_site=dest/'site'; st_worker=dest/'worker'; st_site.mkdir();st_worker.mkdir()
    # Staging identity differs from the formal release but retains the R1157 sequence.
    salt=hashlib.sha256((old_build+'|'+site+'|'+worker+'|'+d1).encode()).hexdigest()[:12]
    stage_build=old_build+'_staging_'+salt
    selected=[]
    for p in files:
        if '/' in p:continue  # Never deploy production data/, repo workflows, docs or backend as Pages assets
        if p in DOCS+EXTRA or p in ('tasun-resources.json','tasun-version.json','TASUN_REBUILD','TASUN_REBUILD_STAMP') or p.endswith(('.js','.png')):
            selected.append(p)
    selected=sorted(set(selected))
    for name in selected:
        raw=files[name];output=st_site/name
        if name.endswith(('.html','.js','.json')):
            content=raw.decode('utf-8')
            content=content.replace(PROD_URL,worker)
            content=content.replace(old_build,stage_build)
            if name.endswith('.html'):content=injection(content,worker)
            output.write_text(content,encoding='utf-8')
        elif name=='TASUN_REBUILD':output.write_text('version='+stage_build+'\nreleaseSequence=1157\n',encoding='utf-8')
        elif name=='TASUN_REBUILD_STAMP':output.write_text(stage_build+'\n',encoding='utf-8')
        else:output.write_bytes(raw)
    # Recompute official four-page manifest digests and all aliases for STAGING ONLY.
    v=json.loads((st_site/'tasun-version.json').read_text('utf-8'))
    for name in DOCS:
        data=(st_site/name).read_bytes(); digest=hashlib.sha256(data).hexdigest(); byte_len=len(data)
        for entry in [v.get('pageArtifactManifest',{}).get(name)]+[x for x in v.get('pages',{}).values() if isinstance(x,dict) and x.get('file')==name]:
            if not isinstance(entry,dict):continue
            for field in DIGEST_FIELDS: 
                if field in entry:entry[field]=digest
            for field in SIZE_FIELDS:
                if field in entry:entry[field]=byte_len
    v['release']['stagingOnly']=True
    v['release']['stagingDomain']=site
    v['release']['stagingWorker']=worker
    v['release']['notFormalRelease']=True
    (st_site/'tasun-version.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (st_worker/'tasun-worker-stable-v4.js').write_bytes(files[WORKER])
    (st_worker/'schema_v4.sql').write_bytes(files[SCHEMA])
    (st_worker/'wrangler.staging.toml').write_text('''# R1157 STAGING-ONLY; never use the formal wrangler.toml
name = "tasun-worker-staging"
main = "tasun-worker-stable-v4.js"
compatibility_date = "2026-02-14"
workers_dev = true

[vars]
CORS_ALLOW_ORIGINS = "'''+site+'''"

[[d1_databases]]
binding = "DB"
database_name = "tasun-db-staging"
database_id = "'''+d1+'''"
''',encoding='utf-8')
    state={'status':'DEMO_NOT_DEPLOYABLE' if args.demo else 'AWAITING_CLOUDFLARE_RESOURCE_VERIFICATION',
           'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
           'github_pr':102,'github_pr_head':PR_HEAD,
           'source_commit_pins_verified':not(args.demo and args.fixture_only),
           'source_version':old_build,'staging_build':stage_build,
           'staging_site':site,'staging_worker':worker,
           'staging_d1_id':d1,'site_files':len(selected),
           'source_origin_prod_worker_removed':all(PROD_HOST not in p.read_text('utf-8') for p in st_site.rglob('*') if p.is_file() and p.suffix in ('.html','.js','.json')),
           'cloud_resources_independently_confirmed':False,'cloud_deployed':False,
           'cloud_readback_verified':False,'browser_e2e_verified':False,
           'AUTH_SECRET_set':False,'formal_release_modified':False}
    (dest/'STAGING_STATUS.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (dest/'DO_NOT_DEPLOY_UNTIL_VERIFIED.txt').write_text('此套件僅為本機隔離配置候選；Cloudflare Worker/D1 未建立或未驗證、AUTH_SECRET 未設定、Readback/E2E 未驗證。\n請先執行 verify_r1157_staging.py，並由授權管理員完成雲端資源獨立性檢查。\n',encoding='utf-8')
    if not state['source_origin_prod_worker_removed']:fail('staging site has production Worker string; blocked')
    return state

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source',required=True,help='R1157 original full ZIP')
    ap.add_argument('--output',required=True,help='EMPTY destination directory')
    ap.add_argument('--site');ap.add_argument('--worker');ap.add_argument('--d1')
    ap.add_argument('--confirm-independent',action='store_true')
    ap.add_argument('--demo',action='store_true',help='fake resources for validation only; DO NOT DEPLOY')
    ap.add_argument('--fixture-only',action='store_true',help='DEMO ONLY: local older R1157 fixture without PR blob SHA pin; never deploy')
    args=ap.parse_args()
    if args.fixture_only and not args.demo:
        ap.error('--fixture-only requires --demo')
    try: print(json.dumps(build(args),ensure_ascii=False,indent=2))
    except Exception as exc:print('BLOCKED:',exc,file=sys.stderr);sys.exit(3)
    sys.exit(0)

