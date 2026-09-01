from pathlib import Path
import re, json, hashlib, zipfile, shutil

VERSION = "20260901_tasun_v5_xidong_docs_r949_manager_pending_supervisor_stage_drilldown_docno_jump_single_authority_release"
NOW = "2026-09-01T09:20:00+08:00"
MANAGER = Path("汐東文件管理表.html")
DETAIL = Path("汐東收發文明細表.html")
REGISTER = Path("汐東收發文登錄表.html")
STATS = Path("汐東文件統計表.html")
VERSION_FILE = Path("tasun-version.json")
FILES = [MANAGER, DETAIL, REGISTER, STATS]
OLD_MANAGER = "20260721_tasun_v5_xidong_docs_r737_manager_three_zone_coordinated_color_visual_release"
OLD_R948 = "20260831_tasun_v5_xidong_docs_r948_pending_supervisor_reply_compact_stage_more_data_space_single_authority_release"

for p in FILES + [VERSION_FILE]:
    if not p.exists():
        raise SystemExit(f"missing required file: {p}")

def prepend_release_comment(text, comment):
    marker = "<!DOCTYPE html>"
    if marker in text:
        return text.replace(marker, marker + "\n" + comment, 1)
    return comment + "\n" + text

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# R949 manager: fix wording + number-only drilldown + stage-only detail + jump.
# ---------------------------------------------------------------------------
m = MANAGER.read_text(encoding="utf-8")
if OLD_MANAGER not in m:
    raise SystemExit("manager is not expected R737 baseline")
m = m.replace(OLD_MANAGER, VERSION)
m = prepend_release_comment(m, "<!-- R949：以 2026-09-01 最新上傳 R948 三頁與 R737 汐東文件管理表為唯一修改基準，僅修復文件管理表待回覆顯示語意、統計數字鑽取、該階段明細及文號精確定位。待回覆統一顯示為待監造回覆，但 pendingReply/needReply 內部相容鍵及統計公式不變；所有 KPI 僅統計數字本身可開啟明細，明細沿用單一 summaryRows 權威與短生命週期 stage/event context，只顯示該統計階段必要欄位；文號直接重用 R853/R855→R832 有界定位契約跳至汐東收發文明細表對應母列／階段／文號。關閉明細立即釋放 tbody 投影；無 setInterval、無正式 rows 副本，TasunSelfHealV5 採冷卻、最大重試與 AbortController。另同步四頁正式版號、own-page entry、SHA-256 與 TASUN_REBUILD_STAMP，其餘資料、同步、權限、手機/桌機主視覺及操作邏輯不變。 -->")
# All manager user-visible pending-reply wording is the same semantic.
m = m.replace("待回覆", "待監造回覆")
m = m.replace("按一下查看明細", "按統計數字查看明細")

stage_anchor = 'const R706_STAGE_HISTORY_KEY="文件處理歷程",R706_STAGE_START="起始文件",R706_STAGE_SUPERVISOR="監造回覆",R706_STAGE_CONTRACTOR="統包回覆來文";'
if "R949_PENDING_SUPERVISOR_REPLY_LABEL" not in m:
    m = replace_once(m, stage_anchor, stage_anchor + '\n  const R949_PENDING_SUPERVISOR_REPLY_LABEL="待監造回覆";', "R949 pending label authority")

# Add scalar cache aliases without duplicating formal row data.
needle = "pendingReply:a.filter(summaryNeedReply).length,overdue:a.filter(r=>summaryDueInfo(r).overdue).length"
if needle in m:
    m = m.replace(needle, "pendingReply:a.filter(summaryNeedReply).length,pendingSupervisorReply:a.filter(summaryNeedReply).length,pendingSupervisorReplyLabel:R949_PENDING_SUPERVISOR_REPLY_LABEL,overdue:a.filter(r=>summaryDueInfo(r).overdue).length", 1)

