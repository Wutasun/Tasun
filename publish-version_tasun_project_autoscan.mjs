#!/usr/bin/env node
/**
 * Tasun v5 自動改版號腳本（GitHub 可直接使用）
 *
 * 功能：
 * 1. 讀取 tasun-version.json
 * 2. 自動掃描專案中的 html/js/json/css/mjs 檔案
 * 3. 產生新版本號（日期 + 專案名 + 流程名 + v流水號）
 * 4. 回寫 tasun-version.json
 * 5. 輸出 GitHub Actions 可讀的 output
 *
 * 使用方式：
 *   node publish-version_tasun_project_autoscan.mjs
 *   node publish-version_tasun_project_autoscan.mjs --mode=release
 *   node publish-version_tasun_project_autoscan.mjs --write-manifest=false
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const VERSION_FILE = path.join(ROOT, 'tasun-version.json');
const TZ = 'Asia/Taipei';
const EXCLUDE_DIRS = new Set([
  '.git',
  '.github',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.vercel',
  '.idea',
  '.vscode',
  'coverage',
  'tmp',
  'temp'
]);
const ALLOW_EXTS = new Set(['.html', '.js', '.json', '.css', '.mjs']);
const OUTPUTS = {};

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const body = raw.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) args[body] = true;
    else args[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function nowInTaipei() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    dateTag: `${map.year}${map.month}${map.day}`,
    iso: `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+08:00`
  };
}

function safeRel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function isAllowedFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (!ALLOW_EXTS.has(ext)) return false;
  const rel = safeRel(file);
  if (rel === 'tasun-version.json') return true;
  if (rel.startsWith('.github/')) return false;
  if (rel.includes('/backup/') || rel.includes('/bak/')) return false;
  if (rel.endsWith('.min.js')) return true;
  return true;
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(ent.name)) continue;
      walk(full, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!isAllowedFile(full)) continue;
    out.push(full);
  }
  return out;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function fileHash(file) {
  return sha256(fs.readFileSync(file));
}

function loadCurrentVersionConfig() {
  if (!fs.existsSync(VERSION_FILE)) {
    throw new Error('找不到 tasun-version.json，請先把此檔放在 repo 根目錄');
  }
  return readJson(VERSION_FILE);
}

function buildVersionBase(config) {
  const app = String(config.app || 'tasun').trim().toLowerCase();
  return `${app}_v5_unified_final`;
}

function parsePreviousVersion(ver) {
  const text = String(ver || '').trim();
  const m = text.match(/^(\d{8})_(.+?)_v(\d+)$/i);
  if (!m) return null;
  return {
    dateTag: m[1],
    stem: m[2],
    seq: Number(m[3] || '0')
  };
}

function buildNextVersion(config, now) {
  const current = String(config.version || config.ver || config.manualVersion || config.fallbackVersion || '').trim();
  const parsed = parsePreviousVersion(current);
  const stem = buildVersionBase(config);
  let nextSeq = 1;
  if (parsed && parsed.stem === stem) {
    nextSeq = parsed.dateTag === now.dateTag ? parsed.seq + 1 : parsed.seq + 1;
  } else if (parsed && parsed.dateTag === now.dateTag) {
    nextSeq = parsed.seq + 1;
  } else if (parsed) {
    nextSeq = parsed.seq + 1;
  }
  return `${now.dateTag}_${stem}_v${nextSeq}`;
}

function getTrackedFiles(config, args) {
  const writeManifest = String(args['write-manifest'] ?? 'true').toLowerCase() !== 'false';
  const autoFiles = walk(ROOT)
    .map(safeRel)
    .filter((file) => file !== '.github/workflows/release-version.yml')
    .filter((file) => file !== 'publish-version_tasun_project_autoscan.mjs')
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  const fixed = Array.isArray(config.versionSources) ? config.versionSources.map(String) : [];
  const merged = Array.from(new Set([...fixed, ...autoFiles]))
    .filter((file) => fs.existsSync(path.join(ROOT, file)))
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  if (writeManifest) {
    config.versionSources = merged;
  }
  return merged;
}

function createManifest(files, version) {
  const manifest = [];
  for (const rel of files) {
    const full = path.join(ROOT, rel);
    const stat = fs.statSync(full);
    manifest.push({
      file: rel,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      sha256: fileHash(full),
      version
    });
  }
  return manifest;
}

function writeOutputs(kv) {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    const lines = [];
    for (const [k, v] of Object.entries(kv)) {
      lines.push(`${k}=${String(v)}`);
    }
    fs.appendFileSync(githubOutput, lines.join('\n') + '\n', 'utf8');
  }
  Object.assign(OUTPUTS, kv);
}

function main() {
  const args = parseArgs(process.argv);
  const now = nowInTaipei();
  const config = loadCurrentVersionConfig();

  const nextVersion = String(args.version || '').trim() || buildNextVersion(config, now);
  const trackedFiles = getTrackedFiles(config, args);
  const manifest = createManifest(trackedFiles, nextVersion);
  const projectHash = sha256(JSON.stringify(manifest.map((m) => [m.file, m.sha256])));

  config.versionMode = 'auto';
  config.manualVersion = nextVersion;
  config.fallbackVersion = nextVersion;
  config.ver = nextVersion;
  config.version = nextVersion;
  config.appVer = nextVersion;
  config.APP_VER = nextVersion;
  config.appVersion = nextVersion;
  config.updatedAt = now.iso;
  config.notes = `Tasun v5 全站自動發布版：${nextVersion}`;
  config.release = Object.assign({}, config.release || {}, {
    mode: 'github-actions',
    branch: process.env.GITHUB_REF_NAME || 'main',
    script: 'publish-version_tasun_project_autoscan.mjs',
    workflow: '.github/workflows/release-version.yml',
    timezone: TZ,
    fileCount: trackedFiles.length,
    projectHash
  });
  config.build = {
    generatedAt: now.iso,
    generatedBy: 'publish-version_tasun_project_autoscan.mjs',
    hash: projectHash,
    fileCount: trackedFiles.length
  };

  writeJson(VERSION_FILE, config);

  const manifestFile = path.join(ROOT, 'tasun-release-manifest.json');
  fs.writeFileSync(manifestFile, JSON.stringify({ version: nextVersion, generatedAt: now.iso, files: manifest }, null, 2) + '\n', 'utf8');

  writeOutputs({
    version: nextVersion,
    updated_at: now.iso,
    file_count: trackedFiles.length,
    manifest_file: 'tasun-release-manifest.json',
    project_hash: projectHash
  });

  console.log(JSON.stringify({
    ok: true,
    version: nextVersion,
    updatedAt: now.iso,
    fileCount: trackedFiles.length,
    manifestFile: 'tasun-release-manifest.json',
    projectHash
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error('[publish-version] 失敗：', error && error.stack ? error.stack : error);
  process.exit(1);
}
