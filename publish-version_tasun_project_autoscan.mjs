#!/usr/bin/env node
/**
 * Tasun v5 自動版號發布器
 * - 掃描 tasun-version.json 的 versionSources
 * - 依內容雜湊產生穩定版號
 * - 同步各 HTML 的 <meta name="tasun-build-stamp" content="...">
 * - 回寫 tasun-version.json 與 TASUN_REBUILD_STAMP
 * - 無外部套件，GitHub Actions / 本機 Node.js 皆可執行
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const VERSION_FILE = path.join(ROOT, 'tasun-version.json');
const REBUILD_FILE = path.join(ROOT, 'TASUN_REBUILD_STAMP');
const GENERATED_BY = 'publish-version_tasun_project_autoscan.mjs';

function readText(file){
  return fs.readFileSync(file, 'utf8');
}
function writeTextIfChanged(file, text){
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if(old === text) return false;
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, text, 'utf8');
  return true;
}
function readJson(file){
  return JSON.parse(readText(file));
}
function unique(arr){
  const out=[]; const seen=new Set();
  for(const raw of arr || []){
    const v=String(raw || '').trim();
    if(!v || seen.has(v)) continue;
    seen.add(v); out.push(v);
  }
  return out;
}
function taipeiParts(date=new Date()){
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  }).formatToParts(date).reduce((a,p)=>{ a[p.type]=p.value; return a; }, {});
  return parts;
}
function taipeiStamp(date=new Date()){
  const p=taipeiParts(date);
  return `${p.year}${p.month}${p.day}_${p.hour}${p.minute}${p.second}`;
}
function taipeiIso(date=new Date()){
  const p=taipeiParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+08:00`;
}
function normTextForHash(file, text){
  let s = String(text || '').replace(/\r\n?/g, '\n');
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file);
  // 避免自動回寫欄位造成無限改版。
  if(ext === '.html' || ext === '.htm'){
    s = s
      .replace(/(<meta\b(?=[^>]*\bname\s*=\s*["']tasun-build-stamp["'])(?=[^>]*\bcontent\s*=\s*["'])([^>]*?\bcontent\s*=\s*["']))[^"']*(["'][^>]*>)/gi, '$1__TASUN_BUILD_STAMP__$3')
      .replace(/(meta\s+name=["']tasun-build-stamp["']\s+content=["'])[^"']*(["'])/gi, '$1__TASUN_BUILD_STAMP__$2')
      .replace(/(tasun-raci-r\d+[^\n<]*)/gi, '__TASUN_RACI_TAG__')
      .replace(/([?&]v=)[^&"'<>\s]+/gi, '$1__V__')
      .replace(/([?&]_=)[^&"'<>\s]+/gi, '$1__TS__')
      .replace(/([?&]_bs=)[^&"'<>\s]+/gi, '$1__BS__');
  }
  if(base === 'tasun-version.json' || base === 'TASUN_REBUILD_STAMP') return '';
  return s;
}
function hashSources(sources){
  const h = crypto.createHash('sha256');
  const scanned=[];
  const missing=[];
  for(const rel of sources){
    if(!rel || rel === 'tasun-version.json' || rel === 'TASUN_REBUILD_STAMP') continue;
    const file = path.join(ROOT, rel);
    if(!fs.existsSync(file)){
      missing.push(rel);
      continue;
    }
    const st = fs.statSync(file);
    if(!st.isFile()) continue;
    const raw = readText(file);
    const normalized = normTextForHash(rel, raw);
    h.update(`\n---FILE:${rel}---\n`);
    h.update(normalized);
    scanned.push({ file:rel, bytes:Buffer.byteLength(raw, 'utf8') });
  }
  return { hash:h.digest('hex'), scanned, missing };
}
function patchHtmlBuildStamp(rel, buildStamp){
  const file = path.join(ROOT, rel);
  if(!fs.existsSync(file)) return false;
  const ext = path.extname(file).toLowerCase();
  if(ext !== '.html' && ext !== '.htm') return false;
  let html = readText(file);
  let next = html;
  const metaRe = /<meta\b(?=[^>]*\bname\s*=\s*["']tasun-build-stamp["'])(?=[^>]*\bcontent\s*=\s*["'])([^>]*?\bcontent\s*=\s*["'])([^"']*)(["'][^>]*?)>/i;
  if(metaRe.test(next)){
    next = next.replace(metaRe, (m, a, old, b) => `<meta${a}${buildStamp}${b}>`);
  }else if(/<head[^>]*>/i.test(next)){
    next = next.replace(/<head[^>]*>/i, m => `${m}\n  <meta name="tasun-build-stamp" content="${buildStamp}" />`);
  }
  return writeTextIfChanged(file, next);
}
function setVersionFields(cfg, version, buildStamp, info){
  cfg.app = cfg.app || 'Tasun';
  cfg.versionMode = 'auto';
  cfg.includeCurrentPage = true;
  for(const k of ['manualVersion','fallbackVersion','ver','version','appVer','APP_VER','appVersion','cacheV','cache_v']) cfg[k] = version;
  cfg.buildStamp = buildStamp;
  cfg.build_stamp = buildStamp;
  cfg.pageBuildStamp = buildStamp;
  cfg.updatedAt = taipeiIso();
  cfg.notes = `Tasun v5：自動版號 ${version}；依 versionSources 內容雜湊自動發布，並同步 HTML build stamp。`;
  cfg.release = Object.assign({}, cfg.release || {}, {
    mode:'github-actions',
    branch:'main',
    script:'publish-version_tasun_project_autoscan.mjs',
    workflow:'.github/workflows/release-version.yml',
    timezone:'Asia/Taipei',
    autoCommit:true,
    requiredPermission:'contents: write',
    loopGuard:'sourceHash + bot actor skip + paths-ignore'
  });
  cfg.meta = Object.assign({}, cfg.meta || {}, {
    version,
    buildStamp,
    autoVersion:true,
    generatedBy:GENERATED_BY,
    sourceHash:info.hash,
    sourceShortHash:info.shortHash,
    scannedCount:info.scanned.length,
    missingCount:info.missing.length,
    missingSources:info.missing,
    htmlMetaSynced:true,
    updatedAt:cfg.updatedAt
  });
  return cfg;
}

function main(){
  if(!fs.existsSync(VERSION_FILE)){
    console.error('找不到 tasun-version.json，停止。');
    process.exit(1);
  }
  const cfg = readJson(VERSION_FILE);
  let sources = unique(cfg.versionSources || []);
  // 正式規則：版號檔本身不可列入內容雜湊，避免自我觸發。
  sources = sources.filter(x => x !== 'tasun-version.json' && x !== 'TASUN_REBUILD_STAMP');
  cfg.versionSources = sources;

  const info = hashSources(sources);
  info.shortHash = info.hash.slice(0, 10);
  const oldHash = cfg.meta && cfg.meta.sourceHash ? String(cfg.meta.sourceHash) : '';
  const currentVersion = String(cfg.version || cfg.ver || cfg.appVer || '').trim();
  const currentBuild = String(cfg.buildStamp || cfg.pageBuildStamp || '').trim();
  const sourceChanged = !oldHash || oldHash !== info.hash || !currentVersion || !currentBuild;
  const nextVersion = sourceChanged ? `${taipeiStamp()}_tasun_v5_auto_${info.shortHash}` : currentVersion;
  const nextBuildStamp = nextVersion;

  let htmlChanged = false;
  for(const rel of sources){
    htmlChanged = patchHtmlBuildStamp(rel, nextBuildStamp) || htmlChanged;
  }

  const nextCfg = setVersionFields(cfg, nextVersion, nextBuildStamp, info);
  const jsonChanged = writeTextIfChanged(VERSION_FILE, JSON.stringify(nextCfg, null, 2) + '\n');
  const rebuildChanged = writeTextIfChanged(REBUILD_FILE, `${nextBuildStamp}\n`);

  console.log(JSON.stringify({
    ok:true,
    sourceChanged,
    version:nextVersion,
    buildStamp:nextBuildStamp,
    sourceHash:info.hash,
    scanned:info.scanned.length,
    missing:info.missing,
    changed:{ html:htmlChanged, json:jsonChanged, rebuildStamp:rebuildChanged }
  }, null, 2));
}

main();