# Add R949 visual treatment for number-only trigger and document-number link.
style = '''\n<style id="tasun-doc-manager-r949-statistics-drilldown-style">\n.managerSummaryValue[data-r949-summary-trigger="1"]{cursor:pointer;border-radius:12px;outline-offset:3px;padding:.04em .12em;transition:box-shadow .14s,background .14s}\n.managerSummaryValue[data-r949-summary-trigger="1"]:hover{background:rgba(255,255,255,.07);box-shadow:0 0 0 2px rgba(244,220,150,.24)}\n.managerSummaryValue[data-r949-summary-trigger="1"]:focus-visible{outline:3px solid #fff0a8}\n.summaryDetailDocNoLinkR949{display:inline-block;color:#fff0a8;text-decoration:underline;text-underline-offset:3px;font-weight:950;cursor:pointer;background:transparent;border:0;padding:2px 3px;font:inherit}\n.summaryDetailDocNoLinkR949:hover{color:#ffffff}\n#summaryDetailTable th[hidden],#summaryDetailTable td[hidden]{display:none!important}\n</style>\n'''
if 'tasun-doc-manager-r949-statistics-drilldown-style' not in m:
    m = m.replace('</head>', style + '</head>', 1)

# Replace current manager detail renderer/binder with one stage-aware authority.
start = m.find('  function summaryRenderDetail(key){')
end = m.find('\n  function readPermMatrix()', start)
if start < 0 or end < 0:
    raise SystemExit("cannot find manager summary detail authority block")
