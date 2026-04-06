#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const argv = process.argv.slice(2);
function getArg(name, fallback = undefined) {
  const i = argv.indexOf(name);
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
  return fallback;
}
function hasFlag(name) {
  return argv.includes(name);
}

const root = path.resolve(getArg('--root', '.'));
const writeFallbacks = /^(1|true|yes|on)$/i.test(String(getArg('--write-fallbacks', 'false')));
const strict = !/^(0|false|no|off)$/i.test(String(getArg('--strict', 'true')));

if (process.env.ADMIN_RELEASE !== '1') {
  console.error('❌ 拒絕執行：只有 admin 可發布。請以 ADMIN_RELEASE=1 執行。');
  process.exit(1);
}

const CONTROLLED_FILES = [
  'entry.html',
  'index.html',
  '汐東工程管理表.html',
  '捷運汐東線事項記錄.html',
  '捷運汐東線權責分工精簡版.html',
  'tasun-version.json',
  'tasun-version-loader.js',
  'tasun-resources.json',
  'tasun-core.js',
  'tasun-boot.js',
  'tasun-loader.js',
  'tasun-next-fix.js',
  'tasun-global-core.js',
  'tasun-auth-v4.js',
  'tasun-cloudwrap-v4.js',
  'tasun-guard-v5.js',
  'tasun-global-auth-v65.js',
  'worker.js'
];

const FALLBACK_FILES = [
  'entry.html',
  'index.html',
  '汐東工程管理表.html',
  '捷運汐東線事項記錄.html',
  '捷運汐東線權責分工精簡版.html'
];

const FORBIDDEN_PATTERNS = [
  /__TASUN_PAGE_FIXED_VERSION__/g,
  /20260405_notes_authfix_v62/g,
  /20260406_tasun_v5_syncfix_v63/g,
  /20260406_tasun_v5_unified_final_v65/g,
  /20260406_tasun_v5_unified_final_v67/g,
  /notes_authfix_v62/g,
  /syncfix_v63/g,
  /unified_final_v65/g
];

function filePath(rel) {
  return path.join(root, rel);
}
function exists(rel) {
  return fs.existsSync(filePath(rel));
}
function read(rel) {
  return fs.readFileSync(filePath(rel), 'utf8');
}
function write(rel, content) {
  fs.writeFileSync(filePath(rel), content, 'utf8');
}
function safeJsonParse(text, rel) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${rel} JSON 解析失敗: ${err.message}`);
  }
}
function stamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}
function isoLocal() {
  const d = new Date();
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(tz) / 60)).padStart(2, '0');
  const mm = String(Math.abs(tz) % 60).padStart(2, '0');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}${sign}${hh}:${mm}`;
}
function computeVersion(files) {
  const hash = crypto.createHash('sha256');
  for (const rel of files) {
    if (!exists(rel)) continue;
    hash.update(`\n---FILE:${rel}---\n`);
    hash.update(read(rel));
  }
  const short = hash.digest('hex').slice(0, 10);
  return `${stamp()}_tasun_v5_auto_${short}`;
}

function scanForbidden(files) {
  const hits = [];
  for (const rel of files) {
    if (!exists(rel)) continue;
    const text = read(rel);
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(text)) hits.push({ file: rel, pattern: re.toString() });
    }
  }
  return hits;
}

function updateVersionJson(newVersion) {
  const rel = 'tasun-version.json';
  if (!exists(rel)) throw new Error('缺少 tasun-version.json');
  const json = safeJsonParse(read(rel), rel);
  json.app = json.app || 'Tasun';
  json.versionMode = 'auto';
  json.version = newVersion;
  json.ver = newVersion;
  json.appVer = newVersion;
  json.APP_VER = newVersion;
  json.appVersion = newVersion;
  json.fallbackVersion = newVersion;
  json.manualVersion = newVersion;
  json.updatedAt = isoLocal();
  json.notes = `Tasun v5 專案專用自動發布版號：${newVersion}`;
  write(rel, JSON.stringify(json, null, 2) + '\n');
}

function updateResourcesJson(newVersion) {
  const rel = 'tasun-resources.json';
  if (!exists(rel)) return;
  const json = safeJsonParse(read(rel), rel);
  json.meta = json.meta || {};
  json.meta.ver = newVersion;
  json.meta.notes = `Tasun v5 專案專用自動發布版號：${newVersion}`;
  write(rel, JSON.stringify(json, null, 2) + '\n');
}

