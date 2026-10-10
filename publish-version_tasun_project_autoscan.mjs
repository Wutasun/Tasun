#!/usr/bin/env node
/**
 * Tasun v5 exact release publisher
 *
 * 修復重點：
 * 1. 四個正式文件頁面整組發布；其他 HTML 僅更新實際變更檔。
 * 2. 正式 HTML 已自行提升人工版號時保留該版號；未提升時才產生單調遞增的 auto rNNN 版號。
 * 3. 解析 PAGE_FILE / PAGE_KEY / PAGE_ALIASES，將同頁所有 page entry 與 HTML build 同步。
 * 4. 同步所有 alias 的版本、序號、SHA-256 與位元組數。
 * 5. --verify-only 為獨立唯讀驗證；不依賴 changed-files，也不產生新版本。
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT=process.cwd();
const VERSION_FILE="tasun-version.json";
const REBUILD_FILE="TASUN_REBUILD";
const REBUILD_STAMP_FILE="TASUN_REBUILD_STAMP";
const WORKFLOW_FILE=".github/workflows/release-version.yml";
const DOCUMENT_ALIASES={
  "汐東收發文明細表.html":["xidong-official-doc-detail","official-doc-detail","official_doc_detail"],
  "汐東收發文登錄表.html":["xidong-official-doc-register","official-doc-register","official_doc_register"],
  "汐東文件統計表.html":["xidong-official-doc-statistics","official-doc-statistics","official_doc_statistics"],
  "汐東文件管理表.html":["xidong-doc-manager","xidong_doc_manager"]
};
const DOCUMENT_PAGES=Object.keys(DOCUMENT_ALIASES);
const BUILD_KEYS=["version","cacheV","buildStamp","pageBuildStamp","rebuildStamp"];
const DIGEST_KEYS=["sha256","artifactSha256","pageArtifactSha256","htmlSha256","digest"];
const SIZE_KEYS=["bytes","pageBytes","sizeBytes","artifactBytes"];
const VERIFY_ONLY=process.argv.includes("--verify-only");
const GENERATED=new Set([VERSION_FILE,REBUILD_FILE,REBUILD_STAMP_FILE]);
const FORMAL_EXT=new Set([".html",".htm"]);
const CORE_FILES=new Set(["tasun-version-loader.js","tasun-core.js","tasun-boot.js","tasun-auth-v4.js","tasun-cloudwrap-v4.js","tasun-guard-v5.js","tasun-global-core.js","tasun-resources.json","worker.js","publish-version_tasun_project_autoscan.mjs",WORKFLOW_FILE]);

function posix(p){return p.split(path.sep).join("/");}
function n(v){return v===undefined||v===null?"":String(v).trim();}
function rank(v){const m=n(v).match(/r(\d+)/i);return m?Number(m[1]):0;}
function taipeiNow(){return new Date(Date.now()+8*60*60*1000);}
function p2(x){return String(x).padStart(2,"0");}
function ymd(d){return `${d.getUTCFullYear()}${p2(d.getUTCMonth()+1)}${p2(d.getUTCDate())}`;}
function iso(d){return `${d.getUTCFullYear()}-${p2(d.getUTCMonth()+1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}+08:00`;}
function stable(obj){return JSON.stringify(obj,null,2)+"\n";}
async function atomicWrite(rel,content){const target=path.join(ROOT,rel),tmp=target+`.tasun-${process.pid}-${Date.now()}.tmp`;await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(tmp,content,"utf8");await fs.rename(tmp,target);}
async function exists(rel){try{await fs.access(path.join(ROOT,rel));return true;}catch{return false;}}
async function readJson(rel){const value=JSON.parse(await fs.readFile(path.join(ROOT,rel),"utf8"));if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(`invalid_manifest:${rel}`);return value;}
async function sha256(rel){return crypto.createHash("sha256").update(await fs.readFile(path.join(ROOT,rel))).digest("hex");}
function git(args){try{return execFileSync("git",args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();}catch{return"";}}
function changedFiles(){
  const env=n(process.env.TASUN_CHANGED_FILES);let list=env?env.split(/\r?\n/):[];
  if(!list.length){const before=n(process.env.TASUN_BEFORE_SHA),head=n(process.env.TASUN_HEAD_SHA)||"HEAD";
    list=(before&&!/^0+$/.test(before)?git(["diff","--name-only","-z",before,head]):git(["diff-tree","--root","--no-commit-id","--name-only","-z","-r",head])).split("\0");}
  // Compatibility with older workflow inputs using Git's C-quoted UTF-8 paths.
  const decode=raw=>{if(!raw.startsWith('"'))return raw;const bytes=[];for(let i=1;i<raw.length-1;i++){if(raw[i]==="\\"){const oct=raw.slice(i+1).match(/^[0-7]{3}/);if(oct){bytes.push(parseInt(oct[0],8));i+=3;continue;}i++;const c=({t:"\t",n:"\n",r:"\r"})[raw[i]]||raw[i];bytes.push(...Buffer.from(c));}else bytes.push(...Buffer.from(raw[i]));}return Buffer.from(bytes).toString("utf8");};
  return [...new Set(list.map(n).filter(Boolean).map(decode).map(posix))];
}
function htmlBuild(text){const m=String(text||"").match(/<meta[^>]+name=["']tasun-build-stamp["'][^>]+content=["']([^"']+)/i)||String(text||"").match(/TASUN_REBUILD_STAMP:([^\s<]+)/);return n(m&&m[1]);}
function pageConfig(text,rel){
  const pick=(key)=>{const m=String(text).match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));return n(m&&m[1]);};
  const aliasesMatch=String(text).match(/"PAGE_ALIASES"\s*:\s*(\[[^\]]*\])/);let aliases=[];try{aliases=aliasesMatch?JSON.parse(aliasesMatch[1]):[];}catch{}
  const file=pick("PAGE_FILE")||rel,key=pick("PAGE_KEY")||file;
  aliases=[file,key,...aliases].map(n).filter(Boolean);return{file,key,aliases:[...new Set(aliases)]};
}
function replaceMeta(text,name,value){const re=new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'][^"']*["']\\s*/?>`,`i`);const tag=`<meta name="${name}" content="${value}" />`;return re.test(text)?text.replace(re,matched=>matched.match(/content=["']([^"']*)/)?.[1]===value?matched:tag):text.replace(/<head[^>]*>/i,m=>`${m}\n${tag}`);}
function updateHtmlBuild(text,newBuild){
  const old=htmlBuild(text);let out=text;if(old&&old!==newBuild)out=out.split(old).join(newBuild);
  out=replaceMeta(out,"tasun-build-stamp",newBuild);out=replaceMeta(out,"tasun-rebuild-stamp",newBuild);
  out=out.replace(/(<!--\s*TASUN_REBUILD_STAMP:)[^\s<]+(?=\s*-->)/g,(_,prefix)=>prefix+newBuild);return out;
}
function previousHtmlBuild(rel){const raw=git(["show",`HEAD^:${rel}`]);return raw?htmlBuild(raw):"";}
function maxKnownRank(current,changedBuilds){let x=rank(current.version);for(const e of Object.values(current.pages||{}))x=Math.max(x,rank(e&&e.version),rank(e&&e.pageBuildStamp),rank(e&&e.buildStamp));for(const b of changedBuilds)x=Math.max(x,rank(b));return x;}
function releaseBuild(current,htmlInfos,allHash,date){
  const currentRoot=n(current.version);const builds=[...new Set(htmlInfos.map(x=>x.currentBuild).filter(Boolean))];
  const currentKnown=maxKnownRank(current,[]);
  const advanced=builds.filter(build=>rank(build)>rank(currentRoot));
  if(advanced.length>1)throw new Error("conflicting_manual_release_builds");
  const everyManualAdvanced=htmlInfos.length>0&&htmlInfos.every(x=>rank(x.currentBuild)>rank(x.previousBuild||"")&&rank(x.currentBuild)>0);
  if(builds.length===1&&everyManualAdvanced&&(currentRoot===builds[0]||rank(builds[0])>currentKnown))return builds[0];
  const next=maxKnownRank(current,builds)+1;return `${ymd(date)}_tasun_v5_xidong_docs_r${next}_${allHash.slice(0,12)}_release`;
}
function aliasesFor(current,config){
  const aliases=new Set([...config.aliases,...(DOCUMENT_ALIASES[config.file]||[])]);
  for(const [alias,entry] of Object.entries(current.pages||{}))if(entry&&typeof entry==="object"&&n(entry.file)===config.file)aliases.add(alias);
  return [...aliases];
}
function exactEntry(old,info,build,updatedAt){
  const out={...(old&&typeof old==="object"?old:{}),file:info.config.file,updatedAt,releaseSequence:rank(build)};
  for(const key of BUILD_KEYS)out[key]=build;
  for(const key of DIGEST_KEYS)out[key]=info.digest;
  for(const key of SIZE_KEYS)if(key in out||key==="sizeBytes")out[key]=Buffer.byteLength(info.text);
  return out;
}
async function verifyRelease(current){
  const build=n(current.version),sequence=rank(build);
  const require=(ok,label)=>{if(!ok)throw new Error(`release_contract_${label}`);};
  require(sequence>0,"invalid_build");
  for(const k of ["cacheV","buildStamp","rebuildStamp"])require(current[k]===build,`root_${k}`);
  require(current.releaseSequence===sequence&&current.release?.releaseSequence===sequence,"sequence_mismatch");
  for(const file of DOCUMENT_PAGES){
    const text=await fs.readFile(path.join(ROOT,file),"utf8"),digest=await sha256(file),config=pageConfig(text,file);
    require(htmlBuild(text)===build,`html_build_mismatch:${file}`);
    const secondary=text.match(/<meta[^>]+name=["']tasun-rebuild-stamp["'][^>]+content=["']([^"']+)/i);
    require(secondary?.[1]===build,`html_rebuild_mismatch:${file}`);
    for(const marker of text.matchAll(/<!--\s*TASUN_REBUILD_STAMP:([^\s<]+?)(?=\s*-->)/g))require(marker[1]===build,`html_comment_mismatch:${file}`);
    for(const alias of aliasesFor(current,config)){
      const entry=current.pages?.[alias];require(entry&&entry.file===file,`alias_missing:${alias}`);
      for(const key of BUILD_KEYS)require(entry[key]===build,`alias_build:${alias}:${key}`);
      require(entry.releaseSequence===sequence,`alias_sequence:${alias}`);
      for(const key of DIGEST_KEYS)require(entry[key]===digest,`alias_digest:${alias}:${key}`);
      for(const key of SIZE_KEYS)if(key in entry)require(entry[key]===Buffer.byteLength(text),`alias_size:${alias}:${key}`);
    }
    const artifact=current.pageArtifactManifest?.[file];require(artifact&&typeof artifact==="object",`manifest_missing:${file}`);
    for(const key of DIGEST_KEYS)require(artifact[key]===digest,`manifest_digest:${file}:${key}`);
    for(const key of BUILD_KEYS)require(artifact[key]===build,`manifest_build:${file}:${key}`);
    require(artifact.releaseSequence===sequence,`manifest_sequence:${file}`);
    for(const key of SIZE_KEYS)if(key in artifact)require(artifact[key]===Buffer.byteLength(text),`manifest_size:${file}:${key}`);
    require(current.pageBuildStamp?.[file]===build,`page_stamp:${file}`);
  }
  require(n(await fs.readFile(path.join(ROOT,REBUILD_STAMP_FILE),"utf8"))===build,"rebuild_stamp_mismatch");
  const rebuild=await fs.readFile(path.join(ROOT,REBUILD_FILE),"utf8");
  require(rebuild.split(/\r?\n/).includes(`version=${build}`)&&rebuild.split(/\r?\n/).includes(`releaseSequence=${sequence}`),"rebuild_mismatch");
  console.log(`[Tasun] read-only four-page release verification passed: ${build}`);
}
async function main(){
  if(!(await exists(WORKFLOW_FILE)))throw new Error(`required_workflow_missing:${WORKFLOW_FILE}`);
  const current=await readJson(VERSION_FILE);
  if(VERIFY_ONLY){await verifyRelease(current);return;}
  const changed=changedFiles(),relevant=[];
  for(const rel of changed){if(await exists(rel)&&(FORMAL_EXT.has(path.extname(rel).toLowerCase())||CORE_FILES.has(rel)||GENERATED.has(rel)))relevant.push(rel);}
  if(!relevant.length){console.log("[Tasun] no formal page/core/manifest change; nothing to sync.");return;}
  // The existing deployment gate requires the four document pages to be one artifact.
  const formal=[...new Set([...DOCUMENT_PAGES,...relevant.filter(rel=>FORMAL_EXT.has(path.extname(rel).toLowerCase()))])];
  const infos=[];
  for(const rel of formal){const text=await fs.readFile(path.join(ROOT,rel),"utf8");infos.push({rel,text,currentBuild:htmlBuild(text),previousBuild:previousHtmlBuild(rel),config:pageConfig(text,rel)});}
  const hash=crypto.createHash("sha256");for(const rel of [...relevant].sort()){hash.update(rel);hash.update("\0");hash.update(await fs.readFile(path.join(ROOT,rel)));hash.update("\0");}
  const now=taipeiNow(),updatedAt=iso(now),metadataOnly=relevant.every(rel=>GENERATED.has(rel));
  const build=metadataOnly?n(current.version):releaseBuild(current,infos.filter(info=>relevant.includes(info.rel)),hash.digest("hex"),now);
  if(!rank(build))throw new Error("unparseable_release_build");
  for(const info of infos){info.text=updateHtmlBuild(info.text,build);info.digest=crypto.createHash("sha256").update(info.text).digest("hex");}
  const pages={...(current.pages||{})},pageArtifactManifest={...(current.pageArtifactManifest||{})},pageBuildStamp=typeof current.pageBuildStamp==="object"?{...current.pageBuildStamp}:{};
  for(const info of infos){
    for(const alias of aliasesFor(current,info.config))pages[alias]={...exactEntry(pages[alias],info,build,updatedAt),pageKey:pages[alias]?.pageKey||info.config.key,officialVersionSource:VERSION_FILE,publisherWorkflowPath:WORKFLOW_FILE};
    pageArtifactManifest[info.config.file]=exactEntry(pageArtifactManifest[info.config.file],info,build,updatedAt);
    pageBuildStamp[info.config.file]=build;
  }
  const next={...current,version:build,cacheV:build,buildStamp:build,rebuildStamp:build,releaseSequence:rank(build),updatedAt,autoVersionEnabled:true,officialVersionSource:VERSION_FILE,rebuildStampFile:REBUILD_STAMP_FILE,pages,pageArtifactManifest,pageBuildStamp,release:{...(current.release||{}),releaseSequence:rank(build),workflow:WORKFLOW_FILE,script:"publish-version_tasun_project_autoscan.mjs",autoCommitVersionFiles:true,skipCommitToken:"[skip tasun-version]",lastAutoSyncAt:updatedAt,changedFormalFiles:formal,changedCoreFiles:relevant.filter(x=>CORE_FILES.has(x)),allFileAliasesExactGate:true}};
  for(const info of infos)await atomicWrite(info.rel,info.text);
  await atomicWrite(VERSION_FILE,stable(next));
  await atomicWrite(REBUILD_FILE,`version=${build}\nreleaseSequence=${rank(build)}\n`);
  await atomicWrite(REBUILD_STAMP_FILE,build+"\n");
  await verifyRelease(next);
}
main().catch(err=>{console.error("[Tasun] auto version sync failed",err);process.exitCode=1;});