new_block = r'''  function r949StageContext(row,key){
    const stages=summaryStageList(row),eventStage=row&&row.__tasunStageRecord&&typeof row.__tasunStageRecord==="object"?row.__tasunStageRecord:null;
    let stage=eventStage||(!row?.__tasunDocumentEvent&&stages.length?stages[stages.length-1]:null),index=stage?stages.findIndex(x=>x===stage||summaryNormalize(x&&x["階段UID"])===summaryNormalize(stage&&stage["階段UID"])):-1;
    let type=stage?summaryStageType(stage):R706_STAGE_START,sequence=Number(row&&row.__tasunDocumentEventSequence||stage&&stage["同類次數"]||0),source=summaryNormalize(row&&row.__tasunDocumentEventSource||"");
    if(type===R706_STAGE_START)sequence=0;
    if(!source){if(type===R706_STAGE_SUPERVISOR)source="監造回覆("+(sequence||1)+")";else if(type===R706_STAGE_CONTRACTOR)source="統包回覆來文("+(sequence||1)+")";else source="起始文件";}
    const direction=summaryNormalize(row&&row.__tasunDocumentEventDirection)||(type===R706_STAGE_SUPERVISOR?"發文":type===R706_STAGE_CONTRACTOR?"收文":summaryNormalizeDirection(summaryField(row,SUMMARY_FIELDS.direction))||"收文");
    const docNo=summaryNormalize(row&&row.__tasunDocumentEventDocNo)||(stage?summaryStageDocNo(stage):"")||summaryNormalize(summaryField(row,SUMMARY_FIELDS.docNo));
    const date=summaryNormalize(row&&row.__tasunDocumentEvent?summaryField(row,SUMMARY_FIELDS.docDate):stage?summaryStageDate(stage):summaryField(row,SUMMARY_FIELDS.docDate)||summaryField(row,SUMMARY_FIELDS.receiveDate));
    const subject=summaryNormalize(stage&&stage["主旨"]||summaryField(row,SUMMARY_FIELDS.subject));
    const stageUid=summaryNormalize(stage&&stage["階段UID"]||stage&&stage.uid||stage&&stage.stageUid||"");
    return{stage,stages,index,type,sequence,source,direction,docNo,date,subject,stageUid,key};
  }
  function r949DetailVisibleFields(key){
    const core=new Set([SUMMARY_FIELDS.direction,SUMMARY_FIELDS.docNo,SUMMARY_FIELDS.subject,"__tasunDocumentEventSource",SUMMARY_FIELDS.system,SUMMARY_FIELDS.handler]);
    if(["total","received","sent"].includes(key))core.add(SUMMARY_FIELDS.docDate);
    if(["pendingReply","overdue","supervisorDays"].includes(key)){core.add(SUMMARY_FIELDS.dueDate);core.add(SUMMARY_FIELDS.days);core.add(SUMMARY_FIELDS.status);}
    if(key==="extensionPending"){core.add(SUMMARY_FIELDS.extensionDate);core.add(SUMMARY_FIELDS.extensionSubmitNo);core.add(SUMMARY_FIELDS.extensionStatus);}
    return core;
  }
  function r949ApplyDetailColumns(key){
    const table=$("#summaryDetailTable"),head=table&&table.tHead&&table.tHead.rows&&table.tHead.rows[0];if(!table||!head)return 0;
    const visible=r949DetailVisibleFields(key);head.cells[0].hidden=false;let count=1;
    SUMMARY_DETAIL_COLUMNS.forEach((col,i)=>{const show=visible.has(col.field),th=head.cells[i+1];if(th)th.hidden=!show;if(show)count++;});
    table.dataset.r949StageOnly="1";table.dataset.r949VisibleColumnCount=String(count);table.dataset.r949SummaryKey=String(key||"");return count;
  }
  function r949DetailValue(row,col,ctx){
    if(col.field===SUMMARY_FIELDS.direction)return ctx.direction||"—";
    if(col.field===SUMMARY_FIELDS.docNo)return ctx.docNo||"—";
    if(col.field===SUMMARY_FIELDS.subject)return ctx.subject||"—";
    if(col.field==="__tasunDocumentEventSource")return ctx.source||"—";
    if(col.field===SUMMARY_FIELDS.docDate)return ctx.date||"—";
    return summaryCellText(row,col.field);
  }
  function r949JumpMeta(row,ctx){
    const start=ctx.stages.find(x=>summaryStageType(x)===R706_STAGE_START)||null,baseNo=summaryStageDocNo(start)||summaryNormalize(summaryField(row,SUMMARY_FIELDS.docNo)),rowUid=summaryNormalize(row&&row.uid||row&&row.pk||row&&row.__tasunSourceUid||""),rowKey=baseNo?"doc::"+baseNo.toLowerCase():summaryLogicalKey(row),kind=ctx.type===R706_STAGE_START?"rowStart":ctx.stageUid?"stage":"legacy";
    return{docNo:ctx.docNo,rowUid,rowKey,stageLabel:ctx.source,sourcePath:"r949-manager-stage-detail",locator:{kind,field:"文號",stageUid:ctx.stageUid,index:ctx.index>=0?ctx.index:""}};
  }
  function r949PrepareDetailJump(meta){
    const loc=meta&&meta.locator||{},intent={...(meta||{}),locator:{kind:summaryNormalize(loc.kind||"legacy"),field:summaryNormalize(loc.field||"文號"),stageUid:summaryNormalize(loc.stageUid||""),index:loc.index!==undefined&&loc.index!==null?String(loc.index):""},intentId:"r949_manager_"+Date.now()+"_"+Math.random().toString(16).slice(2),createdAt:Date.now(),expiresAt:Date.now()+120000,source:"r949-manager-stage-detail",target:"汐東收發文明細表.html"};
    const raw=JSON.stringify(intent);[sessionStorage,localStorage].forEach(store=>{for(const k of ["tasun_r855_duplicate_jump_intent_v1","tasun_doc_manager_child_jump_lock_v1","tasun_child_jump_lock_v1"]){try{store.setItem(k,raw);}catch(_e){}}});
    try{const u=new URL(withVersion("汐東收發文明細表.html"),location.href);u.searchParams.set("_r853dup","1");u.searchParams.set("_r853doc",summaryNormalize(intent.docNo));if(intent.rowUid)u.searchParams.set("_r853uid",summaryNormalize(intent.rowUid));if(intent.rowKey)u.searchParams.set("_r853key",summaryNormalize(intent.rowKey));if(intent.stageLabel)u.searchParams.set("_r853stage",summaryNormalize(intent.stageLabel));u.searchParams.set("_r853path",intent.sourcePath);u.searchParams.set("_r853kind",intent.locator.kind);u.searchParams.set("_r853field",intent.locator.field);if(intent.locator.stageUid)u.searchParams.set("_r853stageuid",intent.locator.stageUid);if(intent.locator.index!=="")u.searchParams.set("_r853index",intent.locator.index);return u.toString();}catch(_e){return withVersion("汐東收發文明細表.html");}
  }
  function summaryRenderDetail(key){
    const cfg=key==="supervisorDays"?summaryDaysDetailConfig():(SUMMARY_DETAIL_FILTERS[key]||SUMMARY_DETAIL_FILTERS.total),matched=summaryDetailRows(key),title=$("#summaryDetailTitle"),count=$("#summaryDetailCount"),body=$("#summaryDetailTbody"),visibleCount=r949ApplyDetailColumns(key);
    if(!title||!count||!body){console.error("[Tasun R949] summary detail DOM missing");return false;}summaryDetailKey=key;title.textContent=cfg.title;count.textContent=String(matched.length);body.replaceChildren();
    if(!matched.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=Math.max(1,visibleCount);td.className="summaryDetailEmpty";td.textContent="目前沒有符合「"+cfg.title.replace(/明細$/,'')+"」條件的文件。";tr.appendChild(td);body.appendChild(tr);scheduleR685SummaryDetailStickySubject();return true;}
    matched.forEach((row,index)=>{const ctx=r949StageContext(row,key),tr=document.createElement("tr"),seq=document.createElement("td"),visible=r949DetailVisibleFields(key);seq.textContent=String(index+1);tr.appendChild(seq);
      SUMMARY_DETAIL_COLUMNS.forEach(col=>{const td=document.createElement("td"),show=visible.has(col.field),value=r949DetailValue(row,col,ctx);td.hidden=!show;if(col.className)td.classList.add(col.className);if(show&&col.field===SUMMARY_FIELDS.docNo&&value!=="—"){const a=document.createElement("button");a.type="button";a.className="summaryDetailDocNoLinkR949";a.textContent=value;a.dataset.r949DocJump="1";a.__r949JumpMeta=r949JumpMeta(row,ctx);td.appendChild(a);}else if(show&&col.status&&value!=="—"){const tag=document.createElement("span");tag.className="summaryDetailStatus";tag.textContent=value;td.appendChild(tag);}else if(show)td.textContent=value;tr.appendChild(td);});body.appendChild(tr);
    });
    scheduleR685SummaryDetailStickySubject();return matched.length===Number(count.textContent);
  }
  function summaryOpenDetail(key,opener){const dialog=$("#summaryDetailDialog"),close=$("#btnSummaryDetailClose");if(!dialog||!summaryRenderDetail(key))return false;summaryDetailLastFocus=opener||document.activeElement;dialog.classList.add("open");dialog.setAttribute("aria-hidden","false");document.body.classList.add("summary-detail-open");scheduleR685SummaryDetailStickySubject();requestAnimationFrame(()=>{try{close&&close.focus({preventScroll:true});}catch(_e){close&&close.focus();}});return true;}
  function summaryCloseDetail(){const dialog=$("#summaryDetailDialog"),body=$("#summaryDetailTbody"),table=$("#summaryDetailTable");if(!dialog)return false;dialog.classList.remove("open");dialog.setAttribute("aria-hidden","true");document.body.classList.remove("summary-detail-open");summaryDetailKey="";body&&body.replaceChildren();if(table&&table.tHead&&table.tHead.rows[0])Array.from(table.tHead.rows[0].cells).forEach(c=>c.hidden=false);const last=summaryDetailLastFocus;summaryDetailLastFocus=null;if(last&&document.contains(last))requestAnimationFrame(()=>{try{last.focus({preventScroll:true});}catch(_e){last.focus();}});return true;}
  function summaryBindDetails(){
    const grid=$("#managerSummaryGrid"),dialog=$("#summaryDetailDialog"),close=$("#btnSummaryDetailClose"),daysSelect=$("#mgrKpiSupervisorDaysFilter");if(!grid||!dialog||!close||!daysSelect){console.error("[Tasun R949] summary detail required DOM missing");return false;}
    grid.querySelectorAll(".managerSummaryCard[data-summary-key]").forEach(card=>{const trigger=card.querySelector(".managerSummaryValue");card.setAttribute("role","group");card.tabIndex=-1;card.removeAttribute("aria-haspopup");card.removeAttribute("aria-controls");if(trigger){trigger.dataset.r949SummaryTrigger="1";trigger.setAttribute("role","button");trigger.tabIndex=0;trigger.setAttribute("aria-haspopup","dialog");trigger.setAttribute("aria-controls","summaryDetailDialog");trigger.setAttribute("aria-label","開啟"+(SUMMARY_DETAIL_FILTERS[card.dataset.summaryKey]?.title||"統計明細"));}});
    if(daysSelect.dataset.filterBound!=="1"){["pointerdown","mousedown","touchstart","click"].forEach(type=>daysSelect.addEventListener(type,e=>e.stopPropagation()));daysSelect.addEventListener("keydown",e=>e.stopPropagation());daysSelect.addEventListener("change",e=>{e.stopPropagation();summaryDaysFilterValue=daysSelect.value||SUMMARY_DAYS_ALL;summaryRender(summaryRows,"距今日天數篩選已更新",false);if(summaryDetailKey==="supervisorDays"&&dialog.classList.contains("open"))summaryRenderDetail("supervisorDays");});daysSelect.dataset.filterBound="1";}
    if(grid.dataset.detailBound!=="r949"){grid.addEventListener("click",e=>{const trigger=e.target.closest('.managerSummaryValue[data-r949-summary-trigger="1"]');if(!trigger||!grid.contains(trigger))return;const card=trigger.closest(".managerSummaryCard[data-summary-key]");if(card)summaryOpenDetail(card.dataset.summaryKey,trigger);});grid.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches('.managerSummaryValue[data-r949-summary-trigger="1"]')){e.preventDefault();const card=e.target.closest(".managerSummaryCard[data-summary-key]");if(card)summaryOpenDetail(card.dataset.summaryKey,e.target);}});grid.dataset.detailBound="r949";}
    if(dialog.dataset.detailBound!=="r949"){close.addEventListener("click",summaryCloseDetail);dialog.addEventListener("click",e=>{const jump=e.target.closest('[data-r949-doc-jump="1"]');if(jump){e.preventDefault();const href=r949PrepareDetailJump(jump.__r949JumpMeta||{});location.href=href;return;}if(e.target===dialog)summaryCloseDetail();});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog.classList.contains("open")){e.preventDefault();summaryCloseDetail();}});dialog.dataset.detailBound="r949";}
    return true;
  }
'''
m = m[:start] + new_block + m[end:]

