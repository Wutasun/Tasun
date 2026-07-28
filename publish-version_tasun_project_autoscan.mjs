#!/usr/bin/env node
/**
 * Tasun v5 Auto Version Sync - R779
 *
 * 修復重點：
 * 1. 僅更新本次實際變更的正式 HTML，不再重寫全站所有 HTML。
 * 2. 正式 HTML 已自行提升人工版號時保留該版號；未提升時才產生單調遞增的 auto rNNN 版號。
 * 3. 解析 PAGE_FILE / PAGE_KEY / PAGE_ALIASES，將同頁所有 page entry 與 HTML build 同步。
 * 4. 每一 changed page 寫入 artifactSha256，供頁面以 no-store HTML + SHA-256 精確驗證後才重載。
 * 5. 同步 tasun-version.json、TASUN_REBUILD、TASUN_REBUILD_STAMP；不使用全站模糊 token 取代。
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
async function readJson(rel){try{return JSON.parse(await fs.readFile(path.join(ROOT,rel),"utf8"));}catch{return{};}}
async function sha256(rel){return crypto.createHash("sha256").update(await fs.readFile(path.join(ROOT,rel))).digest("hex");}
function git(args){try{return execFileSync("git",args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();}catch{return"";}}
function changedFiles(){
  const env=n(process.env.TASUN_CHANGED_FILES);let list=env?env.split(/\r?\n/):[];
  if(!list.length){const before=n(process.env.TASUN_BEFORE_SHA);const head=n(process.env.TASUN_HEAD_SHA)||"HEAD";if(before&&!/^0+$/.test(before))list=git(["diff","--name-only",before,head]).split(/\r?\n/);else list=git(["diff-tree","--no-commit-id","--name-only","-r",head]).split(/\r?\n/);}
  return [...new Set(list.map(posix).map(n).filter(Boolean).filter(x=>!GENERATED.has(x)))];
}
function htmlBuild(text){const m=String(text||"").match(/<meta[^>]+name=["']tasun-build-stamp["'][^>]+content=["']([^"']+)/i)||String(text||"").match(/TASUN_REBUILD_STAMP:([^\s<]+)/);return n(m&&m[1]);}
function pageConfig(text,rel){
  const pick=(key)=>{const m=String(text).match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));return n(m&&m[1]);};
  const aliasesMatch=String(text).match(/"PAGE_ALIASES"\s*:\s*(\[[^\]]*\])/);let aliases=[];try{aliases=aliasesMatch?JSON.parse(aliasesMatch[1]):[];}catch{}
  const file=pick("PAGE_FILE")||rel,key=pick("PAGE_KEY")||file;
  aliases=[file,key,...aliases].map(n).filter(Boolean);return{file,key,aliases:[...new Set(aliases)]};
}
function replaceMeta(text,name,value){const re=new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'][^"']*["']\\s*/?>`,`i`);const tag=`<meta name="${name}" content="${value}" />`;return re.test(text)?text.replace(re,tag):text.replace(/<head[^>]*>/i,m=>`${m}\n${tag}`);}
function updateHtmlBuild(text,newBuild){
  const old=htmlBuild(text);let out=text;if(old&&old!==newBuild)out=out.split(old).join(newBuild);
  out=replaceMeta(out,"tasun-build-stamp",newBuild);out=replaceMeta(out,"tasun-rebuild-stamp",newBuild);
  out=out.replace(/TASUN_REBUILD_STAMP:[^\s<]+/,`TASUN_REBUILD_STAMP:${newBuild}`);return out;
}
function previousHtmlBuild(rel){const raw=git(["show",`HEAD^:${rel}`]);return raw?htmlBuild(raw):"";}
function maxKnownRank(current,changedBuilds){let x=rank(current.version);for(const e of Object.values(current.pages||{}))x=Math.max(x,rank(e&&e.version),rank(e&&e.pageBuildStamp),rank(e&&e.buildStamp));for(const b of changedBuilds)x=Math.max(x,rank(b));return x;}
function releaseBuild(current,htmlInfos,allHash,date){
  const currentRoot=n(current.version);const builds=[...new Set(htmlInfos.map(x=>x.currentBuild).filter(Boolean))];
  const currentKnown=maxKnownRank(current,[]);
  const everyManualAdvanced=htmlInfos.length>0&&htmlInfos.every(x=>rank(x.currentBuild)>rank(x.previousBuild||"")&&rank(x.currentBuild)>0);
  if(builds.length===1&&everyManualAdvanced&&(currentRoot===builds[0]||rank(builds[0])>currentKnown))return builds[0];
  const next=maxKnownRank(current,builds)+1;return `${ymd(date)}_tasun_v5_auto_r${next}_${allHash.slice(0,12)}_release`;
}
async function main(){
  if(!(await exists(WORKFLOW_FILE)))throw new Error(`required_workflow_missing:${WORKFLOW_FILE}`);
  const changed=changedFiles();const formal=[];const relevant=[];
  for(const rel of changed){if(!(await exists(rel)))continue;const ext=path.extname(rel).toLowerCase();if(FORMAL_EXT.has(ext))formal.push(rel);if(FORMAL_EXT.has(ext)||CORE_FILES.has(rel))relevant.push(rel);}
  if(!relevant.length){console.log("[Tasun R779] no formal page/core change; nothing to sync.");return;}
  const current=await readJson(VERSION_FILE);const infos=[];
  for(const rel of formal){const text=await fs.readFile(path.join(ROOT,rel),"utf8");infos.push({rel,text,currentBuild:htmlBuild(text),previousBuild:previousHtmlBuild(rel),config:pageConfig(text,rel)});}
  const hash=crypto.createHash("sha256");for(const rel of [...relevant].sort()){hash.update(rel);hash.update("\0");hash.update(await fs.readFile(path.join(ROOT,rel)));hash.update("\0");}const allHash=hash.digest("hex");
  const now=taipeiNow(),updatedAt=iso(now),build=releaseBuild(current,infos,allHash,now);
  for(const info of infos){info.text=updateHtmlBuild(info.text,build);await fs.writeFile(path.join(ROOT,info.rel),info.text,"utf8");info.digest=await sha256(info.rel);}
  const pages={...(current.pages||{})};const pageArtifactManifest={...(current.pageArtifactManifest||{})};const pageBuildStamp={...(current.pageBuildStamp||{})};
  for(const info of infos){
    const aliases=new Set(info.config.aliases);
    for(const [alias,entry] of Object.entries(pages))if(entry&&typeof entry==="object"&&n(entry.file)===info.config.file)aliases.add(alias);
    pageArtifactManifest[info.config.file]=info.digest;pageBuildStamp[info.config.file]=build;
    for(const alias of aliases){const old=pages[alias]&&typeof pages[alias]==="object"?pages[alias]:{};pages[alias]={...old,version:build,cacheV:build,buildStamp:build,pageBuildStamp:build,rebuildStamp:build,updatedAt,file:info.config.file,pageKey:alias===info.config.file?info.config.key:(old.pageKey||alias),artifactSha256:info.digest,versionAuthorityMode:"own-page-all-aliases-exact-r779-network-html-sha256-gate",cacheCleanupMode:"r779-clear-old-version-lock-cache-storage-service-worker-buildstamp-memo-once-per-build",publisherWorkflowPath:WORKFLOW_FILE,publisherMode:"r779-atomic-changed-page-alias-exact-update-no-global-html-rewrite",partialReleasePolicy:"block-until-all-file-aliases-exact"};}
    info.config.aliases=[...aliases];
  }
  const next={...current,version:build,cacheV:build,buildStamp:build,rebuildStamp:build,updatedAt,autoVersionEnabled:true,versionMode:"auto-page-entry-exact",officialVersionSource:VERSION_FILE,rebuildStampFile:REBUILD_STAMP_FILE,pages,pageArtifactManifest,pageBuildStamp,selfHealChecks:[...new Set([...(Array.isArray(current.selfHealChecks)?current.selfHealChecks:[]),"raciR379EveryFormalPageOrCoreUpdateMustSyncTasunVersionJson","raciR379AutoUpdateTasunRebuildStamp","raciR379GitHubActionsAutoCommitVersionFiles","raciR779WorkflowRealDotGithubPath","raciR779ChangedPageAliasesExactBuildAndDigest","raciR779AtomicVersionFiles","raciR779NoPartialAliasReload","raciR779PostPushGithubPagesArtifactVerification","raciR779NoGlobalHtmlBuildRewrite"])],release:{...(current.release||{}),workflow:WORKFLOW_FILE,script:"publish-version_tasun_project_autoscan.mjs",autoCommitVersionFiles:true,skipCommitToken:"[skip tasun-version]",lastAutoSyncAt:updatedAt,changedFormalFiles:formal,changedCoreFiles:relevant.filter(x=>!formal.includes(x)),pageEntryArtifactExactGate:true,allFileAliasesExactGate:true,atomicVersionWrites:true,postPushPagesVerification:true,noGlobalHtmlTokenRewrite:true}};
  await atomicWrite(VERSION_FILE,stable(next));await atomicWrite(REBUILD_FILE,build+"\n");await atomicWrite(REBUILD_STAMP_FILE,build+"\n");
  for(const info of infos){for(const alias of info.config.aliases){const e=next.pages&&next.pages[alias];if(!e||e.version!==build||e.pageBuildStamp!==build||e.artifactSha256!==info.digest||e.file!==info.config.file)throw new Error(`release_contract_alias_mismatch:${alias}`);}if(next.pageArtifactManifest[info.config.file]!==info.digest||next.pageBuildStamp[info.config.file]!==build)throw new Error(`release_contract_manifest_mismatch:${info.config.file}`);}
  if(n(await fs.readFile(path.join(ROOT,REBUILD_FILE),"utf8"))!==build||n(await fs.readFile(path.join(ROOT,REBUILD_STAMP_FILE),"utf8"))!==build)throw new Error("release_contract_rebuild_mismatch");
  console.log(`[Tasun R779] build=${build}`);console.log(`[Tasun R779] changed pages=${formal.join(", ")||"none"}`);console.log(`[Tasun R779] exact alias/artifact/rebuild contract verified.`);
}
main().catch(err=>{console.error("[Tasun R779] auto version sync failed",err);process.exit(1);});
