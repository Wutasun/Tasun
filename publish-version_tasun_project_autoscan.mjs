#!/usr/bin/env node
/**
 * Tasun v5 Auto Version Sync - R379
 *
 * 目的：
 * - 只要正式網頁 / 核心檔推送到 GitHub，即自動同步更新：
 *   1) tasun-version.json
 *   2) TASUN_REBUILD_STAMP
 *   3) HTML 內 tasun-build-stamp meta
 *
 * 正式規則：
 * - tasun-version.json 是唯一正式版號來源。
 * - TASUN_REBUILD_STAMP 只做 rebuild / cache breaker，不放密碼、不放 token。
 * - 不靠瀏覽器寫回 GitHub；由 GitHub Actions 執行本腳本並自動 commit。
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const VERSION_FILE = "tasun-version.json";
const REBUILD_FILE = "TASUN_REBUILD_STAMP";

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  ".cache",
  ".vercel",
  ".wrangler",
]);

const SOURCE_EXTS = new Set([
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".yml",
  ".yaml",
  ".txt",
]);

const DIRECT_SOURCE_FILES = new Set([
  ".github/workflows/release-version.yml",
  "publish-version_tasun_project_autoscan.mjs",
  "tasun-version-loader.js",
  "tasun-core.js",
  "tasun-boot.js",
  "tasun-auth-v4.js",
  "tasun-cloudwrap-v4.js",
  "tasun-guard-v5.js",
  "tasun-global-core.js",
  "tasun-resources.json",
  "worker.js",
]);

const GENERATED_FILES = new Set([
  VERSION_FILE,
  REBUILD_FILE,
]);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function taipeiNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTaipeiBuildDate(d) {
  return [
    d.getUTCFullYear(),
    pad2(d.getUTCMonth() + 1),
    pad2(d.getUTCDate()),
  ].join("");
}

function formatTaipeiIsoText(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+08:00`;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, result = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = toPosix(path.relative(ROOT, full));

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      await walk(full, result);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    const relLower = rel.toLowerCase();

    if (GENERATED_FILES.has(rel)) continue;
    if (relLower.endsWith(".zip")) continue;
    if (relLower.endsWith(".png") || relLower.endsWith(".jpg") || relLower.endsWith(".jpeg") || relLower.endsWith(".webp") || relLower.endsWith(".gif")) continue;
    if (SOURCE_EXTS.has(ext) || DIRECT_SOURCE_FILES.has(rel)) {
      result.push(rel);
    }
  }
  return result.sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

async function sha256File(rel) {
  const buf = await fs.readFile(path.join(ROOT, rel));
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function buildManifest(files) {
  const manifest = {};
  const hash = crypto.createHash("sha256");
  for (const rel of files) {
    const fileHash = await sha256File(rel);
    manifest[rel] = fileHash;
    hash.update(rel);
    hash.update("\0");
    hash.update(fileHash);
    hash.update("\0");
  }
  return { manifest, allHash: hash.digest("hex") };
}

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + "\n";
}

async function readJsonIfExists(rel) {
  const filePath = path.join(ROOT, rel);
  if (!(await exists(filePath))) return {};
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function replaceHtmlMeta(content, name, value) {
  const escapedValue = String(value).replace(/"/g, "&quot;");
  const metaRe = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'][^"']*["']\\s*/?>`, "i");
  const metaTag = `<meta name="${name}" content="${escapedValue}">`;
  if (metaRe.test(content)) return content.replace(metaRe, metaTag);
  if (/<head[^>]*>/i.test(content)) return content.replace(/<head[^>]*>/i, (m) => `${m}\n  ${metaTag}`);
  return `${metaTag}\n${content}`;
}

function replaceLegacyBuildTokens(content, buildStamp) {
  let next = content;

  // 只替換明確 Tasun build token，避免誤改一般文字。
  next = next.replace(/\b20\d{6}_tasun_v5_[A-Za-z0-9_\-]+/g, buildStamp);

  // 常見全域 build 變數。
  next = next.replace(
    /\b(window\.)?(__TASUN_PAGE_BUILD_STAMP__|TASUN_PAGE_BUILD_STAMP|PAGE_BUILD_STAMP|RACI_BUILD_STAMP|TASUN_REBUILD_STAMP|CURRENT_BUILD|BUILD_STAMP)\s*=\s*(['"])[^'"]*\3/g,
    (m, w = "", key, q) => `${w}${key} = ${q}${buildStamp}${q}`
  );

  // 常見 const / let / var build 變數。
  next = next.replace(
    /\b(const|let|var)\s+(BUILD|BUILD_STAMP|PAGE_BUILD_STAMP|RACI_BUILD_STAMP|TASUN_PAGE_BUILD_STAMP)\s*=\s*(['"])[^'"]*\3/g,
    (m, kind, key, q) => `${kind} ${key} = ${q}${buildStamp}${q}`
  );

  return next;
}

async function updateHtmlFiles(files, buildStamp) {
  const htmlFiles = files.filter((rel) => [".html", ".htm"].includes(path.extname(rel).toLowerCase()));
  for (const rel of htmlFiles) {
    const full = path.join(ROOT, rel);
    let content = await fs.readFile(full, "utf8");
    const before = content;

    content = replaceHtmlMeta(content, "tasun-build-stamp", buildStamp);
    content = replaceHtmlMeta(content, "tasun-cache-v", buildStamp);
    content = replaceHtmlMeta(content, "tasun-version-mode", "auto");
    content = replaceLegacyBuildTokens(content, buildStamp);

    if (content !== before) {
      await fs.writeFile(full, content, "utf8");
    }
  }
}

async function updateTextSources(files, buildStamp) {
  const exts = new Set([".js", ".mjs", ".css", ".yml", ".yaml"]);
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    if (!exts.has(ext)) continue;
    const full = path.join(ROOT, rel);
    let content = await fs.readFile(full, "utf8");
    const before = content;
    content = replaceLegacyBuildTokens(content, buildStamp);
    if (content !== before) {
      await fs.writeFile(full, content, "utf8");
    }
  }
}

async function main() {
  const files = await walk(ROOT);
  const { manifest, allHash } = await buildManifest(files);
  const now = taipeiNow();
  const ymd = formatTaipeiBuildDate(now);
  const shortHash = allHash.slice(0, 12);
  const buildStamp = `${ymd}_tasun_v5_auto_${shortHash}`;
  const updatedAt = formatTaipeiIsoText(now);

  await updateHtmlFiles(files, buildStamp);
  await updateTextSources(files, buildStamp);

  // HTML/JS 更新後再算一次來源 hash，讓 tasun-version.json 反映最終內容。
  const finalFiles = await walk(ROOT);
  const finalManifestData = await buildManifest(finalFiles);

  const current = await readJsonIfExists(VERSION_FILE);
  const pageBuildStamp = { ...(current.pageBuildStamp || {}) };
  for (const rel of finalFiles) {
    if ([".html", ".htm"].includes(path.extname(rel).toLowerCase())) {
      pageBuildStamp[rel] = buildStamp;
    }
  }

  const nextVersion = {
    ...current,
    version: buildStamp,
    cacheV: buildStamp,
    buildStamp,
    rebuildStamp: buildStamp,
    updatedAt,
    autoVersionEnabled: true,
    versionMode: "auto",
    includeCurrentPage: true,
    officialVersionSource: "tasun-version.json",
    rebuildStampFile: REBUILD_FILE,
    versionSources: finalFiles,
    sourceHash: finalManifestData.allHash,
    sourceManifest: finalManifestData.manifest,
    pageBuildStamp,
    selfHealChecks: [
      ...new Set([
        ...(Array.isArray(current.selfHealChecks) ? current.selfHealChecks : []),
        "raciR379EveryFormalPageOrCoreUpdateMustSyncTasunVersionJson",
        "raciR379AutoUpdateTasunRebuildStamp",
        "raciR379GitHubActionsAutoCommitVersionFiles",
      ]),
    ],
    release: {
      ...(current.release || {}),
      workflow: ".github/workflows/release-version.yml",
      script: "publish-version_tasun_project_autoscan.mjs",
      autoCommitVersionFiles: true,
      skipCommitToken: "[skip tasun-version]",
      lastAutoSyncAt: updatedAt,
    },
  };

  await fs.writeFile(path.join(ROOT, VERSION_FILE), stableStringify(nextVersion), "utf8");
  await fs.writeFile(path.join(ROOT, REBUILD_FILE), `${buildStamp}\n`, "utf8");

  console.log(`[Tasun R379] synced ${VERSION_FILE} and ${REBUILD_FILE}`);
  console.log(`[Tasun R379] buildStamp=${buildStamp}`);
}

main().catch((err) => {
  console.error("[Tasun R379] auto version sync failed:");
  console.error(err);
  process.exit(1);
});