# Update legacy self-heal checks that assumed whole-card buttons.
m = m.replace('$("#managerSummaryGrid")?.dataset.detailBound==="1"&&$("#summaryDetailDialog")?.dataset.detailBound==="1"', '$("#managerSummaryGrid")?.dataset.detailBound==="r949"&&$("#summaryDetailDialog")?.dataset.detailBound==="r949"')
m = m.replace('c.getAttribute("role")==="button"&&s.dataset.filterBound==="1"', 'c.getAttribute("role")==="group"&&v.dataset.r949SummaryTrigger==="1"&&s.dataset.filterBound==="1"')

# Add explicit R949 checks into the existing unified manager SelfHeal check list.
selfheal_anchor = '    ["docManagerR680SummaryDetailDialogDom",()=>["summaryDetailDialog","summaryDetailTitle","summaryDetailCount","summaryDetailTable","summaryDetailTbody","btnSummaryDetailClose"].every(id=>!!document.getElementById(id)),()=>{console.error("[Tasun R680] summary detail dialog DOM missing; reload required");return false;}],'
if selfheal_anchor in m and 'docManagerR949PendingSupervisorReplyDisplayAuthority' not in m:
    extra = '''    ["docManagerR949PendingSupervisorReplyDisplayAuthority",()=>{const c=document.querySelector('.managerSummaryCard[data-summary-key="pendingReply"] .managerSummaryLabel');return !!(c&&c.textContent.trim()===R949_PENDING_SUPERVISOR_REPLY_LABEL&&SUMMARY_DETAIL_FILTERS.pendingReply.title===R949_PENDING_SUPERVISOR_REPLY_LABEL+"明細");},()=>{const c=document.querySelector('.managerSummaryCard[data-summary-key="pendingReply"] .managerSummaryLabel');if(c)c.textContent=R949_PENDING_SUPERVISOR_REPLY_LABEL;SUMMARY_DETAIL_FILTERS.pendingReply.title=R949_PENDING_SUPERVISOR_REPLY_LABEL+"明細";return true;}],\n    ["docManagerR949NumberOnlyDrilldown",()=>Array.from(document.querySelectorAll('.managerSummaryCard[data-summary-key]')).every(c=>c.getAttribute("role")==="group"&&c.querySelector('.managerSummaryValue[data-r949-summary-trigger="1"][role="button"]')),()=>summaryBindDetails()],\n    ["docManagerR949StageOnlyDetail",()=>{const t=$("#summaryDetailTable");return !$("#summaryDetailDialog")?.classList.contains("open")||!!(t&&t.dataset.r949StageOnly==="1"&&Number(t.dataset.r949VisibleColumnCount||0)<SUMMARY_DETAIL_COLUMN_COUNT);},()=>summaryDetailKey?summaryRenderDetail(summaryDetailKey):true],\n    ["docManagerR949DocNoExactJumpReuseR855",()=>String(r949PrepareDetailJump).includes("tasun_r855_duplicate_jump_intent_v1")&&String(r949PrepareDetailJump).includes("_r853stageuid")&&String(r949PrepareDetailJump).includes("_r853doc"),()=>true],\n    ["docManagerR949NoInfinitePolling",()=>!String(summaryBindDetails).includes("setInterval")&&!String(summaryRenderDetail).includes("setInterval")&&!String(r949PrepareDetailJump).includes("setInterval"),()=>true],\n'''
    m = m.replace(selfheal_anchor, extra + selfheal_anchor, 1)