function replaceAllVersionTokens(text, newVersion) {
  return text
    .replace(/window\.__TASUN_PAGE_FIXED_VERSION__\s*=\s*["'][^"']+["']/g, `window.__TASUN_PAGE_FIXED_VERSION__ = "${newVersion}"`)
    .replace(/window\.TASUN_APP_VER\s*=\s*["'][^"']+["']/g, `window.TASUN_APP_VER = "${newVersion}"`)
    .replace(/window\.APP_VER\s*=\s*["'][^"']+["']/g, `window.APP_VER = "${newVersion}"`)
    .replace(/window\.__CACHE_V\s*=\s*["'][^"']+["']/g, `window.__CACHE_V = "${newVersion}"`)
    .replace(/var\s+APP_VER\s*=\s*String\(([^\n;]*?)\|\|\s*["'][^"']+["']\)\.trim\(\)\s*\|\|\s*["'][^"']+["']/g, `var APP_VER = String($1|| "${newVersion}").trim() || "${newVersion}"`)
    .replace(/var\s+FALLBACK_VER\s*=\s*["'][^"']+["']/g, `var FALLBACK_VER = "${newVersion}"`)
    .replace(/window\.__TASUN_FALLBACK_VER__\s*=\s*window\.__TASUN_FALLBACK_VER__\s*\|\|\s*["'][^"']+["']/g, `window.__TASUN_FALLBACK_VER__ = window.__TASUN_FALLBACK_VER__ || "${newVersion}"`)
    .replace(/searchParams\.set\(["']v["']\s*,\s*["'][^"']+["']\)/g, `searchParams.set("v", "${newVersion}")`)
    .replace(/__u\.searchParams\.set\(["']v["']\s*,\s*["'][^"']+["']\)/g, `__u.searchParams.set("v", "${newVersion}")`)
    .replace(/history\.replaceState\(null,\s*["']{0,1}["']{0,1},\s*__u\.toString\(\)\);?/g, 'history.replaceState(null, "", __u.toString());');
}

function sanitizeHtmlVersionLock(text) {
  let out = text;
  out = out.replace(/\n?\s*window\.__TASUN_PAGE_FIXED_VERSION__\s*=\s*["'][^"']+["'];?/g, '');
  out = out.replace(/\n?\s*window\.TASUN_APP_VER\s*=\s*["'][^"']+["'];?/g, '');
  out = out.replace(/\n?\s*window\.APP_VER\s*=\s*["'][^"']+["'];?/g, '');
  out = out.replace(/\n?\s*window\.__CACHE_V\s*=\s*["'][^"']+["'];?/g, '');
  out = out.replace(/<!--\s*✅\s*固定正式版：[\s\S]*?-->/g, '<!-- ✅ 單一版號來源：由 tasun-version-loader.js 統一注入 -->');
  return out;
}

function updateFallbackFiles(newVersion) {
  const changed = [];
  for (const rel of FALLBACK_FILES) {
    if (!exists(rel)) continue;
    let text = read(rel);
    text = sanitizeHtmlVersionLock(text);
    text = replaceAllVersionTokens(text, newVersion);
    if (!/tasun-version-loader\.js/.test(text)) {
      text = text.replace(/<head>/i, `<head>\n  <script src="tasun-version-loader.js?_=${Date.now()}"><\/script>`);
    }
    write(rel, text);
    changed.push(rel);
  }
  return changed;
}

function main() {
  const missing = CONTROLLED_FILES.filter(rel => !exists(rel));
  const present = CONTROLLED_FILES.filter(exists);

  if (!present.length) {
    throw new Error('找不到任何受控檔案，請確認 --root 路徑是否正確。');
  }

  const forbiddenHits = scanForbidden(present);
  if (strict && forbiddenHits.length) {
    console.error('❌ 偵測到禁止殘留版號／硬鎖版本：');
    forbiddenHits.forEach(hit => console.error(`- ${hit.file} :: ${hit.pattern}`));
    console.error('請先清理後再發布，或以 --strict false 暫時放寬。');
    process.exit(1);
  }

  const newVersion = computeVersion(present.filter(rel => rel !== 'tasun-version.json'));
  updateVersionJson(newVersion);
  updateResourcesJson(newVersion);

  let changedFallbacks = [];
  if (writeFallbacks) {
    changedFallbacks = updateFallbackFiles(newVersion);
  }

  const report = {
    ok: true,
    root,
    version: newVersion,
    writeFallbacks,
    controlledFilesFound: present,
    controlledFilesMissing: missing,
    changedFallbacks,
    updated: ['tasun-version.json', exists('tasun-resources.json') ? 'tasun-resources.json' : null].filter(Boolean)
  };

  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (err) {
  console.error(`❌ 發布失敗：${err.message}`);
  process.exit(1);
}
