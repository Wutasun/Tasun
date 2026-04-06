#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const argv = process.argv.slice(2);
const args = new Map();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const key = a.slice(2);
  const next = argv[i + 1];
  if (!next || next.startsWith('--')) args.set(key, 'true');
  else {
    args.set(key, next);
    i++;
  }
}

const ROOT = path.resolve(args.get('root') || '.');
const WRITE_FALLBACKS = String(args.get('write-fallbacks') || 'false').toLowerCase() === 'true';
const ADMIN_RELEASE = String(process.env.ADMIN_RELEASE || '') === '1';

if (!ADMIN_RELEASE) {
  console.error('❌ 拒絕執行：只有 admin 可發布。請用 ADMIN_RELEASE=1 執行。');
  process.exit(1);
}

const CORE_FILES = [
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

const SCAN_EXTS = new Set(['.html', '.js', '.json']);
const EXCLUDE_DIRS = new Set([
  '.git',
  '.github',
  'node_modules',
  'dist',
  'build',
  'archive',
  'archives',
  'backup',
  'backups',
  'tmp',
  'temp',
  '.history',
  '.vscode'
]);

const EXCLUDE_FILE_PATTERNS = [
  /(^|\/)tasun-version\.json$/i, // version file excluded from hash input; written after hash
  /(^|\/)publish-version.*\.mjs$/i,
  /(^|\/)README(\.[^\/]+)?$/i,
  /(^|\/).*\.zip$/i,
  /(^|\/).*\.bak$/i,
  /(^|\/).*\.old$/i,
  /(^|\/).*\.tmp$/i,
  /(^|\/).*_backup.*$/i,
  /(^|\/).*備份.*$/i,
  /(^|\/).*修正版.*$/i,
  /(^|\/).*整包.*$/i,
  /(^|\/).*bundle.*$/i,
];

const FALLBACK_FILES = [
  'entry.html',
  'index.html',
  '汐東工程管理表.html',
  '捷運汐東線事項記錄.html',
  '捷運汐東線權責分工精簡版.html'
];

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readUtf8(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeUtf8(p, content) {
  fs.writeFileSync(p, content, 'utf8');
}

function relUnix(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function shouldExcludeRel(rel) {
  const norm = rel.replace(/\\/g, '/');
  return EXCLUDE_FILE_PATTERNS.some((re) => re.test(norm));
}

function collectAutoFiles(dir, out = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const abs = path.join(dir, item.name);
    const rel = relUnix(abs);
    if (item.isDirectory()) {
      if (EXCLUDE_DIRS.has(item.name)) continue;
      collectAutoFiles(abs, out);
      continue;
    }
    const ext = path.extname(item.name).toLowerCase();
    if (!SCAN_EXTS.has(ext)) continue;
    if (shouldExcludeRel(rel)) continue;
    out.push(rel);
  }
  return out;
}

function uniqueSorted(list) {
  return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

function normalizeForHash(content) {
  return String(content)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^\uFEFF/, '');
}

function todayTW() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function isoOffsetNow() {
  const d = new Date();
  const tzo = -d.getTimezoneOffset();
  const sign = tzo >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(tzo) / 60)).padStart(2, '0');
  const mm = String(Math.abs(tzo) % 60).padStart(2, '0');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}${sign}${hh}:${mm}`;
}

function makeVersion(hash8) {
  return `${todayTW()}_tasun_v5_autoscan_${hash8}`;
}

function hashFiles(relFiles) {
  const h = crypto.createHash('sha256');
  for (const rel of relFiles) {
    const abs = path.join(ROOT, rel);
    if (!exists(abs)) continue;
    h.update(`FILE:${rel}\n`);
    h.update(normalizeForHash(readUtf8(abs)));
    h.update('\n<<<END>>>\n');
  }
  return h.digest('hex').slice(0, 8);
}

function findLegacyLocks(content) {
  const hits = [];
  const checks = [
    /__TASUN_PAGE_FIXED_VERSION__/g,
    /20260405_notes_authfix_v62/g,
    /notes_authfix_v62/g,
    /tasun_v5_syncfix/g,
    /tasun_v5_unified_final/g,
    /window\.APP_VER\s*=\s*["'`][^"'`]+["'`]/g,
    /window\.TASUN_APP_VER\s*=\s*["'`][^"'`]+["'`]/g,
    /window\.__CACHE_V\s*=\s*["'`][^"'`]+["'`]/g
  ];
  for (const re of checks) {
    if (re.test(content)) hits.push(re.source);
  }
  return hits;
}