# Existing manager self-heal registration gets an abort controller and finite behavior.
reg_old = 'checks.forEach(([n,c,r])=>core.register(PAGE_KEY+":"+n,{check:c,repair:r,verify:c,coolDownMs:1400,maxRetry:4}));'
reg_new = 'const r949HealController=typeof AbortController==="function"?new AbortController():null;checks.forEach(([n,c,r])=>core.register(PAGE_KEY+":"+n,{check:c,repair:r,verify:c,coolDownMs:1400,maxRetry:4,abortController:r949HealController}));'
if reg_old in m:
    m = m.replace(reg_old, reg_new, 1)

# Required manager startup still validates all original DOM nodes.
# Static content and the direct-open trusted topology remain unchanged.
if '待監造回覆' not in m or 'r949StageOnly' not in m or 'tasun_r855_duplicate_jump_intent_v1' not in m:
    raise SystemExit("manager R949 feature validation failed")
MANAGER.write_text(m, encoding="utf-8", newline="")

# ---------------------------------------------------------------------------
# Other R948 pages: no functional rewrite; only version/comment synchronization.
# ---------------------------------------------------------------------------
comments = {
    DETAIL: '<!-- R949：同步汐東文件管理表「待監造回覆／統計數字鑽取／該階段明細／文號 R855→R832 精確定位」正式版號、own-page entry、SHA-256 與 rebuild 身分；本明細表 R948 狀態語意、R947/R855/R832 定位接收、資料、同步、搜尋、編輯、Excel、雙區滑動、uid/rev/updatedAt/deleted、權限與 UI 功能完全不變。 -->',
    REGISTER: '<!-- R949：同步汐東文件管理表「待監造回覆／統計數字鑽取／該階段明細／文號精確定位」正式版號、own-page entry、SHA-256 與 rebuild 身分；本登錄表 R948/R942 表單、Read/Merge/Readback、Excel、權限、uid/rev/updatedAt/deleted 與 UI 功能完全不變。 -->',
    STATS: '<!-- R949：同步汐東文件管理表「待監造回覆／統計數字鑽取／該階段明細／文號精確定位」正式版號、own-page entry、SHA-256 與 rebuild 身分；本統計表既有 R948 待監造回覆單一顯示權威與 R947 所有件數數字鑽取、該階段欄位收斂、R853/R855→R832 文號精確定位功能完全保留，資料、統計公式、同步、Excel、權限與 UI 其餘不變。 -->'
}
for p in [DETAIL, REGISTER, STATS]:
    text=p.read_text(encoding="utf-8")
    if OLD_R948 not in text:
        raise SystemExit(f"{p} is not expected R948 baseline")
    text=text.replace(OLD_R948, VERSION)
    text=prepend_release_comment(text, comments[p])
    p.write_text(text, encoding="utf-8", newline="")

