/* token bridge unified 2026-03-27 */
(function(){
  "use strict";

  var VERSION_JSON_URL = "tasun-version.json";
  var CACHE_KEY = "tasun_auto_version_cache_v4";
  var READY_RESOLVE = function(){};
  var READY = new Promise(function(resolve){ READY_RESOLVE = resolve; });
  window.__TASUN_VERSION_READY__ = READY;

  function norm(s){ return (s===undefined || s===null) ? "" : String(s).trim(); }
  function safeJSON(raw){ try{ return JSON.parse(raw); }catch(e){ return null; } }
  function currentBaseName(){
    try{
      var p = location.pathname || "";
      var fn = p.split("/").pop() || "";
      fn = decodeURIComponent(fn || "");
      return fn || "index.html";
    }catch(e){
      return "index.html";
    }
  }
  function unique(arr){
    var out = [], map = Object.create(null);
    (arr || []).forEach(function(v){
      v = norm(v);
      if(!v || map[v]) return;
      map[v] = 1;
      out.push(v);
    });
    return out;
  }
  function addVer(url, ver){
    var vv = norm(ver);
    if(!vv) return url;
    try{
      var u = new URL(url, location.href);
      if(u.origin !== location.origin) return url;
      u.searchParams.set("v", vv);
      return u.pathname + u.search + u.hash;
    }catch(e){
      var s = String(url || "");
      if(!s || /^https?:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
      return s + (s.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(vv);
    }
  }
  function setGlobals(ver){
    ver = norm(ver);
    if(!ver) return;
    window.APP_VER = ver;
    window.TASUN_APP_VER = ver;
    window.__CACHE_V = ver;
    window.__withV = function(href){ return addVer(href, ver); };
  }
  function fnv1a(str){
    str = String(str || "");
    var h = 0x811c9dc5;
    for(var i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = (h + ((h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24))) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  async function fetchTextNoStore(path){
    var url = new URL(path, location.href);
    url.searchParams.set("_", String(Date.now()) + "_" + Math.random().toString(16).slice(2));
    var res = await fetch(url.toString(), { cache:"no-store", credentials:"omit" });
    if(!res.ok) throw new Error(path + ":HTTP " + res.status);
    return await res.text();
  }
  function parseConfig(raw){
    raw = (raw && typeof raw === "object") ? raw : {};
    var fallback = norm(raw.fallbackVersion || raw.manualVersion || raw.appVer || raw.APP_VER || raw.ver || raw.version || raw.appVersion || "") || "20260405_notes_authfix_v61";
    var mode = norm(raw.versionMode || raw.mode || "manual").toLowerCase();
    var sources = [];
    if(Array.isArray(raw.versionSources)) sources = raw.versionSources.slice();
    if(Array.isArray(raw.sources)) sources = sources.concat(raw.sources);
    return {
      mode: mode,
      fallbackVersion: fallback,
      versionSources: unique(sources),
      includeCurrentPage: raw.includeCurrentPage !== false,
      app: norm(raw.app || "Tasun"),
      notes: norm(raw.notes || "")
    };
  }
  function getCurrentUrlVersion(){
    try{ return norm(new URL(location.href).searchParams.get("v")); }catch(e){ return ""; }
  }
  function saveCache(ver, meta){
    try{
      var payload = { ver: norm(ver), at: Date.now(), meta: meta || {} };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    }catch(e){}
  }
  function readCache(){
    var raw = null;
    try{ raw = localStorage.getItem(CACHE_KEY); }catch(e){}
    if(!raw){ try{ raw = sessionStorage.getItem(CACHE_KEY); }catch(e){} }
    var j = safeJSON(raw);
    return (j && typeof j === "object") ? j : null;
  }
  function normalizeSourceList(cfg){
    var list = [];
    if(cfg.includeCurrentPage !== false) list.push(currentBaseName());
    list = list.concat(cfg.versionSources || []);
    if(list.indexOf(VERSION_JSON_URL) < 0) list.push(VERSION_JSON_URL);
    if(list.indexOf("tasun-resources.json") < 0) list.push("tasun-resources.json");
    if(list.indexOf("tasun-version-loader.js") < 0) list.push("tasun-version-loader.js");
    return unique(list);
  }
  async function computeAutoVersion(cfg){
    var sources = normalizeSourceList(cfg);
    var parts = [];
    for(var i=0;i<sources.length;i++){
      var p = sources[i];
      try{
        var text = await fetchTextNoStore(p);
        parts.push(p + "|" + text.length + "|" + fnv1a(text));
      }catch(e){
        parts.push(p + "|ERR|" + fnv1a(String(e && e.message ? e.message : e)));
      }
    }
    var seed = JSON.stringify({ app: cfg.app, mode: cfg.mode, notes: cfg.notes, sources: sources }) + "\n" + parts.join("\n");
    return "auto_" + fnv1a(seed);
  }
  function maybeRedirect(ver){
    ver = norm(ver);
    if(!ver) return;
    try{
      var u = new URL(location.href);
      var cur = norm(u.searchParams.get("v"));
      var manualTs = (cur && /^\d{10,}$/.test(cur) && cur !== ver) ? cur : "";
      var guard = "tasun_auto_ver_guard__" + currentBaseName() + "__" + ver;
      var already = false;
      try{ already = sessionStorage.getItem(guard) === "1"; }catch(e){}
      if((cur !== ver || manualTs) && !already){
        try{ sessionStorage.setItem(guard, "1"); }catch(e){}
        u.searchParams.set("v", ver);
        u.searchParams.set("_", manualTs || String(Date.now()));
        location.replace(u.toString());
      }
    }catch(e){}
  }

  var cached = readCache();
  var initial = norm(getCurrentUrlVersion() || (cached && cached.ver) || "");
  if(initial) setGlobals(initial);
  else if(!window.__withV){
    window.__withV = function(href){
      var cur = norm(window.__CACHE_V || window.TASUN_APP_VER || window.APP_VER || getCurrentUrlVersion() || "");
      return addVer(href, cur);
    };
  }

  (async function(){
    try{
      var raw = safeJSON(await fetchTextNoStore(VERSION_JSON_URL)) || {};
      var cfg = parseConfig(raw);
      var ver = "";
      if(cfg.mode.indexOf("auto") >= 0){
        ver = await computeAutoVersion(cfg);
      }
      if(!ver) ver = cfg.fallbackVersion || initial || "20260405_notes_authfix_v61";
      setGlobals(ver);
      saveCache(ver, { mode: cfg.mode, current: currentBaseName() });
      maybeRedirect(ver);
      READY_RESOLVE(true);
    }catch(e){
      var fallback = initial || "20260405_notes_authfix_v61";
      setGlobals(fallback);
      READY_RESOLVE(true);
    }
  })();
})();
