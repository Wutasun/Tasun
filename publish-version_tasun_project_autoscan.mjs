#!/usr/bin/env node
/* Tasun v5 R378 自動版號同步器
 * 原則：每次正式網頁 / 核心檔版本更新，必須同步更新 tasun-version.json。
 * 用法：node publish-version_tasun_project_autoscan.mjs
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const VERSION_FILE = path.join(ROOT, 'tasun-version.json');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.cache']);
const SOURCE_EXTS = new Set(['.html', '.js', '.mjs', '.json', '.css', '.yml', '.yaml']);
const PAGE_EXTS = new Set(['.html', '.htm']);
const FALLBACK_PREFIX = 'tasun_v5_auto';

function readText(file){ return fs.readFileSync(file, 'utf8'); }
function writeText(file, txt){ fs.writeFileSync(file, txt, 'utf8'); }
function norm(s){ return String(s == null ? '' : s).trim(); }
function walk(dir, out=[]){
  for(const name of fs.readdirSync(dir)){
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    const st = fs.statSync(full);
    if(st.isDirectory()){
      if(!SKIP_DIRS.has(name)) walk(full, out);
    }else if(SOURCE_EXTS.has(path.extname(name).toLowerCase())){
      out.push(rel);
    }
  }
  return out;
}
function sha8(txt){ return crypto.createHash('sha256').update(txt).digest('hex').slice(0, 8); }
function stampNow(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_tasun_v5_auto_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function extractMetaBuild(html){
  const m = html.match(/<meta[^>]+name=["']tasun-build-stamp["'][^>]+content=["']([^"']+)["']/i);
  return norm(m && m[1]);
}
function ensureMetaBuild(html, build){
  if(/<meta[^>]+name=["']tasun-build-stamp["']/i.test(html)){
    return html.replace(/(<meta[^>]+name=["']tasun-build-stamp["'][^>]+content=["'])([^"']*)(["'][^>]*>)/i, `$1${build}$3`);
  }
  return html.replace(/<head[^>]*>/i, m => `${m}\n  <meta name="tasun-build-stamp" content="${build}">`);
}
function extractGlobals(html){
  function pick(key, fallback=''){
    const re = new RegExp(`${key}\\s*:\\s*['\"]([^'\"]+)['\"]`);
    const m = html.match(re);
    return norm(m && m[1]) || fallback;
  }
  return {
    pageKey: pick('PAGE_KEY'),
    resourceKey: pick('RESOURCE_KEY'),
    tableId: pick('TABLE_ID'),
    dbName: pick('DB_NAME')
  };
}
function loadVersionJson(){
  if(!fs.existsSync(VERSION_FILE)) return {};
  try{ return JSON.parse(readText(VERSION_FILE)); }
  catch(e){ throw new Error('tasun-version.json 不是合法 JSON：' + e.message); }
}
function newerStamp(a,b){ return norm(a) > norm(b) ? norm(a) : norm(b); }

const files = walk(ROOT);
const pages = files.filter(f => PAGE_EXTS.has(path.extname(f).toLowerCase()));
let latestBuild = '';
let pagesMap = {};

for(const rel of pages){
  const full = path.join(ROOT, rel);
  let html = readText(full);
  let build = extractMetaBuild(html);
  if(!build){
    build = `${stampNow()}_${sha8(rel)}`;
    html = ensureMetaBuild(html, build);
    writeText(full, html);
  }
  latestBuild = newerStamp(latestBuild, build);
  const g = extractGlobals(html);
  pagesMap[rel] = {
    pageKey: g.pageKey || rel.replace(/\.html?$/i, ''),
    resourceKey: g.resourceKey || g.pageKey || rel.replace(/\.html?$/i, ''),
    tableId: g.tableId || '',
    dbName: g.dbName || '',
    buildStamp: build,
    cacheV: build,
    version: build,
    updatedAt: new Date().toISOString(),
    mustSyncWithTasunVersionJson: true
  };
}

if(!latestBuild) latestBuild = stampNow();
const json = loadVersionJson();
json.version = latestBuild;
json.cacheV = latestBuild;
json.buildStamp = latestBuild;
json.pageBuildStamp = latestBuild;
json.versionMode = 'auto';
json.autoVersionEnabled = true;
json.includeCurrentPage = true;
json.versionSyncRequired = true;
json.versionJsonIsSingleAuthority = true;
json.preventDowngradeToOldBuild = true;
json.updatedAt = new Date().toISOString();
json.pages = Object.assign({}, json.pages || {}, pagesMap);
json.versionSources = Array.from(new Set(files.concat(['tasun-version.json','publish-version_tasun_project_autoscan.mjs','.github/workflows/release-version.yml']))).sort();
json.release = Object.assign({}, json.release || {}, {
  versionJsonSyncEnforced: true,
  githubPagesNetworkRefresh: true,
  preventOldDowngrade: true,
  autoScannedAt: new Date().toISOString(),
  sourceCount: json.versionSources.length,
  pageCount: Object.keys(json.pages).length
});

writeText(VERSION_FILE, JSON.stringify(json, null, 2) + '\n');
console.log(`[Tasun] tasun-version.json 已同步：${latestBuild}，頁面 ${Object.keys(pagesMap).length} 個，來源 ${json.versionSources.length} 個。`);