# ---------------------------------------------------------------------------
# Version manifest: exact own-page entries + aliases + exact raw UTF-8 SHA256.
# ---------------------------------------------------------------------------
manifest = json.loads(VERSION_FILE.read_text(encoding="utf-8"))
manifest["version"] = VERSION
manifest["cacheV"] = VERSION
manifest["buildStamp"] = VERSION
manifest["rebuildStamp"] = VERSION
manifest["updatedAt"] = NOW
manifest["versionMode"] = "manual-page-entry-exact-r949-manager-stage-drilldown-docno-jump-single-authority-release"
manifest["officialVersionSource"] = "tasun-version.json"
release = manifest.setdefault("release", {})
release.update({
    "deployConsistency":"r949_manager_pending_supervisor_stage_drilldown_docno_jump_single_authority_release",
    "r949ManagerPendingSupervisorReplyDisplayAuthority": True,
    "r949ManagerPendingReplyInternalKeyCompatibility": True,
    "r949ManagerNumberOnlyStatisticsDrilldown": True,
    "r949ManagerStageOnlyDetailProjection": True,
    "r949ManagerDocNoJumpReusesR855R832": True,
    "r949ManagerNoFormalRowsClone": True,
    "r949ManagerNoInfinitePolling": True,
    "r949ManagerDetailProjectionReleasedOnClose": True,
    "r949SelfHealChecks": [
        "docManagerR949PendingSupervisorReplyDisplayAuthority",
        "docManagerR949NumberOnlyDrilldown",
        "docManagerR949StageOnlyDetail",
        "docManagerR949DocNoExactJumpReuseR855",
        "docManagerR949NoInfinitePolling"
    ]
})