function rewriteFallbackVersion(content, version) {
  let out = content;
  out = out.replace(/window\.__TASUN_FALLBACK_VER__\s*=\s*window\.__TASUN_FALLBACK_VER__\s*\|\|\s*["'`][^"'`]+["'`]/g,
    `window.__TASUN_FALLBACK_VER__ = window.__TASUN_FALLBACK_VER__ || "${version}"`);
  out = out.replace(/var\s+FALLBACK_VER\s*=\s*["'`][^"'`]+["'`]/g, `var FALLBACK_VER = "${version}"`);
  out = out.replace(/const\s+FALLBACK_VER\s*=\s*["'`][^"'`]+["'`]/g, `const FALLBACK_VER = "${version}"`);
  out = out.replace(/let\s+FALLBACK_VER\s*=\s*["'`][^"'`]+["'`]/g, `let FALLBACK_VER = "${version}"`);
  out = out.replace(/window\.__TASUN_PAGE_FIXED_VERSION__\s*=\s*["'`][^"'`]+["'`];?/g, '');
  out = out.replace(/window\.TASUN_APP_VER\s*=\s*["'`][^"'`]+["'`];?/g, '');
  out = out.replace(/window\.APP_VER\s*=\s*["'`][^"'`]+["'`];?/g, '');
  out = out.replace(/window\.__CACHE_V\s*=\s*["'`][^"'`]+["'`];?/g, '');
  out = out.replace(/\/\/\s*✅\s*固定正式版：[\s\S]*?(?=<meta http-equiv="Cache-Control"|<link href=)/, '');
  return out;
}

function updateVersionJson(versionFile, version, relFiles, hash8) {
  const abs = path.join(ROOT, versionFile);
  let json = {};
  if (exists(abs)) {
    try { json = JSON.parse(readUtf8(abs)); } catch { json = {}; }
  }
  json.app = json.app || 'Tasun';
  json.versionMode = 'auto';
  json.includeCurrentPage = false;
  json.versionSources = relFiles;
  json.manualVersion = version;
  json.fallbackVersion = version;
  json.ver = version;
  json.version = version;
  json.appVer = version;
  json.APP_VER = version;
  json.appVersion = version;
  json.updatedAt = isoOffsetNow();
  json.notes = `Tasun v5 自動掃描新增檔案版：${version} (${hash8})`;
  writeUtf8(abs, JSON.stringify(json, null, 2) + '\n');
}

function updateResourcesJson(resourcesFile, version) {
  const abs = path.join(ROOT, resourcesFile);
  if (!exists(abs)) return false;
  let json = {};
  try { json = JSON.parse(readUtf8(abs)); } catch { return false; }
  json.meta = json.meta && typeof json.meta === 'object' ? json.meta : {};
  json.meta.ver = version;
  json.meta.notes = `Tasun v5 自動掃描新增檔案版 ${version}`;
  writeUtf8(abs, JSON.stringify(json, null, 2) + '\n');
  return true;
}

function main() {
  if (!exists(ROOT)) {
    console.error(`❌ 找不到根目錄：${ROOT}`);
    process.exit(1);
  }

  const autoFiles = collectAutoFiles(ROOT);
  const allFiles = uniqueSorted([...CORE_FILES.filter((f) => exists(path.join(ROOT, f))), ...autoFiles]);

  const legacyProblems = [];
  for (const rel of allFiles) {
    const abs = path.join(ROOT, rel);
    if (!exists(abs)) continue;
    const text = readUtf8(abs);
    const hits = findLegacyLocks(text);
    if (hits.length && !WRITE_FALLBACKS) {
      legacyProblems.push({ file: rel, hits });
    }
  }

  if (legacyProblems.length) {
    console.error('❌ 偵測到手寫固定版號或舊版殘留。請先用 --write-fallbacks true 自動清理：');
    for (const p of legacyProblems) {
      console.error(`- ${p.file}`);
    }
    process.exit(1);
  }

  const hashInputFiles = allFiles.filter((f) => !/^(tasun-version\.json)$/i.test(f));
  const hash8 = hashFiles(hashInputFiles);
  const version = makeVersion(hash8);

  if (WRITE_FALLBACKS) {
    for (const rel of FALLBACK_FILES) {
      const abs = path.join(ROOT, rel);
      if (!exists(abs)) continue;
      const old = readUtf8(abs);
      const next = rewriteFallbackVersion(old, version);
      if (next !== old) writeUtf8(abs, next);
    }
  }

  updateVersionJson('tasun-version.json', version, allFiles, hash8);
  const resourcesUpdated = updateResourcesJson('tasun-resources.json', version);

  const finalHashInputFiles = uniqueSorted([
    ...allFiles.filter((f) => f !== 'tasun-version.json' && f !== 'tasun-resources.json'),
    ...(exists(path.join(ROOT, 'tasun-resources.json')) ? ['tasun-resources.json'] : [])
  ]);
  const finalHash8 = hashFiles(finalHashInputFiles);
  const finalVersion = makeVersion(finalHash8);
  if (finalVersion !== version) {
    if (WRITE_FALLBACKS) {
      for (const rel of FALLBACK_FILES) {
        const abs = path.join(ROOT, rel);
        if (!exists(abs)) continue;
        const old = readUtf8(abs);
        const next = rewriteFallbackVersion(old, finalVersion);
        if (next !== old) writeUtf8(abs, next);
      }
    }
    updateVersionJson('tasun-version.json', finalVersion, allFiles, finalHash8);
    updateResourcesJson('tasun-resources.json', finalVersion);
  }

  const released = finalVersion;
  console.log(JSON.stringify({
    ok: true,
    root: ROOT,
    version: released,
    writeFallbacks: WRITE_FALLBACKS,
    resourcesUpdated,
    scannedCount: allFiles.length,
    scannedFiles: allFiles
  }, null, 2));
}

main();
