/* tasun-version-loader.js
   全站：開頁/重整 → 抓 tasun-version.json → 強制 ?v=latest → 載入 core/boot（都帶 v）
*/
(function (window, document) {
  "use strict";

  var VERSION_URL = "tasun-version.json";
  var STORE_KEY = "tasun_latest_ver_v1";

  function str(v) { return (v === undefined || v === null) ? "" : String(v); }
  function trim(v) { return str(v).trim(); }

  function withV(url, v) {
    v = trim(v);
    if (!v) return url;
    try {
      var u = new URL(url, document.baseURI);
      if (u.origin === location.origin) {
        u.searchParams.set("v", v);
        return u.toString();
      }
    } catch (e) {}
    return url;
  }

  async function fetchLatestVer() {
    // 加 t=Date.now + cache:no-store，避免被快取
    var r = await fetch(VERSION_URL + "?t=" + Date.now(), { cache: "no-store" });
    var j = await r.json();
    return j && j.ver ? trim(j.ver) : "";
  }

  function addScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  async function main() {
    var url = new URL(location.href);
    var curV = trim(url.searchParams.get("v"));
    var latest = "";

    try { latest = await fetchLatestVer(); } catch (e) {}

    if (!latest) {
      try { latest = trim(localStorage.getItem(STORE_KEY)); } catch (e) {}
    }
    if (!latest) latest = curV || String(Date.now());

    try { localStorage.setItem(STORE_KEY, latest); } catch (e) {}

    // 對外提供：全站版本與 withV
    window.TASUN_APP_VER = latest;
    window.__CACHE_V = latest;
    window.__withV = function (u) { return withV(u, latest); };

    // ✅ 強制網址 v=latest（避免無限跳轉：用 sessionStorage 記一次）
    var loopKey = "tasun_force_v_once__" + location.pathname + "__" + (curV || "none") + "_to_" + latest;
    if (curV !== latest && !sessionStorage.getItem(loopKey)) {
      sessionStorage.setItem(loopKey, "1");
      url.searchParams.set("v", latest);
      location.replace(url.toString());
      return; // 這次就結束，等待跳轉後的新頁面
    }

    // ✅ 載入 core/boot（都帶 v=latest）
    await addScript(withV("tasun-core.js", latest));
    await addScript(withV("tasun-boot.js", latest));

    // ✅ 若頁面有指定額外腳本，也一起帶 v 載入（可選）
    // 用法：window.TASUN_PAGE_SCRIPTS = ["page-x.js","page-y.js"];
    var extra = window.TASUN_PAGE_SCRIPTS;
    if (Array.isArray(extra)) {
      for (var i = 0; i < extra.length; i++) {
        var p = trim(extra[i]);
        if (!p) continue;
        await addScript(withV(p, latest));
      }
    }

    return true;
  }

  // 讓各頁可以等待它完成
  window.__TASUN_READY__ = main();
})(window, document);