file_keys = {
    "汐東文件管理表.html": ["汐東文件管理表.html","xidong-doc-manager","xidong_doc_manager"],
    "汐東收發文明細表.html": ["汐東收發文明細表.html","xidong-official-doc-detail","official-doc-detail","official_doc_detail"],
    "汐東收發文登錄表.html": ["汐東收發文登錄表.html","xidong-official-doc-register","official-doc-register","official_doc_register"],
    "汐東文件統計表.html": ["汐東文件統計表.html","xidong-official-doc-statistics","official-doc-statistics","official_doc_statistics"]
}
pages = manifest.setdefault("pages", {})
page_art = manifest.setdefault("pageArtifactManifest", {})
page_build = manifest.setdefault("pageBuildStamp", {})

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

for filename, aliases in file_keys.items():
    p=Path(filename); digest=sha(p)
    # Use any current exact entry as metadata base, otherwise create a compact one.
    base=None
    for k in aliases:
        if isinstance(pages.get(k), dict):
            base=dict(pages[k]);break
    if base is None: base={"file":filename}
    base.update({
        "version":VERSION,"cacheV":VERSION,"buildStamp":VERSION,"pageBuildStamp":VERSION,"rebuildStamp":VERSION,
        "updatedAt":NOW,"file":filename,"sha256":digest,"artifactSha256":digest,"pageArtifactSha256":digest,
        "htmlSha256":digest,"digest":digest,"officialVersionSource":"tasun-version.json","pageEntryOnly":True,
        "releaseReady":True,"releaseSequence":949,"r949Exact":True
    })
    if filename=="汐東文件管理表.html":
        base.update({"pageKey":"xidong-doc-manager","r949PendingSupervisorReply":True,"r949NumberOnlyDrilldown":True,"r949StageOnlyDetail":True,"r949DocNoJumpR855R832":True})
    for k in aliases:
        pages[k]=dict(base)
    old_pa=page_art.get(filename)
    if isinstance(old_pa,dict): pa=dict(old_pa)
    else: pa={}
    pa.update({"sha256":digest,"artifactSha256":digest,"pageArtifactSha256":digest,"htmlSha256":digest,"digest":digest,"version":VERSION,"cacheV":VERSION,"buildStamp":VERSION,"pageBuildStamp":VERSION,"rebuildStamp":VERSION,"updatedAt":NOW,"file":filename,"releaseReady":True,"releaseSequence":949,"r949Exact":True})
    page_art[filename]=pa
    page_build[filename]=VERSION

# Ensure manager joins the formal managed topology without retiring existing three pages.
active = manifest.setdefault("officialDocumentActivePages", [])
for f in ["汐東收發文明細表.html","汐東收發文登錄表.html","汐東文件統計表.html","汐東文件管理表.html"]:
    if f not in active: active.append(f)

VERSION_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n",encoding="utf-8",newline="")
Path("TASUN_REBUILD").write_text(VERSION+"\n",encoding="utf-8")
Path("TASUN_REBUILD_STAMP").write_text(VERSION+"\n",encoding="utf-8")

summary = f'''R949 深入修復摘要\n\n正式版號：{VERSION}\n\n1. 汐東文件管理表「待回覆」→「待監造回覆」\n- 可見 KPI、鑽取標題與相關顯示語意統一為「待監造回覆」。\n- pendingReply / needReply 內部相容鍵與原統計公式不改，避免變更正式資料契約。\n- 統計摘要快取增加 pendingSupervisorReply 與 pendingSupervisorReplyLabel 純量值，不建立 rows 副本。\n\n2. 所有管理表 KPI 改為「只按統計數字鑽取」\n- 整張卡片不再是明細開啟目標；統計數字為唯一 click / Enter / Space trigger。\n- 距今日天數下拉仍可獨立操作。\n\n3. 明細只顯示該統計／該階段必要欄位\n- total/received/sent：顯示方向、文號、主旨、統計來源、事件日期、系統、承辦人。\n- pending/overdue/supervisorDays：顯示目前有效階段方向、文號、主旨、來源、期限、距今天數、處理情形、系統、承辦人。\n- extensionPending：顯示目前文號與展延日期／實際提送文號／提送狀態等必要欄位。\n- 原 17 欄 DOM 保留供既有 R685/R718 SelfHeal 相容，但無關欄位 hidden，不再全部攤開。\n- 關閉明細即 replaceChildren 清除短生命週期 tbody。\n\n4. 文號精確跳至汐東收發文明細表\n- 文號改為可點擊按鍵。\n- 直接重用既有 R853/R855→R832 契約：rowUid / rowKey / stageLabel / docNo / locator(kind, stageUid, index)。\n- 同步寫入 tasun_r855_duplicate_jump_intent_v1、tasun_doc_manager_child_jump_lock_v1、tasun_child_jump_lock_v1，URL 同步帶 _r853* 精確定位參數。\n- 不建立第二套明細定位接收器。\n\n5. 單一權威／低記憶體／自我修復\n- summaryRows 仍為管理表唯一正式可變資料集合；統計與階段明細為短生命週期投影。\n- 不新增 setInterval 或無限輪詢。\n- R949 SelfHeal 新增待監造回覆、數字唯一觸發、階段欄位收斂、R855/R832 定位重用及無無限輪詢檢查；使用 cooldown、maxRetry、AbortController。\n\n6. 版本\n- 四頁、tasun-version.json、TASUN_REBUILD、TASUN_REBUILD_STAMP 同步 R949。\n- 四頁 own-page entries / aliases / pageArtifactManifest 均重新計算 SHA-256。\n'''
Path("R949_深入修復摘要.txt").write_text(summary,encoding="utf-8")

# Validate embedded version and requested feature anchors before packaging.
for p in FILES:
    text=p.read_text(encoding="utf-8")
    if VERSION not in text: raise SystemExit(f"version missing in {p}")
if "待監造回覆" not in MANAGER.read_text(encoding="utf-8"): raise SystemExit("manager label missing")
if "data-r949-summary-trigger" not in MANAGER.read_text(encoding="utf-8"): raise SystemExit("number-only trigger missing")
if "_r853stageuid" not in MANAGER.read_text(encoding="utf-8"): raise SystemExit("docno exact jump missing")

zip_name = "Tasun_R949_文件管理表待監造回覆_階段統計明細_文號定位修正版.zip"
with zipfile.ZipFile(zip_name,"w",zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in FILES+[VERSION_FILE,Path("TASUN_REBUILD"),Path("TASUN_REBUILD_STAMP"),Path("R949_深入修復摘要.txt")]:
        z.write(p,p.name)
print("R949_PATCH_OK", VERSION, zip_name)
